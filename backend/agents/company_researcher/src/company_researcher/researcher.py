"""Research agent with tool calling for company research."""

from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import List

from jinja2 import Environment, FileSystemLoader
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI

from company_researcher.configuration import Configuration
from company_researcher.utils import get_api_key_for_model

# Import Tavily tools from shared location
import sys
# Add backend/agents to path to import tools
# __file__ = .../backend/agents/company_researcher/src/company_researcher/researcher.py
# parents[3] = .../backend/agents
agents_path = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(agents_path))
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
# Research Tools
# =============================================================================

@tool
async def web_search(queries: List[str], config: RunnableConfig = None) -> str:
    """Search the web for information using multiple queries.
    
    Args:
        queries: List of search queries to execute (max 3)
        config: Runtime configuration
    
    Returns:
        Formatted search results
    """
    cfg = Configuration.from_runnable_config(config) if config else Configuration()
    return await tavily_search_tool(
        queries=queries[:cfg.max_search_queries],
        max_results=cfg.max_search_results,
        config=config,
    )


@tool
def finish_research(summary: str) -> str:
    """Call this when you have gathered enough information to answer the question.
    
    Args:
        summary: Your final summary answering the research question
    
    Returns:
        Confirmation that research is complete
    """
    return f"Research complete: {summary}"


# =============================================================================
# Researcher Agent
# =============================================================================

async def run_researcher(
    question: str,
    company_name: str,
    config: RunnableConfig | None = None,
) -> str:
    """Run the researcher agent to answer a single question.

    Returns a textual trace of the research (tool calls + summaries),
    not just the final answer. This is used as raw_research context.
    """
    cfg = Configuration.from_runnable_config(config) if config else Configuration()
    
    # Extract model name (remove "openai:" prefix if present)
    model_name = cfg.research_model.replace("openai:", "") if cfg.research_model.startswith("openai:") else cfg.research_model
    
    # Get API credentials
    api_key = get_api_key_for_model(cfg.research_model, config)
    base_url = None
    if config:
        api_keys = config.get("configurable", {}).get("apiKeys", {})
        base_url = api_keys.get("OPENAI_BASE_URL") or os.getenv("OPENAI_BASE_URL")
    else:
        base_url = os.getenv("OPENAI_BASE_URL")
    
    # Set up model with tools
    model_params = {
        "model": model_name,
        "max_tokens": cfg.research_model_max_tokens,
    }
    if api_key:
        model_params["api_key"] = api_key
    if base_url:
        model_params["base_url"] = base_url
    
    model = ChatOpenAI(**model_params)
    
    tools = [web_search, finish_research]
    model_with_tools = model.bind_tools(tools)
    
    # Load prompt from Jinja template
    prompt = load_prompt(
        "researcher.jinja",
        company_name=company_name,
        question=question,
        max_iterations=cfg.max_research_iterations,
    )

    messages = [
        {"role": "user", "content": prompt},
    ]
    
    # ReAct loop (max iterations to prevent runaway)
    max_iterations = cfg.max_research_iterations
    research_output = ""
    finished = False
    
    for iteration in range(max_iterations):
        try:
            response = await model_with_tools.ainvoke(messages)
            messages.append(response)
            
            # Check if there are tool calls
            if not response.tool_calls:
                # No tool calls - just continue the conversation
                continue
            
            # Process tool calls
            for tool_call in response.tool_calls:
                tool_name = tool_call["name"]
                tool_args = tool_call["args"]
                
                if tool_name == "finish_research":
                    # Mark research as complete and record the summary
                    summary_text = tool_args.get("summary", "")
                    messages.append(ToolMessage(
                        content=f"Final summary: {summary_text}",
                        tool_call_id=tool_call["id"],
                    ))
                    research_output = summary_text
                    finished = True
                    break
                
                elif tool_name == "web_search":
                    # Execute search
                    try:
                        result = await web_search.ainvoke(tool_args, config)
                    except Exception as e:
                        result = f"Search error: {str(e)[:100]}"
                    
                    messages.append(ToolMessage(
                        content=str(result),
                        tool_call_id=tool_call["id"],
                    ))
                
                else:
                    # Unknown tool
                    messages.append(ToolMessage(
                        content=f"Unknown tool: {tool_name}",
                        tool_call_id=tool_call["id"],
                    ))
            if finished:
                break

        except Exception as e:
            research_output = f"Research error: {str(e)[:100]}"
            break

        if finished:
            break

    # Build a full research trace from all AI / tool / user messages
    trace_parts: list[str] = []
    for msg in messages:
        if isinstance(msg, (AIMessage, ToolMessage)):
            trace_parts.append(str(msg.content))
        elif isinstance(msg, dict):
            # Initial system/user messages
            content = msg.get("content")
            if content:
                trace_parts.append(str(content))

    full_trace = "\n\n".join(trace_parts).strip()
    if not full_trace:
        full_trace = research_output or "No research results obtained."

    return full_trace


# =============================================================================
# Batch Research
# =============================================================================

async def research_questions_parallel(
    questions: List[dict],  # List of {"section": ..., "question": ...}
    company_name: str,
    config: RunnableConfig | None = None,
    max_concurrent: int = 3,
) -> List[str]:
    """Research multiple questions with controlled parallelism.
    
    Returns list of research outputs in the same order as questions.
    """
    results = []
    
    for i in range(0, len(questions), max_concurrent):
        batch = questions[i:i + max_concurrent]
        batch_tasks = [
            run_researcher(q["question"], company_name, config)
            for q in batch
        ]
        batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
        
        for result in batch_results:
            if isinstance(result, Exception):
                results.append(f"Research failed: {str(result)[:100]}")
            else:
                results.append(result)
    
    return results
