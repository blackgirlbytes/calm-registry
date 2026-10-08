import "server-only";
import { z } from "zod";
import { ParentProfileSchema, type ChatMessage, type ParentProfile, type ProfileSeed, type RetailerId } from "../types";
import { describeSeed } from "../answers";
import { normalizeProfile } from "../profile";
import { callJson, isOpenAIConfigured } from "./openai";
import { INTAKE_GUIDANCE, seedGuidance, todayLine } from "./prompts";

export const IntakeTurnSchema = z.object({
  reply: z.string().describe("Your next short, warm message. One question at a time."),
  chips: z.array(z.string()).describe("2-5 short tap-to-answer options for the question you asked"),
  done: z.boolean().describe("True once you know enough to build the registry"),
  profile: ParentProfileSchema.nullable().describe("Filled in only when done is true"),
});
export type IntakeTurn = z.infer<typeof IntakeTurnSchema>;

function systemPrompt(seed: ProfileSeed | null) {
  return `${INTAKE_GUIDANCE}
- Offer 1-5 tap-to-answer chips matching your question. Each chip is sent as their answer, so it must read as one.
  For the names question, use only chips like "Skip for now" and "No baby name yet"; they'll type the names.
- If they correct an earlier answer, use the new one.
- When you have enough, set done=true, fill in profile, and reply with one short sentence asking them to look over
  their answers below and tap build when it looks right.
${seed ? `${seedGuidance(seed)}\n` : ""}${todayLine()}`;
}

const DUE_CHIPS = ["In 1-2 months", "In 3-5 months", "6+ months away", "Not sure yet"];

export const OPENING: IntakeTurn = {
  reply:
    "Hi! I'll put together a registry for you, so you don't have to start from a blank page. Just a few quick questions, and you can tap an answer or type anything. First, when is your little one due?",
  chips: DUE_CHIPS,
  done: false,
  profile: null,
};

export function openingTurn(seed: ProfileSeed | null): IntakeTurn {
  const kept = seed ? describeSeed(seed) : "";
  if (!kept) return OPENING;
  return {
    ...OPENING,
    reply: `Welcome back! I kept a few answers from last time: ${kept}. You can change any of them before I build. When is this little one due?`,
  };
}

export async function nextIntakeTurn(messages: ChatMessage[], seed: ProfileSeed | null = null): Promise<IntakeTurn> {
  if (!isOpenAIConfigured()) return mockIntakeTurn(messages, seed);
  const turn = await callJson("intake_turn", IntakeTurnSchema, [{ role: "system", content: systemPrompt(seed) }, ...messages]);
  if (turn.profile) turn.profile = normalizeProfile(turn.profile);
  return turn;
}

// ---------------------------------------------------------------------------
// Scripted fallback so the flow works without an OpenAI key.

type StepKey = "dueDate" | "names" | "home" | "hasCar" | "feeding" | "budget" | "alreadyHave" | "values" | "preferredRetailers";

const SCRIPT: Array<{ key: StepKey } & Omit<IntakeTurn, "done" | "profile">> = [
  { key: "dueDate", reply: OPENING.reply, chips: OPENING.chips },
  {
    key: "names",
    reply: "Lovely. What should family call you? And if you've picked a name for baby, I'd love to hear it, but that's optional.",
    chips: ["Skip for now"],
  },
  { key: "home", reply: "Thank you. Do you live in an apartment or a house?", chips: ["Apartment", "House", "Something else"] },
  { key: "hasCar", reply: "Got it. Will you be driving with baby much?", chips: ["Yes, we drive", "Mostly walk / transit", "A bit of both"] },
  { key: "feeding", reply: "How are you thinking about feeding? Totally fine to not know yet.", chips: ["Breastfeeding", "Formula", "A mix", "Not sure"] },
  { key: "budget", reply: "What budget feels comfortable for the registry overall?", chips: ["Keep it lean", "Moderate", "Generous"] },
  { key: "alreadyHave", reply: "Anything you already have or are getting handed down?", chips: ["Crib", "Stroller", "Car seat", "Nothing yet"] },
  { key: "values", reply: "Any values that matter to you?", chips: ["Eco-friendly", "Minimal", "Gender-neutral", "No preference"] },
  { key: "preferredRetailers", reply: "Last one! Where do your friends and family like to shop?", chips: ["Amazon", "Target", "Walmart", "Any of them"] },
];

/** Steps still asked once carried-over answers are known. */
function steps(seed: ProfileSeed | null) {
  return SCRIPT.filter((step) => !seed || !(step.key in seed));
}

function dueDateFrom(answer: string) {
  const months = /1-2/.test(answer) ? 1.5 : /3-5/.test(answer) ? 4 : /6\+/.test(answer) ? 6.5 : null;
  const explicit = answer.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (explicit) return explicit;
  if (months === null) return null;
  const date = new Date(Date.now() + months * 30 * 24 * 3600 * 1000);
  return date.toISOString().slice(0, 10);
}

export function mockProfile(messages: ChatMessage[], seed: ProfileSeed | null = null): ParentProfile {
  const raw = messages.filter((m) => m.role === "user").map((m) => m.content.trim());
  const asked = steps(seed);
  const answer = (key: StepKey) => raw[asked.findIndex((s) => s.key === key)] ?? "";
  const at = (key: StepKey) => answer(key).toLowerCase();
  const rawNames = answer("names");
  const [parentPart, babyPart] = rawNames.split(/[,.;]\s*(?:and\s+)?(?:the\s+)?baby(?:'s name)?(?:\s+is|\s+will be)?\s*/i);
  const stores: RetailerId[] = (["amazon", "walmart", "target"] as const).filter((s) => at("preferredRetailers").includes(s));
  const haves = ["crib", "stroller", "car seat", "bassinet", "high chair", "bouncer"].filter((h) => at("alreadyHave").includes(h));
  const values = ["eco", "minimal", "gender-neutral"].filter((v) => at("values").includes(v));
  const car = at("hasCar");
  const feeding = at("feeding");
  const budget = at("budget");
  return {
    parentNames: /^skip/i.test(rawNames) ? "" : (parentPart ?? "").replace(/^(we're|we are|i'm|i am)\s+/i, ""),
    babyName: babyPart?.trim() ?? "",
    dueDate: dueDateFrom(at("dueDate")),
    home: at("home").includes("apartment") ? "apartment" : at("home").includes("house") ? "house" : "unknown",
    hasCar: car.includes("walk") || car.includes("transit") ? false : car ? true : null,
    feeding: feeding.includes("mix") || feeding.includes("both")
      ? "both"
      : feeding.includes("breast")
        ? "breast"
        : feeding.includes("formula")
          ? "formula"
          : "unsure",
    budget: budget.includes("lean") ? "lean" : budget.includes("generous") ? "generous" : "moderate",
    values,
    alreadyHave: haves,
    preferredRetailers: stores,
    notes: "",
    ...seed,
  };
}

function mockIntakeTurn(messages: ChatMessage[], seed: ProfileSeed | null): IntakeTurn {
  const answered = messages.filter((m) => m.role === "user").length;
  const asked = steps(seed);
  if (answered >= asked.length) {
    return {
      reply: "Thank you, that's everything I need. Look over your answers below, and tap build when they look right.",
      chips: [],
      done: true,
      profile: normalizeProfile(mockProfile(messages, seed)),
    };
  }
  const { key: _key, ...step } = asked[answered];
  return { ...step, done: false, profile: null };
}
