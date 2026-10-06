"use client";

import { use, useCallback, useEffect, useState } from "react";
import { CATEGORY_ICONS, formatPrice, getBrowserSupabase, PRIORITY_LABELS } from "@/lib/client";
import { CATEGORIES, RETAILER_LABELS, type Registry, type RegistryItem, type RetailerId } from "@/lib/types";

type PublicRegistry = Omit<Registry, "ownerId" | "profile">;

const POLL_MS = 15000;

export default function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [registry, setRegistry] = useState<PublicRegistry | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/r/${slug}`, { cache: "no-store" });
    const data = (await response.json()) as { registry?: PublicRegistry; error?: string };
    if (data.registry) setRegistry(data.registry);
    else setError(data.error ?? "Registry not found.");
  }, [slug]);

  useEffect(() => {
    void load();
    const supabase = getBrowserSupabase();
    if (!supabase) {
      const timer = setInterval(() => void load(), POLL_MS);
      return () => clearInterval(timer);
    }
    const channel = supabase
      .channel(`registry:${slug}`)
      .on("broadcast", { event: "registry_changed" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, slug]);

  if (error) return <p className="py-20 text-center text-muted">{error}</p>;
  if (!registry) return <p className="py-20 text-center text-muted">Loading…</p>;

  const gifted = registry.items.filter((i) => i.purchased).length;

  return (
    <main className="space-y-6 pt-10">
      <header className="space-y-2 text-center">
        <p className="text-4xl">🍼</p>
        <h1 className="text-2xl font-bold">{registry.title}</h1>
        {registry.dueDate && (
          <p className="text-muted">
            Due {new Date(registry.dueDate + "T00:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </p>
        )}
        <p className="text-sm text-muted">
          {gifted} of {registry.items.length} gifted. Thank you for helping us get ready!
        </p>
      </header>

      {CATEGORIES.map((category) => {
        const items = registry.items.filter((i) => i.category === category);
        if (!items.length) return null;
        return (
          <section key={category} className="space-y-3">
            <h2 className="text-lg font-semibold">
              {CATEGORY_ICONS[category]} {category}
            </h2>
            {items.map((item) => (
              <GiftCard key={item.id} item={item} slug={slug} onBought={load} />
            ))}
          </section>
        );
      })}
    </main>
  );
}

function GiftCard({ item, slug, onBought }: { item: RegistryItem; slug: string; onBought: () => Promise<void> }) {
  const [confirming, setConfirming] = useState<RetailerId | "elsewhere" | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const primary = item.offers[0];

  async function markBought() {
    setError("");
    const response = await fetch(`/api/r/${slug}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId: item.id, buyerName: name, retailer: confirming === "elsewhere" ? null : confirming }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) setError(data.error ?? "That didn't work.");
    setConfirming(null);
    await onBought();
  }

  return (
    <article className={`card space-y-3 ${item.purchased ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-cream text-3xl">
          {primary?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={primary.imageUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            CATEGORY_ICONS[item.category]
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">{PRIORITY_LABELS[item.priority]}</p>
          <h3 className="font-semibold">
            {item.name}
            {item.qty > 1 && <span className="font-normal text-muted"> × {item.qty}</span>}
          </h3>
          <p className="truncate text-sm text-muted">{primary?.title}</p>
        </div>
      </div>

      {item.purchased ? (
        <p className="text-center font-medium text-sage-dark">🎁 Already gifted</p>
      ) : confirming ? (
        <div className="space-y-2 rounded-2xl bg-cream p-3">
          <p className="text-sm">Did you buy it? Let them know so nobody doubles up.</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name (optional)"
            className="w-full rounded-full border border-ink/15 bg-white px-4 py-2 outline-none focus:border-sage"
          />
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => setConfirming(null)}>
              Not yet
            </button>
            <button className="btn-primary flex-1" onClick={() => void markBought()}>
              Yes, I bought it
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {item.offers.map((offer) => (
            <a
              key={offer.id}
              href={offer.url}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={() => setConfirming(offer.retailer)}
              className="chip"
            >
              {RETAILER_LABELS[offer.retailer]} · {formatPrice(offer.price)}
            </a>
          ))}
          <button className="text-sm text-muted underline" onClick={() => setConfirming("elsewhere")}>
            Bought it elsewhere
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </article>
  );
}
