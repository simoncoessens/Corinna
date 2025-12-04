"""Structured models for company-level DSA research output."""

from datetime import datetime
from typing import List

from pydantic import BaseModel, Field


class FieldAnswer(BaseModel):
    """Single answered prompt derived from search_fields.csv."""

    section: str
    information_needed: str
    relevant_articles: str | None = None
    why_it_matters: str | None = None
    answer: str


class CompanyResearchResult(BaseModel):
    """Aggregated output for all predefined research prompts."""

    company_name: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    answers: List[FieldAnswer]

    def to_json(self, *, indent: int = 2) -> str:
        """Convenience helper for LangGraph nodes that need a JSON string."""
        return self.model_dump_json(indent=indent)

