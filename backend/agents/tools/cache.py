"""Cache stub — caching is disabled."""

from typing import Optional

CACHE_TTL = 0


def make_cache_key(query: str, max_results: int) -> str:
    """Create a deterministic cache key (kept for test compatibility)."""
    import hashlib
    normalized = query.strip().lower()
    h = hashlib.sha256(f"{normalized}:{max_results}".encode()).hexdigest()[:16]
    return f"tavily:{h}"


def get_cached(query: str, max_results: int) -> Optional[dict]:
    """Always returns None — caching is disabled."""
    return None


def set_cached(query: str, max_results: int, response: dict) -> None:
    """No-op — caching is disabled."""
    pass
