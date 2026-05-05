"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/sidebar/Sidebar";
import ChatArea from "@/components/chat/ChatArea";
import SettingsModal from "@/components/settings/SettingsModal";
import type { Conversation, Message, AppSettings } from "@/lib/types";
import { localExportAll } from "@/lib/local-db";
import SyncPromptModal from "@/components/auth/SyncPromptModal";
import { useAuthSync } from "@/lib/hooks/useAuthSync";
import { useTheme } from "next-themes";
import { z } from "zod";

const settingsSchema = z.object({
  provider: z.string().default("openai"),
  model: z.string().default("gpt-4o-mini"),
  apiKey: z.string().default(""),
  theme: z.enum(["light", "dark", "system"]).default("dark"),
});

const DEFAULT_SETTINGS: AppSettings = {
  provider: "openai",
  model: "gpt-4o-mini",
  apiKey: "",
  theme: "dark",
};

function getStoredSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem("quotepin-settings");
    if (stored) {
      const parsed = JSON.parse(stored);
      const result = settingsSchema.safeParse(parsed);
      if (result.success) {
        return { ...DEFAULT_SETTINGS, ...result.data };
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}



export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const {
    supabase,
    authReady,
    userEmail,
    mode,
    dataSource,
    showSyncPrompt,
    setShowSyncPrompt,
    localConvoCount,
  } = useAuthSync();

  const { setTheme } = useTheme();

  useEffect(() => {
    const s = getStoredSettings();
    setSettings(s);
    setTheme(s.theme);

    const handleResize = () => {
      setSidebarCollapsed(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    setLoaded(true);

    return () => window.removeEventListener("resize", handleResize);
  }, [setTheme]);



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
    localStorage.setItem("quotepin-settings", JSON.stringify(newSettings));
    setTheme(newSettings.theme);
  }

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setActiveConvoId(null);
    setActiveMessages([]);
    setConversations([]);
  };

  const getSidebarAuthAction = () => {
    if (userEmail) {
      return {
        label: "Sign out",
        title: userEmail,
        kind: "signout" as const,
        onClick: handleSignOut,
      };
    }

    return {
      label: "Sign in to sync",
      title: "Sign in to sync across devices",
      href: "/auth",
      kind: "signin" as const,
    };
  };

  const renderFloatingAuthAction = () => {
    const className = "fixed bottom-20 right-4 px-3 py-2 rounded-lg bg-card border border-border shadow-lg text-xs hover:bg-muted transition-colors";

    if (userEmail) {
      return (
        <button onClick={handleSignOut} className={className} title={userEmail}>
          Sign out
        </button>
      );
    }

    return (
      <a href="/auth" className={className} title="Sign in to sync across devices">
        Sign in to sync
      </a>
    );
  };

  function handleConversationCreated(id: string) {
    setActiveConvoId(id);
    fetchConversations();
  }

  if (!loaded || !authReady) {
    return (
      <div className="h-screen flex bg-background">
        {/* Sidebar Skeleton */}
        <div className="hidden md:flex w-64 h-full bg-sidebar border-r border-sidebar-border flex-col flex-shrink-0">
          <div className="h-12 px-3 flex items-center border-b border-sidebar-border">
            <div className="w-full h-9 bg-muted rounded-lg animate-pulse" />
          </div>
          <div className="flex-1 p-3 space-y-3">
            <div className="h-8 bg-muted rounded-lg animate-pulse" />
            <div className="h-8 bg-muted rounded-lg animate-pulse" />
            <div className="h-8 bg-muted rounded-lg animate-pulse" />
          </div>
        </div>
        {/* Main Content Skeleton */}
        <div className="flex-1 flex flex-col h-full">
          <header className="h-12 flex items-center gap-3 px-4 border-b border-border flex-shrink-0">
            <div className="w-6 h-6 bg-muted rounded-md animate-pulse" />
            <div className="w-24 h-4 bg-muted rounded animate-pulse" />
            <div className="flex-1" />
            <div className="w-8 h-8 bg-muted rounded-md animate-pulse" />
          </header>
          <div className="flex-1 flex items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-muted animate-pulse" />
          </div>
        </div>
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
        authAction={getSidebarAuthAction()}
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

      {sidebarCollapsed && renderFloatingAuthAction()}

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
