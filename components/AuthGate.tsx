"use client";

import { useEffect, useState } from "react";
import { authEnabled, getBrowserSupabase } from "@/lib/client";
import { Status } from "./Status";

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
  if (state === "loading") return <Status>One moment…</Status>;

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
    <div className="mx-auto max-w-md space-y-5 pt-24">
      <h2 className="font-serif text-[26px] font-semibold">Save your progress</h2>
      <p className="text-muted">{reason ?? "We'll email you a sign-in link so you can come back anytime. No password needed."}</p>
      {sent ? (
        <p role="status" className="font-serif text-[17px] text-note italic">
          Check your inbox for a sign-in link.
        </p>
      ) : (
        <form onSubmit={send} className="space-y-3">
          <label htmlFor="auth-email" className="sr-only">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="field"
          />
          <button className="btn-primary w-full">Email me a link</button>
          {error && (
            <p role="alert" className="text-[13px] text-danger">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
