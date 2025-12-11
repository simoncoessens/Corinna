"""State definitions for Company Researcher."""

import operator
from typing import Annotated, List, Optional
from langgraph.graph import MessagesState
from pydantic import BaseModel, Field


def override_reducer(current_value, new_value):
    """Reducer that allows overriding values via {"type": "override", "value": ...}."""
    if isinstance(new_value, dict) and new_value.get("type") == "override":
        return new_value.get("value", new_value)
    if current_value is None:
        current_value = []
    if new_value is None:
        new_value = []
    return current_value + new_value


class CompanyResearchInputState(MessagesState):
    """Input state - just messages containing the company name."""
    company_name: Optional[str] = None


class CompanyResearchState(MessagesState):
    """Full state for the company research workflow."""

    company_name: Annotated[str, lambda x, y: y if y else x] = ""
    # Use override_reducer to allow setting the initial list, then appending
    subquestions: Annotated[List[dict], override_reducer] = []
    # Use override_reducer to allow resetting, then standard add for parallel appends
    completed_answers: Annotated[List[dict], override_reducer] = []
    final_report: Optional[str] = None


class QuestionResearchState(MessagesState):
    """State for a single question research subgraph."""
    
    question: str
    section: str
    company_name: str
    relevant_articles: list[str] = []
    rationale: Optional[str] = None
    research_summary: Optional[str] = None
    completed_answers: List[dict] = []
