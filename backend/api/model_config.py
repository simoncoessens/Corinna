"""Shared model configuration, API credential helpers, and admin settings store.

Combines:
- A ``get_chat_model()`` factory that resolves provider prefixes (openrouter,
  anthropic, openai/bare) and API credentials.
- A dynamic admin settings store backed by ``model_config.json`` so the admin
  panel can swap models at runtime.
- ``get_runnable_configurable()`` for injecting the current model selection
  into every ``RunnableConfig``.
"""

import json
import logging
import os
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from langchain_core.runnables import RunnableConfig
from langchain_openai import ChatOpenAI
from pydantic import SecretStr

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_CONFIG_PATH = Path(__file__).resolve().parent.parent / "model_config.json"

# Explicit output cap for OpenRouter requests (see get_chat_model). Override
# with the OPENROUTER_MAX_TOKENS env var if a deployment needs longer outputs.
OPENROUTER_MAX_TOKENS: int = int(os.getenv("OPENROUTER_MAX_TOKENS", "16384"))

AVAILABLE_MODELS: List[Dict[str, str]] = [
    {"id": "openrouter:anthropic/claude-opus-4.6", "label": "Claude Opus 4.6"},
    {"id": "openrouter:anthropic/claude-sonnet-4.6", "label": "Claude Sonnet 4.6"},
    {"id": "openrouter:moonshotai/kimi-k2", "label": "Kimi K2"},
    {"id": "openrouter:moonshotai/kimi-k2-thinking", "label": "Kimi K2 (Thinking)"},
    {"id": "deepseek-chat", "label": "DeepSeek Chat (OpenAI-compat)"},
    {"id": "deepseek-reasoner", "label": "DeepSeek Reasoner (OpenAI-compat)"},
]

DEFAULT_MODEL_CONFIG: Dict[str, str] = {
    "chat_model": "openrouter:moonshotai/kimi-k2",
    "research_model": "openrouter:moonshotai/kimi-k2-thinking",
    "summarization_model": "openrouter:moonshotai/kimi-k2-thinking",
    "matcher_model": "openrouter:moonshotai/kimi-k2-thinking",
    "categorizer_model": "openrouter:moonshotai/kimi-k2-thinking",
}

# Mapping from user-facing config keys to the RunnableConfig ``configurable``
# keys consumed by each agent's Configuration class (or manual lookup).
_CONFIG_TO_CONFIGURABLE: Dict[str, str] = {
    "chat_model": "main_model",
    "research_model": "research_model",
    "summarization_model": "summarization_model",
    "matcher_model": "matcher_model",
    "categorizer_model": "categorizer_model",
}

# ---------------------------------------------------------------------------
# In-memory state (guarded by lock)
# ---------------------------------------------------------------------------

_lock = threading.Lock()
_current_config: Dict[str, str] = dict(DEFAULT_MODEL_CONFIG)


def _load_from_disk() -> None:
    """Load persisted config from JSON file (best-effort)."""
    global _current_config
    if _CONFIG_PATH.exists():
        try:
            with open(_CONFIG_PATH, "r") as f:
                data = json.load(f)
            if isinstance(data, dict):
                for key in DEFAULT_MODEL_CONFIG:
                    if key in data:
                        _current_config[key] = data[key]
        except Exception:
            pass  # fall back to defaults


def _save_to_disk() -> None:
    """Persist current config to JSON (best-effort)."""
    try:
        with open(_CONFIG_PATH, "w") as f:
            json.dump(_current_config, f, indent=2)
    except Exception:
        pass


# Load on import
_load_from_disk()

# ---------------------------------------------------------------------------
# Admin settings API
# ---------------------------------------------------------------------------


def get_model_config() -> Dict[str, str]:
    """Return the current model configuration (copy)."""
    with _lock:
        return dict(_current_config)


def update_model_config(updates: Dict[str, str]) -> Dict[str, str]:
    """Validate *updates*, merge into current config, persist, and return the full config."""
    with _lock:
        for key, value in updates.items():
            if key not in DEFAULT_MODEL_CONFIG:
                raise ValueError(f"Unknown config key: {key}")
            # Allow any model string (including custom ones) — only warn if
            # it's not in the curated list.
            _current_config[key] = value
        _save_to_disk()
        return dict(_current_config)


def get_runnable_configurable() -> Dict[str, Any]:
    """Return a dict suitable for ``RunnableConfig["configurable"]``.

    Keys are mapped from the user-facing names (``chat_model``, etc.) to the
    names each agent's ``Configuration`` class expects (``main_model``, etc.).
    """
    with _lock:
        return {
            configurable_key: _current_config[config_key]
            for config_key, configurable_key in _CONFIG_TO_CONFIGURABLE.items()
        }


# ---------------------------------------------------------------------------
# Model name resolution
# ---------------------------------------------------------------------------


def get_model_name(role: str, default: Optional[str] = None) -> str:
    """Get the model name for a given *role* (e.g. ``"matcher_model"``).

    Resolution order: admin config (in-memory / JSON) -> *default* argument
    -> built-in default.
    """
    with _lock:
        name = _current_config.get(role)
    if name:
        return name
    return default or DEFAULT_MODEL_CONFIG.get(role, "deepseek-chat")


# ---------------------------------------------------------------------------
# API credential resolution
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Chat model factory (used by all agents)
# ---------------------------------------------------------------------------


def get_chat_model(
    role: str,
    config: Optional[RunnableConfig] = None,
    default: Optional[str] = None,
    **kwargs: Any,
) -> ChatOpenAI:
    """Build a ``ChatOpenAI`` instance for *role* with credentials resolved.

    Supports provider prefixes:
      - ``openrouter:<model>`` -- routes through OpenRouter
      - ``anthropic:<model>``  -- uses ANTHROPIC_API_KEY
      - ``openai:<model>``     -- uses OPENAI_API_KEY + OPENAI_BASE_URL
      - bare model name        -- same as openai prefix
    """
    raw_name = get_model_name(role, default)

    # Allow runtime override via RunnableConfig (e.g. admin panel selection)
    if config:
        configurable = config.get("configurable", {})
        override = configurable.get(role)
        if override:
            raw_name = override

    # Detect provider prefix and route accordingly
    if ":" in raw_name:
        provider, model_name = raw_name.split(":", 1)
    else:
        provider, model_name = None, raw_name

    api_keys_from_config: Dict[str, Any] = {}
    if config:
        api_keys_from_config = config.get("configurable", {}).get("apiKeys", {})

    if provider == "openrouter":
        api_key = (
            api_keys_from_config.get("OPENROUTER_API_KEY")
            or os.getenv("OPENROUTER_API_KEY")
        )
        # OpenRouter fills in max_tokens with the provider's advertised maximum
        # when it is omitted; several providers (Novita, Google) then reject the
        # request because that value exceeds their real output limit. Always
        # send an explicit, sane cap.
        kwargs.setdefault("max_tokens", OPENROUTER_MAX_TOKENS)
        kwargs.setdefault("extra_body", {})
        kwargs["extra_body"].setdefault(
            "provider",
            {"order": ["Amazon Bedrock"], "allow_fallbacks": True},
        )
        return ChatOpenAI(
            model=model_name,
            api_key=SecretStr(api_key) if api_key else None,
            base_url="https://openrouter.ai/api/v1",
            **kwargs,
        )

    if provider == "anthropic":
        raise ValueError(
            f"The 'anthropic:' provider prefix is not supported (langchain-anthropic "
            f"is not installed). Use 'openrouter:anthropic/{model_name}' instead."
        )

    # Default: openai: prefix (or bare model name)
    model_name = model_name  # already stripped if "openai:" prefix was present
    api_key, base_url = get_api_credentials(config)

    model_params: Dict[str, Any] = {"model": model_name, **kwargs}
    if api_key:
        model_params["api_key"] = api_key
    if base_url:
        model_params["base_url"] = base_url

    return ChatOpenAI(**model_params)
