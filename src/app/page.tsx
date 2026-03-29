"use client";

import { useState, useEffect, useCallback } from "react";
import { PanelLeftClose } from "lucide-react";
import Sidebar from "@/components/sidebar/Sidebar";
import ChatArea from "@/components/chat/ChatArea";
import SettingsModal from "@/components/settings/SettingsModal";
import type { Conversation, Message, AppSettings } from "@/lib/types";

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

  useEffect(() => {
    const s = getStoredSettings();
    setSettings(s);
    applyTheme(s.theme);
    if (window.innerWidth < 768) setSidebarCollapsed(true);
    setLoaded(true);
  }, []);

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
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  async function loadConversation(id: string) {
    setActiveConvoId(id);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveMessages(data.messages || []);
      }
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
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
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
      />

      {!sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(true)}
          className="absolute top-3 left-[248px] z-10 p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground"
        >
          <PanelLeftClose size={16} />
        </button>
      )}

      <ChatArea
        conversationId={activeConvoId}
        settings={settings}
        initialMessages={activeMessages}
        onConversationCreated={handleConversationCreated}
        onToggleSidebar={() => setSidebarCollapsed(false)}
        sidebarCollapsed={sidebarCollapsed}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
