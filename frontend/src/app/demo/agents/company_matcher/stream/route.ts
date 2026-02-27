import { COMPANY_MATCH_SOURCES, COMPANY_MATCH_RESULT } from "@/lib/demo-data";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST() {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      // --- Search round 1 ---
      send({
        type: "tool_start",
        name: "web_search",
        node: "search",
        input: "aruba s.p.a. italy",
      });
      await delay(300);

      send({
        type: "tool_end",
        name: "web_search",
        node: "search",
        output_length: 1500,
        sources: COMPANY_MATCH_SOURCES.slice(0, 3),
      });
      await delay(300);

      // --- Search round 2 ---
      send({
        type: "tool_start",
        name: "web_search",
        node: "search",
        input: "aruba s.p.a. cloud hosting provider",
      });
      await delay(300);

      send({
        type: "tool_end",
        name: "web_search",
        node: "search",
        output_length: 1500,
        sources: COMPANY_MATCH_SOURCES.slice(3, 5),
      });
      await delay(300);

      // --- Search round 3 ---
      send({
        type: "tool_start",
        name: "web_search",
        node: "search",
        input: "aruba.it company info domain registration",
      });
      await delay(300);

      send({
        type: "tool_end",
        name: "web_search",
        node: "search",
        output_length: 1500,
        sources: COMPANY_MATCH_SOURCES.slice(5, 8),
      });

      // --- Result ---
      await delay(500);

      send({
        type: "result",
        data: COMPANY_MATCH_RESULT,
      });

      // --- Done ---
      send({ type: "done" });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
