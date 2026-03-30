"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, Sparkles, GitFork } from "lucide-react";
import type { Conversation, Message } from "@/lib/types";
import ConversationGraph from "@/components/graph/ConversationGraph";

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <a
          href={`/graph/${conversation.id}`}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Graph (requires access)"
        >
          <GitFork size={13} />
          Graph
        </a>
      </header>

      <div className="flex-1 relative">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-muted-foreground">No messages in this conversation.</p>
          </div>
        ) : (
          <ConversationGraph messages={messages} title={conversation.title} />
        )}
      </div>
    </div>
  );
}

