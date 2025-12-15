"""Configuration for the Main Agent."""

import os
from typing import Any, Optional

from langchain_core.runnables import RunnableConfig
from pydantic import BaseModel, Field


class Configuration(BaseModel):
    """Configuration for the Main Agent (Corinna)."""

    # Model settings - using DeepSeek by default (like other agents)
    main_model: str = Field(
        default="openai:deepseek-chat",
        metadata={"description": "Primary model for reasoning and responses"}
    )
    # ReAct agent settings
    max_iterations: int = Field(
        default=10,
        metadata={"description": "Maximum reasoning/action iterations"}
    )
    
    # Tool settings
    max_search_results: int = Field(
        default=5,
        metadata={"description": "Maximum search results per Tavily query"}
    )
    max_dsa_chunks: int = Field(
        default=5,
        metadata={"description": "Maximum DSA knowledge chunks to retrieve"}
    )

    @classmethod
    def from_runnable_config(cls, config: Optional[RunnableConfig] = None) -> "Configuration":
        """Create Configuration from RunnableConfig, with env var fallbacks."""
        configurable = config.get("configurable", {}) if config else {}
        field_names = list(cls.model_fields.keys())
        values: dict[str, Any] = {
            field_name: os.environ.get(field_name.upper(), configurable.get(field_name))
            for field_name in field_names
        }
        return cls(**{k: v for k, v in values.items() if v is not None})
