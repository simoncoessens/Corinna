"""Data models for Company Researcher."""

from datetime import datetime
from typing import List

from pydantic import BaseModel, Field


class SubQuestion(BaseModel):
    """A single sub-question to research."""

    section: str
    question: str
    relevant_articles: List[str] = []

    def build_prompt(self, company_name: str) -> str:
        """Build a compact research prompt."""
        # Keep prompts small - only short article references
        if self.relevant_articles:
            short_refs = []
            for ref in self.relevant_articles[:2]:
                snippet = " ".join(ref.strip().splitlines())[:100]
                short_refs.append(snippet)
            articles_text = "\n".join(short_refs)
        else:
            articles_text = "N/A"

        return f"""Research: {company_name} - {self.question}

Section: {self.section}
Legal refs: {articles_text}

Find specific facts from official sources (company website, news, filings).
Be concise and factual."""

    def build_search_queries(self, company_name: str) -> List[str]:
        """Generate search queries for this question."""
        base_query = f"{company_name} {self.question}"
        return [
            base_query[:200],  # Main query
            f"{company_name} official {self.section.lower()}"[:200],  # Section-specific
        ]


class SubQuestionAnswer(BaseModel):
    """Answer to a single sub-question."""

    section: str
    question: str
    answer: str
    source: str = "Unknown"
    confidence: str = "Medium"
    raw_research: str | None = None


class CompanyResearchResult(BaseModel):
    """Final aggregated research output."""

    company_name: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    answers: List[SubQuestionAnswer]

    def to_json(self, *, indent: int = 2) -> str:
        return self.model_dump_json(indent=indent)

