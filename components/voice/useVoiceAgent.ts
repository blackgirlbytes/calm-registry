"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";

export type VoiceStatus = "off" | "connecting" | "listening" | "thinking" | "speaking";

type SessionResponse = { token: string; url: string; settings: unknown; greeting: string };
type FunctionCall = { id: string; name: string; arguments: string; client_side: boolean };

export type VoiceAgentOptions = {
  /** A finished transcript line. The spoken greeting is reported with isGreeting so callers can skip it. */
  onText?: (role: "user" | "assistant", content: string, isGreeting: boolean) => void;
  /** Runs a client-side function and returns the text sent back to the agent. */
  onFunction?: (name: string, args: Record<string, unknown>) => Promise<string>;
  onError?: (message: string) => void;
};

type Session = {
  ws: WebSocket | null;
  ctx: AudioContext;
  stream: MediaStream | null;
  capture: AudioWorkletNode | null;
  sources: Set<AudioBufferSourceNode>;
  playhead: number;
  leftover: Uint8Array | null;
  ready: boolean;
  muted: boolean;
  greeting: string;
  greeted: boolean;
  cancelled: Set<string>;
  stopAfterSpeaking: boolean;
  timers: number[];
};

const OUTPUT_RATE = 24000;
const MAX_SESSION_MS = 10 * 60 * 1000;
const KEEPALIVE_MS = 8000;

export function useVoiceEnabled() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    fetch("/api/voice")
      .then((r) => r.json() as Promise<{ enabled?: boolean }>)
      .then((j) => setEnabled(Boolean(j.enabled)))
      .catch(() => setEnabled(false));
  }, []);
  return enabled;
}

export function useVoiceAgent(options: VoiceAgentOptions) {
  const [status, setStatus] = useState<VoiceStatus>("off");
  const [muted, setMutedState] = useState(false);

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const session = useRef<Session | null>(null);

  const stop = useCallback(() => {
    const s = session.current;
    if (!s) return;
    session.current = null;
    s.timers.forEach((t) => window.clearTimeout(t));
    s.sources.forEach((src) => src.stop());
    s.capture?.disconnect();
    s.stream?.getTracks().forEach((t) => t.stop());
    if (s.ws && s.ws.readyState <= WebSocket.OPEN) s.ws.close();
    void s.ctx.close().catch(() => undefined);
    setStatus("off");
  }, []);

  const fail = useCallback(
    (message: string) => {
      optionsRef.current.onError?.(message);
      stop();
    },
    [stop],
  );

  const stopPlayback = () => {
    const s = session.current;
    if (!s) return;
    s.sources.forEach((src) => src.stop());
    s.sources.clear();
    s.playhead = 0;
  };

  const play = (data: ArrayBuffer) => {
    const s = session.current;
    if (!s) return;
    let bytes = new Uint8Array(data);
    if (s.leftover) {
      const joined = new Uint8Array(s.leftover.length + bytes.length);
      joined.set(s.leftover);
      joined.set(bytes, s.leftover.length);
      bytes = joined;
      s.leftover = null;
    }
    if (bytes.length % 2) {
      s.leftover = bytes.slice(-1);
      bytes = bytes.slice(0, -1);
    }
    if (!bytes.length) return;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const samples = new Float32Array(bytes.length / 2);
    for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 0x8000;
    const buffer = s.ctx.createBuffer(1, samples.length, OUTPUT_RATE);
    buffer.copyToChannel(samples, 0);
    const src = s.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(s.ctx.destination);
    const startAt = Math.max(s.ctx.currentTime + 0.02, s.playhead);
    src.start(startAt);
    s.playhead = startAt + buffer.duration;
    s.sources.add(src);
    src.onended = () => s.sources.delete(src);
  };

  const afterPlayback = (fn: () => void) => {
    const s = session.current;
    if (!s) return;
    const wait = Math.max(0, (s.playhead - s.ctx.currentTime) * 1000);
    s.timers.push(window.setTimeout(fn, wait + 150));
  };

  const runFunctions = async (calls: FunctionCall[]) => {
    for (const call of calls) {
      if (!call.client_side) continue;
      let content: string;
      try {
        const args = call.arguments ? (JSON.parse(call.arguments) as Record<string, unknown>) : {};
        content = (await optionsRef.current.onFunction?.(call.name, args)) ?? "Not available.";
      } catch (error) {
        content = `That didn't work: ${error instanceof Error ? error.message : "unknown error"}.`;
      }
      const s = session.current;
      if (!s?.ws || s.cancelled.has(call.id) || s.ws.readyState !== WebSocket.OPEN) continue;
      s.ws.send(JSON.stringify({ type: "FunctionCallResponse", id: call.id, name: call.name, content }));
    }
  };

  const handleEvent = (event: Record<string, unknown>) => {
    const s = session.current;
    if (!s) return;
    switch (event.type) {
      case "Welcome":
        break;
      case "SettingsApplied":
        s.ready = true;
        setStatus("listening");
        break;
      case "UserStartedSpeaking":
        stopPlayback();
        setStatus("listening");
        break;
      case "AgentThinking":
        setStatus("thinking");
        break;
      case "AgentStartedSpeaking":
        setStatus("speaking");
        break;
      case "AgentAudioDone":
        afterPlayback(() => {
          if (!session.current) return;
          if (session.current.stopAfterSpeaking) stop();
          else setStatus("listening");
        });
        break;
      case "ConversationText": {
        const role = event.role === "user" ? "user" : "assistant";
        const content = String(event.content ?? "").trim();
        if (!content) break;
        const isGreeting = role === "assistant" && !s.greeted && content === s.greeting.trim();
        if (isGreeting) s.greeted = true;
        optionsRef.current.onText?.(role, content, isGreeting);
        break;
      }
      case "FunctionCallRequest":
        void runFunctions((event.functions as FunctionCall[]) ?? []);
        break;
      case "FunctionCallCancelled": {
        const ids = [event.id, ...((event.functions as Array<{ id?: string }>) ?? []).map((f) => f.id)];
        ids.forEach((id) => typeof id === "string" && s.cancelled.add(id));
        break;
      }
      case "Error":
        console.error("Voice agent error", event);
        fail(String(event.description ?? event.message ?? "Voice stopped unexpectedly."));
        break;
      case "Warning":
        console.warn("Voice agent warning", event);
        break;
    }
  };

  /** Must be called from a tap so phone browsers allow audio playback and mic access. */
  const start = useCallback(
    async (body: Record<string, unknown>) => {
      if (session.current) return;
      const ctx = new AudioContext();
      void ctx.resume();
      const s: Session = {
        ws: null,
        ctx,
        stream: null,
        capture: null,
        sources: new Set(),
        playhead: 0,
        leftover: null,
        ready: false,
        muted: false,
        greeting: "",
        greeted: false,
        cancelled: new Set(),
        stopAfterSpeaking: false,
        timers: [],
      };
      session.current = s;
      setStatus("connecting");
      setMutedState(false);

      try {
        const [config, stream] = await Promise.all([
          api<SessionResponse>("/api/voice", { method: "POST", body: JSON.stringify(body) }),
          navigator.mediaDevices.getUserMedia({
            audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          }),
        ]);
        if (session.current !== s) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        s.stream = stream;
        s.greeting = config.greeting;

        await ctx.audioWorklet.addModule("/voice-capture-worklet.js");
        const capture = new AudioWorkletNode(ctx, "voice-capture");
        s.capture = capture;
        const silent = ctx.createGain();
        silent.gain.value = 0;
        ctx.createMediaStreamSource(stream).connect(capture);
        capture.connect(silent).connect(ctx.destination);
        capture.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
          if (s.ready && !s.muted && s.ws?.readyState === WebSocket.OPEN) s.ws.send(e.data);
        };

        const ws = new WebSocket(config.url, ["bearer", config.token]);
        ws.binaryType = "arraybuffer";
        s.ws = ws;
        ws.onmessage = (e) => {
          if (e.data instanceof ArrayBuffer) play(e.data);
          else {
            const event = JSON.parse(String(e.data)) as Record<string, unknown>;
            if (event.type === "Welcome") ws.send(JSON.stringify(config.settings));
            handleEvent(event);
          }
        };
        ws.onclose = () => {
          if (session.current === s) fail(s.ready ? "Voice disconnected. You can keep going by typing." : "Voice couldn't connect.");
        };
        ws.onerror = () => undefined;

        s.timers.push(window.setTimeout(stop, MAX_SESSION_MS));
        const keepAlive = window.setInterval(() => {
          if (session.current !== s) return window.clearInterval(keepAlive);
          if (s.muted && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "KeepAlive" }));
        }, KEEPALIVE_MS);
      } catch (error) {
        if (session.current !== s) return;
        const denied = error instanceof DOMException && error.name === "NotAllowedError";
        fail(denied ? "Microphone access was blocked. You can allow it in your browser settings, or keep typing." : error instanceof Error ? error.message : "Voice couldn't start.");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fail, stop],
  );

  const setMuted = useCallback((value: boolean) => {
    if (session.current) session.current.muted = value;
    setMutedState(value);
  }, []);

  /** Lets the agent finish its current sentence, then closes the session. */
  const stopAfterSpeaking = useCallback(() => {
    const s = session.current;
    if (!s) return;
    s.stopAfterSpeaking = true;
    s.timers.push(window.setTimeout(stop, 8000));
  }, [stop]);

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && stop();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      stop();
    };
  }, [stop]);

  return { status, active: status !== "off", muted, start, stop, setMuted, stopAfterSpeaking };
}
