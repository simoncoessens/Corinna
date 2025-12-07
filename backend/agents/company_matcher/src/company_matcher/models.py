"""Data models for Company Matcher output."""

from typing import List, Optional
from pydantic import BaseModel, Field


class CompanyMatch(BaseModel):
    """A single company match result."""
    
    name: str = Field(description="Company name")
    url: str = Field(description="Company website URL")
    confidence: str = Field(description="Match confidence: exact, high, medium, low")


class CompanyMatchResult(BaseModel):
    """Final output from company matcher."""
    
    input_name: str = Field(description="The input company name")
    exact_match: Optional[CompanyMatch] = Field(
        default=None,
        description="Exact match if found, null otherwise"
    )
    suggestions: List[CompanyMatch] = Field(
        default_factory=list,
        description="List of closest matches if no exact match"
    )
    
    def to_json(self, *, indent: int = 2) -> str:
        """Convert to JSON string."""
        return self.model_dump_json(indent=indent, exclude_none=True)

