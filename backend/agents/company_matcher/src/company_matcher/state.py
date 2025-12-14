"""State definitions for Company Matcher."""

from langgraph.graph import MessagesState


class CompanyMatcherInputState(MessagesState):
    """Input state - messages containing the company name."""

    company_name: str = ""
    country_of_establishment: str = ""


class CompanyMatcherState(MessagesState):
    """State for the company matcher workflow."""
    
    company_name: str = ""
    country_of_establishment: str = ""
    match_result: str = ""

