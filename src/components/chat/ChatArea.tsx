"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "ai/react";
import { Send, Loader2, PanelLeftOpen, PanelLeftClose, AlertCircle, Sparkles, GitFork, Sun, Moon, Share2, Check, Bookmark, X, Copy } from "lucide-react";
import MessageBubble from "./MessageBubble";
import SelectionPopup from "./SelectionPopup";
import MobileAnnotateSheet from "./MobileAnnotateSheet";
import { parseDataStream } from "@/lib/stream-parser";
import type { Annotation, AppSettings, Message as DBMessage } from "@/lib/types";
import { localAddAnnotation, localAppendMessage, localCreateConversation } from "@/lib/local-db";
import { markdownToPlainText } from "@/lib/markdown-plain";
import { findNthIndex } from "@/lib/utils";

interface LocalAnnotation {
  id: string;
  messageId: string;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  occurrence: number;
  prefix: string;
  suffix: string;
  question: string;
  answer: string;
  createdAt: string;
}

interface SelectionState {
  text: string;
  rect: DOMRect;
  messageContent: string;
  messageId?: string;
  occurrenceHint: number;
}

interface AnnotationPopupState {
  annotation: LocalAnnotation;
  position: { x: number; y: number };
}

interface MobileSheetState {
  messageId: string;
  messageContent: string;
}

interface Props {
  conversationId: string | null;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  initialMessages: DBMessage[];
  onConversationCreated: (id: string) => void;
  onToggleSidebar: () => void;
  onCollapseSidebar: () => void;
  sidebarCollapsed: boolean;
  mode: "local" | "cloud";
}

type BookmarkItem = {
  messageId: string;
  role: "user" | "assistant";
  preview: string;
  createdAt: string;
};

export default function ChatArea({
  conversationId,
  settings,
  onSaveSettings,
  initialMessages,
  onConversationCreated,
  onToggleSidebar,
  onCollapseSidebar,
  sidebarCollapsed,
  mode,
}: Props) {
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [annotationPopup, setAnnotationPopup] = useState<AnnotationPopupState | null>(null);
  const [mobileSheet, setMobileSheet] = useState<MobileSheetState | null>(null);
  const [currentConvoId, setCurrentConvoId] = useState<string | null>(conversationId);
  const [annotationsMap, setAnnotationsMap] = useState<Record<string, LocalAnnotation[]>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const convoIdRef = useRef<string | null>(conversationId);
  const pendingAssistantSaveRef = useRef(false);
  const lastSavedAssistantIdRef = useRef<string | null>(null);

  const [chatError, setChatError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "error">("idle");
  const [shareEnabled, setShareEnabled] = useState<boolean>(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [bookmarksHydratedFor, setBookmarksHydratedFor] = useState<string | null>(null);
  const [pendingScrollTo, setPendingScrollTo] = useState<string | null>(null);

  const messageElsRef = useRef<Record<string, HTMLDivElement | null>>({});

  const bookmarkKey = currentConvoId ? `quotepin-bookmarks:${currentConvoId}` : null;

  // If we're in a blank "New Chat" (no conversation yet), ensure we don't show stale bookmarks.
  useEffect(() => {
    if (bookmarkKey) return;
    setBookmarksHydratedFor(null);
    setBookmarks([]);
  }, [bookmarkKey]);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: sdkHandleSubmit,
    append,
    reload,
    status,
    error,
    setMessages,
  } = useChat({
    api: "/api/chat",
    initialMessages: initialMessages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    onResponse(response) {
      setChatError(null);
      const newConvoId = response.headers.get("X-Conversation-Id");
      if (newConvoId && !convoIdRef.current && mode === "cloud") {
        convoIdRef.current = newConvoId;
        setCurrentConvoId(newConvoId);
        onConversationCreated(newConvoId);
      }
    },
    onError(err) {
      console.error("useChat error:", err);
      let msg = err.message || "Something went wrong";
      try {
        const parsed = JSON.parse(msg);
        if (parsed.error) msg = parsed.error;
      } catch {
        // not JSON, use as-is
      }
      setChatError(msg);
    },
  });

  useEffect(() => {
    convoIdRef.current = conversationId;
    setCurrentConvoId(conversationId);
    messageElsRef.current = {};
    setPendingScrollTo(null);

    const initMsgs = initialMessages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
    setMessages(initMsgs);

    const annMap: Record<string, LocalAnnotation[]> = {};
    for (const m of initialMessages) {
      if (m.annotations?.length) {
        annMap[m.id] = m.annotations;
      }
    }
    setAnnotationsMap(annMap);
    setSelection(null);
    setAnnotationPopup(null);
    setShareEnabled(false);
    setShareToken(null);
  }, [conversationId, initialMessages, setMessages]);

  useEffect(() => {
    if (!bookmarkKey) return;
    // Prevent persisting stale/empty state to a new conversation key before we load.
    setBookmarksHydratedFor(null);
    setBookmarks([]);
    try {
      const raw = localStorage.getItem(bookmarkKey);
      if (!raw) {
        setBookmarks([]);
        setBookmarksHydratedFor(bookmarkKey);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setBookmarks(parsed);
      setBookmarksHydratedFor(bookmarkKey);
    } catch {
      setBookmarks([]);
      setBookmarksHydratedFor(bookmarkKey);
    }
  }, [bookmarkKey]);

  useEffect(() => {
    if (!bookmarkKey) return;
    // Only persist once we've loaded bookmarks for this specific key.
    if (bookmarksHydratedFor !== bookmarkKey) return;
    try {
      localStorage.setItem(bookmarkKey, JSON.stringify(bookmarks));
    } catch {
      // ignore
    }
  }, [bookmarkKey, bookmarks, bookmarksHydratedFor]);

  useEffect(() => {
    (async () => {
      if (!currentConvoId) return;
      if (mode !== "cloud") return;
      try {
        const res = await fetch(`/api/conversations/${currentConvoId}/share`, { method: "GET" });
        if (!res.ok) return;
        const data = await res.json();
        setShareEnabled(!!data.shareEnabled);
        setShareToken(data.shareToken || null);
      } catch {
        // ignore
      }
    })();
  }, [currentConvoId, mode]);

  const shareUrl = shareToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${shareToken}` : null;

  async function ensureShareEnabled() {
    if (!currentConvoId || mode !== "cloud") return;
    if (shareToken && shareEnabled) return;
    setShareBusy(true);
    try {
      const res = await fetch(`/api/conversations/${currentConvoId}/share`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to enable sharing");
      const data = await res.json();
      setShareEnabled(true);
      setShareToken(data.shareToken);
      setShareStatus("idle");
    } finally {
      setShareBusy(false);
    }
  }

  async function copyShareLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setShareStatus("copied");
    setTimeout(() => setShareStatus("idle"), 1200);
  }

  async function disableShare() {
    if (!currentConvoId || mode !== "cloud") return;
    setShareBusy(true);
    try {
      const res = await fetch(`/api/conversations/${currentConvoId}/share`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to disable sharing");
      setShareEnabled(false);
      setShareToken(null);
    } finally {
      setShareBusy(false);
    }
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // If a bookmark was clicked before the message DOM mounted, scroll once it exists.
  useEffect(() => {
    if (!pendingScrollTo) return;
    const el = messageElsRef.current[pendingScrollTo];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setPendingScrollTo(null);
    }
  }, [messages, pendingScrollTo]);

  // Local-mode persistence: write user+assistant messages to IndexedDB.
  useEffect(() => {
    if (mode !== "local") return;
    const convoId = convoIdRef.current;
    if (!convoId) return;

    (async () => {
      const last = messages[messages.length - 1];
      if (!last) return;

      // Save user messages immediately when they appear.
      if (last.role === "user") {
        await localAppendMessage({
          id: last.id,
          conversationId: convoId,
          role: "user",
          content: last.content,
        });
        return;
      }

      // Save assistant message once streaming is done.
      if (last.role === "assistant" && status === "ready" && pendingAssistantSaveRef.current) {
        if (lastSavedAssistantIdRef.current === last.id) return;
        await localAppendMessage({
          id: last.id,
          conversationId: convoId,
          role: "assistant",
          content: last.content,
        });
        lastSavedAssistantIdRef.current = last.id;
        pendingAssistantSaveRef.current = false;
      }
    })();
  }, [mode, messages, status]);

  const handleTextSelect = useCallback(
    (text: string, rect: DOMRect, messageContent: string, occurrenceHint: number, messageId?: string) => {
      const matchingMsg = messageId
        ? messages.find((m) => m.id === messageId)
        : messages.find((m) => m.role === "assistant" && m.content === messageContent);
      setAnnotationPopup(null);
      setMobileSheet(null);
      setSelection({ text, rect, messageContent, messageId: matchingMsg?.id, occurrenceHint });
    },
    [messages]
  );

  function handleAnnotationClick(annotation: LocalAnnotation, rect: DOMRect) {
    setSelection(null);
    setMobileSheet(null);
    setAnnotationPopup({
      annotation,
      position: { x: rect.left, y: rect.bottom },
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!settings.apiKey || !input.trim()) return;
    setChatError(null);

    (async () => {
      let convoId = convoIdRef.current;

      if (!convoId && mode === "local") {
        const convo = await localCreateConversation({
          id: `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          provider: settings.provider,
          model: settings.model,
        });
        convoId = convo.id;
        convoIdRef.current = convo.id;
        setCurrentConvoId(convo.id);
        onConversationCreated(convo.id);
      }

      pendingAssistantSaveRef.current = mode === "local";
      lastSavedAssistantIdRef.current = null;

      sdkHandleSubmit(e, {
        body: {
          conversationId: convoId,
          provider: settings.provider,
          model: settings.model,
          apiKey: settings.apiKey,
          persist: mode === "cloud",
        },
      });

      // Persist the user message in local mode using the same message id that `useChat` will create.
      // We can't access that id here; instead we persist on the messages effect below once it appears.
    })();
  }

  async function handleReplyInChat(selectedText: string, question: string) {
    if (!settings.apiKey) return;
    setSelection(null);
    setChatError(null);

    // In local mode we must ensure the conversation exists BEFORE appending,
    // otherwise the messages won’t be associated and will disappear on reload.
    if (mode === "local" && !convoIdRef.current) {
      try {
        const convo = await localCreateConversation({
          id: `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          provider: settings.provider,
          model: settings.model,
        });
        convoIdRef.current = convo.id;
        setCurrentConvoId(convo.id);
        onConversationCreated(convo.id);
      } catch {
        // If we can’t create local convo, abort to avoid “orphan” messages.
        return;
      }
    }

    // Ensure the assistant reply gets persisted after streaming completes (local mode).
    pendingAssistantSaveRef.current = mode === "local";
    lastSavedAssistantIdRef.current = null;

    append(
      { role: "user", content: `Regarding "${selectedText}":\n\n${question}` },
      {
        body: {
          conversationId: convoIdRef.current,
          provider: settings.provider,
          model: settings.model,
          apiKey: settings.apiKey,
          persist: mode === "cloud",
        },
      }
    );
  }

  async function requestPopupAnswer(args: {
    messageId: string;
    messageContent: string;
    selectedText: string;
    startOffset: number;
    endOffset: number;
    occurrence: number;
    prefix: string;
    suffix: string;
    question: string;
  }): Promise<ReadableStream<Uint8Array> | null> {
    const res = await fetch("/api/chat/popup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messageId: args.messageId,
        selectedText: args.selectedText,
        question: args.question,
        startOffset: args.startOffset,
        endOffset: args.endOffset,
        occurrence: args.occurrence,
        prefix: args.prefix,
        suffix: args.suffix,
        originalContent: args.messageContent,
        provider: settings.provider,
        model: settings.model,
        apiKey: settings.apiKey,
        // In cloud mode we persist exactly once via POST /api/annotations (on close),
        // to avoid double-saves (popup route also supports persistence).
        persist: false,
      }),
    });

    if (!res.ok) return null;
    return res.body;
  }

  async function handlePopupAsk(question: string): Promise<ReadableStream<Uint8Array> | null> {
    if (!selection) return null;

    const messageId = selection.messageId || "";
    const content = selection.messageContent;
    const selected = selection.text;

    const startOffset = Math.max(0, findNthIndex(content, selected, selection.occurrenceHint));
    const endOffset = startOffset + selected.length;

    const prefix = content.slice(Math.max(0, startOffset - 32), startOffset);
    const suffix = content.slice(endOffset, Math.min(content.length, endOffset + 32));

    return requestPopupAnswer({
      messageId,
      messageContent: content,
      selectedText: selection.text,
      question,
      startOffset,
      endOffset,
      occurrence: selection.occurrenceHint,
      prefix,
      suffix,
    });
  }

  function handleSaveAnnotation(question: string, answer: string) {
    if (!selection) return;
    const content = selection.messageContent;
    const selected = selection.text;

    const startOffset = Math.max(0, findNthIndex(content, selected, selection.occurrenceHint));
    const endOffset = startOffset + selected.length;
    const prefix = content.slice(Math.max(0, startOffset - 32), startOffset);
    const suffix = content.slice(endOffset, Math.min(content.length, endOffset + 32));

    const newAnnotation: LocalAnnotation = {
      id: `ann-${Date.now()}`,
      messageId: selection.messageId || "",
      selectedText: selection.text,
      startOffset,
      endOffset,
      occurrence: selection.occurrenceHint,
      prefix,
      suffix,
      question,
      answer,
      createdAt: new Date().toISOString(),
    };

    const msgId = selection.messageId || "";
    setAnnotationsMap((prev) => ({
      ...prev,
      [msgId]: [...(prev[msgId] || []), newAnnotation],
    }));

    if (mode === "local" && selection.messageId) {
      localAddAnnotation({
        messageId: selection.messageId,
        selectedText: selection.text,
        startOffset,
        endOffset,
        occurrence: selection.occurrenceHint,
        prefix,
        suffix,
        question,
        answer,
      }).catch(() => {});
    }

    if (mode === "cloud" && selection.messageId) {
      // Persist to server so it survives chat switching/reload.
      fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: selection.messageId,
          selectedText: selection.text,
          startOffset,
          endOffset,
          occurrence: selection.occurrenceHint,
          prefix,
          suffix,
          question,
          answer,
        }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("save_failed");
          const saved = await res.json();
          if (!saved?.id) return;
          // Replace the optimistic local id with the real DB id.
          setAnnotationsMap((prev) => {
            const msgId = selection.messageId || "";
            const list = prev[msgId] || [];
            const next = list.map((a) => (a.id === newAnnotation.id ? { ...a, id: saved.id, createdAt: saved.createdAt || a.createdAt } : a));
            return { ...prev, [msgId]: next };
          });
        })
        .catch(() => {
          // keep optimistic annotation in UI even if save fails
        });
    }
  }

  const hasApiKey = !!settings.apiKey;
  const isWaiting = status === "submitted";
  const isStreaming = status === "streaming";
  const isBusy = isWaiting || isStreaming;

  const isDark = settings.theme === "dark" || (settings.theme === "system" && typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);

  function toggleTheme() {
    const nextTheme = isDark ? "light" : "dark";
    onSaveSettings({ ...settings, theme: nextTheme });
  }

  async function handleRetryMessage(messageId: string) {
    if (!settings.apiKey) return;
    const convoId = convoIdRef.current;
    if (!convoId) return;

    // Find the assistant message we want to retry, then trim to the previous user message.
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;

    let userIdx = -1;
    for (let i = idx; i >= 0; i--) {
      if (messages[i]?.role === "user") {
        userIdx = i;
        break;
      }
    }
    if (userIdx === -1) return;

    const trimmed = messages.slice(0, userIdx + 1);
    setMessages(trimmed);

    pendingAssistantSaveRef.current = mode === "local";
    lastSavedAssistantIdRef.current = null;

    reload({
      body: {
        conversationId: convoId,
        provider: settings.provider,
        model: settings.model,
        apiKey: settings.apiKey,
        persist: mode === "cloud",
      },
    });
  }

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      <header className="h-12 flex items-center gap-3 px-4 border-b border-border flex-shrink-0">
        {sidebarCollapsed ? (
          <button onClick={onToggleSidebar} className="p-1 rounded-md hover:bg-muted transition-colors">
            <PanelLeftOpen size={18} />
          </button>
        ) : (
          <button onClick={onCollapseSidebar} className="p-1 rounded-md hover:bg-muted transition-colors">
            <PanelLeftClose size={18} />
          </button>
        )}
        <h1 className="font-semibold text-sm">QuotePin</h1>
        <div className="flex-1" />
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        {currentConvoId && (
          <button
            onClick={async () => {
              setShareOpen(true);
              if (mode === "cloud") {
                // Ensure we show the latest status/token in the dialog.
                try {
                  const res = await fetch(`/api/conversations/${currentConvoId}/share`, { method: "GET" });
                  if (res.ok) {
                    const data = await res.json();
                    setShareEnabled(!!data.shareEnabled);
                    setShareToken(data.shareToken || null);
                  }
                } catch {
                  // ignore
                }
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title={mode === "cloud" ? "Share this chat" : "Sign in to share chats"}
          >
            <Share2 size={13} />
            Share
          </button>
        )}
        {currentConvoId && (
          <a
            href={`/graph/${currentConvoId}`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <GitFork size={13} />
            Graph
          </a>
        )}
        <span className="text-xs text-muted-foreground">
          {settings.provider} / {settings.model}
        </span>
      </header>

      {shareOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShareOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-md mx-4 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold">Share chat</h2>
              <button onClick={() => setShareOpen(false)} className="p-1 rounded-md hover:bg-muted transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {mode !== "cloud" ? (
                <div className="text-sm text-muted-foreground">
                  Sharing is available for synced chats. <a className="text-annotation hover:underline" href="/auth">Sign in</a> to enable sharing.
                </div>
              ) : (
                <>
                  {!shareEnabled ? (
                    <button
                      disabled={shareBusy}
                      onClick={ensureShareEnabled}
                      className="w-full px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
                    >
                      {shareBusy ? "Please wait..." : "Create share link"}
                    </button>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <input
                          readOnly
                          value={shareUrl || ""}
                          className="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm"
                        />
                        <button
                          disabled={!shareUrl || shareBusy}
                          onClick={copyShareLink}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm border border-input hover:bg-muted transition-colors disabled:opacity-50"
                          title="Copy link"
                        >
                          {shareStatus === "copied" ? <Check size={14} /> : <Copy size={14} />}
                          {shareStatus === "copied" ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <div className="flex justify-between items-center">
                        <a
                          className="text-xs text-annotation hover:underline"
                          href={shareUrl || "#"}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open link
                        </a>
                        <button
                          disabled={shareBusy}
                          onClick={disableShare}
                          className="text-xs text-muted-foreground hover:underline disabled:opacity-50"
                          title="Disable sharing"
                        >
                          Disable link
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}

              {shareStatus === "error" && (
                <p className="text-xs text-destructive">Something went wrong creating the share link.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin relative">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-annotation/10 flex items-center justify-center mb-5">
              <Sparkles size={26} className="text-annotation" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Welcome to QuotePin</h2>
            <p className="text-sm text-muted-foreground max-w-md mb-1">
              Start a conversation. When the AI replies, <strong>select any text</strong> to open an inline popup and ask about it.
            </p>
            <p className="text-xs text-muted-foreground max-w-md">
              Your annotations are saved right on the message &mdash; no chat clutter.
            </p>
            {!hasApiKey && (
              <p className="text-xs text-destructive mt-4">
                Open Settings to add your API key before chatting.
              </p>
            )}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto pr-0 lg:pr-56">
            {messages.map((msg) => (
              <div
                key={msg.id}
                ref={(el) => {
                  messageElsRef.current[msg.id] = el;
                }}
              >
                <MessageBubble
                  role={msg.role as "user" | "assistant"}
                  content={msg.content}
                  annotations={annotationsMap[msg.id] || []}
                  onAnnotationClick={handleAnnotationClick}
                  onTextSelect={handleTextSelect}
                  onMobileAnnotate={(messageId, messageContent) => {
                    setSelection(null);
                    setAnnotationPopup(null);
                    setMobileSheet({ messageId, messageContent });
                  }}
                  onToggleBookmark={(messageId, role, content) => {
                    setBookmarks((prev) => {
                      const exists = prev.some((b) => b.messageId === messageId);
                      if (exists) return prev.filter((b) => b.messageId !== messageId);
                      const plain = markdownToPlainText(content);
                      const preview = plain.length > 48 ? plain.slice(0, 48).trim() + "…" : plain.trim();
                      return [
                        ...prev,
                        { messageId, role, preview, createdAt: new Date().toISOString() },
                      ];
                    });
                  }}
                  isBookmarked={bookmarks.some((b) => b.messageId === msg.id)}
                  messageId={msg.id}
                  onRetryMessage={handleRetryMessage}
                />
              </div>
            ))}
            {isWaiting && (
              <div className="flex items-center gap-3 px-4 py-4 animate-fade-in">
                <div className="w-7 h-7 rounded-lg bg-annotation/10 flex items-center justify-center flex-shrink-0">
                  <Loader2 size={15} className="animate-spin text-annotation" />
                </div>
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            )}
          </div>
        )}

        {currentConvoId && bookmarks.length > 0 && (
          <aside className="hidden lg:block fixed top-16 right-4 w-56 max-h-[calc(100vh-96px)] border border-border bg-background/80 backdrop-blur px-2 py-3 shadow-lg rounded-xl">
            <div className="flex items-center gap-2 px-1.5 pb-2 border-b border-border/60">
              <Bookmark size={14} className="text-annotation" />
              <span className="text-xs font-semibold">Bookmarks</span>
              <span className="ml-auto text-[10px] text-muted-foreground">{bookmarks.length}</span>
            </div>
            <div className="mt-2 space-y-1.5 overflow-y-auto max-h-[calc(100%-32px)] scrollbar-thin pr-1">
              {bookmarks
                .slice()
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                .map((b) => (
                  <div
                    key={b.messageId}
                    className="w-full text-left px-2 py-1.5 rounded-md border border-border/60 hover:bg-muted transition-colors"
                    title="Jump to message"
                  >
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => {
                          const el = messageElsRef.current[b.messageId];
                          if (el) {
                            el.scrollIntoView({ behavior: "smooth", block: "start" });
                            return;
                          }
                          // If the message isn't mounted yet (common right after switching chats),
                          // queue the scroll and try again after render.
                          setPendingScrollTo(b.messageId);
                        }}
                        className="flex-1 text-left"
                      >
                        <div className="text-[10px] text-muted-foreground">
                          {b.role === "user" ? "You" : "AI"}
                        </div>
                        <div className="text-xs leading-snug line-clamp-2">{b.preview || "(empty)"}</div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setBookmarks((prev) => prev.filter((x) => x.messageId !== b.messageId));
                        }}
                        className="p-1 rounded-md hover:bg-background/70 text-muted-foreground hover:text-foreground transition-colors"
                        title="Remove bookmark"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </aside>
        )}
      </div>

      {(error || chatError) && (
        <div className="px-4 py-2.5 bg-destructive/10 border-t border-destructive/20 flex items-center gap-2">
          <AlertCircle size={14} className="text-destructive flex-shrink-0" />
          <span className="text-xs text-destructive">{chatError || error?.message || "Something went wrong. Check your API key and try again."}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="border-t border-border h-16 px-4 flex items-center flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center gap-3 w-full">
          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={hasApiKey ? "Type a message..." : "Set API key in settings first"}
            disabled={isBusy || !hasApiKey}
            rows={1}
            className="flex-1 resize-none px-4 py-2 bg-muted border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 max-h-32"
            style={{ minHeight: "40px" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 128) + "px";
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isBusy || !hasApiKey}
            className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-30 hover:opacity-90 transition-opacity flex-shrink-0"
          >
            {isBusy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </form>

      {selection && (
        <SelectionPopup
          selectedText={selection.text}
          position={{ x: selection.rect.left, y: selection.rect.bottom }}
          onAsk={handlePopupAsk}
          onClose={() => setSelection(null)}
          onSaveAnnotation={handleSaveAnnotation}
          onReplyInChat={handleReplyInChat}
        />
      )}

      {mobileSheet && (
        <MobileAnnotateSheet
          open={!!mobileSheet}
          messageId={mobileSheet.messageId}
          messageContent={mobileSheet.messageContent}
          onClose={() => setMobileSheet(null)}
          onAsk={async (payload) => {
            if (!settings.apiKey) return null;
            return requestPopupAnswer({
              messageId: mobileSheet.messageId,
              messageContent: mobileSheet.messageContent,
              selectedText: payload.selectedText,
              startOffset: payload.startOffset,
              endOffset: payload.endOffset,
              occurrence: payload.occurrence,
              prefix: payload.prefix,
              suffix: payload.suffix,
              question: payload.question,
            });
          }}
          onSaveAnnotation={(payload) => {
            const msgId = payload.messageId;
            const newAnnotation: LocalAnnotation = {
              id: `ann-${Date.now()}`,
              messageId: msgId,
              selectedText: payload.selectedText,
              startOffset: payload.startOffset,
              endOffset: payload.endOffset,
              occurrence: payload.occurrence,
              prefix: payload.prefix,
              suffix: payload.suffix,
              question: payload.question,
              answer: payload.answer,
              createdAt: new Date().toISOString(),
            };

            setAnnotationsMap((prev) => ({
              ...prev,
              [msgId]: [...(prev[msgId] || []), newAnnotation],
            }));

            if (mode === "local") {
              localAddAnnotation({
                messageId: msgId,
                selectedText: payload.selectedText,
                startOffset: payload.startOffset,
                endOffset: payload.endOffset,
                occurrence: payload.occurrence,
                prefix: payload.prefix,
                suffix: payload.suffix,
                question: payload.question,
                answer: payload.answer,
              }).catch(() => {});
            }

            if (mode === "cloud") {
              fetch("/api/annotations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  messageId: msgId,
                  selectedText: payload.selectedText,
                  startOffset: payload.startOffset,
                  endOffset: payload.endOffset,
                  occurrence: payload.occurrence,
                  prefix: payload.prefix,
                  suffix: payload.suffix,
                  question: payload.question,
                  answer: payload.answer,
                }),
              })
                .then(async (res) => {
                  if (!res.ok) throw new Error("save_failed");
                  const saved = await res.json();
                  if (!saved?.id) return;
                  setAnnotationsMap((prev) => {
                    const list = prev[msgId] || [];
                    const next = list.map((a) =>
                      a.id === newAnnotation.id
                        ? { ...a, id: saved.id, createdAt: saved.createdAt || a.createdAt }
                        : a
                    );
                    return { ...prev, [msgId]: next };
                  });
                })
                .catch(() => {});
            }
          }}
          onReplyInChat={handleReplyInChat}
        />
      )}

      {annotationPopup && (
        <SelectionPopup
          selectedText={annotationPopup.annotation.selectedText}
          position={annotationPopup.position}
          existingQuestion={annotationPopup.annotation.question}
          existingAnswer={annotationPopup.annotation.answer}
          onAsk={async () => null}
          onClose={() => setAnnotationPopup(null)}
          onSaveAnnotation={() => { }}
        />
      )}
    </div>
  );
}
