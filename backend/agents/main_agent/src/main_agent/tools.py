"""Tools for the Main Agent - Tavily Search and DSA Knowledge Base Retrieval."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import List, Optional

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool

# Add paths to import shared tools and knowledge base
agents_path = Path(__file__).resolve().parents[3]
backend_path = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(agents_path))
sys.path.insert(0, str(backend_path))

from tools import tavily_search_tool


def get_dsa_retriever(config: Optional[RunnableConfig] = None):
    """Initialize and return the DSA retriever."""
    from knowledge_base.retriever import DSARetriever
    
    qdrant_url = os.getenv("QDRANT_URL")
    qdrant_api_key = os.getenv("QDRANT_API_KEY")
    # Separate key specifically for embeddings so we can keep DeepSeek chat
    # on OPENAI_API_KEY without affecting the retriever.
    openai_api_key = os.getenv("OPENAI_EMBEDDING_API_KEY")
    
    if config:
        api_keys = config.get("configurable", {}).get("apiKeys", {})
        qdrant_api_key = api_keys.get("QDRANT_API_KEY") or qdrant_api_key
        openai_api_key = api_keys.get("OPENAI_EMBEDDING_API_KEY") or openai_api_key
    
    try:
        return DSARetriever(
            qdrant_url=qdrant_url,
            qdrant_api_key=qdrant_api_key,
            openai_api_key=openai_api_key,
        )
    except TypeError as e:
        if "proxies" in str(e):
            # Fallback: try without explicit api_key if proxies is causing issues
            return DSARetriever(
                qdrant_url=qdrant_url,
                qdrant_api_key=qdrant_api_key,
            )
        raise


@tool
async def web_search(queries: List[str], config: RunnableConfig = None) -> str:
    """Search the web for information about companies, DSA compliance, or digital services.
    
    Args:
        queries: List of search queries (max 3)
    """
    return await tavily_search_tool(
        queries=queries[:3],
        max_results=5,
        config=config,
    )


@tool
def retrieve_dsa_knowledge(
    query: str,
    category: Optional[str] = None,
    limit: int = 5,
    config: RunnableConfig = None,
) -> str:
    """Retrieve relevant information from the DSA legal knowledge base.
    
    Args:
        query: Natural language query about DSA content
        category: Optional filter: "Intermediary Service", "Hosting Service", "Online Platform", "VLOP/VLOSE"
        limit: Maximum results (default 5)
    """
    try:
        retriever = get_dsa_retriever(config)
        
        if not retriever.is_ready():
            return "Error: DSA knowledge base not initialized."
        
        results = retriever.get_dsa_context(
            query=query,
            limit=min(limit, 10),
            category=category if category and category != "all" else None,
        )
        
        if not results:
            return f"No DSA content found for: '{query}'"
        
        formatted = f"DSA Results for: '{query}'\n{'=' * 50}\n\n"
        for i, r in enumerate(results, 1):
            formatted += f"**{i}. {r.get('title', 'Untitled')}**\n"
            if r.get("category"):
                formatted += f"   Applies to: {r['category']}\n"
            formatted += f"\n{r.get('content', '')}\n\n---\n\n"
        
        return formatted
        
    except Exception as e:
        return f"Error retrieving DSA knowledge: {str(e)[:200]}"


def get_all_tools():
    """Return list of all available tools."""
    return [web_search, retrieve_dsa_knowledge]
