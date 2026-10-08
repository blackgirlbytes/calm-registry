"use client";

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

export function VoiceControls({
  status,
  muted,
  onMute,
  onStop,
  stopLabel,
}: {
  status: VoiceStatus;
  muted: boolean;
  onMute: (muted: boolean) => void;
  onStop: () => void;
  stopLabel: string;
}) {
  const label = muted && status === "listening" ? "Muted" : LABELS[status];
  return (
    <div className="flex items-center gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3" role="status" aria-live="polite">
        <span
          aria-hidden
          className={`h-3 w-3 shrink-0 rounded-full bg-accent ${
            status === "speaking" ? "animate-pulse" : status === "listening" && !muted ? "" : "opacity-40"
          }`}
        />
        <span className="truncate font-serif text-[17px]">{label}</span>
      </div>
      <button
        className="btn-quiet shrink-0 px-4 py-2.5"
        onClick={() => onMute(!muted)}
        disabled={status === "connecting"}
        aria-pressed={muted}
      >
        {muted ? "Unmute" : "Mute"}
      </button>
      <button className="btn-primary shrink-0 px-4 py-2.5" onClick={onStop}>
        {stopLabel}
      </button>
    </div>
  );
}
