"use client";

import { useEffect, useRef } from "react";
import type { VoiceStatus } from "./useVoiceAgent";

const LABELS: Record<VoiceStatus, string> = {
  off: "",
  connecting: "Getting ready…",
  listening: "Listening",
  thinking: "Thinking…",
  speaking: "Speaking",
};

export function MicIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className} aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  );
}

/**
 * Rounded bars that follow the conversation's loudness, drawn in the element's text color.
 * Without a level source it draws one still frame, for previews of what talking looks like.
 */
export function Waveform({ level, className = "" }: { level?: () => number; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let tick = 0;
    let smooth = 0;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
        el.width = Math.round(w * dpr);
        el.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = getComputedStyle(el).color;

      const target = level ? level() : 0.6;
      smooth = level ? smooth + (target - smooth) * (target > smooth ? 0.35 : 0.08) : target;
      const bar = Math.max(3, Math.min(10, w / 56));
      const step = bar * 2.1;
      const count = Math.max(8, Math.floor(w / step));
      const offset = (w - (count * step - (step - bar))) / 2;

      for (let i = 0; i < count; i++) {
        const envelope = 0.3 + 0.7 * Math.sin((Math.PI * (i + 0.5)) / count);
        const motion = still ? 0 : tick;
        const wobble = Math.abs(0.6 * Math.sin(i * 0.9 + motion * 0.06) + 0.4 * Math.sin(i * 0.31 - motion * 0.045));
        const rest = 0.07 + 0.03 * Math.sin(i * 0.5 + motion * 0.03);
        const height = Math.max(bar, Math.min(1, rest + 1.3 * smooth * envelope * (0.2 + 0.8 * wobble)) * h);
        ctx.globalAlpha = i % 3 === 1 ? 0.5 : 1;
        ctx.beginPath();
        ctx.roundRect(offset + i * step, (h - height) / 2, bar, height, bar / 2);
        ctx.fill();
      }
      tick++;
      if (level) frame = requestAnimationFrame(draw);
    };

    draw();
    const resize = new ResizeObserver(() => !level && draw());
    resize.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
    };
  }, [level]);

  return <canvas ref={canvas} aria-hidden className={`block ${className}`} />;
}

/** The voice room: a lavender panel while you talk, and the waveform color shows who is speaking. */
export function VoiceRoom({
  status,
  muted,
  onMute,
  onStop,
  stopLabel,
  level,
  hint,
  heard,
  className = "",
}: {
  status: VoiceStatus;
  muted: boolean;
  onMute: (muted: boolean) => void;
  onStop: () => void;
  stopLabel: string;
  level: () => number;
  /** A line of direction shown under the waveform until there's something to caption. */
  hint?: string;
  /** The latest line of the conversation. */
  heard?: { role: "user" | "assistant"; content: string } | null;
  className?: string;
}) {
  const label = muted && status === "listening" ? "Muted" : LABELS[status];
  const agentSpeaking = status === "speaking";
  return (
    <section aria-label="Voice conversation" className={`animate-[room-in_.35s_ease-out] rounded-[24px] bg-room p-5 text-room-text sm:p-6 lg:p-7 ${className}`}>
      <p role="status" aria-live="polite" className="flex items-center gap-2.5 text-[14px] text-room-muted">
        <span aria-hidden className={`h-2 w-2 rounded-full ${status === "listening" && !muted ? "bg-wave-you" : agentSpeaking ? "bg-wave" : "bg-room-muted/50"}`} />
        {label}
      </p>

      <Waveform
        level={level}
        className={`my-4 h-20 w-full transition-colors duration-500 sm:h-24 lg:h-28 ${agentSpeaking ? "text-wave" : muted ? "text-room-muted/40" : "text-wave-you"}`}
      />

      {heard ? (
        <p className={heard.role === "user" ? "text-[14px] text-room-muted" : "max-w-[52ch] font-serif text-[17px] leading-relaxed lg:text-[19px]"}>
          {heard.role === "user" ? `You said: ${heard.content}` : heard.content}
        </p>
      ) : (
        hint && <p className="text-[14px] text-room-muted">{hint}</p>
      )}

      <div className="mt-5 flex gap-3">
        <button
          className="btn flex-1 border border-room-line px-3 whitespace-nowrap text-room-text hover:bg-room-raise sm:flex-none sm:px-6"
          onClick={() => onMute(!muted)}
          disabled={status === "connecting"}
          aria-pressed={muted}
        >
          {muted ? "Unmute" : "Mute"}
        </button>
        <button className="btn flex-1 bg-mic px-3 whitespace-nowrap text-room-text hover:brightness-[.97] sm:flex-none sm:px-6" onClick={onStop}>
          {stopLabel}
        </button>
      </div>
    </section>
  );
}

/** The invitation to talk instead of type: a lavender strip with a big mic, and a still waveform when there's room. */
export function VoiceInvite({
  title,
  detail,
  onStart,
  disabled,
}: {
  title: string;
  detail: string;
  onStart: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onStart}
      disabled={disabled}
      className="@container flex w-full items-center gap-4 rounded-[22px] bg-room p-3 pr-5 text-left text-room-text transition-colors hover:bg-room-raise disabled:opacity-60"
    >
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-mic text-room-text">
        <MicIcon className="h-6 w-6" />
      </span>
      <span className="min-w-0">
        <span className="block font-serif text-[18px] font-semibold">{title}</span>
        <span className="block text-[13px] text-room-muted">{detail}</span>
      </span>
      <Waveform className="ml-auto hidden h-10 max-w-64 min-w-24 flex-1 text-wave/70 @lg:block" />
    </button>
  );
}

/** A compact mic button for sitting beside a text field. */
export function TalkButton({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="btn shrink-0 bg-room px-3.5 text-room-text hover:bg-room-raise"
    >
      <MicIcon />
      <span className="hidden sm:inline">Talk</span>
    </button>
  );
}
