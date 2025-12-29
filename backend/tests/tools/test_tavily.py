"""Tests for Tavily search tools."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestTavilyTools:
    """Tests for Tavily search functions."""

    def test_get_tavily_api_key_from_env(self):
        """Test get_tavily_api_key returns env var."""
        from tools.tavily_tools import get_tavily_api_key
        
        with patch.dict("os.environ", {"TAVILY_API_KEY": "test-key-123"}):
            key = get_tavily_api_key()
            assert key == "test-key-123"

    def test_get_tavily_api_key_no_env(self):
        """Test get_tavily_api_key returns None when not set."""
        from tools.tavily_tools import get_tavily_api_key
        
        with patch.dict("os.environ", {}, clear=True):
            key = get_tavily_api_key()
            assert key is None

    def test_get_tavily_api_key_from_config(self):
        """Test get_tavily_api_key from RunnableConfig."""
        from tools.tavily_tools import get_tavily_api_key
        
        config = {
            "configurable": {
                "apiKeys": {"TAVILY_API_KEY": "config-key"}
            }
        }
        
        with patch.dict("os.environ", {"GET_API_KEYS_FROM_CONFIG": "true"}):
            key = get_tavily_api_key(config)
            assert key == "config-key"

    @pytest.mark.asyncio
    async def test_tavily_search_tool_no_api_key(self):
        """Test tavily_search_tool returns error when no API key."""
        from tools.tavily_tools import tavily_search_tool
        
        with patch.dict("os.environ", {}, clear=True):
            result = await tavily_search_tool(["test query"])
            assert "Error" in result
            assert "TAVILY_API_KEY" in result

    @pytest.mark.asyncio
    async def test_tavily_search_tool_success(self, mock_tavily_response):
        """Test tavily_search_tool formats results correctly."""
        from tools.tavily_tools import tavily_search_tool
        
        mock_client = AsyncMock()
        mock_client.search = AsyncMock(return_value=mock_tavily_response)
        
        with patch.dict("os.environ", {"TAVILY_API_KEY": "test-key"}):
            with patch("tools.tavily_tools.AsyncTavilyClient", return_value=mock_client):
                with patch("tools.tavily_tools.get_cached", return_value=None):
                    with patch("tools.tavily_tools.set_cached"):
                        result = await tavily_search_tool(["acme corporation"])
        
        assert "Search Results:" in result
        assert "Acme Corporation" in result
        assert "https://www.acme.com" in result

    @pytest.mark.asyncio
    async def test_tavily_search_tool_deduplication(self):
        """Test tavily_search_tool deduplicates by URL."""
        from tools.tavily_tools import tavily_search_tool
        
        duplicate_response = {
            "results": [
                {"title": "Result 1", "url": "https://same.com", "content": "First"},
                {"title": "Result 2", "url": "https://same.com", "content": "Duplicate"},
                {"title": "Result 3", "url": "https://other.com", "content": "Different"},
            ]
        }
        
        mock_client = AsyncMock()
        mock_client.search = AsyncMock(return_value=duplicate_response)
        
        with patch.dict("os.environ", {"TAVILY_API_KEY": "test-key"}):
            with patch("tools.tavily_tools.AsyncTavilyClient", return_value=mock_client):
                with patch("tools.tavily_tools.get_cached", return_value=None):
                    with patch("tools.tavily_tools.set_cached"):
                        result = await tavily_search_tool(["test"])
        
        # Should only include unique URLs
        assert result.count("https://same.com") == 1
        assert "https://other.com" in result

    @pytest.mark.asyncio
    async def test_tavily_search_tool_multiple_queries(self, mock_tavily_response):
        """Test tavily_search_tool handles multiple queries."""
        from tools.tavily_tools import tavily_search_tool
        
        mock_client = AsyncMock()
        mock_client.search = AsyncMock(return_value=mock_tavily_response)
        
        with patch.dict("os.environ", {"TAVILY_API_KEY": "test-key"}):
            with patch("tools.tavily_tools.AsyncTavilyClient", return_value=mock_client):
                with patch("tools.tavily_tools.get_cached", return_value=None):
                    with patch("tools.tavily_tools.set_cached"):
                        result = await tavily_search_tool(["query 1", "query 2"])
        
        # Should have called search for each query
        assert mock_client.search.call_count == 2

    @pytest.mark.asyncio
    async def test_tavily_search_tool_cache_hit(self, mock_tavily_response):
        """Test tavily_search_tool uses cached results."""
        from tools.tavily_tools import tavily_search_tool
        
        mock_client = AsyncMock()
        mock_client.search = AsyncMock(return_value=mock_tavily_response)
        
        with patch.dict("os.environ", {"TAVILY_API_KEY": "test-key"}):
            with patch("tools.tavily_tools.AsyncTavilyClient", return_value=mock_client):
                with patch("tools.tavily_tools.get_cached", return_value=mock_tavily_response):
                    result = await tavily_search_tool(["cached query"])
        
        # Should not call API when cache hit
        mock_client.search.assert_not_called()
        # Should still format results
        assert "Search Results:" in result

    @pytest.mark.asyncio
    async def test_tavily_search_tool_error_handling(self):
        """Test tavily_search_tool handles API errors."""
        from tools.tavily_tools import tavily_search_tool
        
        mock_client = AsyncMock()
        mock_client.search = AsyncMock(side_effect=Exception("API Error"))
        
        with patch.dict("os.environ", {"TAVILY_API_KEY": "test-key"}):
            with patch("tools.tavily_tools.AsyncTavilyClient", return_value=mock_client):
                with patch("tools.tavily_tools.get_cached", return_value=None):
                    result = await tavily_search_tool(["failing query"])
        
        # Should include error in results
        assert "Search failed" in result or "error" in result.lower()

    @pytest.mark.asyncio
    async def test_tavily_search_tool_no_results(self):
        """Test tavily_search_tool handles empty results."""
        from tools.tavily_tools import tavily_search_tool
        
        empty_response = {"results": []}
        
        mock_client = AsyncMock()
        mock_client.search = AsyncMock(return_value=empty_response)
        
        with patch.dict("os.environ", {"TAVILY_API_KEY": "test-key"}):
            with patch("tools.tavily_tools.AsyncTavilyClient", return_value=mock_client):
                with patch("tools.tavily_tools.get_cached", return_value=None):
                    with patch("tools.tavily_tools.set_cached"):
                        result = await tavily_search_tool(["no results query"])
        
        assert "No search results found" in result

    @pytest.mark.asyncio
    async def test_tavily_search_tool_content_truncation(self):
        """Test tavily_search_tool truncates long content."""
        from tools.tavily_tools import tavily_search_tool
        
        long_content = "x" * 5000  # Longer than 3000 char limit
        response = {
            "results": [
                {"title": "Long", "url": "https://test.com", "content": long_content}
            ]
        }
        
        mock_client = AsyncMock()
        mock_client.search = AsyncMock(return_value=response)
        
        with patch.dict("os.environ", {"TAVILY_API_KEY": "test-key"}):
            with patch("tools.tavily_tools.AsyncTavilyClient", return_value=mock_client):
                with patch("tools.tavily_tools.get_cached", return_value=None):
                    with patch("tools.tavily_tools.set_cached"):
                        result = await tavily_search_tool(["test"])
        
        # Content should be truncated
        assert len(result) < 5000

    @pytest.mark.asyncio
    async def test_tavily_search_tool_max_results_limit(self):
        """Test tavily_search_tool limits results to 10."""
        from tools.tavily_tools import tavily_search_tool
        
        many_results = {
            "results": [
                {"title": f"Result {i}", "url": f"https://test{i}.com", "content": f"Content {i}"}
                for i in range(15)
            ]
        }
        
        mock_client = AsyncMock()
        mock_client.search = AsyncMock(return_value=many_results)
        
        with patch.dict("os.environ", {"TAVILY_API_KEY": "test-key"}):
            with patch("tools.tavily_tools.AsyncTavilyClient", return_value=mock_client):
                with patch("tools.tavily_tools.get_cached", return_value=None):
                    with patch("tools.tavily_tools.set_cached"):
                        result = await tavily_search_tool(["test"])
        
        # Should only show first 10 results
        assert "test10.com" not in result or "test14.com" not in result




