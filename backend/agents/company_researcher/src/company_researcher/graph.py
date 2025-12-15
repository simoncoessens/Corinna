"""Main LangGraph workflow for Company Researcher."""

from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import List, Literal
from urllib.parse import urlparse
import re

from jinja2 import Environment, FileSystemLoader
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode
from langgraph.types import Send

from company_researcher.configuration import Configuration
from company_researcher.models import (
    CompanyResearchResult,
    SubQuestion,
    SubQuestionAnswer,
)
from company_researcher.question_loader import load_subquestions_from_templates
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


def _infer_source_domain(raw_output: str, top_domain: str | None = None) -> str:
    """
    Best-effort source inference from the research trace.

    The LLM sometimes returns SOURCE: N/A even when the trace contains URLs.
    We prefer the known `top_domain` when it appears, otherwise fall back to the
    most common hostname found in the trace.
    """
    text = raw_output or ""
    if not text.strip():
        return "Unknown"

    # Extract URLs (handles both real newlines and escaped \\n sequences).
    urls = re.findall(r"https?://[^\\s\\n]+", text)
    if not urls:
        return (top_domain or "").strip() or "Unknown"

    def clean_url(u: str) -> str:
        u = (u or "").strip()
        # Remove literal escape sequences that sometimes appear in repr() strings.
        u = u.replace("\\n", "").replace("\\t", "")
        # Strip common trailing punctuation.
        u = u.rstrip(").,;]}>\"'")
        return u

    host_counts: dict[str, int] = {}
    cleaned_urls: list[str] = []
    for u in urls:
        cu = clean_url(u)
        if not cu:
            continue
        cleaned_urls.append(cu)
        try:
            host = urlparse(cu).hostname or ""
        except Exception:
            host = ""
        host = host.replace("www.", "").strip().lower()
        if host:
            host_counts[host] = host_counts.get(host, 0) + 1

    if not host_counts:
        return (top_domain or "").strip() or "Unknown"

    td = (top_domain or "").strip().lower().replace("www.", "")
    if td and any(td in h or h in td for h in host_counts.keys()):
        return td

    # Pick most common domain.
    return max(host_counts.items(), key=lambda kv: kv[1])[0]


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
        # Initial prompt: each sub-question has its own dedicated template
        prompt = load_prompt(
            state["prompt_template"],
            company_name=state["company_name"],
            top_domain=state.get("top_domain"),
            summary_long=state.get("summary_long"),
            max_iterations=cfg.max_research_iterations,
        )

        messages = [HumanMessage(content=prompt)]
    
    # Check if this is the last iteration and warn the model
    iterations = state.get("iterations", 0)
    max_iterations = cfg.max_research_iterations
    if iterations >= max_iterations - 1:
        # This is the last allowed iteration - warn the model
        warning_message = (
            f"\n\n⚠️ CRITICAL: This is your LAST iteration (iteration {iterations + 1} of {max_iterations}). "
            f"You MUST call finish_research with your final answer now. "
            f"Do NOT make any more web_search calls. Use the information you have gathered and call finish_research immediately."
        )
        messages.append(HumanMessage(content=warning_message))
    
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
        }
        if api_key:
            model_params["api_key"] = api_key
        if base_url:
            model_params["base_url"] = base_url
        
        model = ChatOpenAI(**model_params)
        
        prompt = load_prompt(
            "summarize.jinja",
            company_name=state["company_name"],
            top_domain=state.get("top_domain"),
            summary_long=state.get("summary_long"),
            question=state["question"],
            raw_output=raw_output,  # Full context - 128k context window available
        )
        
        # summarization has no tool calls, but keep helper consistent in case
        # upstream message lists include assistant tool-call messages.
        response = await model.ainvoke([HumanMessage(content=prompt)])
        response_text = str(response.content)
        
        # Parse response
        answer = "Unable to determine"
        source = "Unknown"
        confidence = "Low"
        information_found: bool | None = None
        
        for line in response_text.split('\n'):
            line_clean = line.strip()
            upper = line_clean.upper()
            if upper.startswith("INFORMATION_FOUND:"):
                raw_val = line_clean.split(":", 1)[1].strip() if ":" in line_clean else ""
                norm = re.sub(r"[\s_\-]+", "", raw_val.lower())
                if norm in {"yes", "y", "true", "1", "found"}:
                    information_found = True
                elif norm in {"no", "n", "false", "0", "notfound"}:
                    information_found = False
            elif upper.startswith("ANSWER:"):
                answer = line_clean.split(":", 1)[1].strip() if ":" in line_clean else answer
            elif upper.startswith("SOURCE:"):
                source = line_clean.split(":", 1)[1].strip() if ":" in line_clean else source
            elif upper.startswith("CONFIDENCE:"):
                confidence = line_clean.split(":", 1)[1].strip() if ":" in line_clean else confidence

        # Backward compatible fallback if the new field isn't present.
        if information_found is None:
            information_found = answer.strip().lower() != "information not publicly available"

        # Normalize the explicit "no information found" case.
        if information_found is False:
            answer = "Information not publicly available"
            source = "N/A"
            confidence = "Low"
        
        result_obj = SubQuestionAnswer(
            section=state["section"],
            question=state["question"],
            answer=answer,
            information_found=information_found,
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
    """Node 1: Extract company name and load sub-questions from templates."""
    company_name = state.get("company_name")
    if not company_name:
        company_name = _extract_company_name(state.get("messages", []))

    top_domain = (state.get("top_domain") or "").strip()
    summary_long = (state.get("summary_long") or "").strip()
    
    subquestions = load_subquestions_from_templates()

    return {
        "company_name": company_name,
        "top_domain": top_domain,
        "summary_long": summary_long,
        "subquestions": {"type": "override", "value": [sq.model_dump() for sq in subquestions]},
        "completed_answers": {"type": "override", "value": []},
        "messages": [AIMessage(content=f"Starting DSA research for: {company_name}\n\nResearching {len(subquestions)} questions with parallel agents...")]
    }


def dispatch_research(state: CompanyResearchState) -> List[Send]:
    """Map step: dispatch a research subgraph for each question."""
    subquestions = state.get("subquestions", [])
    company_name = state.get("company_name", "Unknown")
    top_domain = (state.get("top_domain") or "").strip() or None
    summary_long = (state.get("summary_long") or "").strip() or None
    
    return [
        Send(
            "research_question",
            {
                "question": sq["question"],
                "section": sq["section"],
                "prompt_template": sq.get("template_name") or f"questions/q{i:02d}.jinja",
                "company_name": company_name,
                "top_domain": top_domain,
                "summary_long": summary_long,
                "messages": [],
                "iterations": 0  # Initialize iteration counter
            }
        )
        for i, sq in enumerate(subquestions)
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

def should_continue_with_tools(state: QuestionResearchState, config: RunnableConfig | None = None) -> Literal["tools", "summarize"]:
    """Conditional function that enforces iteration limit before allowing tool calls."""
    cfg = Configuration.from_runnable_config(config) if config else Configuration()
    iterations = state.get("iterations", 0)
    max_iterations = cfg.max_research_iterations
    
    # Get the last message to check if agent wants to call tools
    messages = state.get("messages", [])
    if not messages:
        return "summarize"
    
    last_message = messages[-1]
    
    # If agent called finish_research or no tool calls, go to summarize
    if isinstance(last_message, AIMessage):
        if not last_message.tool_calls:
            return "summarize"
        # Check if all tool calls are finish_research
        if all(tc.get("name") == "finish_research" for tc in last_message.tool_calls):
            return "summarize"
        # If we've exceeded max iterations, force summarize
        # (iterations is incremented AFTER tools execute, so this catches when we've gone over)
        if iterations >= max_iterations:
            return "summarize"
        # Otherwise allow tools (the warning in research_agent will handle the last iteration case)
        return "tools"
    
    # Default to summarize if we can't determine
    return "summarize"


async def tools_with_iteration_counter(
    state: QuestionResearchState, config: RunnableConfig | None = None
) -> dict:
    """Wrapper around ToolNode that increments iteration counter."""
    tools = get_research_tools()
    tool_node = ToolNode(tools)
    
    # Execute tools
    result = await tool_node.ainvoke(state, config)
    
    # Increment iteration counter
    current_iterations = state.get("iterations", 0)
    
    return {
        **result,
        "iterations": current_iterations + 1
    }


# 1. Build Subgraph
sub_builder = StateGraph(QuestionResearchState)
sub_builder.add_node("agent", research_agent)
sub_builder.add_node("tools", tools_with_iteration_counter)

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
    
    model = ChatOpenAI(model=model_name, api_key=api_key, base_url=base_url)
    
    prompt = load_prompt(
        "summarize.jinja",
        company_name=state["company_name"],
        top_domain=state.get("top_domain"),
        summary_long=state.get("summary_long"),
        question=state["question"],
        raw_output=raw_output,  # Full context - 128k context window available
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
    information_found: bool | None = None
    for line in response_text.split('\n'):
        line_clean = line.strip()
        upper = line_clean.upper()
        if upper.startswith("INFORMATION_FOUND:"):
            raw_val = line_clean.split(":", 1)[1].strip() if ":" in line_clean else ""
            norm = re.sub(r"[\s_\-]+", "", raw_val.lower())
            if norm in {"yes", "y", "true", "1", "found"}:
                information_found = True
            elif norm in {"no", "n", "false", "0", "notfound"}:
                information_found = False
        elif upper.startswith("ANSWER:"):
            answer = line_clean.split(":", 1)[1].strip() if ":" in line_clean else answer
        elif upper.startswith("SOURCE:"):
            source = line_clean.split(":", 1)[1].strip() if ":" in line_clean else source
        elif upper.startswith("CONFIDENCE:"):
            confidence = line_clean.split(":", 1)[1].strip() if ":" in line_clean else confidence

    # Backward compatible fallback if the new field isn't present.
    if information_found is None:
        information_found = answer.strip().lower() != "information not publicly available"

    # Normalize the explicit "no information found" case.
    if information_found is False:
        answer = "Information not publicly available"
        source = "N/A"
        confidence = "Low"

    # If the model didn't provide a usable source, infer one from the trace URLs.
    if information_found is True and (not source or source.strip().lower() in {"unknown", "n/a", "na", "none"}):
        source = _infer_source_domain(raw_output, state.get("top_domain"))

    result = SubQuestionAnswer(
        section=state["section"],
        question=state["question"],
        answer=answer,
        information_found=information_found,
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
sub_builder.add_conditional_edges(
    "agent", 
    should_continue_with_tools, 
    {"tools": "tools", "summarize": "summarize"}
)
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
