"""Main LangGraph workflow for Company Matcher."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

from jinja2 import Environment, FileSystemLoader
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition

from company_matcher.models import CompanyMatch, CompanyMatchResult
from company_matcher.state import CompanyMatcherInputState, CompanyMatcherState

# Import shared Tavily tools from backend/agents/tools.
# (This repo keeps shared tools outside this package, so we add backend/agents to sys.path.)
_AGENTS_PATH = Path(__file__).resolve().parents[3]
if str(_AGENTS_PATH) not in sys.path:
    sys.path.insert(0, str(_AGENTS_PATH))
from tools import tavily_search_tool


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


# =============================================================================
# Tools
# =============================================================================

@tool
async def web_search(queries: list[str], config: RunnableConfig | None = None) -> str:
    """Search the web for company information using multiple queries.
    
    Args:
        queries: List of search queries to execute (max 5)
        config: Runtime configuration
    
    Returns:
        Formatted search results
    """
    return await tavily_search_tool(
        queries=queries[:MAX_QUERIES_PER_CALL],
        max_results=10,
        config=config,
    )


@tool
def finish_matching(result_json: str) -> str:
    """Call this when you have determined the exact match or suggestions.
    
    Args:
        result_json: JSON string with the match result in this format:
        {
          "exact_match": {
            "name": "...",
            "top_domain": "...",
            "confidence": "exact",
            "summary_short": "...",
            "summary_long": "..."
          } OR null,
          "suggestions": [
            {
              "name": "...",
              "top_domain": "...",
              "confidence": "high|medium|low",
              "summary_short": "...",
              "summary_long": "..."
            },
            ...
          ]
        }
    
    Returns:
        Confirmation that matching is complete
    """
    return f"Matching complete: {result_json}"


# =============================================================================
# Graph Nodes
# =============================================================================

# Configuration constants
MAX_ITERATIONS = 1
MAX_SUGGESTIONS = 3
MAX_QUERIES_PER_CALL = 5  # Maximum queries per web_search call


def _extract_company_name(messages: list) -> str:
    """Extract company name from the last human message."""
    for message in reversed(messages):
        if isinstance(message, HumanMessage):
            if isinstance(message.content, str) and message.content.strip():
                return message.content.strip()
    raise ValueError("No company name found. Please provide the company name.")


TOOLS = [web_search, finish_matching]
tool_node = ToolNode(TOOLS)

def _to_top_domain(value: str) -> str:
    """Normalize a URL/domain-ish string into a top-domain hostname."""
    v = (value or "").strip()
    if not v:
        return ""
    # If it's a bare domain without scheme, urlparse puts it in path.
    if "://" not in v:
        v2 = v.split("/")[0]
        return v2.replace("www.", "")
    try:
        host = urlparse(v).hostname or ""
        return host.replace("www.", "")
    except Exception:
        return v.split("/")[0].replace("www.", "")


async def prepare_prompt(
    state: CompanyMatcherState, config: RunnableConfig | None = None
) -> dict:
    """Build the formatted prompt so the agent always starts from the same context."""
    company_name = _extract_company_name(state.get("messages", []))
    country_of_establishment = (state.get("country_of_establishment") or "").strip()
    prompt = load_prompt(
        "prompt.jinja",
        company_name=company_name,
        country_of_establishment=country_of_establishment,
        max_iterations=MAX_ITERATIONS,
        max_suggestions=MAX_SUGGESTIONS,
        max_queries_per_call=MAX_QUERIES_PER_CALL,
    )
    return {
        "company_name": company_name,
        "country_of_establishment": country_of_establishment,
        "messages": [HumanMessage(content=prompt)],
    }


async def run_agent(
    state: CompanyMatcherState, config: RunnableConfig | None = None
) -> dict:
    """LLM step that decides whether to call tools or produce a final answer."""
    api_keys = (config or {}).get("configurable", {}).get("apiKeys", {})
    api_key = api_keys.get("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY")
    base_url = api_keys.get("OPENAI_BASE_URL") or os.getenv("OPENAI_BASE_URL")

    model = ChatOpenAI(
        model="deepseek-chat",
        api_key=api_key,
        base_url=base_url,
        max_tokens=2000,
    ).bind_tools(TOOLS)

    response = await model.ainvoke(state["messages"], config=config)
    return {"messages": [response]}


def _parse_result_from_messages(messages: list[BaseMessage | str]) -> str:
    """Extract the most recent result JSON payload from the conversation.

    Important: the initial prompt includes JSON examples, so we ignore HumanMessages
    and only accept payloads that look like the real output schema.
    """
    for message in reversed(messages):
        if isinstance(message, HumanMessage):
            continue
        content = getattr(message, "content", message)
        if not isinstance(content, str):
            continue
        if "{" not in content:
            continue
        # Heuristic: require the expected keys to avoid parsing the prompt examples.
        if '"exact_match"' not in content or '"suggestions"' not in content:
            continue
        json_start = content.find("{")
        json_end = content.rfind("}") + 1
        candidate = content[json_start:json_end]
        try:
            json.loads(candidate)
        except json.JSONDecodeError:
            continue
        return candidate
    return "{}"


async def finalize_result(
    state: CompanyMatcherState, config: RunnableConfig | None = None
) -> dict:
    """Normalize the agent output to the expected CompanyMatchResult."""
    company_name = state.get("company_name", "")
    raw_json = _parse_result_from_messages(state.get("messages", []))

    try:
        parsed = json.loads(raw_json)
    except json.JSONDecodeError:
        parsed = {"exact_match": None, "suggestions": []}

    def _normalize_match_dict(d: dict) -> dict:
        # Accept legacy "url" and convert to top_domain if needed.
        if not d.get("top_domain"):
            if d.get("url"):
                d["top_domain"] = _to_top_domain(str(d.get("url")))
            elif d.get("domain"):
                d["top_domain"] = _to_top_domain(str(d.get("domain")))

        # Accept legacy "description" while preferring summary_short/summary_long.
        if not d.get("summary_short") and d.get("description"):
            d["summary_short"] = d["description"]

        # Accept a few common "long summary" aliases.
        if not d.get("summary_long"):
            for key in (
                "extended_summary",
                "summary_extended",
                "long_summary",
                "description_long",
                "description_extended",
            ):
                if d.get(key):
                    d["summary_long"] = d[key]
                    break

        # summary_long is required by the API schema; if the model didn't provide it,
        # fall back to whatever short summary we have so parsing never crashes.
        if not d.get("summary_long"):
            d["summary_long"] = d.get("summary_short") or d.get("description") or ""
        return d

    exact_match = None
    if parsed.get("exact_match"):
        exact_match = CompanyMatch(**_normalize_match_dict(parsed["exact_match"]))

    suggestions = [
        CompanyMatch(**_normalize_match_dict(s)) for s in parsed.get("suggestions", [])
    ]

    result = CompanyMatchResult(
        input_name=company_name or "Unknown",
        exact_match=exact_match,
        suggestions=suggestions,
    )

    json_output = result.to_json()
    return {
        "company_name": company_name,
        "match_result": json_output,
        "messages": [AIMessage(content=json_output)],
    }


# =============================================================================
# Graph Construction
# =============================================================================

_builder = StateGraph(
    CompanyMatcherState,
    input=CompanyMatcherInputState,
)

_builder.add_node("prepare_prompt", prepare_prompt)
_builder.add_node("agent", run_agent)
_builder.add_node("tools", tool_node)
_builder.add_node("finalize", finalize_result)

_builder.add_edge(START, "prepare_prompt")
_builder.add_edge("prepare_prompt", "agent")
_builder.add_conditional_edges(
    "agent",
    tools_condition,
    {
        "tools": "tools",
        END: "finalize",
    },
)
_builder.add_edge("tools", "agent")
_builder.add_edge("finalize", END)

# Export the compiled graph
company_matcher = _builder.compile()
