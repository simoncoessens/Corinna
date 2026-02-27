/**
 * Shared SSE streaming utility.
 * Replaces the copy-pasted fetch → getReader → TextDecoder → buffer → parse
 * pattern found in 6 components.
 */

import { API_BASE_URL } from "@/services/api";
import type { StreamEvent } from "@/types/api";

/**
 * Opens an SSE connection to the given endpoint and yields parsed StreamEvents.
 *
 * @param endpoint - API path (e.g. "/agents/main_agent/stream")
 * @param body     - JSON-serialisable request body
 * @param signal   - Optional AbortSignal for cancellation
 */
export async function* streamSSE(
  endpoint: string,
  body: unknown,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      detail
        ? `API Error: ${response.status} - ${detail.slice(0, 500)}`
        : `API Error: ${response.status}`,
    );
  }

  if (!response.body) {
    throw new Error("No response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        try {
          yield JSON.parse(data) as StreamEvent;
        } catch {
          // Skip invalid JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
