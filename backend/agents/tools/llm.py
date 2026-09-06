"""Shared LLM factory for all agents."""

import os
from typing import Optional

from langchain_core.runnables import RunnableConfig
from langchain_openai import ChatOpenAI


def create_llm(
    model_string: str,
    config: Optional[RunnableConfig] = None,
    **kwargs,
) -> ChatOpenAI:
    """Create a ChatOpenAI instance from a prefixed model string.

    Supported prefixes:
      - ``openrouter:<model>`` – routes through OpenRouter (uses OPENROUTER_API_KEY)
      - ``openai:<model>``     – uses OPENAI_API_KEY + OPENAI_BASE_URL (e.g. DeepSeek)
      - ``anthropic:<model>``  – uses ANTHROPIC_API_KEY

    Any ``**kwargs`` are forwarded to :class:`ChatOpenAI`.
    """
    api_keys_from_config = {}
    if config:
        api_keys_from_config = config.get("configurable", {}).get("apiKeys", {})

    if model_string.startswith("openrouter:"):
        model_name = model_string.removeprefix("openrouter:")
        api_key = (
            api_keys_from_config.get("OPENROUTER_API_KEY")
            or os.getenv("OPENROUTER_API_KEY")
        )
        # Explicit output cap: without it OpenRouter forwards the provider's
        # advertised maximum, which Novita/Google reject (HTTP 400).
        kwargs.setdefault(
            "max_tokens", int(os.getenv("OPENROUTER_MAX_TOKENS", "16384"))
        )
        kwargs.setdefault("extra_body", {})
        kwargs["extra_body"].setdefault(
            "provider",
            {"order": ["Amazon Bedrock"], "allow_fallbacks": True},
        )
        return ChatOpenAI(
            model=model_name,
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
            **kwargs,
        )

    if model_string.startswith("anthropic:"):
        model_name = model_string.removeprefix("anthropic:")
        api_key = (
            api_keys_from_config.get("ANTHROPIC_API_KEY")
            or os.getenv("ANTHROPIC_API_KEY")
        )
        return ChatOpenAI(
            model=model_name,
            api_key=api_key,
            **kwargs,
        )

    # Default: openai: prefix (or bare model name)
    model_name = model_string.removeprefix("openai:")
    api_key = (
        api_keys_from_config.get("OPENAI_API_KEY")
        or os.getenv("OPENAI_API_KEY")
    )
    base_url = (
        api_keys_from_config.get("OPENAI_BASE_URL")
        or os.getenv("OPENAI_BASE_URL")
    )
    params: dict = {"model": model_name, **kwargs}
    if api_key:
        params["api_key"] = api_key
    if base_url:
        params["base_url"] = base_url
    return ChatOpenAI(**params)
