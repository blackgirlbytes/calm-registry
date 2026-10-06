"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { ItemCard } from "@/components/ItemCard";
import { useRegistry } from "@/components/useRegistry";
import { CATEGORY_ICONS } from "@/lib/client";
import { CATEGORIES, type Category } from "@/lib/types";

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGate>
      <Review id={id} />
    </AuthGate>
  );
}

function Review({ id }: { id: string }) {
  const { registry, error, setStatus, setPrimary } = useRegistry(id);
  const [category, setCategory] = useState<Category | null>(null);

  const groups = useMemo(() => {
    if (!registry) return [];
    return CATEGORIES.map((c) => {
      const items = registry.items.filter((i) => i.category === c);
      return { category: c, items, pending: items.filter((i) => i.status === "pending") };
    }).filter((g) => g.items.length > 0);
  }, [registry]);

  if (error && !registry) return <p className="py-20 text-center text-red-600">{error}</p>;
  if (!registry) return <p className="py-20 text-center text-muted">Loading your registry…</p>;

  const total = registry.items.length;
  const reviewed = registry.items.filter((i) => i.status !== "pending").length;
  const progress = total ? reviewed / total : 0;

  const header = (
    <header className="sticky top-0 z-10 space-y-2 bg-cream pt-6 pb-3">
      <div className="flex items-center justify-between text-sm">
        <Link href={`/registry/${id}`} className="text-muted underline">
          Registry overview
        </Link>
        <span className="text-muted">
          {reviewed} of {total} reviewed
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink/10">
        <div className="h-full rounded-full bg-sage transition-all" style={{ width: `${progress * 100}%` }} />
      </div>
    </header>
  );

  const active = category ? groups.find((g) => g.category === category) : null;
  const current = active?.pending[0];

  if (active) {
    return (
      <main className="space-y-4">
        {header}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            {CATEGORY_ICONS[active.category]} {active.category}
          </h1>
          <button onClick={() => setCategory(null)} className="text-sm text-muted underline">
            All categories
          </button>
        </div>

        {current ? (
          <>
            <p className="text-sm text-muted">{active.pending.length} left in this category</p>
            <ItemCard key={current.id} item={current} onChooseOffer={(offerId) => void setPrimary(current.id, offerId)}>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button className="btn-ghost" onClick={() => void setStatus(current.id, "skip")}>
                  Skip
                </button>
                <button className="btn-primary" onClick={() => void setStatus(current.id, "keep")}>
                  Keep
                </button>
              </div>
            </ItemCard>
          </>
        ) : (
          <div className="card space-y-4 text-center">
            <p className="text-4xl">🎉</p>
            <h2 className="text-xl font-semibold">{active.category} is done!</h2>
            <NextCategoryButton groups={groups} onPick={setCategory} id={id} />
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="space-y-4">
      {header}
      <h1 className="text-2xl font-bold">{registry.title}</h1>
      <p className="text-muted">
        Here&apos;s your full draft. Go through it one category at a time, in any order. You can stop whenever you like, and
        your progress is saved.
      </p>
      <div className="grid gap-3">
        {groups.map((g) => {
          const minutes = Math.max(1, Math.round(g.pending.length / 3));
          const done = g.pending.length === 0;
          return (
            <button
              key={g.category}
              onClick={() => setCategory(g.category)}
              className="card flex items-center justify-between text-left hover:bg-white/70"
            >
              <span className="flex items-center gap-3">
                <span className="text-3xl">{CATEGORY_ICONS[g.category]}</span>
                <span>
                  <span className="block font-semibold">{g.category}</span>
                  <span className="text-sm text-muted">
                    {done ? "All reviewed ✓" : `${g.pending.length} items · about ${minutes} min`}
                  </span>
                </span>
              </span>
              <span className="text-muted">→</span>
            </button>
          );
        })}
      </div>
      {progress === 1 && (
        <Link href={`/registry/${id}`} className="btn-primary w-full">
          All done! See and share your registry
        </Link>
      )}
    </main>
  );
}

function NextCategoryButton({
  groups,
  onPick,
  id,
}: {
  groups: Array<{ category: Category; pending: unknown[] }>;
  onPick: (c: Category | null) => void;
  id: string;
}) {
  const next = groups.find((g) => g.pending.length > 0);
  if (!next) {
    return (
      <Link href={`/registry/${id}`} className="btn-primary w-full">
        Everything&apos;s reviewed. See your registry
      </Link>
    );
  }
  return (
    <button className="btn-primary w-full" onClick={() => onPick(next.category)}>
      Next: {CATEGORY_ICONS[next.category]} {next.category}
    </button>
  );
}
