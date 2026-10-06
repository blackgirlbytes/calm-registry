"use client";

import { useEffect, useState } from "react";
import { authEnabled, getBrowserSupabase } from "@/lib/client";

export function AuthGate({ children, reason }: { children: React.ReactNode; reason?: string }) {
  const [state, setState] = useState<"loading" | "in" | "out">(authEnabled ? "loading" : "in");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setState(data.session ? "in" : "out"));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState(session ? "in" : "out"));
    return () => data.subscription.unsubscribe();
  }, []);

  if (state === "in") return <>{children}</>;
  if (state === "loading") return <p className="py-20 text-center text-muted">One moment…</p>;

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const { error } = await getBrowserSupabase()!.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="card mt-16 space-y-4 text-center">
      <h2 className="text-xl font-semibold">Save your progress</h2>
      <p className="text-muted">{reason ?? "We'll email you a link so you can come back anytime. No password needed."}</p>
      {sent ? (
        <p className="font-medium text-sage-dark">Check your inbox for a sign-in link.</p>
      ) : (
        <form onSubmit={send} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-full border border-ink/15 bg-cream px-5 py-3 outline-none focus:border-sage"
          />
          <button className="btn-primary w-full">Email me a link</button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
}
