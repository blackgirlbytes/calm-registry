"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, authEnabled, getBrowserSupabase } from "@/lib/client";
import type { IntakeDraft } from "@/lib/types";

type Summary = { id: string; slug: string; title: string };

function answeredCount(draft: IntakeDraft) {
  return draft.messages.filter((m) => m.role === "user").length;
}

function draftLabel(draft: IntakeDraft) {
  if (draft.profile) return "Answers ready to check";
  const n = answeredCount(draft);
  return `${n} ${n === 1 ? "answer" : "answers"} so far`;
}

/** Registries this person already has, plus any answers they haven't finished. */
export function ResumeList() {
  const [registries, setRegistries] = useState<Summary[]>([]);
  const [drafts, setDrafts] = useState<IntakeDraft[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (authEnabled) {
      const { data } = await getBrowserSupabase()!.auth.getSession();
      if (!data.session) return;
    }
    const [r, d] = await Promise.all([
      api<{ registries: Summary[] }>("/api/registries").catch(() => null),
      api<{ drafts: IntakeDraft[] }>("/api/drafts").catch(() => null),
    ]);
    if (r) setRegistries(r.registries);
    if (d) setDrafts(d.drafts);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(task: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await task();
      setConfirming(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const unfinished = drafts.find((d) => !d.registryId && (answeredCount(d) > 0 || d.profile));
  const startingOver = new Map(drafts.filter((d) => d.registryId && answeredCount(d) > 0).map((d) => [d.registryId, d]));

  if (!registries.length && !unfinished) return null;

  const confirmRow = (key: string, prompt: string, onConfirm: () => void) =>
    confirming === key && (
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 text-[14px]" role="alertdialog" aria-label={prompt}>
        <span className="text-muted">{prompt}</span>
        <span className="flex gap-2">
          <button className="btn-quiet px-3 py-1.5 text-[13px]" onClick={() => setConfirming(null)} disabled={busy}>
            Keep it
          </button>
          <button className="btn-primary px-3 py-1.5 text-[13px]" onClick={onConfirm} disabled={busy}>
            {busy ? "Deleting…" : "Delete"}
          </button>
        </span>
      </div>
    );

  return (
    <section aria-labelledby="yours" className="space-y-3 rounded-xl bg-surface px-5 py-4">
      <h2 id="yours" className="text-[13px] text-muted">
        Your registries
      </h2>

      <ul className="divide-y divide-line border-y border-line">
        {unfinished && (
          <li>
            <div className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-serif text-[19px] font-semibold">A new registry</p>
                <p className="text-[13px] text-muted">{draftLabel(unfinished)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button className="link text-[13px]" onClick={() => setConfirming(unfinished.id)}>
                  Discard
                </button>
                <Link href={`/start?draft=${unfinished.id}`} className="btn-primary px-4 py-2.5">
                  Finish answers
                </Link>
              </div>
            </div>
            {confirmRow(unfinished.id, "Discard these answers?", () =>
              void remove(() => api(`/api/drafts/${unfinished.id}`, { method: "DELETE" })),
            )}
          </li>
        )}
        {registries.map((r) => {
          const over = startingOver.get(r.id);
          return (
            <li key={r.id}>
              <div className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-serif text-[19px] font-semibold">{r.title}</p>
                  {over && (
                    <Link href={`/start?draft=${over.id}`} className="link text-[13px]">
                      Starting over, {draftLabel(over).toLowerCase()}. Continue
                    </Link>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button className="link text-[13px]" onClick={() => setConfirming(r.id)}>
                    Delete
                  </button>
                  <Link href={`/registry/${r.id}`} className="btn-quiet px-4 py-2.5">
                    Open
                  </Link>
                </div>
              </div>
              {confirmRow(r.id, "Delete it? The share link stops working and gifts marked on it are lost.", () =>
                void remove(() => api(`/api/registries/${r.id}`, { method: "DELETE", body: JSON.stringify({ confirm: true }) })),
              )}
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}

      {!unfinished && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-[13px]">
          <Link href="/start?new" className="link">
            Start a new registry
          </Link>
          {registries[0] && (
            <Link href={`/start?from=${registries[0].id}`} className="link">
              Start one using answers from {registries[0].title}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
