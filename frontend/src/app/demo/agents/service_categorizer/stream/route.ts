import { COMPLIANCE_REPORT } from "@/lib/demo-data";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST() {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      // --- Phase 1: Classify node ---
      send({
        type: "node_start",
        node: "classify",
        chain: "service_categorizer",
      });
      await delay(500);

      send({
        type: "llm_start",
        node: "classify",
        agent: "service_categorizer",
      });
      await delay(300);

      // Stream classification summary tokens in ~10-20 char chunks
      const classificationText = COMPLIANCE_REPORT.classification.summary;
      const classificationChunks: string[] = [];
      for (let i = 0; i < classificationText.length; i += 15) {
        classificationChunks.push(classificationText.slice(i, i + 15));
      }

      for (const chunk of classificationChunks) {
        send({
          type: "token",
          content: chunk,
          node: "classify",
          agent: "service_categorizer",
        });
        await delay(50);
      }

      await delay(1000);

      send({
        type: "node_end",
        node: "classify",
        chain: "service_categorizer",
      });
      await delay(500);

      // --- Phase 2: Obligations node ---
      send({
        type: "node_start",
        node: "obligations",
        chain: "service_categorizer",
      });
      await delay(500);

      send({
        type: "llm_start",
        node: "obligations",
        agent: "service_categorizer",
      });
      await delay(300);

      // Stream report summary tokens in ~10-20 char chunks
      const reportSummary = COMPLIANCE_REPORT.summary;
      const summaryChunks: string[] = [];
      for (let i = 0; i < reportSummary.length; i += 15) {
        summaryChunks.push(reportSummary.slice(i, i + 15));
      }

      for (const chunk of summaryChunks) {
        send({
          type: "token",
          content: chunk,
          node: "obligations",
          agent: "service_categorizer",
        });
        await delay(30);
      }

      await delay(1000);

      send({
        type: "node_end",
        node: "obligations",
        chain: "service_categorizer",
      });

      // --- Final result ---
      await delay(500);

      send({
        type: "result",
        data: COMPLIANCE_REPORT,
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
