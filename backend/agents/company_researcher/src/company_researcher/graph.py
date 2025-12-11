"""Main LangGraph workflow for Company Researcher."""

from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import List, Literal

from jinja2 import Environment, FileSystemLoader
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.types import Send

from company_researcher.configuration import Configuration
from company_researcher.csv_parser import parse_subquestions_from_csv
from company_researcher.models import (
    CompanyResearchResult,
    SubQuestion,
    SubQuestionAnswer,
)
from company_researcher.researcher import get_research_tools
from company_researcher.state import (
    CompanyResearchInputState,
    CompanyResearchState,
    QuestionResearchState,
)
from company_researcher.utils import get_api_key_for_model


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
# Subgraph Nodes (Single Question Research)
# =============================================================================

async def research_agent(
    state: QuestionResearchState, config: RunnableConfig | None = None
) -> dict:
    """Agent node that decides to search or finish."""
    cfg = Configuration.from_runnable_config(config) if config else Configuration()
    
    # Get model params
    model_name = cfg.research_model.replace("openai:", "") if cfg.research_model.startswith("openai:") else cfg.research_model
    api_key = get_api_key_for_model(cfg.research_model, config)
    base_url = None
    if config:
        api_keys = config.get("configurable", {}).get("apiKeys", {})
        base_url = api_keys.get("OPENAI_BASE_URL") or os.getenv("OPENAI_BASE_URL")
    else:
        base_url = os.getenv("OPENAI_BASE_URL")
    
    model_params = {
        "model": model_name,
        "max_tokens": cfg.research_model_max_tokens,
    }
    if api_key:
        model_params["api_key"] = api_key
    if base_url:
        model_params["base_url"] = base_url
    
    model = ChatOpenAI(**model_params)
    tools = get_research_tools()
    model_with_tools = model.bind_tools(tools)
    
    # Prepare messages
    messages = state.get("messages", [])
    if not messages:
        # Build short legal context from relevant_articles for this sub-question
        articles = state.get("relevant_articles") or []
        short_refs: list[str] = []
        for ref in articles[:2]:
            # Normalise whitespace and truncate to keep prompt compact
            snippet = " ".join(str(ref).strip().splitlines())[:400]
            if snippet:
                short_refs.append(snippet)
        legal_context = "\n".join(short_refs) if short_refs else ""

        # Initial prompt
        prompt = load_prompt(
            "researcher.jinja",
            company_name=state["company_name"],
            question=state["question"],
            section=state.get("section"),
            legal_context=legal_context or None,
            rationale=state.get("rationale"),
            max_iterations=cfg.max_research_iterations,
        )
        messages = [HumanMessage(content=prompt)]
    
    response = await model_with_tools.ainvoke(messages)
    return {"messages": [response]}


async def summarize_research(
    state: QuestionResearchState, config: RunnableConfig | None = None
) -> dict:
    """Summarize the research trace into a final answer."""
    # Extract trace from message history
    messages = state.get("messages", [])
    trace_parts = []
    
    final_summary_tool_arg = ""
    
    for msg in messages:
        if isinstance(msg, (AIMessage, ToolMessage)):
            trace_parts.append(str(msg.content))
            # Look for finish_research tool call to get the proposed summary
            if isinstance(msg, AIMessage) and msg.tool_calls:
                 for tc in msg.tool_calls:
                     if tc["name"] == "finish_research":
                         final_summary_tool_arg = tc["args"].get("summary", "")
        elif isinstance(msg, HumanMessage):
             # Skip the big system prompt in trace to save tokens, or include if needed.
             # Including just the content.
             trace_parts.append(str(msg.content))

    raw_output = "\n\n".join(trace_parts)
    if final_summary_tool_arg:
        raw_output += f"\n\nFINAL AGENT SUMMARY: {final_summary_tool_arg}"

    try:
        cfg = Configuration.from_runnable_config(config) if config else Configuration()
        
        model_name = cfg.summarization_model.replace("openai:", "") if cfg.summarization_model.startswith("openai:") else cfg.summarization_model
        api_key = get_api_key_for_model(cfg.summarization_model, config)
        base_url = None
        if config:
            api_keys = config.get("configurable", {}).get("apiKeys", {})
            base_url = api_keys.get("OPENAI_BASE_URL") or os.getenv("OPENAI_BASE_URL")
        else:
            base_url = os.getenv("OPENAI_BASE_URL")
        
        model_params = {
            "model": model_name,
            "max_tokens": 500,
        }
        if api_key:
            model_params["api_key"] = api_key
        if base_url:
            model_params["base_url"] = base_url
        
        model = ChatOpenAI(**model_params)
        
        prompt = load_prompt(
            "summarize.jinja",
            company_name=state["company_name"],
            question=state["question"],
            raw_output=raw_output[:400000],
        )
        
        response = await model.ainvoke([HumanMessage(content=prompt)])
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
        
        result_obj = SubQuestionAnswer(
            section=state["section"],
            question=state["question"],
            answer=answer,
            source=source,
            confidence=confidence,
            raw_research=raw_output,
        )
        
        # We need to return the answer to the PARENT graph
        # LangGraph subgraphs don't write directly to parent state unless we return it
        # BUT, when called via Send/node, the return value of the compiled graph is what matters?
        # Actually, we need to return a dict that matches the parent state schema for reduction?
        # No, Send("node_name", input) -> node execution.
        # If node is a compiled graph, its output is its final state.
        # We need a way to bubble up the 'completed_answers' to the main state.
        
        # Since this node is the last in the subgraph, its output is part of the subgraph's final state.
        # However, to merge into the main state's `completed_answers`, we need the main graph to handle it.
        # The main graph's `Send` mechanism will collect results?
        # No, `Send` just spawns tasks. They write to the shared state? 
        # Standard pattern: The subgraph returns a state update that is compatible with the parent?
        # OR: We just define `completed_answers` in `QuestionResearchState`?
        # No, `QuestionResearchState` is local.
        
        # Correct approach: The `research_subgraph` output should contain `completed_answers`.
        # So we add `completed_answers` to `QuestionResearchState` just for transport?
        # Or we rely on the node wrapper in the main graph to format it.
        
        return {
            "research_summary": response_text
        }
        
    except Exception as e:
        return {"research_summary": f"Error: {str(e)}"}


# =============================================================================
# Main Graph Nodes
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
    company_name = state.get("company_name")
    if not company_name:
        company_name = _extract_company_name(state.get("messages", []))
    
    subquestions = parse_subquestions_from_csv()

    return {
        "company_name": company_name,
        "subquestions": {"type": "override", "value": [sq.model_dump() for sq in subquestions]},
        "completed_answers": {"type": "override", "value": []},
        "messages": [AIMessage(content=f"Starting DSA research for: {company_name}\n\nResearching {len(subquestions)} questions with parallel agents...")]
    }


def dispatch_research(state: CompanyResearchState) -> List[Send]:
    """Map step: dispatch a research subgraph for each question."""
    subquestions = state.get("subquestions", [])
    company_name = state.get("company_name", "Unknown")
    
    return [
        Send(
            "research_question",
            {
                "question": sq["question"],
                "section": sq["section"],
                "relevant_articles": sq.get("relevant_articles", []),
                "rationale": sq.get("rationale"),
                "company_name": company_name,
                "messages": []
            }
        )
        for sq in subquestions
    ]


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


# Wrapper to format subgraph output for the main state
def format_subgraph_output(state: QuestionResearchState) -> dict:
    """Take the final state of the subgraph and format it for the main graph reducer."""
    # We need to reconstruct the SubQuestionAnswer from the subgraph state
    # But wait, `summarize_research` created it but didn't return it in a way we can easily grab?
    # Let's modify `summarize_research` to put the dictionary in a specific key.
    
    # Actually, better pattern: `summarize_research` returns a dict that *looks* like a partial update for the main state?
    # No, the subgraph state is isolated.
    # We need to bridge the gap.
    
    # Let's parse the `research_summary` or `messages` to rebuild the answer object?
    # Or just have `summarize_research` return a special key "answer_dict" in the subgraph state.
    pass # Implemented below in graph construction


async def research_summarizer_wrapper(state: QuestionResearchState, config: RunnableConfig | None = None):
    """Last node of subgraph: generates summary AND formats it for parent state."""
    # Run the summarization logic
    res = await summarize_research(state, config)
    
    # Re-extract the structured answer from the logic (duplicated for now, or refactor)
    # To avoid duplication, let's look at `summarize_research` again.
    # It builds `result_obj`. We should store `result_obj.model_dump()` in the state.
    
    # Hack: Let's make `summarize_research` return `{"completed_answers": [result_obj.model_dump()]}`?
    # If the subgraph state has `completed_answers` (local), it works.
    # But `QuestionResearchState` doesn't have it.
    # Let's add it to `QuestionResearchState`? No, it's specific to the parent.
    
    # We will modify `summarize_research` to return the dict directly, 
    # and we will use a "Write" node at the end of subgraph to output to parent?
    # LangGraph `Send` outputs are merged to parent state if the node definition matches?
    # No, `Send` invokes a node/graph. The return value of that invocation is merged.
    # If the invocation is a Graph, the return value is the final state of that Graph.
    # So `QuestionResearchState` needs to contain the data we want to bubble up.
    # But `QuestionResearchState` fields (question, section, etc) might clash or not match `CompanyResearchState`.
    
    # Solution: The output of the subgraph is `QuestionResearchState`.
    # The parent `CompanyResearchState` has `completed_answers`.
    # We need a way to map `QuestionResearchState` -> `CompanyResearchState` update.
    # This is usually done by ensuring the subgraph state has the same key, OR by using a wrapper node in the main graph that calls the subgraph.
    # But `Send` goes directly to the node/graph.
    
    # Best way: Add `completed_answers` to `QuestionResearchState`.
    # The subgraph writes to it. 
    # When subgraph finishes, it returns `QuestionResearchState`.
    # The parent merges this. Since `completed_answers` matches, it gets appended.
    # `question` and `section` in `QuestionResearchState` might overwrite parent? 
    # `CompanyResearchState` doesn't have `question` (scalar), it has `subquestions` (list). So no clash.
    pass

# =============================================================================
# Graph Construction
# =============================================================================

# 1. Build Subgraph
sub_builder = StateGraph(QuestionResearchState)
sub_builder.add_node("agent", research_agent)
tools = get_research_tools()
tool_node = ToolNode(tools)
sub_builder.add_node("tools", tool_node)

# We need a specialized summarizer that outputs `completed_answers`
async def summarize_and_format(state: QuestionResearchState, config: RunnableConfig | None = None) -> dict:
    # Run summarization (reuse logic from above, but we need the actual object)
    # Copy-paste logic for safety and modification
    messages = state.get("messages", [])
    trace_parts = []
    final_summary_tool_arg = ""
    for msg in messages:
        if isinstance(msg, (AIMessage, ToolMessage)):
            trace_parts.append(str(msg.content))
            if isinstance(msg, AIMessage) and msg.tool_calls:
                 for tc in msg.tool_calls:
                     if tc["name"] == "finish_research":
                         final_summary_tool_arg = tc["args"].get("summary", "")
        elif isinstance(msg, HumanMessage):
             trace_parts.append(str(msg.content))

    raw_output = "\n\n".join(trace_parts)
    if final_summary_tool_arg:
        raw_output += f"\n\nFINAL AGENT SUMMARY: {final_summary_tool_arg}"

    cfg = Configuration.from_runnable_config(config) if config else Configuration()
    # ... (Model setup same as above) ...
    model_name = cfg.summarization_model.replace("openai:", "") if cfg.summarization_model.startswith("openai:") else cfg.summarization_model
    api_key = get_api_key_for_model(cfg.summarization_model, config)
    base_url = None
    if config:
        api_keys = config.get("configurable", {}).get("apiKeys", {})
        base_url = api_keys.get("OPENAI_BASE_URL") or os.getenv("OPENAI_BASE_URL")
    else:
        base_url = os.getenv("OPENAI_BASE_URL")
    
    model = ChatOpenAI(model=model_name, api_key=api_key, base_url=base_url, max_tokens=500)
    
    prompt = load_prompt(
        "summarize.jinja",
        company_name=state["company_name"],
        question=state["question"],
        raw_output=raw_output[:400000],
    )
    
    try:
        response = await model.ainvoke([HumanMessage(content=prompt)])
        response_text = str(response.content)
    except Exception as e:
        response_text = f"Error: {e}"

    # Parse (simplified)
    answer = "Unable to determine"
    source = "Unknown"
    confidence = "Low"
    for line in response_text.split('\n'):
        if line.strip().upper().startswith("ANSWER:"):
            answer = line.strip().split(":", 1)[1].strip()
        elif line.strip().upper().startswith("SOURCE:"):
            source = line.strip().split(":", 1)[1].strip()
        elif line.strip().upper().startswith("CONFIDENCE:"):
            confidence = line.strip().split(":", 1)[1].strip()

    result = SubQuestionAnswer(
        section=state["section"],
        question=state["question"],
        answer=answer,
        source=source,
        confidence=confidence,
        raw_research=raw_output,
    )
    
    # Return formatted for parent merge
    return {
        "research_summary": response_text,
        "completed_answers": [result.model_dump()]  # This key must exist in parent state
    }

sub_builder.add_node("summarize", summarize_and_format)

sub_builder.add_edge(START, "agent")
sub_builder.add_conditional_edges("agent", tools_condition, {"tools": "tools", END: "summarize"})
sub_builder.add_edge("tools", "agent")
sub_builder.add_edge("summarize", END)

research_subgraph = sub_builder.compile()


# 2. Build Main Graph
_builder = StateGraph(
    CompanyResearchState,
    input=CompanyResearchInputState,
    config_schema=Configuration,
)

_builder.add_node("prepare_research", prepare_research)
# Add the compiled subgraph as a node
_builder.add_node("research_question", research_subgraph)
_builder.add_node("finalize_report", finalize_report)

_builder.add_edge(START, "prepare_research")
# Use Send to fan out
_builder.add_conditional_edges("prepare_research", dispatch_research, ["research_question"])
# Fan in: After research_question completes (all branches), go to finalize
# Note: In current LangGraph, parallel branches join at the next step automatically if configured?
# Actually, Send creates a map-reduce. We need a way to collect.
# The `finalize_report` should be the destination.
# However, `dispatch_research` returns `Send`. The destination is `research_question`.
# Where does `research_question` go?
# We need to wire `research_question` to `finalize_report`.
_builder.add_edge("research_question", "finalize_report")
_builder.add_edge("finalize_report", END)

# Export
company_researcher = _builder.compile()
