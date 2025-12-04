"""Main LangGraph workflow for Company Researcher."""

from __future__ import annotations

import asyncio
from typing import List

from langchain.chat_models import init_chat_model
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, StateGraph

from company_researcher.configuration import Configuration
from company_researcher.csv_parser import parse_subquestions_from_csv
from company_researcher.models import (
    CompanyResearchResult,
    SubQuestion,
    SubQuestionAnswer,
)
from company_researcher.researcher import run_researcher
from company_researcher.state import CompanyResearchInputState, CompanyResearchState
from company_researcher.utils import get_api_key_for_model


# Initialize configurable model for summarization
_configurable_model = init_chat_model(
    configurable_fields=("model", "max_tokens", "api_key"),
    streaming=True,  # Enable streaming for token callbacks
)


# =============================================================================
# Summarization
# =============================================================================

SUMMARIZE_PROMPT = """Extract a clean answer from this research output.

COMPANY: {company_name}
QUESTION: {question}

RESEARCH OUTPUT:
{raw_output}

Respond in EXACTLY this format:
ANSWER: [1-2 sentences with specific facts. Say "Information not publicly available" if not found.]
SOURCE: [Main source domain, e.g., "company.com". Say "N/A" if unknown.]
CONFIDENCE: [High/Medium/Low]"""


async def _summarize_research(
    raw_output: str,
    question: str,
    section: str,
    company_name: str,
    config: RunnableConfig | None,
) -> SubQuestionAnswer:
    """Summarize raw research output into a clean answer."""
    
    if not raw_output or len(raw_output) < 20:
        return SubQuestionAnswer(
            section=section,
            question=question,
            answer="Research did not return results.",
            source="N/A",
            confidence="Low",
            raw_research=raw_output,
        )

    try:
        cfg = Configuration.from_runnable_config(config) if config else Configuration()
        
        model_config = {
            "model": cfg.summarization_model,
            "max_tokens": 500,
            "api_key": get_api_key_for_model(cfg.summarization_model, config),
        }
        
        model = _configurable_model.with_config(model_config)
        
        # Allow much more context for summarization while keeping a hard cap.
        # DeepSeek V3.2 supports ~128K tokens; we approximate this as ~400K characters.
        prompt = SUMMARIZE_PROMPT.format(
            company_name=company_name,
            question=question,
            raw_output=raw_output[:400000],
        )
        
        # Pass through config so external callbacks (for streaming) are respected
        response = await model.ainvoke([HumanMessage(content=prompt)], config=config)
        response_text = str(response.content)
        
        # Parse response
        answer = "Unable to determine"
        source = "Unknown"
        confidence = "Low"
        
        for line in response_text.split('\n'):
            line_clean = line.strip()
            if line_clean.upper().startswith("ANSWER:"):
                answer = line_clean.split(":", 1)[1].strip() if ":" in line_clean else answer
            elif line_clean.upper().startswith("SOURCE:"):
                source = line_clean.split(":", 1)[1].strip() if ":" in line_clean else source
            elif line_clean.upper().startswith("CONFIDENCE:"):
                confidence = line_clean.split(":", 1)[1].strip() if ":" in line_clean else confidence
        
        return SubQuestionAnswer(
            section=section,
            question=question,
            answer=answer,
            source=source,
            confidence=confidence,
            raw_research=raw_output,
        )
        
    except Exception as e:
        return SubQuestionAnswer(
            section=section,
            question=question,
            answer=f"Summarization failed: {str(e)[:50]}",
            source="Error",
            confidence="Low",
            raw_research=raw_output,
        )


# =============================================================================
# Graph Nodes
# =============================================================================

def _extract_company_name(messages: list) -> str:
    """Extract company name from the last human message."""
    for message in reversed(messages):
        if isinstance(message, HumanMessage):
            if isinstance(message.content, str) and message.content.strip():
                return message.content.strip()
    raise ValueError("No company name found. Please provide the company name.")


async def prepare_research(
    state: CompanyResearchState, config: RunnableConfig | None = None
) -> dict:
    """Node 1: Extract company name and load sub-questions from CSV."""
    company_name = _extract_company_name(state.get("messages", []))
    subquestions = parse_subquestions_from_csv()

    return {
        "company_name": company_name,
        "subquestions": {"type": "override", "value": [sq.model_dump() for sq in subquestions]},
        "completed_answers": {"type": "override", "value": []},
        "messages": [AIMessage(content=f"Starting DSA research for: {company_name}\n\nResearching {len(subquestions)} questions with parallel agents...")]
    }


async def run_parallel_research(
    state: CompanyResearchState, config: RunnableConfig | None = None
) -> dict:
    """Node 2: Run parallel research agents for each sub-question."""
    company_name = state.get("company_name", "Unknown")
    subquestions_raw = state.get("subquestions", [])

    if not subquestions_raw:
        return {"completed_answers": {"type": "override", "value": []}}

    cfg = Configuration.from_runnable_config(config) if config else Configuration()
    subquestions = [SubQuestion(**sq) for sq in subquestions_raw]
    
    async def research_and_summarize(sq: SubQuestion) -> SubQuestionAnswer:
        """Run researcher agent and summarize results."""
        try:
            # Run the researcher agent (with tool calling)
            raw_output = await run_researcher(
                question=sq.question,
                company_name=company_name,
                config=config,
            )
            
            # Summarize into clean answer
            return await _summarize_research(
                raw_output=raw_output,
                question=sq.question,
                section=sq.section,
                company_name=company_name,
                config=config,
            )
            
        except Exception as e:
            return SubQuestionAnswer(
                section=sq.section,
                question=sq.question,
                answer=f"Research failed: {str(e)[:80]}",
                source="Error",
                confidence="Low",
            )
    
    # Process in batches for controlled parallelism
    answers: List[SubQuestionAnswer] = []
    batch_size = cfg.max_concurrent_research
    
    for i in range(0, len(subquestions), batch_size):
        batch = subquestions[i:i + batch_size]
        batch_results = await asyncio.gather(*[
            research_and_summarize(sq) for sq in batch
        ])
        answers.extend(batch_results)

    return {
        "completed_answers": {"type": "override", "value": [a.model_dump() for a in answers]},
        "messages": [AIMessage(content=f"Completed research on {len(answers)} questions.")]
    }


async def finalize_report(
    state: CompanyResearchState, config: RunnableConfig | None = None
) -> dict:
    """Node 3: Compile all answers into final JSON report."""
    answers = [SubQuestionAnswer(**a) for a in state.get("completed_answers", [])]
    company_name = state.get("company_name", "Unknown")

    result = CompanyResearchResult(
        company_name=company_name,
        answers=answers,
    )
    json_payload = result.to_json()

    return {
        "final_report": json_payload,
        "messages": [AIMessage(content=json_payload)],
    }


# =============================================================================
# Graph Construction
# =============================================================================

_builder = StateGraph(
    CompanyResearchState,
    input=CompanyResearchInputState,
    config_schema=Configuration,
)

_builder.add_node("prepare_research", prepare_research)
_builder.add_node("run_parallel_research", run_parallel_research)
_builder.add_node("finalize_report", finalize_report)

_builder.add_edge(START, "prepare_research")
_builder.add_edge("prepare_research", "run_parallel_research")
_builder.add_edge("run_parallel_research", "finalize_report")
_builder.add_edge("finalize_report", END)

# Export the compiled graph
company_researcher = _builder.compile()
