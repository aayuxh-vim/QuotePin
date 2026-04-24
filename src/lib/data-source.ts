import type { Conversation, Message } from "@/lib/types";
import {
  localCreateConversation,
  localDeleteConversation,
  localGetConversation,
  localListConversations,
  localExportAll,
} from "@/lib/local-db";

export type DataSourceMode = "local" | "cloud";

export interface DataSource {
  mode: DataSourceMode;
  listConversations(): Promise<Conversation[]>;
  getConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] } | null>;
  newConversation(args: { provider: string; model: string }): Promise<Conversation>;
  deleteConversation(id: string): Promise<void>;
  exportAll(): Promise<any>;
}

export function getLocalDataSource(): DataSource {
  return {
    mode: "local",
    listConversations: localListConversations,
    getConversation: localGetConversation,
    newConversation: async ({ provider, model }) =>
      localCreateConversation({ provider, model }),
    deleteConversation: localDeleteConversation,
    exportAll: localExportAll,
  };
}

export function getCloudDataSource(): DataSource {
  return {
    mode: "cloud",
    listConversations: async () => {
      const res = await fetch("/api/conversations");
      if (!res.ok) return [];
      return await res.json();
    },
    getConversation: async (id: string) => {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) return null;
      const data = await res.json();
      return { conversation: data, messages: data.messages || [] };
    },
    newConversation: async ({ provider, model }) => {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model }),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      return await res.json();
    },
    deleteConversation: async (id: string) => {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    },
    exportAll: async () => {
      const res = await fetch("/api/export");
      if (!res.ok) throw new Error("Export failed");
      return await res.json();
    },
  };
}

