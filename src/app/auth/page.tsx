"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);

  const [mode, setMode] = useState<"signIn" | "signUp" | "reset">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        window.location.href = "/";
      }
    })();
  }, [supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setMessage("Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      if (mode === "reset") {
        const redirectTo = `${window.location.origin}/auth/reset`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;
        setMessage("Password reset email sent. Check your inbox.");
        setMode("signIn");
      } else if (mode === "signUp") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Account created. If email confirmation is enabled, check your inbox. Otherwise you can sign in now.");
        setMode("signIn");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/";
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Authentication failed";
      const msg = raw.toLowerCase().includes("email rate limit exceeded")
        ? "Supabase is rate-limiting auth emails for this project right now. Please wait a bit and try again, or use Sign in if you already have an account."
        : raw;
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h1 className="text-lg font-semibold">QuotePin</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Sign in to sync conversations across devices.
          </p>
        </div>

        <form onSubmit={submit} className="p-4 space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("signIn")}
              className={`flex-1 px-3 py-2 rounded-md text-sm border transition-colors ${mode === "signIn" ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-muted"
                }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signUp")}
              className={`flex-1 px-3 py-2 rounded-md text-sm border transition-colors ${mode === "signUp" ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-muted"
                }`}
            >
              Sign up
            </button>
          </div>

          <div>
            <label className="text-xs font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          {mode !== "reset" && (
            <div>
              <label className="text-xs font-medium">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
          )}

          {message && <p className="text-xs text-muted-foreground">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {loading
              ? "Please wait..."
              : mode === "signUp"
                ? "Create account"
                : mode === "reset"
                  ? "Send reset email"
                  : "Sign in"}
          </button>

          {mode === "signIn" && (
            <button
              type="button"
              onClick={() => {
                setMessage(null);
                setMode("reset");
              }}
              className="w-full text-center text-xs text-muted-foreground hover:underline"
            >
              Forgot password?
            </button>
          )}

          <a href="/" className="block text-center text-xs text-muted-foreground hover:underline">
            Back to chat
          </a>
        </form>
      </div>
    </div>
  );
}

