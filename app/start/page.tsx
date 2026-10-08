"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { Building } from "@/components/Building";
import { useVoiceAgent, useVoiceEnabled } from "@/components/voice/useVoiceAgent";
import { MicIcon, VoiceControls } from "@/components/voice/VoiceControls";
import { api } from "@/lib/client";
import { ParentProfileSchema, type ChatMessage, type ParentProfile } from "@/lib/types";

type Turn = { reply: string; chips: string[]; done: boolean; profile: ParentProfile | null };

const STORAGE_KEY = "calm-registry:intake";

export default function StartPage() {
  return (
    <AuthGate reason="Sign in with your email first so your registry is saved. No password needed.">
      <IntakeChat />
    </AuthGate>
  );
}

function IntakeChat() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chips, setChips] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const voiceEnabled = useVoiceEnabled();
  const voice = useVoiceAgent({
    onText(role, content, isGreeting) {
      // The greeting repeats a question that's already on screen.
      if (!isGreeting) setMessages((prev) => [...prev, { role, content }]);
    },
    async onFunction(name, args) {
      if (name !== "finish_intake") return `Unknown function ${name}.`;
      const parsed = ParentProfileSchema.safeParse(args);
      if (!parsed.success) {
        const fields = [...new Set(parsed.error.issues.map((i) => i.path.join(".") || "profile"))].join(", ");
        return `The profile isn't complete. Problems with: ${fields}. Ask about those, then call finish_intake again.`;
      }
      voice.stopAfterSpeaking();
      void build(parsed.data);
      return "Success. The registry is being built now.";
    },
    onError: setError,
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const { messages, chips } = JSON.parse(saved) as { messages: ChatMessage[]; chips: string[] };
      setMessages(messages);
      setChips(chips);
      return;
    }
    void send([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (messages.length) localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, chips }));
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chips, thinking]);

  async function send(history: ChatMessage[]) {
    setThinking(true);
    setError("");
    try {
      const turn = await api<Turn>("/api/intake", { method: "POST", body: JSON.stringify({ messages: history }) });
      const next = [...history, { role: "assistant" as const, content: turn.reply }];
      setMessages(next);
      setChips(turn.chips);
      if (turn.done && turn.profile) await build(turn.profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setThinking(false);
    }
  }

  async function build(profile: ParentProfile) {
    setBuilding(true);
    try {
      const { id } = await api<{ id: string }>("/api/registries", { method: "POST", body: JSON.stringify({ profile }) });
      localStorage.removeItem(STORAGE_KEY);
      router.push(`/registry/${id}/review`);
    } catch (e) {
      setBuilding(false);
      setError(e instanceof Error ? e.message : "Your registry couldn't be built. Try again.");
    }
  }

  function answer(text: string) {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    const history = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(history);
    setChips([]);
    setInput("");
    void send(history);
  }

  function talk() {
    setError("");
    setChips([]);
    void voice.start({ mode: "intake", messages });
  }

  function restart() {
    voice.stop();
    localStorage.removeItem(STORAGE_KEY);
    setMessages([]);
    void send([]);
  }

  if (building) return <Building />;

  const answered = messages.filter((m) => m.role === "user").length;

  return (
    <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
    <IntakeGuide answered={answered} />
    <div className="flex min-h-dvh flex-col pt-5 lg:pt-10">
      <header className="mb-8 flex items-center justify-between text-[13px]">
        <span className="text-muted">
          {8 - answered > 1 ? `About ${8 - answered} questions left` : "Almost done"}
        </span>
        <button onClick={restart} className="link">
          Start over
        </button>
      </header>

      <div className="flex-1 space-y-6" aria-live="polite">
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[80%] rounded-2xl rounded-br-md bg-surface px-4 py-2.5 lg:max-w-[60%] lg:px-5 lg:py-3 lg:text-[17px]">{m.content}</p>
            </div>
          ) : (
            <p key={i} className="max-w-[65ch] font-serif text-[19px] leading-relaxed lg:text-[22px]">
              {m.content}
            </p>
          ),
        )}
        {thinking && <p className="font-serif text-[19px] text-muted">…</p>}
        {error && (
          <p role="alert" className="text-[14px] text-danger">
            {error}{" "}
            <button className="underline underline-offset-4" onClick={() => void send(messages)}>
              Try again
            </button>
          </p>
        )}
        <div ref={bottom} />
      </div>

      <div className="sticky bottom-0 -mx-4 space-y-3 bg-bg px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6">
        {voice.active ? (
          <VoiceControls
            status={voice.status}
            muted={voice.muted}
            onMute={voice.setMuted}
            onStop={voice.stop}
            stopLabel="Switch to typing"
          />
        ) : (
          <>
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <button key={chip} className="chip" onClick={() => answer(chip)} disabled={thinking}>
                    {chip}
                  </button>
                ))}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                answer(input);
              }}
              className="flex gap-2"
            >
              <label htmlFor="chat-input" className="sr-only">
                Your answer
              </label>
              <input
                id="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Or type your own answer"
                className="field"
              />
              {voiceEnabled && !input.trim() ? (
                <button type="button" className="btn-quiet shrink-0 px-4" onClick={talk} disabled={thinking}>
                  <MicIcon />
                  Talk instead
                </button>
              ) : (
                <button className="btn-primary shrink-0" disabled={thinking || !input.trim()}>
                  Send
                </button>
              )}
            </form>
          </>
        )}
      </div>
    </div>
    </div>
  );
}

const TOPICS = [
  "When your baby is due",
  "Your home, and whether you drive",
  "How you plan to feed",
  "Your budget",
  "What matters to you, like eco-friendly or minimal",
  "What you already have",
  "Stores you like",
];
const STEPS = ["Answer a few questions", "Review your draft", "Share with family"];

/** Laptop-only context beside the chat: where you are, and what the questions cover. */
function IntakeGuide({ answered }: { answered: number }) {
  const progress = Math.min(1, answered / 8);
  return (
    <aside className="hidden space-y-10 pt-10 lg:sticky lg:top-0 lg:block lg:self-start">
      <p className="font-serif text-[17px] font-semibold">Calm Registry</p>

      <ol className="space-y-2">
        {STEPS.map((step, i) => (
          <li key={step} className={`flex gap-3 ${i === 0 ? "text-text" : "text-muted"}`}>
            <span className={`w-4 shrink-0 font-serif ${i === 0 ? "text-accent" : ""}`}>{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>

      <div className="space-y-3">
        <div className="h-1 overflow-hidden rounded-full bg-line" aria-hidden>
          <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="text-[13px] text-muted">The questions cover</p>
        <ul className="space-y-1.5 text-[14px]">
          {TOPICS.map((topic) => (
            <li key={topic}>{topic}</li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
