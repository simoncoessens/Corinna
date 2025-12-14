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
    top_domain: Optional[str] = None
    summary_long: Optional[str] = None


class CompanyResearchState(MessagesState):
    """Full state for the company research workflow."""

    company_name: Annotated[str, lambda x, y: y if y else x] = ""
    top_domain: Annotated[str, lambda x, y: y if y else x] = ""
    summary_long: Annotated[str, lambda x, y: y if y else x] = ""
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
    top_domain: Optional[str] = None
    summary_long: Optional[str] = None
    # Each sub-question agent loads a dedicated prompt template
    prompt_template: str
    research_summary: Optional[str] = None
    completed_answers: List[dict] = []
    iterations: int = 0  # Track number of tool-calling iterations to enforce limits
