"""Shared metrics collection for SSE streaming endpoints."""

import json
from typing import Any, AsyncGenerator, Dict, List, Optional


class StreamMetrics:
    """Accumulates metrics from parsed SSE events during streaming."""

    def __init__(self) -> None:
        self.llm_calls: int = 0
        self.search_calls: int = 0
        self.sources: List[Dict[str, Any]] = []
        self.tools_used: List[str] = []
        self.error: Optional[str] = None

    def process_event(self, chunk: str) -> None:
        """Parse an SSE chunk and accumulate metrics."""
        if not chunk.startswith("data: "):
            return
        try:
            event_data = json.loads(chunk[6:])
            event_type = event_data.get("type")
            if event_type == "llm_start":
                self.llm_calls += 1
            elif event_type == "tool_start":
                tool_name = event_data.get("name", "")
                if tool_name and tool_name not in self.tools_used:
                    self.tools_used.append(tool_name)
            elif event_type == "tool_end":
                name = event_data.get("name", "")
                if "search" in name.lower():
                    self.search_calls += 1
                sources = event_data.get("sources", [])
                if sources:
                    self.sources.extend(sources)
        except json.JSONDecodeError:
            pass

    def flush_to_tracker(self, tracker: Any, step_id: str) -> None:
        """Flush accumulated metrics to the session tracker."""
        if self.llm_calls or self.search_calls or self.sources:
            tracker.update_step_metrics(
                step_id,
                llm_calls=self.llm_calls,
                search_calls=self.search_calls,
                sources=self.sources if self.sources else None,
            )
        if self.error:
            tracker.complete_step(step_id, error_message=self.error)


async def tracked_stream(
    stream: AsyncGenerator[str, None],
    tracker: Any = None,
    step_id: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """Async generator wrapper that passes through SSE chunks while collecting metrics.

    Metrics are flushed to the session tracker once streaming ends.
    """
    metrics = StreamMetrics()
    try:
        async for chunk in stream:
            metrics.process_event(chunk)
            yield chunk
    except Exception as e:
        metrics.error = str(e)
        raise
    finally:
        if step_id and tracker:
            try:
                metrics.flush_to_tracker(tracker, step_id)
            except Exception:
                pass  # Never let tracking errors break the response
