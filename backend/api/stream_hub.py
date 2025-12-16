"""In-memory stream hub to allow SSE clients to reconnect and resume."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import AsyncGenerator, Awaitable, Callable, Dict, Optional


@dataclass
class StreamJob:
    """A single streaming job with a replayable event buffer."""

    created_at: float = field(default_factory=time.time)
    events: list[str] = field(default_factory=list)
    done: bool = False
    error: Optional[str] = None
    _cond: asyncio.Condition = field(default_factory=asyncio.Condition)
    _task: Optional[asyncio.Task] = None

    async def append(self, chunk: str) -> None:
        async with self._cond:
            self.events.append(chunk)
            self._cond.notify_all()

    async def finish(self, error: Optional[str] = None) -> None:
        async with self._cond:
            self.done = True
            self.error = error
            self._cond.notify_all()

    async def subscribe(self, cursor: int = 0) -> AsyncGenerator[str, None]:
        """Yield buffered events then wait for new ones until done."""
        idx = max(0, cursor)
        # Replay what's already available, then stream new events.
        while True:
            # Copy buffered events while holding the lock, then yield outside
            # the lock so producers can append concurrently.
            to_yield: list[str] = []
            async with self._cond:
                if idx < len(self.events):
                    to_yield = self.events[idx:]
                    idx = len(self.events)
                done = self.done
                if not to_yield and not done:
                    await self._cond.wait()
                    continue

            for chunk in to_yield:
                yield chunk
            if done:
                return


class StreamHub:
    """Manages jobs keyed by a stable identifier."""

    def __init__(self) -> None:
        self._jobs: Dict[str, StreamJob] = {}
        self._lock = asyncio.Lock()

    async def get_or_create(
        self, key: str, runner: Callable[[StreamJob], Awaitable[None]]
    ) -> StreamJob:
        """
        Get an existing job (running or completed) or start a new one.
        The runner executes the underlying long-running work and appends chunks.
        """
        async with self._lock:
            job = self._jobs.get(key)
            if job is not None:
                return job

            job = StreamJob()
            self._jobs[key] = job
            job._task = asyncio.create_task(runner(job))
            return job


stream_hub = StreamHub()

