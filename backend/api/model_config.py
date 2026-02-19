"""Dynamic model configuration store.

Holds the current model assignments for each agent slot, persists to
``backend/model_config.json``, and exposes helpers consumed by the API
layer to build ``RunnableConfig`` dicts.
"""

import json
import threading
from pathlib import Path
from typing import Any, Dict, List

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

AVAILABLE_MODELS: List[Dict[str, str]] = [
    {"id": "openrouter:anthropic/claude-opus-4.6", "label": "Claude Opus 4.6"},
    {"id": "openrouter:anthropic/claude-sonnet-4.6", "label": "Claude Sonnet 4.6"},
    {"id": "openrouter:moonshotai/kimi-k2", "label": "Kimi K2"},
    {"id": "openrouter:moonshotai/kimi-k2-thinking", "label": "Kimi K2 (Thinking)"},
]

_VALID_MODEL_IDS = {m["id"] for m in AVAILABLE_MODELS}

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
# Persistence path
# ---------------------------------------------------------------------------

_CONFIG_PATH = Path(__file__).resolve().parent.parent / "model_config.json"

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
                    if key in data and data[key] in _VALID_MODEL_IDS:
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
# Public API
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
            if value not in _VALID_MODEL_IDS:
                raise ValueError(f"Invalid model id: {value}")
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
