"""Unit tests for utility functions."""

import os
import pytest
from unittest.mock import patch


class TestCompanyMatcherUtils:
    """Tests for company_matcher utility functions."""

    def test_to_top_domain_full_url(self):
        """Test _to_top_domain with full URL."""
        from company_matcher.graph import _to_top_domain
        
        assert _to_top_domain("https://www.acme.com/about") == "acme.com"
        assert _to_top_domain("http://www.example.org/page") == "example.org"
        assert _to_top_domain("https://subdomain.company.com") == "subdomain.company.com"

    def test_to_top_domain_bare_domain(self):
        """Test _to_top_domain with bare domain."""
        from company_matcher.graph import _to_top_domain
        
        assert _to_top_domain("acme.com") == "acme.com"
        assert _to_top_domain("www.acme.com") == "acme.com"
        assert _to_top_domain("www.example.org/path") == "example.org"

    def test_to_top_domain_empty_or_none(self):
        """Test _to_top_domain with empty or None values."""
        from company_matcher.graph import _to_top_domain
        
        assert _to_top_domain("") == ""
        assert _to_top_domain("   ") == ""
        assert _to_top_domain(None) == ""

    def test_to_top_domain_strips_www(self):
        """Test that www. prefix is stripped."""
        from company_matcher.graph import _to_top_domain
        
        assert _to_top_domain("https://www.google.com") == "google.com"
        assert _to_top_domain("www.facebook.com") == "facebook.com"

    def test_extract_company_name_from_messages(self, human_message):
        """Test _extract_company_name extracts from HumanMessage."""
        from company_matcher.graph import _extract_company_name
        
        messages = [human_message]
        name = _extract_company_name(messages)
        
        assert name == "Acme Corporation"

    def test_extract_company_name_multiple_messages(self, human_message, ai_message):
        """Test _extract_company_name finds last human message."""
        from company_matcher.graph import _extract_company_name
        from langchain_core.messages import HumanMessage
        
        later_msg = HumanMessage(content="Microsoft Corporation")
        messages = [human_message, ai_message, later_msg]
        
        name = _extract_company_name(messages)
        assert name == "Microsoft Corporation"

    def test_extract_company_name_empty_raises(self):
        """Test _extract_company_name raises on empty messages."""
        from company_matcher.graph import _extract_company_name
        
        with pytest.raises(ValueError, match="No company name found"):
            _extract_company_name([])

    def test_parse_result_from_messages_valid_json(self, sample_company_match_result):
        """Test _parse_result_from_messages extracts valid JSON."""
        from company_matcher.graph import _parse_result_from_messages
        from langchain_core.messages import AIMessage
        
        json_content = '{"exact_match": {"name": "Test"}, "suggestions": []}'
        messages = [AIMessage(content=json_content)]
        
        result = _parse_result_from_messages(messages)
        assert '"exact_match"' in result
        assert '"suggestions"' in result

    def test_parse_result_from_messages_ignores_human(self):
        """Test _parse_result_from_messages ignores HumanMessages."""
        from company_matcher.graph import _parse_result_from_messages
        from langchain_core.messages import AIMessage, HumanMessage
        
        # HumanMessage with JSON should be ignored
        human = HumanMessage(content='{"exact_match": null, "suggestions": []}')
        ai = AIMessage(content='{"exact_match": {"name": "Real"}, "suggestions": []}')
        
        result = _parse_result_from_messages([human, ai])
        assert '"name": "Real"' in result

    def test_parse_result_from_messages_no_json(self):
        """Test _parse_result_from_messages returns empty dict on no JSON."""
        from company_matcher.graph import _parse_result_from_messages
        from langchain_core.messages import AIMessage
        
        messages = [AIMessage(content="No JSON here.")]
        result = _parse_result_from_messages(messages)
        
        assert result == "{}"

    def test_load_prompt(self):
        """Test load_prompt loads and renders template."""
        from company_matcher.graph import load_prompt
        
        # Should load the prompt.jinja template
        prompt = load_prompt("prompt.jinja", company_name="TestCorp", country_of_establishment="Belgium", max_iterations=2, max_suggestions=3, max_queries_per_call=5)
        
        assert "TestCorp" in prompt
        assert "Belgium" in prompt


class TestServiceCategorizerUtils:
    """Tests for service_categorizer utility functions."""

    def test_parse_json_from_markdown(self):
        """Test _parse_json extracts JSON from markdown code block."""
        from service_categorizer.graph import _parse_json
        
        text = """Here is the result:
```json
{"key": "value", "number": 42}
```
End of response."""
        
        result = _parse_json(text)
        assert result == {"key": "value", "number": 42}

    def test_parse_json_from_plain_code_block(self):
        """Test _parse_json with plain code block."""
        from service_categorizer.graph import _parse_json
        
        text = """Result:
```
{"status": "ok"}
```"""
        
        result = _parse_json(text)
        assert result == {"status": "ok"}

    def test_parse_json_plain_json(self):
        """Test _parse_json with plain JSON string."""
        from service_categorizer.graph import _parse_json
        
        text = '{"name": "test", "active": true}'
        result = _parse_json(text)
        
        assert result == {"name": "test", "active": True}

    def test_parse_json_with_surrounding_text(self):
        """Test _parse_json extracts JSON from surrounding text."""
        from service_categorizer.graph import _parse_json
        
        text = 'The classification is {"category": "Hosting"} as determined.'
        result = _parse_json(text)
        
        assert result == {"category": "Hosting"}


class TestCompanyResearcherUtils:
    """Tests for company_researcher utility functions."""

    def test_get_api_key_for_model_openai(self):
        """Test get_api_key_for_model for OpenAI models."""
        from company_researcher.utils import get_api_key_for_model
        
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key-123"}):
            key = get_api_key_for_model("openai:gpt-4")
            assert key == "test-key-123"

    def test_get_api_key_for_model_anthropic(self):
        """Test get_api_key_for_model for Anthropic models."""
        from company_researcher.utils import get_api_key_for_model
        
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "anthropic-key"}):
            key = get_api_key_for_model("anthropic:claude-3")
            assert key == "anthropic-key"

    def test_get_api_key_for_model_from_config(self):
        """Test get_api_key_for_model from RunnableConfig."""
        from company_researcher.utils import get_api_key_for_model
        
        config = {
            "configurable": {
                "apiKeys": {"OPENAI_API_KEY": "config-key"}
            }
        }
        
        with patch.dict(os.environ, {"GET_API_KEYS_FROM_CONFIG": "true"}):
            key = get_api_key_for_model("openai:deepseek-chat", config)
            assert key == "config-key"

    def test_get_api_key_for_model_unknown(self):
        """Test get_api_key_for_model returns None for unknown model."""
        from company_researcher.utils import get_api_key_for_model
        
        key = get_api_key_for_model("unknown:model")
        assert key is None

    def test_get_today_str_format(self):
        """Test get_today_str returns formatted date."""
        from company_researcher.utils import get_today_str
        
        result = get_today_str()
        
        # Should contain day of week and month
        assert any(day in result for day in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
        assert any(month in result for month in ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])


class TestCacheUtils:
    """Tests for cache utility functions."""

    def test_make_cache_key_deterministic(self):
        """Test make_cache_key produces deterministic keys."""
        from tools.cache import make_cache_key
        
        key1 = make_cache_key("test query", 10)
        key2 = make_cache_key("test query", 10)
        
        assert key1 == key2
        assert key1.startswith("tavily:")

    def test_make_cache_key_different_queries(self):
        """Test make_cache_key produces different keys for different queries."""
        from tools.cache import make_cache_key
        
        key1 = make_cache_key("query one", 10)
        key2 = make_cache_key("query two", 10)
        
        assert key1 != key2

    def test_make_cache_key_different_max_results(self):
        """Test make_cache_key includes max_results in key."""
        from tools.cache import make_cache_key
        
        key1 = make_cache_key("same query", 5)
        key2 = make_cache_key("same query", 10)
        
        assert key1 != key2

    def test_make_cache_key_normalizes_case(self):
        """Test make_cache_key normalizes query case."""
        from tools.cache import make_cache_key
        
        key1 = make_cache_key("Test Query", 10)
        key2 = make_cache_key("test query", 10)
        
        assert key1 == key2

    def test_make_cache_key_strips_whitespace(self):
        """Test make_cache_key strips whitespace."""
        from tools.cache import make_cache_key
        
        key1 = make_cache_key("  test query  ", 10)
        key2 = make_cache_key("test query", 10)
        
        assert key1 == key2
