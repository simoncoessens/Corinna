"""State definitions for the Main Agent (DSA Copilot)."""

from typing import List, Optional
from langgraph.graph import MessagesState


class MainAgentInputState(MessagesState):
    """Input state - messages plus frontend context."""
    
    # Frontend context as a simple string - will be refined later
    frontend_context: Optional[str] = None


class MainAgentState(MessagesState):
    """Full state for the Main Agent workflow."""
    
    # Frontend context passed from the UI (simple string for now)
    frontend_context: Optional[str] = None
