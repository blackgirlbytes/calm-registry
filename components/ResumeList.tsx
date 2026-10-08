"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, authEnabled, getBrowserSupabase } from "@/lib/client";

type Summary = { id: string; slug: string; title: string };

/** Registries this person already started, if any. */
export function ResumeList() {
  const [registries, setRegistries] = useState<Summary[]>([]);

  useEffect(() => {
    void (async () => {
      if (authEnabled) {
        const { data } = await getBrowserSupabase()!.auth.getSession();
        if (!data.session) return;
      }
      const result = await api<{ registries: Summary[] }>("/api/registries").catch(() => null);
      if (result) setRegistries(result.registries);
    })();
  }, []);

  if (!registries.length) return null;
  const [latest, ...others] = registries;

  return (
    <section aria-labelledby="resume" className="rounded-xl bg-surface px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h2 id="resume" className="text-[13px] text-muted">
            Pick up where you left off
          </h2>
          <p className="truncate font-serif text-[19px] font-semibold">{latest.title}</p>
        </div>
        <Link href={`/registry/${latest.id}`} className="btn-quiet shrink-0 px-4 py-2.5">
          Open registry
        </Link>
      </div>
      {others.length > 0 && (
        <details className="group mt-3 border-t border-line pt-3">
          <summary className="link cursor-pointer list-none text-[13px] [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">See your other {others.length === 1 ? "registry" : `${others.length} registries`}</span>
            <span className="hidden group-open:inline">Hide other registries</span>
          </summary>
          <ul className="mt-2 grid gap-x-8 sm:grid-cols-2">
            {others.map((r) => (
              <li key={r.id}>
                <Link href={`/registry/${r.id}`} className="block truncate py-2 text-[14px] transition-colors hover:text-accent">
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
