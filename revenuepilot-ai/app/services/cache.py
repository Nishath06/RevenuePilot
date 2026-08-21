"""
RevenuePilot AI — In-memory Cache Service
TTL-based simple cache to avoid hitting MongoDB on every request.
"""
from __future__ import annotations

import asyncio
import time
from typing import Any

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class TTLCache:
    """Thread-safe in-memory TTL cache backed by asyncio.Lock."""

    def __init__(self, ttl: int = 300) -> None:
        self._ttl = ttl
        self._store: dict[str, tuple[Any, float]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Any | None:
        async with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expiry = entry
            if time.monotonic() > expiry:
                del self._store[key]
                return None
            return value

    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        async with self._lock:
            expires_at = time.monotonic() + (ttl or self._ttl)
            self._store[key] = (value, expires_at)

    async def delete(self, key: str) -> None:
        async with self._lock:
            self._store.pop(key, None)

    async def clear(self) -> None:
        async with self._lock:
            self._store.clear()

    async def size(self) -> int:
        async with self._lock:
            return len(self._store)


# Module-level singleton
cache = TTLCache(ttl=settings.CACHE_TTL_SECONDS)
