"use client";

import Link from "next/link";
import { use, useRef, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { ProductPhoto } from "@/components/ProductPhoto";
import { ProductRating } from "@/components/ProductRating";
import { DeleteRegistry, StartOverLink, YourAnswers } from "@/components/RegistryActions";
import { RegistryDetails } from "@/components/RegistryDetails";
import { Status } from "@/components/Status";
import { useRegistry } from "@/components/useRegistry";
import { useVoiceAgent, useVoiceEnabled } from "@/components/voice/useVoiceAgent";
import { TalkButton, VoiceInvite, VoiceRoom } from "@/components/voice/VoiceControls";
import { api, formatPrice, totalPrice } from "@/lib/client";
import { CATEGORIES, RETAILER_LABELS, type EditDiff, type Registry, type RegistryItem } from "@/lib/types";

export default function RegistryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGate>
      <Overview id={id} />
    </AuthGate>
  );
}

function money(amount: number) {
  return `$${Math.round(amount).toLocaleString()}`;
}

function Overview({ id }: { id: string }) {
  const { registry, error, reload, setStatus } = useRegistry(id);

  if (error && !registry) return <Status tone="error">{error}</Status>;
  if (!registry) return <Status>Opening your registry…</Status>;

  const kept = registry.items.filter((i) => i.status !== "skip");
  const pending = registry.items.filter((i) => i.status === "pending").length;
  const purchased = kept.filter((i) => i.purchased).length;
  const total = kept.reduce((sum, i) => sum + totalPrice(i.offers, i.qty), 0);

  return (
    <main className="pt-6 pb-36 lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-16 lg:pt-10 lg:pb-16">
      <aside className="space-y-8 lg:sticky lg:top-10 lg:max-h-[calc(100dvh-2.5rem)] lg:self-start lg:overflow-y-auto lg:pb-10">
        <header className="space-y-3">
          <Link href="/" className="link text-[13px]">
            Calm Registry
          </Link>
          <h1 className="font-serif text-[33px] leading-tight font-semibold">{registry.title}</h1>
          <p className="text-muted">
            {kept.length} items, about {money(total)} in all.{" "}
            {pending > 0 ? null : purchased > 0 ? `${purchased} gifted so far.` : "Nothing gifted yet."}
          </p>
        </header>

        {/* One next step: finish reviewing, then share. */}
        {pending > 0 ? (
          <div className="space-y-4 rounded-2xl bg-surface p-5">
            <div className="space-y-1">
              <p className="font-serif text-[19px] font-semibold">
                {pending} {pending === 1 ? "item" : "items"} still to review
              </p>
              <p className="text-[14px] text-muted">Keep or skip each one before you share the list with family.</p>
            </div>
            <Link href={`/registry/${id}/review`} className="btn-primary w-full">
              Continue review
            </Link>
          </div>
        ) : (
          <ShareCard slug={registry.slug} />
        )}

        <RegistrySettings registry={registry} onSaved={reload} />
        <EditBar registry={registry} onApplied={reload} />
      </aside>

      <div className="mt-12 space-y-10 lg:mt-0">
        {CATEGORIES.map((category) => {
          const items = kept.filter((i) => i.category === category);
          if (!items.length) return null;
          const subtotal = items.reduce((sum, i) => sum + totalPrice(i.offers, i.qty), 0);
          return (
            <section key={category} aria-labelledby={`cat-${category}`}>
              <div className="flex items-baseline justify-between border-b border-line pb-3">
                <h2 id={`cat-${category}`} className="font-serif text-[21px] font-semibold">
                  {category}
                </h2>
                <span className="text-[13px] text-muted tabular-nums">
                  {items.length} {items.length === 1 ? "item" : "items"}, {money(subtotal)}
                </span>
              </div>
              <ul>
                {items.map((item) => (
                  <ItemRow key={item.id} item={item} onRemove={() => void setStatus(item.id, "skip")} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}

/** Name, price, why it's here, and the product. Ratings belong to the keep-or-skip step, not this list. */
function ItemRow({ item, onRemove }: { item: RegistryItem; onRemove: () => void }) {
  const primary = item.offers[0];
  return (
    <li className="flex gap-4 border-b border-line py-4">
      <ProductPhoto offer={primary} label={item.name} className="h-[72px] w-[72px] sm:h-20 sm:w-20" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-semibold">
            {item.name}
            {item.qty > 1 && <span className="font-normal text-muted"> ×{item.qty}</span>}
          </p>
          <p className="shrink-0 tabular-nums">{formatPrice(primary?.price ?? null)}</p>
        </div>
        <p className="line-clamp-2 font-serif text-[14px] leading-snug text-note italic">{item.reason}</p>
        <div className="flex items-baseline justify-between gap-3 text-[13px]">
          {primary ? (
            <a
              href={primary.url}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="min-w-0 truncate text-muted hover:text-text"
            >
              {primary.title}, {RETAILER_LABELS[primary.retailer]}
            </a>
          ) : (
            <span />
          )}
          {item.purchased ? (
            <span className="shrink-0 rounded-md bg-gift-bg px-2 py-0.5 text-gift">
              Gifted{item.purchased.buyerName ? ` by ${item.purchased.buyerName}` : ""}
            </span>
          ) : (
            <button className="shrink-0 text-muted hover:text-text" onClick={onRemove} aria-label={`Remove ${item.name}`}>
              Remove
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function useShare(slug: string) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? `/r/${slug}` : `${window.location.origin}/r/${slug}`;

  async function share() {
    if (navigator.share) {
      await navigator.share({ title: "Our baby registry", url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return { url, copied, share };
}

/** The next step once everything is reviewed. */
function ShareCard({ slug }: { slug: string }) {
  const { url, copied, share } = useShare(slug);
  return (
    <div className="space-y-4 rounded-2xl bg-surface p-5">
      <div className="min-w-0 space-y-1">
        <p className="font-serif text-[19px] font-semibold">Share with family and friends</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="block truncate text-[14px] text-muted hover:text-text">
          {url.replace(/^https?:\/\//, "")}
        </a>
      </div>
      <button className="btn-primary w-full" onClick={() => void share()}>
        {copied ? "Link copied" : "Share link"}
      </button>
    </div>
  );
}

/** Share link while still reviewing: there, but not the next step. */
function ShareLine({ slug }: { slug: string }) {
  const { url, copied, share } = useShare(slug);
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 text-[14px]">
        <p className="font-semibold">Share link</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="block truncate text-muted hover:text-text">
          {url.replace(/^https?:\/\//, "")}
        </a>
      </div>
      <button className="btn-quiet shrink-0 px-4 py-2" onClick={() => void share()}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/** Names, address, answers, and the rare actions, folded into one row until they're needed. */
function RegistrySettings({ registry, onSaved }: { registry: Registry; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const reviewing = registry.items.some((i) => i.status === "pending");
  return (
    <section className="space-y-6" aria-label="Registry settings">
      <button
        className="flex w-full items-center justify-between gap-4 border-y border-line py-3.5 text-left"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="min-w-0">
          <span className="block font-semibold">Registry settings</span>
          <span className="block text-[13px] text-muted">Names, shipping address, your answers{reviewing ? ", share link" : ""}</span>
        </span>
        <svg viewBox="0 0 20 20" aria-hidden className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {/* Closed, this still shows address requests, since those need an answer. */}
      <RegistryDetails registry={registry} onSaved={onSaved} open={open} />
      {open && (
        <div className="space-y-8">
          {reviewing && <ShareLine slug={registry.slug} />}
          <YourAnswers registry={registry} onSaved={onSaved} />
          <div className="flex flex-col items-start gap-3 border-t border-line pt-5">
            <StartOverLink registry={registry} />
            <DeleteRegistry registry={registry} />
          </div>
        </div>
      )}
    </section>
  );
}

const SUGGESTIONS = ["Make it cheaper", "We already have a crib", "More eco-friendly", "Add a baby swing"];

/** Change the registry by describing it. One button until it's used; pinned to the bottom of the screen on phones. */
function EditBar({ registry, onApplied }: { registry: Registry; onApplied: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [diff, setDiff] = useState<EditDiff | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [heard, setHeard] = useState<{ role: "user" | "assistant"; content: string } | null>(null);
  // Voice function calls arrive outside React's render cycle, so they read the pending diff from here.
  const diffRef = useRef<EditDiff | null>(null);

  const names = new Map(registry.items.map((i) => [i.id, i.name]));

  function showDiff(next: EditDiff | null) {
    diffRef.current = next;
    setDiff(next);
  }

  async function requestDiff(request: string) {
    const { diff } = await api<{ diff: EditDiff }>(`/api/registries/${registry.id}/edit`, {
      method: "POST",
      body: JSON.stringify({ request }),
    });
    showDiff(diff);
    return diff;
  }

  async function applyDiff(pending: EditDiff) {
    await api(`/api/registries/${registry.id}/edit`, { method: "POST", body: JSON.stringify({ diff: pending }) });
    showDiff(null);
    setText("");
    setOpen(false);
    await onApplied();
  }

  async function run(task: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That change didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function propose(request: string) {
    if (request.trim()) void run(() => requestDiff(request));
  }

  function apply() {
    if (diff) void run(() => applyDiff(diff));
  }

  function describe(d: EditDiff) {
    return [
      ...d.remove.map((id) => `remove ${names.get(id)}`),
      ...d.add.map((item) => `add ${item.name}`),
      ...d.swap.map((s) => `find a different ${names.get(s.id)}`),
    ];
  }

  const voiceEnabled = useVoiceEnabled();
  const voice = useVoiceAgent({
    onText: (role, content) => setHeard({ role, content }),
    onError: setError,
    async onFunction(name, args) {
      if (name === "preview_change") {
        const request = String(args.request ?? "").trim();
        if (!request) return "No request was given. Ask what they'd like to change.";
        setBusy(true);
        try {
          const next = await requestDiff(request.slice(0, 500));
          const changes = describe(next);
          return JSON.stringify(
            changes.length
              ? {
                  proposed: changes,
                  summary: next.summary,
                  next: "Nothing has changed yet. Describe the proposal as something you'd do, like \"I'd remove the stroller\", and ask if you should go ahead.",
                }
              : { proposed: [], summary: next.summary, next: "Nothing would change. Tell them, and ask what else they'd like." },
          );
        } finally {
          setBusy(false);
        }
      }
      if (name === "apply_change") {
        const pending = diffRef.current;
        if (!pending || !describe(pending).length) return "There's no change waiting. Call preview_change first.";
        setBusy(true);
        try {
          await applyDiff(pending);
          return "Applied. The registry is updated. Tell them it's done and ask if there's anything else.";
        } finally {
          setBusy(false);
        }
      }
      if (name === "cancel_change") {
        showDiff(null);
        return "Cancelled. Nothing was changed.";
      }
      return `Unknown function ${name}.`;
    },
  });

  function talk() {
    setError("");
    setHeard(null);
    void voice.start({ mode: "edit", registryId: registry.id });
  }

  const hasChanges = diff && (diff.add.length || diff.remove.length || diff.swap.length);
  const expanded = open || Boolean(diff) || voice.active || busy;

  function close() {
    setOpen(false);
    setText("");
    setError("");
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:backdrop-blur-none">
      <div className="mx-auto max-w-2xl space-y-3 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 lg:max-w-none lg:p-0">
        {!expanded ? (
          <div className="flex gap-2">
            <button className="btn-quiet flex-1 justify-start" onClick={() => setOpen(true)}>
              Change your registry
            </button>
            {voiceEnabled && <TalkButton label="Say a change out loud" onClick={talk} />}
          </div>
        ) : (
        <>
        {!voice.active && !diff && (
          <div className="flex items-baseline justify-between gap-4">
            <p className="font-semibold">Change your registry</p>
            <button className="link text-[13px]" onClick={close} disabled={busy}>
              Close
            </button>
          </div>
        )}
        {diff && (
          <div className="max-h-[45dvh] space-y-3 overflow-y-auto rounded-xl bg-surface p-4">
            <p className="font-serif text-[17px] text-note italic">{diff.summary}</p>
            <ul className="space-y-1 text-[14px]">
              {diff.remove.map((id) => (
                <li key={id}>Remove {names.get(id)}</li>
              ))}
              {diff.add.map((item) => (
                <li key={item.name}>Add {item.name}</li>
              ))}
              {diff.swap.map((s) => (
                <li key={s.id}>Find a different {names.get(s.id)?.toLowerCase()}</li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button className="btn-quiet flex-1 py-2.5" onClick={() => showDiff(null)} disabled={busy}>
                Cancel
              </button>
              {hasChanges ? (
                <button className="btn-primary flex-1 py-2.5" onClick={apply} disabled={busy}>
                  {busy ? "Applying…" : "Apply changes"}
                </button>
              ) : null}
            </div>
          </div>
        )}
        {!voice.active && !diff && !text && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                className="chip shrink-0 py-1.5 text-[13px]"
                disabled={busy}
                onClick={() => {
                  setText(s);
                  propose(s);
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {error && (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        )}
        {voice.active ? (
          <VoiceRoom
            status={voice.status}
            muted={voice.muted}
            onMute={voice.setMuted}
            onStop={voice.stop}
            stopLabel="Done"
            level={voice.level}
            heard={heard}
            hint="Say what's changed, like a hand-me-down stroller or a smaller budget."
          />
        ) : (
          <>
          {voiceEnabled && !diff && (
            <div className="hidden lg:block">
              <VoiceInvite title="Say a change" detail="Tell it what's changed. Nothing updates until you agree." onStart={talk} disabled={busy} />
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              propose(text);
            }}
            className="flex gap-2 lg:flex-wrap"
          >
            <label htmlFor="edit-request" className="sr-only">
              Describe a change
            </label>
            <input
              id="edit-request"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's changed?"
              className="field lg:basis-full"
            />
            {voiceEnabled && (
              <div className="shrink-0 lg:hidden">
                <TalkButton label="Say a change out loud" onClick={talk} disabled={busy} />
              </div>
            )}
            <button className="btn-primary shrink-0 lg:flex-1" disabled={busy || !text.trim()}>
              {busy && !diff ? "Thinking…" : "Change"}
            </button>
          </form>
          </>
        )}
        </>
        )}
      </div>
    </div>
  );
}
