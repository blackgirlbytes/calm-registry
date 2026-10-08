import { getOwnerId, unauthorized } from "@/lib/auth";
import { parseSeed } from "@/lib/profile";
import { registryStore } from "@/lib/registry-store";
import type { ChatMessage } from "@/lib/types";
import { AGENT_URL, editSettings, grantToken, intakeSettings, isVoiceConfigured, reviewSettings } from "@/lib/voice/settings";

export const runtime = "nodejs";

export function GET() {
  return Response.json({ enabled: isVoiceConfigured() });
}

type Body = { mode?: string; messages?: unknown; registryId?: unknown; seed?: unknown; itemId?: unknown; intent?: unknown };

/** Returns a short-lived token plus the agent Settings, so the browser can talk to Deepgram directly. */
export async function POST(request: Request) {
  if (!isVoiceConfigured()) return Response.json({ error: "Voice isn't set up yet." }, { status: 503 });
  const ownerId = await getOwnerId(request);
  if (!ownerId) return unauthorized();

  const body = (await request.json().catch(() => ({}))) as Body;
  let config: { settings: unknown; greeting: string };

  try {
    if (body.mode === "edit" || body.mode === "review") {
      if (typeof body.registryId !== "string") return Response.json({ error: "registryId is required." }, { status: 400 });
      const registry = await registryStore().getById(body.registryId);
      if (!registry || registry.ownerId !== ownerId) return Response.json({ error: "Registry not found." }, { status: 404 });
      config =
        body.mode === "edit"
          ? editSettings(registry)
          : reviewSettings(registry, typeof body.itemId === "string" ? body.itemId : null, body.intent === "pick" ? "pick" : "review");
    } else {
      const messages: ChatMessage[] = (Array.isArray(body.messages) ? body.messages : [])
        .slice(-40)
        .map((m: { role?: unknown; content?: unknown }) => ({
          role: m?.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: String(m?.content ?? "").slice(0, 1000),
        }))
        .filter((m) => m.content.trim());
      config = intakeSettings(messages, parseSeed(body.seed));
    }
    return Response.json({ token: await grantToken(), url: AGENT_URL, ...config });
  } catch (error) {
    console.error("Voice session failed", error);
    return Response.json({ error: "Voice couldn't start. You can keep typing." }, { status: 502 });
  }
}
