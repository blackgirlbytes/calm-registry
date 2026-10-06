"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, authEnabled, getBrowserSupabase } from "@/lib/client";

type Summary = { id: string; slug: string; title: string };

export default function Home() {
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

  return (
    <main className="space-y-8 pt-16">
      <div className="space-y-4 text-center">
        <p className="text-5xl">🌿</p>
        <h1 className="text-3xl font-bold leading-tight">Your baby registry, without the overwhelm.</h1>
        <p className="text-lg text-muted">
          Chat for about 3 minutes. We&apos;ll build a complete registry from Amazon, Target, and Walmart. Then you
          just review it, one small step at a time.
        </p>
      </div>

      <Link href="/start" className="btn-primary w-full text-lg">
        Start my registry
      </Link>

      <ul className="space-y-3 text-muted">
        <li>✓ No blank pages. You get a full draft right away.</li>
        <li>✓ Each item tells you why it&apos;s there.</li>
        <li>✓ Review one category at a time, about 2 minutes each.</li>
        <li>✓ Change anything by just saying it: &ldquo;make it cheaper.&rdquo;</li>
      </ul>

      {registries.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Pick up where you left off</h2>
          {registries.map((r) => (
            <Link key={r.id} href={`/registry/${r.id}`} className="card block font-medium hover:bg-white/70">
              {r.title} →
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
