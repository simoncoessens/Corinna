"""Utility functions for Company Researcher."""

import os
from datetime import datetime
from typing import List, Optional

from langchain_core.runnables import RunnableConfig
from tavily import AsyncTavilyClient


def get_api_key_for_model(model_name: str, config: Optional[RunnableConfig] = None) -> Optional[str]:
    """Get API key for a model from environment."""
    model_name = model_name.lower()
    
    # Check if we should get from config
    should_get_from_config = os.getenv("GET_API_KEYS_FROM_CONFIG", "false").lower() == "true"
    
    if should_get_from_config and config:
        api_keys = config.get("configurable", {}).get("apiKeys", {})
        if api_keys:
            if model_name.startswith("openai:"):
                return api_keys.get("OPENAI_API_KEY")
            elif model_name.startswith("anthropic:"):
                return api_keys.get("ANTHROPIC_API_KEY")
    
    # Fall back to environment variables
    if model_name.startswith("openai:"):
        return os.getenv("OPENAI_API_KEY")
    elif model_name.startswith("anthropic:"):
        return os.getenv("ANTHROPIC_API_KEY")
    
    return None


def get_tavily_api_key(config: Optional[RunnableConfig] = None) -> Optional[str]:
    """Get Tavily API key from environment or config."""
    should_get_from_config = os.getenv("GET_API_KEYS_FROM_CONFIG", "false").lower() == "true"
    
    if should_get_from_config and config:
        api_keys = config.get("configurable", {}).get("apiKeys", {})
        if api_keys:
            return api_keys.get("TAVILY_API_KEY")
    
    return os.getenv("TAVILY_API_KEY")


def get_today_str() -> str:
    """Get current date as a formatted string."""
    now = datetime.now()
    return f"{now:%a} {now:%b} {now.day}, {now:%Y}"


async def tavily_search_tool(
    queries: List[str],
    max_results: int = 3,
    config: Optional[RunnableConfig] = None,
) -> str:
    """Execute Tavily search queries and return formatted results.
    
    This is the main search function used by the researcher agent.
    """
    api_key = get_tavily_api_key(config)
    if not api_key:
        return "Error: TAVILY_API_KEY not configured."
    
    client = AsyncTavilyClient(api_key=api_key)
    
    all_results = []
    seen_urls = set()
    
    for query in queries:
        try:
            response = await client.search(
                query,
                max_results=max_results,
                include_raw_content=False,  # Keep responses smaller
            )
            for result in response.get("results", []):
                url = result.get("url", "")
                # Deduplicate by URL
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    all_results.append({
                        "title": result.get("title", ""),
                        "url": url,
                        # Allow richer snippets while still capping size
                        "content": result.get("content", "")[:3000],
                    })
        except Exception as e:
            all_results.append({"error": f"Search failed for '{query}': {str(e)[:80]}"})
    
    if not all_results:
        return "No search results found. Try different search queries."
    
    # Format results compactly
    formatted = "Search Results:\n\n"
    # Include at most 10 aggregated results to avoid huge contexts
    for i, result in enumerate(all_results[:10], 1):
        if "error" in result:
            formatted += f"{i}. {result['error']}\n\n"
        else:
            formatted += f"{i}. **{result['title']}**\n"
            formatted += f"   {result['url']}\n"
            formatted += f"   {result['content']}\n\n"
    
    return formatted
