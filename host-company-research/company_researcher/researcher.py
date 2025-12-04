"""Research agent with tool calling for company research."""

from __future__ import annotations

import asyncio
from typing import List

from langchain.chat_models import init_chat_model
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool

from company_researcher.configuration import Configuration
from company_researcher.utils import get_api_key_for_model, tavily_search_tool


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

RESEARCHER_SYSTEM_PROMPT = """You are a research agent investigating a company for DSA (Digital Services Act) compliance.

Your task is to find specific, factual information to answer the research question.

Available tools:
- web_search: Search the web with multiple queries. Use specific queries including the company name.
- finish_research: Call this when you have enough information to provide a complete answer.

Research strategy:
1. Start with a targeted search including the company name and key terms from the question.
2. If results are insufficient, try alternative search queries.
3. Once you have concrete facts, call finish_research with your summary.

Be concise and factual. Include specific numbers, dates, or sources when available.
Maximum 3 search iterations - then you must call finish_research."""


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
    
    # Set up model with tools
    model_config = {
        "model": cfg.research_model,
        "max_tokens": cfg.research_model_max_tokens,
        "api_key": get_api_key_for_model(cfg.research_model, config),
    }
    
    model = init_chat_model(
        model=cfg.research_model,
        max_tokens=cfg.research_model_max_tokens,
        api_key=get_api_key_for_model(cfg.research_model, config),
        streaming=True,  # Enable streaming for token callbacks
    )
    
    tools = [web_search, finish_research]
    model_with_tools = model.bind_tools(tools)
    tools_by_name = {t.name: t for t in tools}
    
    # Initial message
    user_prompt = f"""Research question about {company_name}:

{question}

Use web_search to find information, then call finish_research with your answer."""

    messages = [
        {"role": "system", "content": RESEARCHER_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]
    
    # ReAct loop (max iterations to prevent runaway)
    max_iterations = cfg.max_research_iterations
    research_output = ""
    finished = False
    
    for iteration in range(max_iterations):
        try:
            # Pass through config so external callbacks (for streaming) are respected
            response = await model_with_tools.ainvoke(messages, config=config)
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

