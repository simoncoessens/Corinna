"""State definitions for Service Categorizer."""
from typing import Annotated, Any
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict


class ServiceCategorizerInputState(TypedDict):
    """Input state - just messages with company profile."""
    messages: Annotated[list[AnyMessage], add_messages]


class ServiceCategorizerState(TypedDict):
    """Full internal state."""
    messages: Annotated[list[AnyMessage], add_messages]
    company_profile: dict[str, Any]  # The company profile from research
    classification: dict[str, Any]   # Result of classification step
    obligations: list[dict]          # List of applicable obligations
    obligation_analyses: list[dict]  # Analysis of each obligation
    final_report: str                # Final summarized report

