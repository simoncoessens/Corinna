"""Unit tests for state definitions and reducers."""

import pytest


class TestOverrideReducer:
    """Tests for the override_reducer function."""

    def test_override_reducer_normal_append(self):
        """Test override_reducer appends lists normally."""
        from company_researcher.state import override_reducer
        
        current = [1, 2, 3]
        new = [4, 5]
        
        result = override_reducer(current, new)
        assert result == [1, 2, 3, 4, 5]

    def test_override_reducer_override_dict(self):
        """Test override_reducer with override dict replaces value."""
        from company_researcher.state import override_reducer
        
        current = [1, 2, 3]
        new = {"type": "override", "value": [10, 20]}
        
        result = override_reducer(current, new)
        assert result == [10, 20]

    def test_override_reducer_current_none(self):
        """Test override_reducer handles None current value."""
        from company_researcher.state import override_reducer
        
        result = override_reducer(None, [1, 2])
        assert result == [1, 2]

    def test_override_reducer_new_none(self):
        """Test override_reducer handles None new value."""
        from company_researcher.state import override_reducer
        
        result = override_reducer([1, 2], None)
        assert result == [1, 2]

    def test_override_reducer_both_none(self):
        """Test override_reducer handles both None."""
        from company_researcher.state import override_reducer
        
        result = override_reducer(None, None)
        assert result == []

    def test_override_reducer_empty_override(self):
        """Test override_reducer with empty override value."""
        from company_researcher.state import override_reducer
        
        current = [1, 2, 3]
        new = {"type": "override", "value": []}
        
        result = override_reducer(current, new)
        assert result == []


class TestCompanyMatcherState:
    """Tests for CompanyMatcherState."""

    def test_company_matcher_input_state(self):
        """Test CompanyMatcherInputState is a valid TypedDict."""
        from company_matcher.state import CompanyMatcherInputState
        
        # LangGraph states are TypedDicts, accessed via dict syntax
        state: CompanyMatcherInputState = {"messages": []}
        assert state["messages"] == []

    def test_company_matcher_state_defaults(self):
        """Test CompanyMatcherState default values."""
        from company_matcher.state import CompanyMatcherState
        
        # CompanyMatcherState inherits from MessagesState
        # Default values should be empty strings
        state_dict: CompanyMatcherState = {
            "messages": [],
            "company_name": "",
            "country_of_establishment": "",
            "match_result": "",
        }
        
        # Verify the state can be created with these defaults
        assert state_dict["company_name"] == ""
        assert state_dict["match_result"] == ""


class TestCompanyResearcherState:
    """Tests for CompanyResearcherState."""

    def test_company_research_input_state(self):
        """Test CompanyResearchInputState creation as dict."""
        from company_researcher.state import CompanyResearchInputState
        
        # LangGraph states are TypedDicts
        state: CompanyResearchInputState = {
            "messages": [],
            "company_name": "TestCorp",
            "top_domain": "test.com",
            "summary_long": None,
        }
        
        assert state["company_name"] == "TestCorp"
        assert state["top_domain"] == "test.com"

    def test_company_research_input_state_optional_fields(self):
        """Test CompanyResearchInputState optional fields."""
        from company_researcher.state import CompanyResearchInputState
        
        state: CompanyResearchInputState = {
            "messages": [],
            "company_name": None,
            "top_domain": None,
            "summary_long": None,
        }
        
        assert state["company_name"] is None
        assert state["top_domain"] is None
        assert state["summary_long"] is None

    def test_question_research_state(self):
        """Test QuestionResearchState creation as dict."""
        from company_researcher.state import QuestionResearchState
        
        state: QuestionResearchState = {
            "messages": [],
            "question": "What services does the company provide?",
            "section": "TYPE OF SERVICE",
            "company_name": "TestCorp",
            "prompt_template": "questions/q10.jinja",
            "top_domain": None,
            "summary_long": None,
            "research_summary": None,
            "completed_answers": [],
            "iterations": 0,
        }
        
        assert state["question"] == "What services does the company provide?"
        assert state["section"] == "TYPE OF SERVICE"
        assert state["iterations"] == 0

    def test_question_research_state_defaults(self):
        """Test QuestionResearchState default values as dict."""
        from company_researcher.state import QuestionResearchState
        
        state: QuestionResearchState = {
            "messages": [],
            "question": "Test?",
            "section": "TEST",
            "company_name": "Corp",
            "prompt_template": "test.jinja",
            "top_domain": None,
            "summary_long": None,
            "research_summary": None,
            "completed_answers": [],
            "iterations": 0,
        }
        
        assert state["top_domain"] is None
        assert state["summary_long"] is None
        assert state["research_summary"] is None
        assert state["completed_answers"] == []
        assert state["iterations"] == 0


class TestServiceCategorizerState:
    """Tests for ServiceCategorizerState."""

    def test_service_categorizer_input_state(self):
        """Test ServiceCategorizerInputState as dict."""
        from service_categorizer.state import ServiceCategorizerInputState
        
        state: ServiceCategorizerInputState = {"messages": []}
        assert state["messages"] == []

    def test_service_categorizer_state_structure(self):
        """Test ServiceCategorizerState expected structure."""
        from service_categorizer.state import ServiceCategorizerState
        
        # Verify the state class exists and has expected attributes
        state_dict: ServiceCategorizerState = {
            "messages": [],
            "company_profile": {},
            "classification": {},
            "obligations": [],
            "obligation_analyses": [],
            "final_report": None,
        }
        
        # Basic structure check
        assert "company_profile" in state_dict
        assert "classification" in state_dict


class TestMainAgentState:
    """Tests for MainAgentState."""

    def test_main_agent_input_state(self):
        """Test MainAgentInputState as dict."""
        from main_agent.state import MainAgentInputState
        
        state: MainAgentInputState = {"messages": [], "frontend_context": None}
        assert state["messages"] == []

    def test_main_agent_input_state_with_context(self):
        """Test MainAgentInputState with frontend_context."""
        from main_agent.state import MainAgentInputState
        
        state: MainAgentInputState = {
            "messages": [],
            "frontend_context": "User is on step 3 of assessment.",
        }
        
        assert state["frontend_context"] == "User is on step 3 of assessment."





