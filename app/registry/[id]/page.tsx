"use client";

import Link from "next/link";
import { use, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { ItemCard } from "@/components/ItemCard";
import { useRegistry } from "@/components/useRegistry";
import { api, CATEGORY_ICONS, totalPrice } from "@/lib/client";
import { CATEGORIES, type EditDiff, type Registry } from "@/lib/types";

export default function RegistryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGate>
      <Overview id={id} />
    </AuthGate>
  );
}

function Overview({ id }: { id: string }) {
  const { registry, error, reload, setStatus, setPrimary } = useRegistry(id);

  if (error && !registry) return <p className="py-20 text-center text-red-600">{error}</p>;
  if (!registry) return <p className="py-20 text-center text-muted">Loading your registry…</p>;

  const kept = registry.items.filter((i) => i.status !== "skip");
  const pending = registry.items.filter((i) => i.status === "pending").length;
  const purchased = kept.filter((i) => i.purchased).length;
  const total = kept.reduce((sum, i) => sum + totalPrice(i.offers, i.qty), 0);

  return (
    <main className="space-y-6 pt-6">
      <header className="space-y-2">
        <Link href="/" className="text-sm text-muted underline">
          Home
        </Link>
        <h1 className="text-2xl font-bold">{registry.title}</h1>
        <p className="text-muted">
          {kept.length} items · about ${Math.round(total).toLocaleString()} · {purchased} gifted
        </p>
      </header>

      {pending > 0 && (
        <Link href={`/registry/${id}/review`} className="card block bg-blush/60 font-medium">
          {pending} items still to review. Continue where you left off →
        </Link>
      )}

      <ShareBox slug={registry.slug} />
      <EditBox registry={registry} onApplied={reload} />

      {CATEGORIES.map((category) => {
        const items = kept.filter((i) => i.category === category);
        if (!items.length) return null;
        return (
          <section key={category} className="space-y-3">
            <h2 className="text-lg font-semibold">
              {CATEGORY_ICONS[category]} {category}
            </h2>
            {items.map((item) => (
              <ItemCard key={item.id} item={item} onChooseOffer={(offerId) => void setPrimary(item.id, offerId)}>
                <div className="flex items-center justify-between text-sm">
                  {item.purchased ? (
                    <span className="font-medium text-sage-dark">🎁 Gifted</span>
                  ) : (
                    <button className="text-muted underline" onClick={() => void setStatus(item.id, "skip")}>
                      Remove
                    </button>
                  )}
                </div>
              </ItemCard>
            ))}
          </section>
        );
      })}
    </main>
  );
}

function ShareBox({ slug }: { slug: string }) {
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
    <div className="card flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold">Share with family &amp; friends</p>
        <p className="truncate text-sm text-muted">{url}</p>
      </div>
      <button className="btn-primary shrink-0" onClick={() => void share()}>
        {copied ? "Copied!" : "Share"}
      </button>
    </div>
  );
}

const SUGGESTIONS = ["Make it cheaper", "We already have a crib", "More eco-friendly", "Add a baby swing"];

function EditBox({ registry, onApplied }: { registry: Registry; onApplied: () => Promise<void> }) {
  const [text, setText] = useState("");
  const [diff, setDiff] = useState<EditDiff | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const names = new Map(registry.items.map((i) => [i.id, i.name]));

  async function propose(request: string) {
    if (!request.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { diff } = await api<{ diff: EditDiff }>(`/api/registries/${registry.id}/edit`, {
        method: "POST",
        body: JSON.stringify({ request }),
      });
      setDiff(diff);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!diff) return;
    setBusy(true);
    try {
      await api(`/api/registries/${registry.id}/edit`, { method: "POST", body: JSON.stringify({ diff }) });
      setDiff(null);
      setText("");
      await onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  const hasChanges = diff && (diff.add.length || diff.remove.length || diff.swap.length);

  return (
    <div className="card space-y-3">
      <p className="font-semibold">Change anything by just saying it</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void propose(text);
        }}
        className="flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. we're getting a hand-me-down stroller"
          className="flex-1 rounded-full border border-ink/15 bg-cream px-4 py-2.5 outline-none focus:border-sage"
        />
        <button className="btn-primary" disabled={busy || !text.trim()}>
          {busy ? "…" : "Go"}
        </button>
      </form>
      {!diff && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              className="chip text-xs"
              disabled={busy}
              onClick={() => {
                setText(s);
                void propose(s);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {diff && (
        <div className="space-y-3 rounded-2xl bg-cream p-4 text-sm">
          <p className="font-medium">{diff.summary}</p>
          <ul className="space-y-1 text-muted">
            {diff.remove.map((id) => (
              <li key={id}>− Remove {names.get(id)}</li>
            ))}
            {diff.add.map((item) => (
              <li key={item.name}>+ Add {item.name}</li>
            ))}
            {diff.swap.map((s) => (
              <li key={s.id}>
                ↻ {names.get(s.id)} → &ldquo;{s.searchQuery}&rdquo;
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => setDiff(null)} disabled={busy}>
              Never mind
            </button>
            {hasChanges ? (
              <button className="btn-primary flex-1" onClick={() => void apply()} disabled={busy}>
                {busy ? "Updating…" : "Looks good"}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
