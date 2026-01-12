"""Tests for service_categorizer agent nodes."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestServiceCategorizerNodes:
    """Tests for service_categorizer graph nodes."""

    @pytest.mark.asyncio
    async def test_extract_profile_parses_json(self, sample_company_profile):
        """Test extract_profile parses JSON from message."""
        from service_categorizer.graph import extract_profile
        from langchain_core.messages import HumanMessage
        
        state = {
            "messages": [HumanMessage(content=json.dumps(sample_company_profile))],
        }
        
        result = await extract_profile(state)
        
        assert "company_profile" in result
        assert result["company_profile"]["company_name"] == "TechPlatform Inc"

    @pytest.mark.asyncio
    async def test_extract_profile_handles_invalid_json(self):
        """Test extract_profile handles invalid JSON."""
        from service_categorizer.graph import extract_profile
        from langchain_core.messages import HumanMessage
        
        state = {
            "messages": [HumanMessage(content="Not valid JSON")],
        }
        
        result = await extract_profile(state)
        
        assert "company_profile" in result
        assert "raw_input" in result["company_profile"]

    @pytest.mark.asyncio
    async def test_classify_service_calls_llm(self, sample_company_profile, sample_classification):
        """Test classify_service invokes LLM."""
        from service_categorizer.graph import classify_service
        
        mock_response = MagicMock()
        mock_response.content = json.dumps(sample_classification)
        
        mock_model = MagicMock()
        mock_model.ainvoke = AsyncMock(return_value=mock_response)
        
        with patch("service_categorizer.graph._get_model", return_value=mock_model):
            state = {"company_profile": sample_company_profile}
            result = await classify_service(state)
        
        assert "classification" in result
        assert "obligations" in result

    @pytest.mark.asyncio
    async def test_classify_service_gets_obligations(self, sample_company_profile):
        """Test classify_service retrieves applicable obligations."""
        from service_categorizer.graph import classify_service
        
        classification = {
            "territorial_scope": {"is_in_scope": True},
            "service_classification": {
                "is_intermediary": True,
                "service_category": "Hosting",
                "is_online_platform": True,
                "is_marketplace": False,
                "is_search_engine": False,
            },
            "size_designation": {"is_vlop_vlose": False},
            "summary": "In scope online platform.",
        }
        
        mock_response = MagicMock()
        mock_response.content = json.dumps(classification)
        
        mock_model = MagicMock()
        mock_model.ainvoke = AsyncMock(return_value=mock_response)
        
        with patch("service_categorizer.graph._get_model", return_value=mock_model):
            state = {"company_profile": sample_company_profile}
            result = await classify_service(state)
        
        assert len(result["obligations"]) > 0

    @pytest.mark.asyncio
    async def test_analyze_obligations_no_obligations(self, sample_company_profile):
        """Test analyze_obligations handles empty obligations."""
        from service_categorizer.graph import analyze_obligations
        
        state = {
            "company_profile": sample_company_profile,
            "classification": {},
            "obligations": [],
        }
        
        result = await analyze_obligations(state)
        
        assert result["obligation_analyses"] == []

    @pytest.mark.asyncio
    async def test_generate_report_creates_json(self, sample_company_profile, sample_classification):
        """Test generate_report creates valid JSON."""
        from service_categorizer.graph import generate_report
        
        mock_response = MagicMock()
        mock_response.content = "Summary of compliance requirements."
        
        mock_model = MagicMock()
        mock_model.ainvoke = AsyncMock(return_value=mock_response)
        
        with patch("service_categorizer.graph._get_model", return_value=mock_model):
            state = {
                "company_profile": sample_company_profile,
                "classification": sample_classification,
                "obligation_analyses": [],
            }
            result = await generate_report(state)
        
        assert "final_report" in result
        parsed = json.loads(result["final_report"])
        assert parsed["company_name"] == "TechPlatform Inc"


class TestServiceCategorizerUtils:
    """Tests for service_categorizer utility functions."""

    def test_parse_json_markdown_block(self):
        """Test _parse_json extracts from markdown."""
        from service_categorizer.graph import _parse_json
        
        text = """Analysis:
```json
{"is_in_scope": true}
```
"""
        result = _parse_json(text)
        assert result == {"is_in_scope": True}

    def test_get_model_returns_chatgpt(self):
        """Test _get_model returns ChatOpenAI instance."""
        from service_categorizer.graph import _get_model
        
        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key", "OPENAI_BASE_URL": "http://test"}):
            model = _get_model()
            assert model is not None


class TestServiceCategorizerGraph:
    """Tests for service_categorizer graph structure."""

    def test_graph_compiles(self):
        """Test service_categorizer graph compiles successfully."""
        from service_categorizer.graph import service_categorizer
        
        assert service_categorizer is not None

    def test_graph_has_nodes(self):
        """Test service_categorizer graph has expected nodes."""
        from service_categorizer.graph import _builder
        
        assert "extract_profile" in _builder.nodes
        assert "classify_service" in _builder.nodes
        assert "analyze_obligations" in _builder.nodes
        assert "generate_report" in _builder.nodes






