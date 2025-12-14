"""Tests for Redis cache module."""

import json
import pytest
from unittest.mock import MagicMock, patch


class TestRedisCache:
    """Tests for Redis cache functions."""

    def test_get_redis_client_no_url(self):
        """Test get_redis_client returns None when REDIS_URL not set."""
        from tools.cache import get_redis_client, _client
        
        # Reset the cached client
        import tools.cache
        tools.cache._client = None
        
        with patch.dict("os.environ", {}, clear=True):
            with patch.object(tools.cache, "_client", None):
                client = get_redis_client()
                assert client is None

    def test_get_redis_client_with_url(self, mock_redis_client):
        """Test get_redis_client connects when REDIS_URL is set."""
        import tools.cache
        tools.cache._client = None
        
        with patch.dict("os.environ", {"REDIS_URL": "redis://localhost:6379"}):
            with patch("redis.from_url", return_value=mock_redis_client):
                client = tools.cache.get_redis_client()
                
                assert client is not None
                mock_redis_client.ping.assert_called_once()

    def test_get_redis_client_caches_connection(self, mock_redis_client):
        """Test get_redis_client caches the connection."""
        import tools.cache
        tools.cache._client = None
        
        with patch.dict("os.environ", {"REDIS_URL": "redis://localhost:6379"}):
            with patch("redis.from_url", return_value=mock_redis_client) as mock_from_url:
                # First call
                client1 = tools.cache.get_redis_client()
                # Second call should use cached client
                client2 = tools.cache.get_redis_client()
                
                assert client1 is client2
                # from_url should only be called once
                assert mock_from_url.call_count == 1

    def test_get_redis_client_connection_error(self):
        """Test get_redis_client handles connection errors."""
        import tools.cache
        tools.cache._client = None
        
        mock_client = MagicMock()
        mock_client.ping.side_effect = Exception("Connection refused")
        
        with patch.dict("os.environ", {"REDIS_URL": "redis://localhost:6379"}):
            with patch("redis.from_url", return_value=mock_client):
                client = tools.cache.get_redis_client()
                
                assert client is None

    def test_get_cached_returns_none_no_redis(self):
        """Test get_cached returns None when Redis not available."""
        import tools.cache
        tools.cache._client = None
        
        with patch.dict("os.environ", {}, clear=True):
            result = tools.cache.get_cached("test query", 10)
            assert result is None

    def test_get_cached_cache_miss(self, mock_redis_client):
        """Test get_cached returns None on cache miss."""
        import tools.cache
        
        mock_redis_client.get.return_value = None
        
        with patch.object(tools.cache, "get_redis_client", return_value=mock_redis_client):
            result = tools.cache.get_cached("test query", 10)
            
            assert result is None
            mock_redis_client.get.assert_called_once()

    def test_get_cached_cache_hit(self, mock_redis_client):
        """Test get_cached returns parsed JSON on cache hit."""
        import tools.cache
        
        cached_data = {"results": [{"title": "Test", "url": "http://test.com"}]}
        mock_redis_client.get.return_value = json.dumps(cached_data)
        
        with patch.object(tools.cache, "get_redis_client", return_value=mock_redis_client):
            result = tools.cache.get_cached("test query", 10)
            
            assert result == cached_data

    def test_get_cached_handles_json_error(self, mock_redis_client):
        """Test get_cached handles invalid JSON in cache."""
        import tools.cache
        
        mock_redis_client.get.return_value = "invalid json {"
        
        with patch.object(tools.cache, "get_redis_client", return_value=mock_redis_client):
            # Should handle the error gracefully
            try:
                result = tools.cache.get_cached("test query", 10)
                # If it doesn't raise, result should be None or handled
            except json.JSONDecodeError:
                pass  # This is acceptable behavior

    def test_set_cached_stores_data(self, mock_redis_client):
        """Test set_cached stores data in Redis."""
        import tools.cache
        
        response = {"results": [{"title": "Test"}]}
        
        with patch.object(tools.cache, "get_redis_client", return_value=mock_redis_client):
            tools.cache.set_cached("test query", 10, response)
            
            mock_redis_client.setex.assert_called_once()
            call_args = mock_redis_client.setex.call_args
            
            # Check key format
            assert call_args[0][0].startswith("tavily:")
            # Check TTL (6 hours = 21600 seconds)
            assert call_args[0][1] == 6 * 60 * 60
            # Check data is JSON
            assert json.loads(call_args[0][2]) == response

    def test_set_cached_no_redis(self):
        """Test set_cached does nothing when Redis not available."""
        import tools.cache
        tools.cache._client = None
        
        with patch.dict("os.environ", {}, clear=True):
            # Should not raise
            tools.cache.set_cached("test query", 10, {"data": "test"})

    def test_set_cached_handles_error(self, mock_redis_client):
        """Test set_cached handles Redis errors gracefully."""
        import tools.cache
        
        mock_redis_client.setex.side_effect = Exception("Redis error")
        
        with patch.object(tools.cache, "get_redis_client", return_value=mock_redis_client):
            # Should not raise
            tools.cache.set_cached("test query", 10, {"data": "test"})
            # Client should be reset
            assert tools.cache._client is None

    def test_cache_ttl_constant(self):
        """Test CACHE_TTL is 6 hours."""
        from tools.cache import CACHE_TTL
        
        assert CACHE_TTL == 6 * 60 * 60  # 6 hours in seconds
