"""Utility functions for Company Researcher."""

import os
from datetime import datetime
from typing import Optional

from langchain_core.runnables import RunnableConfig


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


def get_today_str() -> str:
    """Get current date as a formatted string."""
    now = datetime.now()
    return f"{now:%a} {now:%b} {now.day}, {now:%Y}"
