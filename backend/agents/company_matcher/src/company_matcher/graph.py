"""Main LangGraph workflow for Company Matcher."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import List

from jinja2 import Environment, FileSystemLoader
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph

from company_matcher.models import CompanyMatch, CompanyMatchResult
from company_matcher.state import CompanyMatcherInputState, CompanyMatcherState

# Import Tavily tools
# Path: backend/agents/company_matcher/src/company_matcher/graph.py
# parents[3] = backend/agents/ where tools/ is located
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
# Tools
# =============================================================================

@tool
async def web_search(queries: List[str], config: RunnableConfig = None) -> str:
    """Search the web for company information using multiple queries.
    
    Args:
        queries: List of search queries to execute (max 3)
        config: Runtime configuration
    
    Returns:
        Formatted search results
    """
    return await tavily_search_tool(
        queries=queries[:3],
        max_results=5,
        config=config,
    )


@tool
def finish_matching(result_json: str) -> str:
    """Call this when you have determined the exact match or suggestions.
    
    Args:
        result_json: JSON string with the match result in this format:
        {
          "exact_match": {"name": "...", "url": "...", "confidence": "exact"} OR null,
          "suggestions": [{"name": "...", "url": "...", "confidence": "high|medium|low"}, ...]
        }
    
    Returns:
        Confirmation that matching is complete
    """
    return f"Matching complete: {result_json}"


# =============================================================================
# ReAct Agent
# =============================================================================

# Configuration constants
MAX_ITERATIONS = 5
MAX_SUGGESTIONS = 3


def _extract_company_name(messages: list) -> str:
    """Extract company name from the last human message."""
    for message in reversed(messages):
        if isinstance(message, HumanMessage):
            if isinstance(message.content, str) and message.content.strip():
                return message.content.strip()
    raise ValueError("No company name found. Please provide the company name.")


async def search_and_match(
    state: CompanyMatcherState, config: RunnableConfig | None = None
) -> dict:
    """ReAct agent that searches and matches company names."""
    company_name = _extract_company_name(state.get("messages", []))
    
    # Get API key and base URL from config if available
    api_key = None
    base_url = None
    if config:
        api_keys = config.get("configurable", {}).get("apiKeys", {})
        api_key = api_keys.get("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY")
        base_url = api_keys.get("OPENAI_BASE_URL") or os.getenv("OPENAI_BASE_URL")
    else:
        api_key = os.getenv("OPENAI_API_KEY")
        base_url = os.getenv("OPENAI_BASE_URL")
    
    # Set up model with tools
    model = ChatOpenAI(
        model="deepseek-chat",
        api_key=api_key,
        base_url=base_url,
        max_tokens=2000,
    )
    
    tools = [web_search, finish_matching]
    model_with_tools = model.bind_tools(tools)
    
    # Load prompt from Jinja template
    prompt = load_prompt(
        "prompt.jinja",
        company_name=company_name,
        max_iterations=MAX_ITERATIONS,
        max_suggestions=MAX_SUGGESTIONS,
    )

    messages = [
        {"role": "user", "content": prompt},
    ]
    
    # ReAct loop (max iterations to prevent runaway)
    match_result = None
    finished = False
    
    for iteration in range(MAX_ITERATIONS):
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
                
                if tool_name == "finish_matching":
                    # Extract the JSON result
                    result_json = tool_args.get("result_json", "{}")
                    messages.append(ToolMessage(
                        content=f"Matching complete: {result_json}",
                        tool_call_id=tool_call["id"],
                    ))
                    match_result = result_json
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
            match_result = f'{{"error": "Matching failed: {str(e)[:100]}"}}'
            break

        if finished:
            break
    
    # Parse the result JSON
    if match_result:
        try:
            # Extract JSON if wrapped in text
            if "{" in match_result:
                json_start = match_result.find("{")
                json_end = match_result.rfind("}") + 1
                match_result = match_result[json_start:json_end]
            
            parsed = json.loads(match_result)
        except (json.JSONDecodeError, AttributeError):
            # Fallback: create a basic result
            parsed = {
                "exact_match": None,
                "suggestions": []
            }
    else:
        parsed = {
            "exact_match": None,
            "suggestions": []
        }
    
    # Build result model
    exact_match = None
    if parsed.get("exact_match"):
        exact_match = CompanyMatch(**parsed["exact_match"])
    
    suggestions = [
        CompanyMatch(**s) for s in parsed.get("suggestions", [])
    ]
    
    result = CompanyMatchResult(
        input_name=company_name,
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

_builder.add_node("search_and_match", search_and_match)

_builder.add_edge(START, "search_and_match")
_builder.add_edge("search_and_match", END)

# Export the compiled graph
company_matcher = _builder.compile()
