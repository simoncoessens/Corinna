"""LangGraph workflow for DSA Service Categorization."""

from __future__ import annotations

import asyncio
import json
import os
import re
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.runnables import RunnableConfig
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph

from service_categorizer.models import Classification, ObligationAnalysis, ComplianceReport
from service_categorizer.obligations import get_obligations_for_classification
from service_categorizer.state import ServiceCategorizerInputState, ServiceCategorizerState


try:
    # Available when running via backend/api (backend added to sys.path there)
    from knowledge_base.dsa_parser import get_article as _get_dsa_article
except Exception:  # pragma: no cover - optional dependency/path at runtime
    _get_dsa_article = None


def _extract_article_point(article_text: str, point: str) -> str | None:
    """Best-effort extract of a numbered point (e.g. '3') from an article body."""
    # Try to match "\n3." ... until next "\n4." (or end)
    pattern = rf"(?:^|\n){re.escape(point)}\.\s.*?(?=(?:\n\d+\.\s)|\Z)"
    m = re.search(pattern, article_text, flags=re.DOTALL)
    return m.group(0).strip() if m else None


def _get_dsa_legal_text(article_ref: int | str) -> dict[str, str] | None:
    """
    Return legal text for an article reference.

    Supports article refs like 11 or "24.3" (best-effort extract of point 3).
    """
    if _get_dsa_article is None:
        return None

    ref_str = str(article_ref).strip()
    base_num = ref_str.split(".", 1)[0]
    chunk = _get_dsa_article(base_num)
    if chunk is None or not getattr(chunk, "content", None):
        return None

    article_text = str(chunk.content)
    result: dict[str, str] = {
        "article_number": base_num,
        "title": str(getattr(chunk, "title", "") or ""),
        "content": article_text,
    }

    # If we have something like "24.3", try to extract point 3 specifically.
    if "." in ref_str:
        _, point = ref_str.split(".", 1)
        point = point.strip()
        if point:
            extracted = _extract_article_point(article_text, point)
            if extracted:
                result["point_number"] = point
                result["point_content"] = extracted

    return result



# =============================================================================
# Prompt Loading
# =============================================================================

PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"

_jinja_env = Environment(
    loader=FileSystemLoader(str(PROMPTS_DIR)),
    trim_blocks=True,
    lstrip_blocks=True,
)


def load_prompt(template_name: str, **kwargs) -> str:
    """Load and render a Jinja2 prompt template."""
    template = _jinja_env.get_template(template_name)
    return template.render(**kwargs)


def _get_model(config: RunnableConfig | None = None) -> ChatOpenAI:
    """Get configured LLM."""
    api_key = None
    base_url = None
    if config:
        api_keys = config.get("configurable", {}).get("apiKeys", {})
        api_key = api_keys.get("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY")
        base_url = api_keys.get("OPENAI_BASE_URL") or os.getenv("OPENAI_BASE_URL")
    else:
        api_key = os.getenv("OPENAI_API_KEY")
        base_url = os.getenv("OPENAI_BASE_URL")
    
    return ChatOpenAI(
        model="deepseek-chat",
        api_key=api_key,
        base_url=base_url,
        max_tokens=2000,
    )


def _parse_json(text: str) -> dict:
    """Extract and parse JSON from text."""
    # Find JSON block
    if "```json" in text:
        start = text.find("```json") + 7
        end = text.find("```", start)
        text = text[start:end]
    elif "```" in text:
        start = text.find("```") + 3
        end = text.find("```", start)
        text = text[start:end]
    
    # Find JSON object
    if "{" in text:
        start = text.find("{")
        end = text.rfind("}") + 1
        text = text[start:end]
    
    return json.loads(text)


# =============================================================================
# Graph Nodes
# =============================================================================

async def extract_profile(
    state: ServiceCategorizerState, config: RunnableConfig | None = None
) -> dict:
    """Extract company profile from input message."""
    messages = state.get("messages", [])
    
    # Get the last human message as company profile
    profile_json = "{}"
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage):
            profile_json = msg.content if isinstance(msg.content, str) else str(msg.content)
            break
    
    try:
        profile = json.loads(profile_json)
    except json.JSONDecodeError:
        profile = {"raw_input": profile_json}
    
    # Extract top_domain and summary_long from state
    top_domain = (state.get("top_domain") or "").strip() or None
    summary_long = (state.get("summary_long") or "").strip() or None
    
    return {
        "company_profile": profile,
        "top_domain": top_domain,
        "summary_long": summary_long,
        "messages": [AIMessage(content=f"Analyzing company profile...")]
    }


async def classify_service(
    state: ServiceCategorizerState, config: RunnableConfig | None = None
) -> dict:
    """Classify the service under DSA framework."""
    profile = state.get("company_profile", {})
    top_domain = state.get("top_domain")
    summary_long = state.get("summary_long")
    model = _get_model(config)
    
    prompt = load_prompt(
        "classify.jinja",
        company_profile=json.dumps(profile, indent=2),
        top_domain=top_domain,
        summary_long=summary_long,
    )
    
    response = await model.ainvoke([HumanMessage(content=prompt)])
    
    try:
        classification = _parse_json(str(response.content))
    except json.JSONDecodeError:
        classification = {
            "territorial_scope": {"is_in_scope": False, "reasoning": "Parse error"},
            "service_classification": {
                "is_intermediary": False,
                "service_category": "Not Applicable",
                "is_online_platform": False,
                "is_marketplace": False,
                "is_search_engine": False,
            },
            "size_designation": {"is_vlop_vlose": False},
            "summary": str(response.content)[:500]
        }
    
    # Get applicable obligations based on classification
    svc = classification.get("service_classification", {})
    size = classification.get("size_designation", {})
    
    obligations = []
    if classification.get("territorial_scope", {}).get("is_in_scope", False):
        # Determine the service category
        # If it's a marketplace, platform, or search engine, use that as the category
        # Otherwise use the base service_category
        service_category = svc.get("service_category", "Not Applicable")
        if svc.get("is_marketplace", False):
            service_category = "Online Marketplace"
        elif svc.get("is_search_engine", False):
            service_category = "Search Engine"
        elif svc.get("is_online_platform", False):
            service_category = "Online Platform"
        
        obligations = get_obligations_for_classification(
            service_category=service_category,
            is_online_platform=svc.get("is_online_platform", False),
            is_marketplace=svc.get("is_marketplace", False),
            is_search_engine=svc.get("is_search_engine", False),
            is_vlop_vlose=size.get("is_vlop_vlose", False),
            is_sme_exemption_eligible=size.get("qualifies_for_sme_exemption", False),
        )
    
    return {
        "classification": classification,
        "obligations": obligations,
        "messages": [AIMessage(content=f"Classification complete. Found {len(obligations)} applicable obligations.")]
    }


async def analyze_obligations(
    state: ServiceCategorizerState, config: RunnableConfig | None = None
) -> dict:
    """Analyze each obligation for the company."""
    profile = state.get("company_profile", {})
    classification = state.get("classification", {})
    obligations = state.get("obligations", [])
    summary_long = state.get("summary_long")
    
    if not obligations:
        return {"obligation_analyses": [], "messages": [AIMessage(content="No obligations to analyze.")]}
    
    model = _get_model(config)
    company_name = profile.get("company_name", "Unknown Company")
    classification_summary = classification.get("summary", "")
    
    async def analyze_one(obl: dict) -> dict:
        # Obligations come with context and key_requirements from YAML.
        # Additionally, fetch the official DSA legal text from knowledge_base/dsa.html.
        legal_text = _get_dsa_legal_text(obl.get("article", ""))
        prompt = load_prompt(
            "obligation.jinja",
            company_profile=json.dumps(profile, indent=2),
            company_name=company_name,
            obligation=obl,
            classification_summary=classification_summary,
            summary_long=summary_long,
            dsa_legal_text=legal_text,
        )
        
        try:
            response = await model.ainvoke([HumanMessage(content=prompt)])
            return _parse_json(str(response.content))
        except Exception as e:
            return {
                "article": str(obl.get("article", "?")),
                "title": obl.get("title", "Unknown"),
                "applies": True,
                "implications": f"Analysis failed: {str(e)[:50]}",
                "action_items": ["Review this article manually"],
            }
    
    # Process in parallel (batches of 5)
    analyses = []
    batch_size = 5
    for i in range(0, len(obligations), batch_size):
        batch = obligations[i:i + batch_size]
        batch_results = await asyncio.gather(*[analyze_one(o) for o in batch])
        analyses.extend(batch_results)
    
    return {
        "obligation_analyses": analyses,
        "messages": [AIMessage(content=f"Analyzed {len(analyses)} obligations.")]
    }


async def generate_report(
    state: ServiceCategorizerState, config: RunnableConfig | None = None
) -> dict:
    """Generate final compliance report."""
    profile = state.get("company_profile", {})
    classification = state.get("classification", {})
    analyses = state.get("obligation_analyses", [])
    
    model = _get_model(config)
    company_name = profile.get("company_name", "Unknown Company")
    
    prompt = load_prompt(
        "summarize.jinja",
        company_name=company_name,
        classification=json.dumps(classification, indent=2),
        obligation_analyses=analyses,
    )
    
    response = await model.ainvoke([HumanMessage(content=prompt)])
    summary = str(response.content)
    
    # Build final report
    report = {
        "company_name": company_name,
        "classification": classification,
        "obligations": analyses,
        "summary": summary,
    }
    
    final_json = json.dumps(report, indent=2)
    
    return {
        "final_report": final_json,
        "messages": [AIMessage(content=final_json)]
    }


# =============================================================================
# Graph Construction
# =============================================================================

_builder = StateGraph(
    ServiceCategorizerState,
    input=ServiceCategorizerInputState,
)

_builder.add_node("extract_profile", extract_profile)
_builder.add_node("classify_service", classify_service)
_builder.add_node("analyze_obligations", analyze_obligations)
_builder.add_node("generate_report", generate_report)

_builder.add_edge(START, "extract_profile")
_builder.add_edge("extract_profile", "classify_service")
_builder.add_edge("classify_service", "analyze_obligations")
_builder.add_edge("analyze_obligations", "generate_report")
_builder.add_edge("generate_report", END)

# Export compiled graph
service_categorizer = _builder.compile()

