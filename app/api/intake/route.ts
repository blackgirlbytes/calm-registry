import { nextIntakeTurn, OPENING } from "@/lib/ai/intake";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let messages: ChatMessage[];
  try {
    ({ messages } = (await request.json()) as { messages: ChatMessage[] });
    if (!Array.isArray(messages)) throw new Error();
  } catch {
    return Response.json({ error: "Send { messages } as JSON." }, { status: 400 });
  }

  if (messages.length === 0) return Response.json(OPENING);

  try {
    const cleaned = messages.slice(-40).map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(m.content).slice(0, 2000),
    }));
    return Response.json(await nextIntakeTurn(cleaned));
  } catch (error) {
    console.error("Intake failed", error);
    return Response.json({ error: "I lost my train of thought. Please try that again." }, { status: 502 });
  }
}
