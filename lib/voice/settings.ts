import "server-only";
import { z } from "zod";
import { INTAKE_GUIDANCE, todayLine, VOICE_RULES } from "../ai/prompts";
import { ParentProfileSchema, type ChatMessage, type Registry } from "../types";

export const AGENT_URL = "wss://agent.deepgram.com/v1/agent/converse";

export function isVoiceConfigured() {
  return Boolean(process.env.DEEPGRAM_API_KEY);
}

/** Mints a 30-second token the browser uses to open the agent socket. The API key needs Member permission. */
export async function grantToken(): Promise<string> {
  const response = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: { authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
  });
  if (!response.ok) throw new Error(`Deepgram token request failed (${response.status}): ${(await response.text()).slice(0, 200)}`);
  return ((await response.json()) as { access_token: string }).access_token;
}

const KEYTERMS = ["bassinet", "swaddle", "onesie", "stroller", "car seat", "Target", "Walmart", "Amazon"];

function profileParameters() {
  const { $schema: _schema, ...schema } = z.toJSONSchema(ParentProfileSchema) as Record<string, unknown>;
  return schema;
}

function baseSettings(mode: "intake" | "edit", prompt: string, functions: unknown[], greeting: string, history: ChatMessage[] = []) {
  return {
    type: "Settings",
    tags: ["calm-registry", mode],
    audio: {
      input: { encoding: "linear16", sample_rate: 16000 },
      output: { encoding: "linear16", sample_rate: 24000, container: "none" },
    },
    agent: {
      ...(history.length && {
        context: { messages: history.map((m) => ({ type: "History", role: m.role, content: m.content })) },
      }),
      listen: { provider: { type: "deepgram", model: "flux-general-en", version: "v2", keyterms: KEYTERMS } },
      think: {
        provider: { type: "open_ai", model: "gpt-4o-mini", temperature: 0.4 },
        prompt: `${prompt}\n\n${VOICE_RULES}\n${todayLine()}`,
        functions,
      },
      speak: { provider: { type: "deepgram", version: "v2", model: "flux-alexis-en", speed: 0.95 } },
      greeting,
    },
  };
}

const VOICE_OPENING =
  "Hi! I'll put together a registry for you, so you don't have to start from a blank page. Just a few quick questions. First, when is your little one due?";

export function intakeSettings(history: ChatMessage[]) {
  const answered = history.some((m) => m.role === "user");
  const lastAssistant = [...history].reverse().find((m) => m.role === "assistant")?.content;
  const greeting = answered && lastAssistant ? `Okay, I'm listening. ${lastAssistant}` : VOICE_OPENING;
  const prompt = `${INTAKE_GUIDANCE}
- When you know enough, or the parent asks to finish, call finish_intake with the complete profile.
  Use "unknown", "unsure", null, or an empty list for anything you didn't learn. Don't announce the call first.
- After finish_intake succeeds, say one short, warm sentence that you're building their registry now, then stop talking.
- If finish_intake reports a problem, ask only about what it says is missing.`;
  const functions = [
    {
      name: "finish_intake",
      description: "Build the parent's registry from everything learned in the conversation.",
      parameters: profileParameters(),
      defer_until_eot: true,
    },
  ];
  // Without the opening chat message, history would start with a user turn the agent never asked for.
  return { settings: baseSettings("intake", prompt, functions, greeting, answered ? history : []), greeting };
}

export function editSettings(registry: Registry) {
  const items = registry.items
    .filter((i) => i.status !== "skip")
    .map((i) => ({
      name: i.name,
      category: i.category,
      price: i.offers[0]?.price ?? null,
      qty: i.qty,
      purchased: Boolean(i.purchased),
    }));
  const prompt = `You help an expecting parent change their baby registry, "${registry.title}", by talking.
Current items (JSON): ${JSON.stringify(items)}
How to work:
- Whenever they ask to add, remove, swap, or change anything, immediately call preview_change with their request in plain words.
  Don't confirm first and don't decide yourself whether it's possible; preview_change works that out.
- Then read its summary back in one or two sentences and ask if you should make the change.
- If they agree, call apply_change. If they don't, call cancel_change. Only one change can wait at a time.
- You may answer simple questions about the list from the items above without calling a function.
- Never claim a change was made unless apply_change succeeded.
- When they say they're done, say a short goodbye.`;
  const functions = [
    {
      name: "preview_change",
      description: "Propose a change to the registry and show it on screen. Returns a summary to read back.",
      parameters: {
        type: "object",
        properties: { request: { type: "string", description: "The change the parent wants, in plain words." } },
        required: ["request"],
      },
    },
    {
      name: "apply_change",
      description: "Apply the change that was previewed, after the parent agrees.",
      parameters: { type: "object", properties: {} },
      defer_until_eot: true,
    },
    {
      name: "cancel_change",
      description: "Discard the previewed change.",
      parameters: { type: "object", properties: {} },
    },
  ];
  const greeting = "I'm listening. What would you like to change?";
  return { settings: baseSettings("edit", prompt, functions, greeting), greeting };
}
