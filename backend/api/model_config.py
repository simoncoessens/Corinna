"""Shared model configuration and API credential helpers.

Loads model names from ``model_config.json`` (if present) and provides a
single place for API key / base-URL resolution so every agent uses the
same logic.
"""

import json
import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from langchain_core.runnables import RunnableConfig
from langchain_openai import ChatOpenAI

logger = logging.getLogger(__name__)

_CONFIG_PATH = Path(__file__).resolve().parent.parent / "model_config.json"

# Default model names when model_config.json is absent
_DEFAULTS: Dict[str, str] = {
    "chat_model": "deepseek-chat",
    "research_model": "openai:deepseek-chat",
    "summarization_model": "openai:deepseek-reasoner",
    "matcher_model": "deepseek-chat",
    "categorizer_model": "deepseek-reasoner",
}


@lru_cache(maxsize=1)
def load_model_config() -> Dict[str, str]:
    """Read and cache ``model_config.json``.

    Returns the parsed dict, or an empty dict if the file is missing /
    malformed (defaults are applied in ``get_model_name``).
    """
    if _CONFIG_PATH.is_file():
        try:
            with _CONFIG_PATH.open() as f:
                cfg = json.load(f)
            logger.info("Loaded model config from %s", _CONFIG_PATH)
            return cfg
        except Exception:
            logger.warning("Failed to parse %s, using defaults", _CONFIG_PATH)
    return {}


def get_model_name(role: str, default: Optional[str] = None) -> str:
    """Get the model name for a given *role* (e.g. ``"matcher_model"``).

    Resolution order: ``model_config.json`` → *default* argument → built-in
    default.
    """
    cfg = load_model_config()
    return cfg.get(role) or default or _DEFAULTS.get(role, "deepseek-chat")


def get_api_credentials(
    config: Optional[RunnableConfig] = None,
) -> Tuple[Optional[str], Optional[str]]:
    """Return ``(api_key, base_url)`` from *config* or environment.

    Checks ``config["configurable"]["apiKeys"]`` first, then falls back to
    ``OPENAI_API_KEY`` / ``OPENAI_BASE_URL`` environment variables.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL")

    if config:
        api_keys: Dict[str, Any] = config.get("configurable", {}).get("apiKeys", {})
        api_key = api_keys.get("OPENAI_API_KEY") or api_key
        base_url = api_keys.get("OPENAI_BASE_URL") or base_url

    return api_key, base_url


def get_chat_model(
    role: str,
    config: Optional[RunnableConfig] = None,
    default: Optional[str] = None,
    **kwargs: Any,
) -> ChatOpenAI:
    """Build a ``ChatOpenAI`` instance for *role* with credentials resolved."""
    raw_name = get_model_name(role, default)

    # Detect provider prefix and route accordingly
    if ":" in raw_name:
        provider, model_name = raw_name.split(":", 1)
    else:
        provider, model_name = None, raw_name

    if provider == "openrouter":
        api_key = os.getenv("OPENROUTER_API_KEY")
        base_url = "https://openrouter.ai/api/v1"
    else:
        api_key, base_url = get_api_credentials(config)

    model_params: Dict[str, Any] = {"model": model_name, **kwargs}
    if api_key:
        model_params["api_key"] = api_key
    if base_url:
        model_params["base_url"] = base_url

    return ChatOpenAI(**model_params)
