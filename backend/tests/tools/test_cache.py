"""Tests for cache module (caching disabled)."""

from tools.cache import get_cached, set_cached, make_cache_key


class TestCacheDisabled:
    """Tests for no-op cache functions."""

    def test_get_cached_always_none(self):
        """get_cached always returns None when caching is disabled."""
        assert get_cached("test query", 10) is None

    def test_set_cached_is_noop(self):
        """set_cached should not raise."""
        set_cached("test query", 10, {"data": "test"})

    def test_make_cache_key_deterministic(self):
        """make_cache_key produces consistent keys."""
        key1 = make_cache_key("hello", 5)
        key2 = make_cache_key("hello", 5)
        assert key1 == key2
        assert key1.startswith("tavily:")

    def test_make_cache_key_differs_for_different_inputs(self):
        """Different inputs produce different keys."""
        key1 = make_cache_key("hello", 5)
        key2 = make_cache_key("world", 5)
        assert key1 != key2
