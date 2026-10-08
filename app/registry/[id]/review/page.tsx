"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { ItemCard } from "@/components/ItemCard";
import { ProductPhoto } from "@/components/ProductPhoto";
import { StartOverLink } from "@/components/RegistryActions";
import { Status } from "@/components/Status";
import { useRegistry } from "@/components/useRegistry";
import { CATEGORIES, type Category } from "@/lib/types";

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGate>
      <Review id={id} />
    </AuthGate>
  );
}

type Group = { category: Category; items: unknown[]; pending: Array<{ id: string }> };

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

  if (error && !registry) return <Status tone="error">{error}</Status>;
  if (!registry) return <Status>Opening your registry…</Status>;

  const total = registry.items.length;
  const reviewed = registry.items.filter((i) => i.status !== "pending").length;
  const progress = total ? reviewed / total : 0;
  const active = category ? groups.find((g) => g.category === category) : null;
  const current = active?.pending[0];

  const header = (
    <header className="sticky top-0 z-10 -mx-4 space-y-3 bg-bg px-4 pt-5 pb-4 sm:-mx-6 sm:px-6">
      <div className="flex items-center justify-between text-[13px]">
        {active ? (
          <button onClick={() => setCategory(null)} className="link">
            All categories
          </button>
        ) : (
          <Link href={`/registry/${id}`} className="link">
            Registry overview
          </Link>
        )}
        <span className="text-muted tabular-nums">
          {reviewed} of {total} reviewed
        </span>
      </div>
      <div
        className="h-1 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={reviewed}
        aria-valuemax={total}
        aria-label="Review progress"
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${progress * 100}%` }} />
      </div>
    </header>
  );

  if (active) {
    return (
      <main className="space-y-5">
        {header}
        {current && (
          <div className="flex items-baseline justify-between">
            <h1 className="font-serif text-[21px] font-semibold">{active.category}</h1>
            <span className="text-[13px] text-muted tabular-nums">
              {active.items.length - active.pending.length + 1} of {active.items.length}
            </span>
          </div>
        )}

        {current ? (
          <ItemCard key={current.id} item={current} onChooseOffer={(offerId) => void setPrimary(current.id, offerId)}>
            <div className="sticky bottom-0 -mx-4 grid grid-cols-2 gap-3 bg-bg px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6 md:static md:mx-0 md:px-0 md:pt-4 md:pb-0">
              <button className="btn-quiet" onClick={() => void setStatus(current.id, "skip")}>
                Skip
              </button>
              <button className="btn-primary" onClick={() => void setStatus(current.id, "keep")}>
                Keep
              </button>
            </div>
          </ItemCard>
        ) : (
          <div className="space-y-8 pt-6 lg:pt-10">
            <div className="space-y-2">
              <h1 className="font-serif text-[26px] font-semibold lg:text-[41px]">{active.category} is reviewed.</h1>
              <p className="text-muted lg:text-[17px]">
                You kept {active.items.filter((i) => i.status === "keep").length} of {active.items.length} items.
              </p>
            </div>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 lg:gap-5">
              {active.items
                .filter((i) => i.status === "keep")
                .map((item) => (
                  <li key={item.id} className="space-y-2">
                    <ProductPhoto offer={item.offers[0]} label={item.name} className="aspect-square w-full" />
                    <p className="truncate text-[13px]">{item.name}</p>
                  </li>
                ))}
            </ul>
            <div className="sm:max-w-sm">
              <NextStep groups={groups} onPick={setCategory} id={id} />
            </div>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="space-y-8">
      {header}
      <div className="space-y-3">
        <h1 className="font-serif text-[33px] leading-tight font-semibold lg:text-[48px]">{registry.title}</h1>
        <p className="max-w-[60ch] text-muted lg:text-[17px]">
          Your full draft is ready. Go through it one category at a time, in any order. Stop whenever you like, your
          progress is saved.
        </p>
      </div>

      <ul className="border-t border-line">
        {groups.map((g) => {
          const done = g.pending.length === 0;
          const minutes = Math.max(1, Math.round(g.pending.length / 3));
          return (
            <li key={g.category} className="border-b border-line">
              <button
                onClick={() => setCategory(g.category)}
                className="group flex w-full items-center justify-between gap-6 py-4 text-left lg:py-5"
              >
                <span className="font-serif text-[21px] transition-colors group-hover:text-accent lg:w-48 lg:shrink-0 lg:text-[26px]">
                  {g.category}
                </span>
                <span className="hidden flex-1 gap-3 lg:flex" aria-hidden>
                  {g.items.slice(0, 7).map((item) => (
                    <ProductPhoto
                      key={item.id}
                      offer={item.offers[0]}
                      label=""
                      className={`h-16 w-16 rounded-[10px] ${item.status === "skip" ? "opacity-30" : ""}`}
                    />
                  ))}
                </span>
                <span className="shrink-0 text-[13px] text-muted tabular-nums lg:text-[14px]">
                  {done ? "Reviewed" : `${g.pending.length} to review, about ${minutes} min`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {progress === 1 && (
        <Link href={`/registry/${id}`} className="btn-primary w-full sm:w-auto sm:px-8">
          See and share your registry
        </Link>
      )}

      <div className="sm:max-w-md">
        <StartOverLink registry={registry} label="Not what you wanted? Start over with new answers" />
      </div>
    </main>
  );
}

function NextStep({ groups, onPick, id }: { groups: Group[]; onPick: (c: Category | null) => void; id: string }) {
  const next = groups.find((g) => g.pending.length > 0);
  if (!next) {
    return (
      <Link href={`/registry/${id}`} className="btn-primary w-full">
        See and share your registry
      </Link>
    );
  }
  return (
    <button className="btn-primary w-full" onClick={() => onPick(next.category)}>
      Review {next.category}
    </button>
  );
}
