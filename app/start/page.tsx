"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { api } from "@/lib/client";
import type { ChatMessage, ParentProfile } from "@/lib/types";

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
      setError(e instanceof Error ? e.message : "We couldn't build your registry.");
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

  function restart() {
    localStorage.removeItem(STORAGE_KEY);
    setMessages([]);
    void send([]);
  }

  if (building) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-sage/30 border-t-sage" />
        <h2 className="text-xl font-semibold">Building your registry…</h2>
        <p className="text-muted">Comparing Amazon, Target, and Walmart for you. This takes about 30 seconds.</p>
      </div>
    );
  }

  const answered = messages.filter((m) => m.role === "user").length;

  return (
    <div className="flex min-h-dvh flex-col pt-6">
      <header className="mb-4 flex items-center justify-between">
        <span className="text-sm text-muted">About {Math.max(1, 8 - answered)} quick questions left</span>
        <button onClick={restart} className="text-sm text-muted underline">
          Start over
        </button>
      </header>

      <div className="flex-1 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex"}>
            <p
              className={
                m.role === "user"
                  ? "max-w-[80%] rounded-3xl rounded-br-md bg-sage px-4 py-3 text-white"
                  : "max-w-[85%] rounded-3xl rounded-bl-md bg-white px-4 py-3 shadow-sm"
              }
            >
              {m.content}
            </p>
          </div>
        ))}
        {thinking && <p className="px-2 text-muted">…</p>}
        {error && (
          <p className="text-sm text-red-600">
            {error}{" "}
            <button className="underline" onClick={() => void send(messages)}>
              Retry
            </button>
          </p>
        )}
        <div ref={bottom} />
      </div>

      <div className="sticky bottom-0 space-y-3 bg-cream pt-3 pb-4">
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
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Or type anything…"
            className="flex-1 rounded-full border border-ink/15 bg-white px-5 py-3 outline-none focus:border-sage"
          />
          <button className="btn-primary" disabled={thinking || !input.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
