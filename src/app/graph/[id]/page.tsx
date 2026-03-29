"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, GitFork } from "lucide-react";
import ConversationGraph from "@/components/graph/ConversationGraph";
import type { Conversation, Message } from "@/lib/types";

export default function GraphPage() {
  const params = useParams();
  const id = params.id as string;
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/conversations/${id}`);
        if (!res.ok) throw new Error("Conversation not found");
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
  }, [id]);

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

  const hasAnnotations = messages.some((m) => m.annotations && m.annotations.length > 0);

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
        <GitFork size={14} className="text-annotation" />
        <h1 className="text-sm font-semibold truncate">{conversation.title}</h1>
        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground">
          {messages.length} messages
          {hasAnnotations && ` \u00b7 ${messages.reduce((sum, m) => sum + (m.annotations?.length || 0), 0)} annotations`}
        </span>
      </header>

      <div className="flex-1 relative">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-muted-foreground">No messages in this conversation yet.</p>
          </div>
        ) : (
          <ConversationGraph messages={messages} title={conversation.title} />
        )}

        {!hasAnnotations && messages.length > 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-card border border-border rounded-lg shadow-md">
            <p className="text-xs text-muted-foreground">
              Select text in AI responses and ask questions to create annotation branches.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
