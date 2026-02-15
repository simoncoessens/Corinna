import { RESEARCH_SOURCES, RESEARCH_RESULT } from "@/lib/demo-data";
import type { SearchSource } from "@/types/api";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Chunk an array into groups of a given size.
 */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Search queries used to simulate the research agent querying the web.
 */
const SEARCH_QUERIES = [
  "Aruba S.p.A. headquarters Italy registered office",
  "Aruba S.p.A. EU monthly active users",
  "Aruba S.p.A. service languages customer support",
  "Aruba S.p.A. pricing currency EUR transactions",
  "Aruba S.p.A. EU services accessibility geo-blocking",
  "Aruba S.p.A. top-level domain .it .eu registry",
  "Aruba S.p.A. mobile apps EU app stores",
  "Aruba S.p.A. geo-blocking IP access EU",
  "Aruba S.p.A. number of employees staff size",
  "Aruba S.p.A. annual revenue turnover balance sheet",
  "Aruba S.p.A. mere conduit internet access provider",
  "Aruba S.p.A. caching CDN service HiSpeed Cache",
  "Aruba S.p.A. search engine web search functionality",
  "Aruba S.p.A. hosting service cloud web hosting DSA",
  "Aruba S.p.A. online platform user content dissemination",
  "Aruba S.p.A. online marketplace third-party sellers",
  "Aruba S.p.A. data center infrastructure Italy Europe",
  "Aruba S.p.A. PEC certified email service",
  "Aruba S.p.A. domain registration services",
  "Aruba S.p.A. cloud computing enterprise solutions",
  "Aruba S.p.A. DSA transparency report intermediary",
  "Aruba S.p.A. company profile financial data",
  "Aruba S.p.A. e-commerce tools hosting",
  "Aruba S.p.A. Wikipedia overview history",
  "Aruba S.p.A. certification digital signature services",
  "Aruba S.p.A. cloud VPS virtual private server",
  "Aruba S.p.A. global cloud data center locations",
  "Aruba S.p.A. .cloud TLD registry operator",
  "Aruba S.p.A. annual report 2023 financials",
  "Aruba S.p.A. sede legale legal headquarters",
  "Aruba S.p.A. EU Digital Services Act compliance",
  "Aruba S.p.A. intermediary service provider classification",
  "Aruba S.p.A. content moderation policies",
  "Aruba S.p.A. customer base EU reach",
];

export async function POST() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      /**
       * Helper to emit a single SSE event.
       */
      function emit(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      // Divide RESEARCH_SOURCES into chunks of ~9 for distribution across tool_end events
      const sourceChunks: SearchSource[][] = chunkArray(RESEARCH_SOURCES, 9);

      const totalSearchCycles = Math.min(sourceChunks.length, SEARCH_QUERIES.length);

      // -------------------------------------------------------------------
      // Phase 1 - Research (~10s): tool_start/tool_end pairs with sources
      // -------------------------------------------------------------------
      for (let i = 0; i < Math.min(totalSearchCycles, 25); i++) {
        const query = SEARCH_QUERIES[i % SEARCH_QUERIES.length];
        const sources = sourceChunks[i] ?? [];

        emit({
          type: "tool_start",
          name: "web_search",
          node: "research",
          input: query,
        });

        await delay(180);

        emit({
          type: "tool_end",
          name: "web_search",
          node: "research",
          output_length: 1500 + Math.floor(Math.random() * 1500),
          sources,
        });

        await delay(180);

        // Intersperse llm_start events every 4 search cycles
        if (i % 4 === 3) {
          emit({
            type: "llm_start",
            node: "research",
            agent: "company_researcher",
          });
          await delay(120);
        }
      }

      // -------------------------------------------------------------------
      // Phase 2 - Summarization (~3s): more llm_start, fewer searches
      // -------------------------------------------------------------------
      for (let i = 25; i < Math.min(totalSearchCycles, 31); i++) {
        emit({
          type: "llm_start",
          node: "research",
          agent: "company_researcher",
        });
        await delay(200);

        const query = SEARCH_QUERIES[i % SEARCH_QUERIES.length];
        const sources = sourceChunks[i] ?? [];

        emit({
          type: "tool_start",
          name: "web_search",
          node: "research",
          input: query,
        });

        await delay(100);

        emit({
          type: "tool_end",
          name: "web_search",
          node: "research",
          output_length: 1200 + Math.floor(Math.random() * 800),
          sources,
        });

        await delay(200);
      }

      // Phase 2 tail: mostly llm_start events (summarization in progress)
      for (let j = 0; j < 4; j++) {
        emit({
          type: "llm_start",
          node: "research",
          agent: "company_researcher",
        });
        await delay(350);
      }

      // -------------------------------------------------------------------
      // Phase 3 - Finalize (~2s): node_start then wait
      // -------------------------------------------------------------------
      emit({
        type: "node_start",
        node: "finalize",
        chain: "finalize_research",
      });

      await delay(2000);

      // -------------------------------------------------------------------
      // Phase 4 - Result: emit research result and done
      // -------------------------------------------------------------------
      emit({
        type: "result",
        data: RESEARCH_RESULT,
      });

      emit({
        type: "done",
      });

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
