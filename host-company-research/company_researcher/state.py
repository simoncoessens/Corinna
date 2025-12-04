"""State definitions for Company Researcher."""

import operator
from typing import Annotated, List, Optional

from langgraph.graph import MessagesState
from pydantic import BaseModel


def override_reducer(current_value, new_value):
    """Reducer that allows overriding values via {"type": "override", "value": ...}."""
    if isinstance(new_value, dict) and new_value.get("type") == "override":
        return new_value.get("value", new_value)
    return operator.add(current_value, new_value)


class CompanyResearchInputState(MessagesState):
    """Input state - just messages containing the company name."""
    pass


class CompanyResearchState(MessagesState):
    """Full state for the company research workflow."""

    company_name: str = ""
    subquestions: Annotated[List[dict], override_reducer] = []
    completed_answers: Annotated[List[dict], override_reducer] = []
    final_report: Optional[str] = None

