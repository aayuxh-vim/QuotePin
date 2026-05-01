"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Sidebar from "@/components/sidebar/Sidebar";
import ChatArea from "@/components/chat/ChatArea";
import SettingsModal from "@/components/settings/SettingsModal";
import type { Conversation, Message, AppSettings } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getCloudDataSource, getLocalDataSource } from "@/lib/data-source";
import type { DataSource } from "@/lib/data-source";
import { localExportAll, localListConversations } from "@/lib/local-db";
import SyncPromptModal from "@/components/auth/SyncPromptModal";

const DEFAULT_SETTINGS: AppSettings = {
  provider: "openai",
  model: "gpt-4o-mini",
  apiKey: "",
  theme: "dark",
};

function getStoredSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem("ard-settings");
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

function applyTheme(theme: string) {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
  }
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [mode, setMode] = useState<"local" | "cloud">("local");
  const [dataSource, setDataSource] = useState<DataSource>(() => getLocalDataSource());
  const [showSyncPrompt, setShowSyncPrompt] = useState(false);
  const [localConvoCount, setLocalConvoCount] = useState(0);
  const prevSignedInRef = useRef(false);

  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const s = getStoredSettings();
    setSettings(s);
    applyTheme(s.theme);
    if (window.innerWidth < 768) setSidebarCollapsed(true);
    setLoaded(true);
  }, []);

  useEffect(() => {
    (async () => {
      if (!supabase) {
        setAuthReady(true);
        setMode("local");
        setDataSource(getLocalDataSource());
        return;
      }

      // Handle Supabase PKCE redirect (e.g. email links) by exchanging `code` for a session.
      // Without this, the app can land on `/?code=...` and still be unauthenticated.
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            url.searchParams.delete("code");
            window.history.replaceState({}, "", url.toString());
          }
        }
      } catch {
        // ignore
      }

      const { data } = await supabase.auth.getSession();
      setUserEmail(data.session?.user?.email ?? null);
      const signedIn = !!data.session;
      prevSignedInRef.current = signedIn;
      setMode(signedIn ? "cloud" : "local");
      setDataSource(signedIn ? getCloudDataSource() : getLocalDataSource());
      setAuthReady(true);
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        setUserEmail(session?.user?.email ?? null);
        const signedInNow = !!session;
        const wasSignedIn = prevSignedInRef.current;
        prevSignedInRef.current = signedInNow;
        setMode(signedInNow ? "cloud" : "local");
        setDataSource(signedInNow ? getCloudDataSource() : getLocalDataSource());

        if (!wasSignedIn && signedInNow) {
          localListConversations()
            .then((list) => {
              setLocalConvoCount(list.length);
              if (list.length > 0) setShowSyncPrompt(true);
            })
            .catch(() => {});
        }
      });

      return () => {
        sub.subscription.unsubscribe();
      };
    })();
  }, [supabase]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await dataSource.listConversations();
      setConversations(data);
    } catch { /* ignore */ }
  }, [dataSource]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  async function loadConversation(id: string) {
    setActiveConvoId(id);
    try {
      const data = await dataSource.getConversation(id);
      setActiveMessages(data?.messages || []);
    } catch {
      setActiveMessages([]);
    }
  }

  function handleNewChat() {
    setActiveConvoId(null);
    setActiveMessages([]);
  }

  async function handleDeleteConversation(id: string) {
    try {
      await dataSource.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvoId === id) {
        setActiveConvoId(null);
        setActiveMessages([]);
      }
    } catch { /* ignore */ }
  }

  function handleSaveSettings(newSettings: AppSettings) {
    setSettings(newSettings);
    localStorage.setItem("ard-settings", JSON.stringify(newSettings));
    applyTheme(newSettings.theme);
  }

  function handleConversationCreated(id: string) {
    setActiveConvoId(id);
    fetchConversations();
  }

  if (!loaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!authReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">Loading session...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background">
      <Sidebar
        conversations={conversations}
        activeId={activeConvoId}
        onSelect={loadConversation}
        onNew={handleNewChat}
        onDelete={handleDeleteConversation}
        onOpenSettings={() => setSettingsOpen(true)}
        collapsed={sidebarCollapsed}
        authAction={
          userEmail
            ? {
                label: "Sign out",
                title: userEmail,
                kind: "signout",
                onClick: async () => {
                  if (!supabase) return;
                  await supabase.auth.signOut();
                  setActiveConvoId(null);
                  setActiveMessages([]);
                  setConversations([]);
                },
              }
            : { label: "Sign in to sync", title: "Sign in to sync across devices", href: "/auth", kind: "signin" }
        }
      />

      <ChatArea
        conversationId={activeConvoId}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        initialMessages={activeMessages}
        onConversationCreated={handleConversationCreated}
        onToggleSidebar={() => setSidebarCollapsed(false)}
        onCollapseSidebar={() => setSidebarCollapsed(true)}
        sidebarCollapsed={sidebarCollapsed}
        mode={mode}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      {sidebarCollapsed && (
        userEmail ? (
          <button
            onClick={async () => {
              if (!supabase) return;
              await supabase.auth.signOut();
              setActiveConvoId(null);
              setActiveMessages([]);
              setConversations([]);
            }}
            className="fixed bottom-20 right-4 px-3 py-2 rounded-lg bg-card border border-border shadow-lg text-xs hover:bg-muted transition-colors"
            title={userEmail}
          >
            Sign out
          </button>
        ) : (
          <a
            href="/auth"
            className="fixed bottom-20 right-4 px-3 py-2 rounded-lg bg-card border border-border shadow-lg text-xs hover:bg-muted transition-colors"
            title="Sign in to sync across devices"
          >
            Sign in to sync
          </a>
        )
      )}

      <SyncPromptModal
        open={showSyncPrompt}
        localCount={localConvoCount}
        onClose={() => setShowSyncPrompt(false)}
        onUpload={async () => {
          const payload = await localExportAll();
          const res = await fetch("/api/migrate/local", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Upload failed");
          }
          setShowSyncPrompt(false);
        }}
        onKeepLocal={() => {
          setShowSyncPrompt(false);
        }}
        onKeepSeparate={() => {
          setShowSyncPrompt(false);
        }}
      />
    </div>
  );
}
