"""Tests for company_researcher agent nodes."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestCompanyResearcherNodes:
    """Tests for company_researcher graph nodes."""

    @pytest.mark.asyncio
    async def test_prepare_research_loads_subquestions(self, human_message):
        """Test prepare_research loads subquestions from templates."""
        from company_researcher.graph import prepare_research
        
        state = {
            "messages": [human_message],
            "company_name": None,
            "top_domain": "",
            "summary_long": "",
        }
        
        result = await prepare_research(state)
        
        assert result["company_name"] == "Acme Corporation"
        assert "subquestions" in result
        # Should have override format
        assert result["subquestions"]["type"] == "override"
        assert len(result["subquestions"]["value"]) == 17

    @pytest.mark.asyncio
    async def test_prepare_research_uses_provided_company_name(self):
        """Test prepare_research uses provided company_name."""
        from company_researcher.graph import prepare_research
        
        state = {
            "messages": [],
            "company_name": "TestCorp",
            "top_domain": "testcorp.com",
            "summary_long": "A test company.",
        }
        
        result = await prepare_research(state)
        
        assert result["company_name"] == "TestCorp"
        assert result["top_domain"] == "testcorp.com"
        assert result["summary_long"] == "A test company."

    @pytest.mark.asyncio
    async def test_prepare_research_resets_completed_answers(self, human_message):
        """Test prepare_research resets completed_answers."""
        from company_researcher.graph import prepare_research
        
        state = {
            "messages": [human_message],
            "completed_answers": [{"old": "answer"}],
        }
        
        result = await prepare_research(state)
        
        assert result["completed_answers"]["type"] == "override"
        assert result["completed_answers"]["value"] == []

    def test_dispatch_research_creates_sends(self):
        """Test dispatch_research creates Send objects for each question."""
        from company_researcher.graph import dispatch_research
        
        state = {
            "subquestions": [
                {"question": "Q1?", "section": "SEC1", "template_name": "questions/q00.jinja"},
                {"question": "Q2?", "section": "SEC2", "template_name": "questions/q01.jinja"},
            ],
            "company_name": "TestCorp",
            "top_domain": "test.com",
            "summary_long": "Description",
        }
        
        sends = dispatch_research(state)
        
        assert len(sends) == 2
        # Each Send should target "research_question"
        for send in sends:
            assert send.node == "research_question"

    def test_should_continue_with_tools_no_tool_calls(self):
        """Test should_continue_with_tools returns summarize when no tool calls."""
        from company_researcher.graph import should_continue_with_tools
        from langchain_core.messages import AIMessage
        
        msg = MagicMock()
        msg.tool_calls = []
        
        state = {
            "messages": [msg],
            "iterations": 0,
        }
        
        result = should_continue_with_tools(state)
        
        assert result == "summarize"

    def test_should_continue_with_tools_finish_research(self):
        """Test should_continue_with_tools returns summarize on finish_research."""
        from company_researcher.graph import should_continue_with_tools
        from langchain_core.messages import AIMessage
        
        msg = MagicMock()
        msg.tool_calls = [{"name": "finish_research", "args": {"summary": "Done"}}]
        
        state = {
            "messages": [msg],
            "iterations": 0,
        }
        
        result = should_continue_with_tools(state)
        
        assert result == "summarize"

    def test_should_continue_with_tools_max_iterations(self):
        """Test should_continue_with_tools returns summarize at max iterations."""
        from company_researcher.graph import should_continue_with_tools
        
        msg = MagicMock()
        msg.tool_calls = [{"name": "web_search", "args": {"queries": ["test"]}}]
        
        state = {
            "messages": [msg],
            "iterations": 10,  # Exceeds default max
        }
        
        result = should_continue_with_tools(state)
        
        assert result == "summarize"

    def test_should_continue_with_tools_allows_tools(self):
        """Test should_continue_with_tools returns tools when allowed."""
        from company_researcher.graph import should_continue_with_tools
        from langchain_core.messages import AIMessage
        
        # Create a proper AIMessage with tool_calls
        msg = AIMessage(content="", tool_calls=[{"name": "web_search", "id": "1", "args": {"queries": ["test"]}}])
        
        state = {
            "messages": [msg],
            "iterations": 0,
        }
        
        result = should_continue_with_tools(state)
        
        assert result == "tools"

    @pytest.mark.asyncio
    async def test_finalize_report_creates_json(self, sample_subquestion_answer):
        """Test finalize_report creates valid JSON report."""
        from company_researcher.graph import finalize_report
        
        state = {
            "company_name": "TestCorp",
            "completed_answers": [sample_subquestion_answer],
        }
        
        result = await finalize_report(state)
        
        assert "final_report" in result
        parsed = json.loads(result["final_report"])
        assert parsed["company_name"] == "TestCorp"
        assert len(parsed["answers"]) == 1


class TestCompanyResearcherTools:
    """Tests for company_researcher tool definitions."""

    def test_research_tools_exist(self):
        """Test research tools are defined."""
        from company_researcher.researcher import get_research_tools
        
        tools = get_research_tools()
        
        assert len(tools) == 2
        tool_names = [t.name for t in tools]
        assert "web_search" in tool_names
        assert "finish_research" in tool_names

    def test_finish_research_returns_confirmation(self):
        """Test finish_research returns confirmation."""
        from company_researcher.researcher import finish_research
        
        result = finish_research.invoke({"summary": "Research complete."})
        
        assert "Research complete" in result


class TestCompanyResearcherGraph:
    """Tests for company_researcher graph structure."""

    def test_graph_compiles(self):
        """Test company_researcher graph compiles successfully."""
        from company_researcher.graph import company_researcher
        
        assert company_researcher is not None

    def test_subgraph_compiles(self):
        """Test research_subgraph compiles successfully."""
        from company_researcher.graph import research_subgraph
        
        assert research_subgraph is not None






