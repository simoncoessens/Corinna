"""State definitions for the Main Agent (Corinna)."""

from typing import List, Literal, Optional
from langgraph.graph import MessagesState


class MainAgentInputState(MessagesState):
    """Input state - messages plus frontend context."""
    
    # Frontend context as a simple string - will be refined later
    frontend_context: Optional[str] = None
    
    # Explicit context mode for specialized behavior
    context_mode: Optional[Literal["review_findings", "obligations", "general"]] = None


class MainAgentState(MessagesState):
    """Full state for the Main Agent workflow."""
    
    # Frontend context passed from the UI (simple string for now)
    frontend_context: Optional[str] = None
    
    # Explicit context mode for specialized behavior
    context_mode: Optional[Literal["review_findings", "obligations", "general"]] = None
