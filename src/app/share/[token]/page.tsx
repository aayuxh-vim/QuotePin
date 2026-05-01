"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, Sparkles, MessageSquare, GitFork } from "lucide-react";
import type { Conversation, Message } from "@/lib/types";
import ConversationGraph from "@/components/graph/ConversationGraph";
import MessageBubble from "@/components/chat/MessageBubble";

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"chat" | "graph">("chat");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/share/${token}`);
        if (!res.ok) throw new Error("Shared conversation not found");
        const data = await res.json();
        setConversation(data);
        setMessages(data.messages || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-sm text-muted-foreground">{error || "Not found"}</p>
        <a href="/" className="text-xs text-annotation hover:underline">Back to chat</a>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="h-12 flex items-center gap-3 px-4 border-b border-border flex-shrink-0">
        <a
          href="/"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Chat
        </a>
        <div className="w-px h-5 bg-border" />
        <Sparkles size={14} className="text-annotation" />
        <h1 className="text-sm font-semibold truncate">Shared: {conversation.title}</h1>
        <div className="flex-1" />
        <div className="flex items-center gap-1 rounded-md border border-border bg-card/40 p-1">
          <button
            onClick={() => setView("chat")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
              view === "chat" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
            title="Chat"
          >
            <MessageSquare size={13} />
            Chat
          </button>
          <button
            onClick={() => setView("graph")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
              view === "graph" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
            title="Graph"
          >
            <GitFork size={13} />
            Graph
          </button>
        </div>
      </header>

      <div className="flex-1 relative">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-muted-foreground">No messages in this conversation.</p>
          </div>
        ) : view === "graph" ? (
          <ConversationGraph messages={messages} title={conversation.title} />
        ) : (
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="max-w-4xl mx-auto">
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  role={m.role}
                  content={m.content}
                  annotations={m.annotations || []}
                  messageId={m.id}
                  onAnnotationClick={() => {}}
                  onTextSelect={() => {}}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

