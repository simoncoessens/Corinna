const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const CANNED_RESPONSES: Record<string, string> = {
  default:
    "I'm Corinna, your DSA compliance assistant. I can help you understand the Digital Services Act obligations that apply to your organization. Feel free to ask about any specific article or requirement.",
  article:
    "Based on the compliance assessment for Aruba S.p.A., the applicable DSA obligations include Articles 11, 12, 14, 15, 16, 17, and 18. These cover points of contact, terms of service, transparency reporting, notice-and-action mechanisms, statements of reasons, and criminal offence notifications. Would you like me to explain any specific article in detail?",
  hosting:
    "Aruba S.p.A. is classified as a Hosting service provider under the DSA. This means the company stores information provided by users at their request on a more than temporary basis. This classification brings specific obligations under Articles 11-18 of the DSA.",
  compliance:
    "The compliance assessment has identified 7 applicable obligations for Aruba S.p.A. under the DSA. Key action items include designating points of contact for authorities and users, updating terms of service, implementing notice-and-action mechanisms, and publishing annual transparency reports.",
};

function pickResponse(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("article")) return CANNED_RESPONSES.article;
  if (lower.includes("hosting")) return CANNED_RESPONSES.hosting;
  if (lower.includes("compliance")) return CANNED_RESPONSES.compliance;
  return CANNED_RESPONSES.default;
}

export async function POST(request: Request) {
  const body = await request.json();
  const userMessage: string = body.message ?? body.input ?? "";
  const fullResponse = pickResponse(userMessage);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      // --- LLM start ---
      send({
        type: "llm_start",
        node: "chat",
        agent: "main_agent",
      });

      // --- Stream tokens word-by-word ---
      const words = fullResponse.split(" ");
      for (let i = 0; i < words.length; i++) {
        const token = i < words.length - 1 ? words[i] + " " : words[i];
        send({
          type: "token",
          content: token,
          node: "chat",
          agent: "main_agent",
        });
        await delay(30 + Math.random() * 20);
      }

      // --- Result ---
      send({
        type: "result",
        data: { response: fullResponse },
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
