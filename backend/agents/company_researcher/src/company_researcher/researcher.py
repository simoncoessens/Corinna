"""Research agent with tool calling for company research."""

from __future__ import annotations

import os
from pathlib import Path
from typing import List

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool

from company_researcher.configuration import Configuration
from company_researcher.utils import get_api_key_for_model

# Import Tavily tools from shared location
import sys
# Add backend/agents to path to import tools
agents_path = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(agents_path))
from tools import tavily_search_tool


# =============================================================================
# Research Tools
# =============================================================================

@tool
async def web_search(queries: List[str], config: RunnableConfig) -> str:
    """Search the web for information. Only the first query in the list will be executed.
    
    Args:
        queries: List of search queries. IMPORTANT: Only the first query will be executed (max_search_queries=1).
                 Use separate tool calls for different queries if needed.
        config: Runtime configuration (automatically injected by LangGraph)
    
    Returns:
        Formatted search results from a single search query
    """
    # Get config from RunnableConfig (automatically injected by ToolNode)
    cfg = Configuration.from_runnable_config(config)
    
    # Enforce max_search_queries limit (default is 1)
    max_queries = cfg.max_search_queries
    # Ensure we have a positive limit
    if max_queries <= 0:
        max_queries = 1
    
    # Truncate queries to the limit - only process first max_queries queries
    limited_queries = queries[:max_queries]
    
    return await tavily_search_tool(
        queries=limited_queries,
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


def get_research_tools():
    return [web_search, finish_research]
