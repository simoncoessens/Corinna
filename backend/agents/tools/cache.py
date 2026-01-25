"""Redis cache for Tavily search results."""

import hashlib
import json
import os
from typing import Optional

import redis

# TTL in seconds (6 hours)
CACHE_TTL = 6 * 60 * 60

_client: Optional[redis.Redis] = None


def get_redis_client() -> Optional[redis.Redis]:
    """Get Redis client, connecting lazily."""
    global _client
    if _client is not None:
        return _client

    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        return None

    try:
        _client = redis.from_url(redis_url, decode_responses=True)
        _client.ping()
        return _client
    except Exception:
        _client = None
        return None


def make_cache_key(query: str, max_results: int) -> str:
    """Create a deterministic cache key."""
    normalized = query.strip().lower()
    h = hashlib.sha256(f"{normalized}:{max_results}".encode()).hexdigest()[:16]
    return f"tavily:{h}"


def get_cached(query: str, max_results: int) -> Optional[dict]:
    """Get cached Tavily response if available."""
    client = get_redis_client()
    if not client:
        return None

    try:
        data = client.get(make_cache_key(query, max_results))
        if data:
            return json.loads(data)
    except Exception:
        # Redis can be restarted while the app is running; drop the client so we reconnect next call.
        global _client
        _client = None
    return None


def set_cached(query: str, max_results: int, response: dict) -> None:
    """Cache a Tavily response."""
    client = get_redis_client()
    if not client:
        return

    try:
        key = make_cache_key(query, max_results)
        client.setex(key, CACHE_TTL, json.dumps(response))
    except Exception:
        global _client
        _client = None





