"""Utilities for loading and formatting structured search prompts."""

from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import BaseModel


class SearchFieldSpec(BaseModel):
    """Single entry derived from search_fields.csv."""

    section: str
    information_needed: str
    relevant_articles: str | None = None
    rationale: str | None = None

    def build_prompt(self, company_name: str) -> str:
        """Return an instruction block for the researcher sub-agent."""
        references = self.relevant_articles or "Not specified"
        rationale = self.rationale or "No rationale provided"

        return (
            f"You are a DSA compliance researcher helping profile {company_name}.\n"
            f"Section: {self.section}\n"
            f"Information needed: {self.information_needed}\n"
            f"Relevant DSA references:\n{references}\n"
            f"Why this matters:\n{rationale}\n\n"
            "Instructions:\n"
            "1. Search authoritative public sources (company docs, trusted news, filings).\n"
            "2. Focus only on information that directly concerns the specified company.\n"
            "3. Prefer recent data (last 24 months) but cite older data if nothing newer exists.\n"
            "4. Quote or paraphrase findings with inline citations (domain + year).\n"
            "5. If data is unavailable, explain what was tried and why it may not exist.\n\n"
            "Return your findings in this structure:\n"
            "- Answer: concise narrative (<= 4 sentences).\n"
            "- Evidence: bullet list with citation per bullet.\n"
            "- RemainingQuestions: bullet list of gaps or 'None'.\n"
            "- Confidence: High | Medium | Low with one-sentence justification.\n"
        )

    def as_dict(self) -> dict:
        """JSON-serializable representation for LangGraph state."""
        return self.model_dump()


def _load_csv_rows() -> List[dict]:
    csv_path = Path(__file__).with_name("search_fields.csv")
    if not csv_path.exists():
        raise FileNotFoundError(f"{csv_path} was not found")

    with csv_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        rows: List[dict] = []
        for row in reader:
            section = (row.get("Section") or "").strip()
            info = (row.get("Information Needed") or "").strip()

            # Skip empty spacer rows
            if not section and not info:
                continue

            rows.append(
                {
                    "section": section or "UNCATEGORIZED",
                    "information_needed": info,
                    "relevant_articles": (row.get("Relevant Article(s) \\ Recital(s)") or "").strip()
                    or None,
                    "rationale": (row.get("Why and what") or "").strip() or None,
                }
            )
    return rows


@lru_cache(maxsize=1)
def load_search_field_specs() -> List[SearchFieldSpec]:
    """Return cached list of structured prompts for sub-agents."""
    return [SearchFieldSpec(**row) for row in _load_csv_rows()]

