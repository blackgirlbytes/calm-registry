import "server-only";
import { z } from "zod";
import { ParentProfileSchema, type ChatMessage, type ParentProfile, type RetailerId } from "../types";
import { normalizeProfile } from "../profile";
import { callJson, isOpenAIConfigured } from "./openai";
import { INTAKE_GUIDANCE, todayLine } from "./prompts";

export const IntakeTurnSchema = z.object({
  reply: z.string().describe("Your next short, warm message. One question at a time."),
  chips: z.array(z.string()).describe("2-5 short tap-to-answer options for the question you asked"),
  done: z.boolean().describe("True once you know enough to build the registry"),
  profile: ParentProfileSchema.nullable().describe("Filled in only when done is true"),
});
export type IntakeTurn = z.infer<typeof IntakeTurnSchema>;

function systemPrompt() {
  return `${INTAKE_GUIDANCE}
- Always offer 2-5 tap-to-answer chips matching your question.
- When you have enough, set done=true, fill in profile, and reply with one encouraging sentence
  saying you're building their registry now.
${todayLine()}`;
}

export const OPENING: IntakeTurn = {
  reply:
    "Hi! I'll put together a registry for you, so you don't have to start from a blank page. Just a few quick questions, and you can tap an answer or type anything. First, when is your little one due?",
  chips: ["In 1-2 months", "In 3-5 months", "6+ months away", "Not sure yet"],
  done: false,
  profile: null,
};

export async function nextIntakeTurn(messages: ChatMessage[]): Promise<IntakeTurn> {
  if (!isOpenAIConfigured()) return mockIntakeTurn(messages);
  const turn = await callJson("intake_turn", IntakeTurnSchema, [{ role: "system", content: systemPrompt() }, ...messages]);
  if (turn.profile) turn.profile = normalizeProfile(turn.profile);
  return turn;
}

// ---------------------------------------------------------------------------
// Scripted fallback so the flow works without an OpenAI key.

const SCRIPT: Array<Omit<IntakeTurn, "done" | "profile">> = [
  OPENING,
  { reply: "Lovely. Do you live in an apartment or a house?", chips: ["Apartment", "House", "Something else"] },
  { reply: "Got it. Will you be driving with baby much?", chips: ["Yes, we drive", "Mostly walk / transit", "A bit of both"] },
  { reply: "How are you thinking about feeding? Totally fine to not know yet.", chips: ["Breastfeeding", "Formula", "A mix", "Not sure"] },
  { reply: "What budget feels comfortable for the registry overall?", chips: ["Keep it lean", "Moderate", "Generous"] },
  { reply: "Anything you already have or are getting handed down?", chips: ["Crib", "Stroller", "Car seat", "Nothing yet"] },
  { reply: "Any values that matter to you?", chips: ["Eco-friendly", "Minimal", "Gender-neutral", "No preference"] },
  { reply: "Last one! Where do your friends and family like to shop?", chips: ["Amazon", "Target", "Walmart", "Any of them"] },
];

function answers(messages: ChatMessage[]) {
  return messages.filter((m) => m.role === "user").map((m) => m.content.toLowerCase());
}

function dueDateFrom(answer: string) {
  const months = /1-2/.test(answer) ? 1.5 : /3-5/.test(answer) ? 4 : /6\+/.test(answer) ? 6.5 : null;
  const explicit = answer.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (explicit) return explicit;
  if (months === null) return null;
  const date = new Date(Date.now() + months * 30 * 24 * 3600 * 1000);
  return date.toISOString().slice(0, 10);
}

export function mockProfile(messages: ChatMessage[]): ParentProfile {
  const a = answers(messages);
  const at = (i: number) => a[i] ?? "";
  const stores: RetailerId[] = (["amazon", "walmart", "target"] as const).filter((s) => at(7).includes(s));
  const haves = ["crib", "stroller", "car seat", "bassinet", "high chair", "bouncer"].filter((h) => at(5).includes(h));
  const values = ["eco", "minimal", "gender-neutral"].filter((v) => at(6).includes(v));
  return {
    dueDate: dueDateFrom(at(0)),
    home: at(1).includes("apartment") ? "apartment" : at(1).includes("house") ? "house" : "unknown",
    hasCar: at(2).includes("walk") || at(2).includes("transit") ? false : at(2) ? true : null,
    feeding: at(3).includes("mix") || at(3).includes("both")
      ? "both"
      : at(3).includes("breast")
        ? "breast"
        : at(3).includes("formula")
          ? "formula"
          : "unsure",
    budget: at(4).includes("lean") ? "lean" : at(4).includes("generous") ? "generous" : "moderate",
    values,
    alreadyHave: haves,
    preferredRetailers: stores,
    notes: "",
  };
}

function mockIntakeTurn(messages: ChatMessage[]): IntakeTurn {
  const answered = answers(messages).length;
  if (answered >= SCRIPT.length) {
    return {
      reply: "Thank you, that's everything I need. Building your registry now. Take a breath, I've got this part.",
      chips: [],
      done: true,
      profile: mockProfile(messages),
    };
  }
  return { ...SCRIPT[answered], done: false, profile: null };
}
