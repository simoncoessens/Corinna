"""Data models for Company Matcher output."""

from pydantic import ConfigDict
from pydantic import BaseModel, Field


class CompanyMatch(BaseModel):
    """A single company match result."""

    model_config = ConfigDict(extra="ignore")

    name: str = Field(description="Company name")
    top_domain: str = Field(
        description="Company top domain only (e.g., 'company.com', no scheme/path)",
    )
    confidence: str = Field(description="Match confidence: exact, high, medium, low")

    summary_short: str | None = Field(
        default=None,
        description="Short company summary (1-2 sentences) based on sources",
    )
    summary_long: str = Field(
        description="Extended company summary (can be extensive) based on sources",
    )


class CompanyMatchResult(BaseModel):
    """Final output from company matcher."""

    model_config = ConfigDict(extra="ignore")

    input_name: str = Field(description="The input company name")
    exact_match: CompanyMatch | None = Field(
        default=None,
        description="Exact match if found, null otherwise"
    )
    suggestions: list[CompanyMatch] = Field(
        default_factory=list,
        description="List of closest matches if no exact match"
    )
    
    def to_json(self, *, indent: int = 2) -> str:
        """Convert to JSON string."""
        return self.model_dump_json(indent=indent, exclude_none=True)

