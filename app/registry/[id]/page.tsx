"use client";

import Link from "next/link";
import { use, useRef, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { ProductPhoto } from "@/components/ProductPhoto";
import { Status } from "@/components/Status";
import { useRegistry } from "@/components/useRegistry";
import { useVoiceAgent, useVoiceEnabled } from "@/components/voice/useVoiceAgent";
import { MicIcon, VoiceControls } from "@/components/voice/VoiceControls";
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
    <main className="pt-6 pb-48 lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-16 lg:pt-10 lg:pb-16">
      <aside className="space-y-10 lg:sticky lg:top-10 lg:self-start">
        <header className="space-y-3">
          <Link href="/" className="link text-[13px]">
            Calm Registry
          </Link>
          <h1 className="font-serif text-[33px] leading-tight font-semibold">{registry.title}</h1>
          <p className="text-muted">
            {kept.length} items, about {money(total)} in all.{" "}
            {purchased > 0 ? `${purchased} gifted so far.` : "Nothing gifted yet."}
          </p>
        </header>

        {pending > 0 && (
          <div className="flex items-center justify-between gap-4 rounded-xl bg-surface px-5 py-4">
            <p>
              {pending} {pending === 1 ? "item" : "items"} still to review
            </p>
            <Link href={`/registry/${id}/review`} className="btn-primary shrink-0 px-4 py-2.5">
              Continue review
            </Link>
          </div>
        )}

        <ShareRow slug={registry.slug} />
        <EditBar registry={registry} onApplied={reload} />
      </aside>

      <div className="mt-10 space-y-10 lg:mt-0">
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

function ItemRow({ item, onRemove }: { item: RegistryItem; onRemove: () => void }) {
  const primary = item.offers[0];
  return (
    <li className="flex gap-4 border-b border-line py-4">
      <ProductPhoto offer={primary} label={item.name} className="h-[72px] w-[72px] sm:h-24 sm:w-24" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-semibold">
            {item.name}
            {item.qty > 1 && <span className="font-normal text-muted"> ×{item.qty}</span>}
          </p>
          <p className="shrink-0 tabular-nums">{formatPrice(primary?.price ?? null)}</p>
        </div>
        {primary && (
          <a
            href={primary.url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="block truncate text-[13px] text-muted hover:text-text"
          >
            {primary.title}, {RETAILER_LABELS[primary.retailer]}
          </a>
        )}
        <p className="hidden font-serif text-[14px] leading-snug text-note italic sm:block">{item.reason}</p>
        <div className="pt-1 text-[13px]">
          {item.purchased ? (
            <span className="rounded-md bg-gift-bg px-2 py-0.5 text-gift">
              Gifted{item.purchased.buyerName ? ` by ${item.purchased.buyerName}` : ""}
            </span>
          ) : (
            <button className="link" onClick={onRemove}>
              Remove
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function ShareRow({ slug }: { slug: string }) {
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

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-semibold">Share with family and friends</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="block truncate text-[13px] text-muted hover:text-text">
          {url.replace(/^https?:\/\//, "")}
        </a>
      </div>
      <button className="btn-quiet shrink-0 px-4 py-2.5" onClick={() => void share()}>
        {copied ? "Link copied" : "Share link"}
      </button>
    </div>
  );
}

const SUGGESTIONS = ["Make it cheaper", "We already have a crib", "More eco-friendly", "Add a baby swing"];

/** Change the registry by describing it, pinned to the bottom of the screen. */
function EditBar({ registry, onApplied }: { registry: Registry; onApplied: () => Promise<void> }) {
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
              ? { summary: next.summary, changes, next: "Read the summary back briefly and ask if you should make the change." }
              : { summary: next.summary, changes, next: "Nothing would change. Tell them, and ask what else they'd like." },
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

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:backdrop-blur-none">
      <div className="mx-auto max-w-2xl space-y-3 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 lg:max-w-none lg:p-0">
        <p className="hidden font-semibold lg:block">Change your registry</p>
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
        {voice.active && heard && (
          <p className={`text-[14px] ${heard.role === "user" ? "text-muted" : "font-serif text-[16px]"}`}>
            {heard.role === "user" ? `You: ${heard.content}` : heard.content}
          </p>
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
          <VoiceControls status={voice.status} muted={voice.muted} onMute={voice.setMuted} onStop={voice.stop} stopLabel="Done" />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              propose(text);
            }}
            className="flex gap-2"
          >
            <label htmlFor="edit-request" className="sr-only">
              Describe a change
            </label>
            <input
              id="edit-request"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="We're getting a hand-me-down stroller"
              className="field"
            />
            {voiceEnabled && (
              <button type="button" className="btn-quiet shrink-0 px-3.5" onClick={talk} disabled={busy} aria-label="Say a change out loud">
                <MicIcon />
              </button>
            )}
            <button className="btn-primary shrink-0" disabled={busy || !text.trim()}>
              {busy && !diff ? "Thinking…" : "Change"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
