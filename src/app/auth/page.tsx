"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const INVITE_CODE = process.env.NEXT_PUBLIC_QUOTE_PIN_INVITE_CODE || "";
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "error-callback"?: () => void; "expired-callback"?: () => void; }) => string;
      reset: (widgetId: string) => void;
    };
  }
}

function nowMs() {
  return Date.now();
}

function getCooldownUntil(key: string) {
  try {
    const raw = localStorage.getItem(key);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function setCooldownUntil(key: string, until: number) {
  try {
    localStorage.setItem(key, String(until));
  } catch {
    // ignore
  }
}

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
  const [invite, setInvite] = useState("");
  const [cooldownUntil, setCooldownUntilState] = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [turnstileWidgetId, setTurnstileWidgetId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        window.location.href = "/";
      }
    })();
  }, [supabase]);

  useEffect(() => {
    const key = mode === "reset" ? "quotepin:auth:reset:cooldownUntil" : "quotepin:auth:signup:cooldownUntil";
    setCooldownUntilState(getCooldownUntil(key));
  }, [mode]);

  useEffect(() => {
    const t = setInterval(() => {
      if (!cooldownUntil) return;
      if (nowMs() >= cooldownUntil) setCooldownUntilState(0);
    }, 500);
    return () => clearInterval(t);
  }, [cooldownUntil]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    if (!(mode === "signUp" || mode === "reset")) return;

    // Load script once.
    const existing = document.querySelector<HTMLScriptElement>("script[data-turnstile='true']");
    if (!existing) {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.defer = true;
      s.dataset.turnstile = "true";
      document.head.appendChild(s);
    }

    setCaptchaToken(null);
    setTurnstileWidgetId(null);

    let cancelled = false;
    const interval = window.setInterval(() => {
      if (cancelled) return;
      const api = window.turnstile;
      const mount = document.getElementById("turnstile-container");
      if (!api || !mount) return;

      window.clearInterval(interval);
      try {
        const id = api.render(mount, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token) => setCaptchaToken(token),
          "error-callback": () => setCaptchaToken(null),
          "expired-callback": () => setCaptchaToken(null),
        });
        setTurnstileWidgetId(id);
      } catch {
        // ignore
      }
    }, 100);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [mode]);

  const remainingSec = Math.max(0, Math.ceil((cooldownUntil - nowMs()) / 1000));
  const isCoolingDown = remainingSec > 0 && (mode === "reset" || mode === "signUp");

  async function verifyCaptchaIfNeeded() {
    if (!TURNSTILE_SITE_KEY) return; // feature disabled
    if (!captchaToken) {
      throw new Error("Please complete the CAPTCHA.");
    }
    const res = await fetch("/api/captcha/turnstile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: captchaToken }),
    });
    if (!res.ok) throw new Error("Captcha failed. Please try again.");
  }

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
        if (isCoolingDown) throw new Error(`Please wait ${remainingSec}s before trying again.`);
        await verifyCaptchaIfNeeded();
        const redirectTo = `${window.location.origin}/auth/reset`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;
        setMessage("Password reset email sent. Check your inbox.");
        const key = "quotepin:auth:reset:cooldownUntil";
        const until = nowMs() + 60_000;
        setCooldownUntil(key, until);
        setCooldownUntilState(until);
        setMode("signIn");
      } else if (mode === "signUp") {
        if (INVITE_CODE && invite.trim() !== INVITE_CODE) {
          throw new Error("Invite code required.");
        }
        if (isCoolingDown) throw new Error(`Please wait ${remainingSec}s before trying again.`);
        await verifyCaptchaIfNeeded();
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Account created. If email confirmation is enabled, check your inbox. Otherwise you can sign in now.");
        const key = "quotepin:auth:signup:cooldownUntil";
        const until = nowMs() + 60_000;
        setCooldownUntil(key, until);
        setCooldownUntilState(until);
        setMode("signIn");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/";
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Authentication failed";
      const msg = raw.toLowerCase().includes("email rate limit exceeded")
        ? "Supabase is rate-limiting auth emails for this project right now. Please wait ~10 minutes and try again, or use Sign in if you already have an account."
        : raw;
      if (raw.toLowerCase().includes("email rate limit exceeded")) {
        const key = mode === "reset" ? "quotepin:auth:reset:cooldownUntil" : "quotepin:auth:signup:cooldownUntil";
        const until = nowMs() + 10 * 60_000;
        setCooldownUntil(key, until);
        setCooldownUntilState(until);
      }
      setMessage(msg);
      if (TURNSTILE_SITE_KEY && turnstileWidgetId && window.turnstile) {
        try { window.turnstile.reset(turnstileWidgetId); } catch {}
        setCaptchaToken(null);
      }
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

          {mode === "signUp" && INVITE_CODE && (
            <div>
              <label className="text-xs font-medium">Invite code</label>
              <input
                value={invite}
                onChange={(e) => setInvite(e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
          )}

          {(mode === "signUp" || mode === "reset") && TURNSTILE_SITE_KEY && (
            <div className="space-y-1">
              <div id="turnstile-container" />
              <p className="text-[11px] text-muted-foreground">
                Protected by Cloudflare Turnstile.
              </p>
            </div>
          )}

          {isCoolingDown && (
            <p className="text-xs text-muted-foreground">
              Please wait <strong>{remainingSec}s</strong> before trying again.
            </p>
          )}

          {message && <p className="text-xs text-muted-foreground">{message}</p>}

          <button
            type="submit"
            disabled={loading || isCoolingDown}
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

