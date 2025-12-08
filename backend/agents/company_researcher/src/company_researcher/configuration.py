"""Configuration for the Company Researcher agent."""

import os
from typing import Any, Optional

from langchain_core.runnables import RunnableConfig
from pydantic import BaseModel, Field


class Configuration(BaseModel):
    """Configuration for Company Researcher."""

    # Model settings - using DeepSeek by default
    research_model: str = Field(
        default="openai:deepseek-chat",
        metadata={
            "description": "Model for conducting research (via OpenAI-compatible API)"
        }
    )
    research_model_max_tokens: int = Field(
        default=4000,
        metadata={"description": "Max output tokens for research model"}
    )
    
    summarization_model: str = Field(
        default="openai:deepseek-chat",
        metadata={"description": "Model for summarizing research results"}
    )
    summarization_model_max_tokens: int = Field(
        default=2000,
        metadata={"description": "Max output tokens for summarization"}
    )

    # Research agent settings
    max_research_iterations: int = Field(
        default=3,
        metadata={"description": "Max tool-calling iterations per research question"}
    )
    max_search_results: int = Field(
        default=3,
        metadata={"description": "Max search results per query"}
    )
    max_search_queries: int = Field(
        default=2,
        metadata={"description": "Max search queries per tool call"}
    )
    max_content_length: int = Field(
        default=15000,
        metadata={"description": "Max chars of content before truncation"}
    )
    max_concurrent_research: int = Field(
        default=2,
        metadata={"description": "Max sub-questions to research in parallel"}
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

    class Config:
        arbitrary_types_allowed = True
