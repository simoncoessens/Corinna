"""Tests for company_matcher agent nodes."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestCompanyMatcherNodes:
    """Tests for company_matcher graph nodes."""

    @pytest.mark.asyncio
    async def test_prepare_prompt_extracts_company_name(self, human_message):
        """Test prepare_prompt extracts company name from messages."""
        from company_matcher.graph import prepare_prompt
        
        state = {
            "messages": [human_message],
            "country_of_establishment": "Belgium",
        }
        
        result = await prepare_prompt(state)
        
        assert result["company_name"] == "Acme Corporation"
        assert result["country_of_establishment"] == "Belgium"
        assert len(result["messages"]) == 1

    @pytest.mark.asyncio
    async def test_prepare_prompt_includes_country(self, human_message):
        """Test prepare_prompt includes country in state."""
        from company_matcher.graph import prepare_prompt
        
        state = {
            "messages": [human_message],
            "country_of_establishment": "Netherlands",
        }
        
        result = await prepare_prompt(state)
        
        assert result["country_of_establishment"] == "Netherlands"

    @pytest.mark.asyncio
    async def test_prepare_prompt_handles_empty_country(self, human_message):
        """Test prepare_prompt handles missing country."""
        from company_matcher.graph import prepare_prompt
        
        state = {
            "messages": [human_message],
            "country_of_establishment": "",
        }
        
        result = await prepare_prompt(state)
        
        assert result["country_of_establishment"] == ""

    @pytest.mark.asyncio
    async def test_run_agent_calls_llm(self, human_message, mock_chat_openai):
        """Test run_agent invokes LLM with tools."""
        from company_matcher.graph import run_agent
        
        with patch("company_matcher.graph.ChatOpenAI", return_value=mock_chat_openai):
            state = {"messages": [human_message]}
            result = await run_agent(state)
        
        assert "messages" in result
        assert len(result["messages"]) == 1

    @pytest.mark.asyncio
    async def test_finalize_result_parses_json(self, sample_company_match):
        """Test finalize_result parses JSON from messages."""
        from company_matcher.graph import finalize_result
        from langchain_core.messages import AIMessage
        
        json_content = json.dumps({
            "exact_match": sample_company_match,
            "suggestions": [],
        })
        
        state = {
            "company_name": "Acme Corporation",
            "messages": [AIMessage(content=json_content)],
        }
        
        result = await finalize_result(state)
        
        assert "match_result" in result
        parsed = json.loads(result["match_result"])
        assert parsed["input_name"] == "Acme Corporation"
        assert parsed["exact_match"]["name"] == "Acme Corporation"

    @pytest.mark.asyncio
    async def test_finalize_result_handles_no_match(self):
        """Test finalize_result handles no exact match."""
        from company_matcher.graph import finalize_result
        from langchain_core.messages import AIMessage
        
        json_content = json.dumps({
            "exact_match": None,
            "suggestions": [
                {
                    "name": "Similar Corp",
                    "top_domain": "similar.com",
                    "confidence": "medium",
                    "summary_long": "A similar company.",
                }
            ],
        })
        
        state = {
            "company_name": "Unknown Corp",
            "messages": [AIMessage(content=json_content)],
        }
        
        result = await finalize_result(state)
        
        parsed = json.loads(result["match_result"])
        # exact_match may be absent or None - check it's not a truthy object
        assert not parsed.get("exact_match")
        assert len(parsed["suggestions"]) == 1

    @pytest.mark.asyncio
    async def test_finalize_result_normalizes_legacy_fields(self):
        """Test finalize_result normalizes legacy field names."""
        from company_matcher.graph import finalize_result
        from langchain_core.messages import AIMessage
        
        # Legacy format with 'url' instead of 'top_domain'
        json_content = json.dumps({
            "exact_match": {
                "name": "Test Corp",
                "url": "https://www.testcorp.com/about",
                "confidence": "high",
                "description": "Short description",
                "extended_summary": "Extended description here.",
            },
            "suggestions": [],
        })
        
        state = {
            "company_name": "Test Corp",
            "messages": [AIMessage(content=json_content)],
        }
        
        result = await finalize_result(state)
        
        parsed = json.loads(result["match_result"])
        # Should normalize url to top_domain
        assert parsed["exact_match"]["top_domain"] == "testcorp.com"
        # Should use extended_summary as summary_long
        assert "Extended description" in parsed["exact_match"]["summary_long"]

    @pytest.mark.asyncio
    async def test_finalize_result_handles_invalid_json(self):
        """Test finalize_result handles invalid JSON gracefully."""
        from company_matcher.graph import finalize_result
        from langchain_core.messages import AIMessage
        
        state = {
            "company_name": "Test Corp",
            "messages": [AIMessage(content="No valid JSON here.")],
        }
        
        result = await finalize_result(state)
        
        # Should still produce a result
        parsed = json.loads(result["match_result"])
        assert parsed["input_name"] == "Test Corp"
        # exact_match may be absent or None
        assert not parsed.get("exact_match")
        assert parsed["suggestions"] == []


class TestCompanyMatcherTools:
    """Tests for company_matcher tool definitions."""

    def test_web_search_tool_exists(self):
        """Test web_search tool is defined."""
        from company_matcher.graph import web_search
        
        assert web_search is not None
        assert hasattr(web_search, "name")

    def test_finish_matching_tool_exists(self):
        """Test finish_matching tool is defined."""
        from company_matcher.graph import finish_matching
        
        assert finish_matching is not None

    def test_finish_matching_returns_confirmation(self):
        """Test finish_matching returns confirmation string."""
        from company_matcher.graph import finish_matching
        
        result_json = '{"exact_match": null, "suggestions": []}'
        result = finish_matching.invoke({"result_json": result_json})
        
        assert "Matching complete" in result


class TestCompanyMatcherGraph:
    """Tests for company_matcher graph structure."""

    def test_graph_compiles(self):
        """Test company_matcher graph compiles successfully."""
        from company_matcher.graph import company_matcher
        
        assert company_matcher is not None

    def test_graph_has_nodes(self):
        """Test company_matcher graph has expected nodes."""
        from company_matcher.graph import _builder
        
        # Check that nodes were added
        assert "prepare_prompt" in _builder.nodes
        assert "agent" in _builder.nodes
        assert "tools" in _builder.nodes
        assert "finalize" in _builder.nodes






