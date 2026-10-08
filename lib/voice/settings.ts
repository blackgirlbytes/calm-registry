import "server-only";
import { z } from "zod";
import { openingTurn } from "../ai/intake";
import { INTAKE_GUIDANCE, seedGuidance, todayLine, VOICE_RULES } from "../ai/prompts";
import { itemForVoice, spokenItem } from "../review-speech";
import { ParentProfileSchema, type ChatMessage, type ProfileSeed, type Registry } from "../types";

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

const KEYTERMS = [
  "bassinet",
  "swaddle",
  "onesie",
  "stroller",
  "car seat",
  "Target",
  "Walmart",
  "Amazon",
  "twins",
  "triplets",
  "coily",
  "eczema",
  "bilingual",
  "daycare",
];

function profileParameters() {
  const { $schema: _schema, ...schema } = z.toJSONSchema(ParentProfileSchema) as Record<string, unknown>;
  return schema;
}

// Brands parents often name when they already have a product in mind, which speech-to-text tends to mangle.
const BRANDS = [
  "HALO BassiNest",
  "Snoo",
  "UPPAbaby",
  "Nuna",
  "Chicco",
  "Graco",
  "Doona",
  "Ergobaby",
  "BabyBjörn",
  "Owlet",
  "Nanit",
  "Hatch",
  "Frida",
  "Boppy",
  "Spectra",
  "Medela",
  "Dr. Brown's",
  "Philips Avent",
  "Lovevery",
  "WaterWipes",
];

function baseSettings(
  mode: "intake" | "edit" | "review",
  prompt: string,
  functions: unknown[],
  greeting: string,
  history: ChatMessage[] = [],
  keyterms = KEYTERMS,
) {
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
      listen: { provider: { type: "deepgram", model: "flux-general-en", version: "v2", keyterms } },
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
  "Hi! I'll put together a registry for you, so you don't have to start from a blank page. Just a few quick questions. First, when is your little one, or little ones, due?";

export function intakeSettings(history: ChatMessage[], seed: ProfileSeed | null = null) {
  const answered = history.some((m) => m.role === "user");
  const lastAssistant = [...history].reverse().find((m) => m.role === "assistant")?.content;
  const opening = seed ? openingTurn(seed).reply : VOICE_OPENING;
  const greeting = answered && lastAssistant ? `Okay, I'm listening. ${lastAssistant}` : opening;
  const prompt = `${INTAKE_GUIDANCE}
- When you know enough, or the parent asks to finish, call finish_intake with the complete profile.
  Use "unknown", "unsure", null, or an empty list for anything you didn't learn. Don't announce the call first.
- After finish_intake succeeds, briefly ask them to look over their answers on screen and tap build when it
  looks right. Mention that they can add an address privately later if they'd like gifts shipped. Then stop talking.
- Out loud, never offer more than four short choices in one question.
- If finish_intake reports a problem, ask only about what it says is missing.
${seed ? seedGuidance(seed) : ""}`;
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

const REVIEW_PROMPT = `You help an expecting parent go through their baby registry draft out loud, one item at a time.
They're likely tired. Keep every turn to one or two short sentences, and keep it moving.
How to work:
- Each item is described for you in a "say" line. Say it naturally, then ask "Keep it, or skip?"
  Don't list the other options unless they ask.
- Keep: "keep", "yes", "sure", "we need that", "add it". Call keep_item.
- Skip: "skip", "no", "we have one", "don't need it", "next". Call skip_item.
- If they name a product, brand, or model they'd rather have, or already have in mind, call use_their_pick
  with just the product in their words, like "HALO BassiNest" or "Snoo". Then tell them what you found and ask
  "Keep it, or skip?" If the result is a store search link, say you'll link to it so family can find that exact one.
- If they ask what else there is, or for something cheaper, read up to three otherOptions briefly.
  When they pick one, call choose_option with its option number, then ask keep or skip.
- If they ask "what was that" or seem lost, call describe_item. They can also tap on screen; describe_item
  always tells you what's showing now.
- If they want a different section, call open_category.
- Never say an item was kept, skipped, or changed unless the function succeeded.
- When a function says everything is reviewed, tell them they're all done and say a short goodbye.`;

const REVIEW_FUNCTIONS = (categories: string[]) => [
  { name: "keep_item", description: "Keep the item on screen and move to the next one.", parameters: { type: "object", properties: {} } },
  { name: "skip_item", description: "Skip the item on screen and move to the next one.", parameters: { type: "object", properties: {} } },
  {
    name: "use_their_pick",
    description: "Replace the product on screen with a specific product the parent named. Returns what was found.",
    parameters: {
      type: "object",
      properties: { product: { type: "string", description: "The brand, product, or model they named, in their words." } },
      required: ["product"],
    },
  },
  {
    name: "choose_option",
    description: "Switch to one of the other options for the item on screen.",
    parameters: {
      type: "object",
      properties: { option: { type: "integer", description: "The option number from otherOptions." } },
      required: ["option"],
    },
  },
  { name: "describe_item", description: "Describe the item showing on screen right now.", parameters: { type: "object", properties: {} } },
  {
    name: "open_category",
    description: "Jump to a different section of the registry.",
    parameters: {
      type: "object",
      properties: { category: { type: "string", enum: categories } },
      required: ["category"],
    },
  },
];

/** Talks the parent through keep or skip, starting at the item on screen. */
export function reviewSettings(registry: Registry, itemId: string | null, intent: "review" | "pick") {
  const pending = registry.items.filter((i) => i.status === "pending");
  const item = pending.find((i) => i.id === itemId) ?? pending[0];
  if (!item) throw new Error("Nothing left to review.");
  const categories = [...new Set(registry.items.map((i) => i.category))];
  const greeting =
    intent === "pick"
      ? `Sure. What would you like instead of the ${item.name.toLowerCase()}? Just say the brand or product.`
      : `Let's go through ${item.category}. Say keep or skip, or name one you'd rather have. First up, ${spokenItem(item)}. Keep it, or skip?`;
  const prompt = `${REVIEW_PROMPT}\nThe item on screen when you started: ${JSON.stringify(itemForVoice(item))}`;
  return { settings: baseSettings("review", prompt, REVIEW_FUNCTIONS(categories), greeting, [], [...KEYTERMS, ...BRANDS, "keep", "skip"]), greeting };
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
