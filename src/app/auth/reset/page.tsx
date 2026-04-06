"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);

  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!supabase) {
        setMessage("Missing Supabase env vars.");
        setLoading(false);
        return;
      }
      // Supabase will set a session after the recovery link is opened.
      const { data } = await supabase.auth.getSession();
      setReady(!!data.session);
      setLoading(false);
    })();
  }, [supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setMessage(null);

    if (!password || password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Password updated. You can return to the app.");
    setTimeout(() => {
      window.location.href = "/";
    }, 800);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h1 className="text-lg font-semibold">Reset password</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Open the reset link from your email in this browser.
            </p>
          </div>
          <div className="p-4">
            {message && <p className="text-xs text-muted-foreground">{message}</p>}
            <a href="/auth" className="mt-3 inline-block text-xs text-annotation hover:underline">
              Back to sign in
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h1 className="text-lg font-semibold">Set a new password</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Choose a strong password.
          </p>
        </div>

        <form onSubmit={submit} className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          {message && <p className="text-xs text-muted-foreground">{message}</p>}

          <button
            type="submit"
            className="w-full px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
          >
            Update password
          </button>
        </form>
      </div>
    </div>
  );
}

