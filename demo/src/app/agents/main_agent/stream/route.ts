/**
 * Proxy the main_agent chat stream to the real backend API.
 * All other demo agents remain fake — only chat is live.
 */

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://snip-tool-backend.onrender.com";

export async function POST(request: Request) {
  const body = await request.json();

  // Forward the request to the real backend
  const upstream = await fetch(`${BACKEND_URL}/agents/main_agent/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!upstream.ok || !upstream.body) {
    // Fall back to a simple error event stream
    const msg = await upstream.text().catch(() => "Backend unavailable");
    const errorStream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const send = (evt: Record<string, unknown>) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
        send({ type: "error", message: msg });
        send({ type: "done" });
        controller.close();
      },
    });
    return new Response(errorStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Pipe the real SSE stream straight through
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
