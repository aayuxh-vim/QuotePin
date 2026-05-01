import { openDB, type DBSchema } from "idb";
import type { Conversation, Message, Annotation } from "@/lib/types";

type LocalConversation = Omit<Conversation, "messages"> & {
  // local-only metadata
  storage: "local";
};

type LocalMessage = Message;
type LocalAnnotation = Annotation;

interface QuotePinLocalDB extends DBSchema {
  conversations: {
    key: string;
    value: LocalConversation;
    indexes: { "by-updatedAt": string };
  };
  messages: {
    key: string;
    value: LocalMessage;
    indexes: { "by-conversationId": string; "by-createdAt": string };
  };
  annotations: {
    key: string;
    value: LocalAnnotation;
    indexes: { "by-messageId": string; "by-createdAt": string };
  };
}

const DB_NAME = "quotepin-local";
const DB_VERSION = 1;

export function isLocalId(id: string) {
  return id.startsWith("local_");
}

function uid(prefix: string) {
  // lightweight unique id, stable enough for local usage
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function db() {
  return openDB<QuotePinLocalDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      const convos = database.createObjectStore("conversations", { keyPath: "id" });
      convos.createIndex("by-updatedAt", "updatedAt");

      const msgs = database.createObjectStore("messages", { keyPath: "id" });
      msgs.createIndex("by-conversationId", "conversationId");
      msgs.createIndex("by-createdAt", "createdAt");

      const anns = database.createObjectStore("annotations", { keyPath: "id" });
      anns.createIndex("by-messageId", "messageId");
      anns.createIndex("by-createdAt", "createdAt");
    },
  });
}

export async function localListConversations(): Promise<Conversation[]> {
  const d = await db();
  const all = await d.getAll("conversations");
  all.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return all;
}

export async function localCreateConversation(args: {
  provider: string;
  model: string;
  title?: string;
  id?: string;
}): Promise<Conversation> {
  const d = await db();
  const now = new Date().toISOString();
  const convo: LocalConversation = {
    id: args.id || uid("local"),
    title: args.title || "New Chat",
    provider: args.provider,
    model: args.model,
    createdAt: now,
    updatedAt: now,
    storage: "local",
  };
  await d.put("conversations", convo);
  return convo;
}

export async function localDeleteConversation(id: string) {
  const d = await db();
  const tx = d.transaction(["conversations", "messages", "annotations"], "readwrite");
  await tx.objectStore("conversations").delete(id);

  const msgIdx = tx.objectStore("messages").index("by-conversationId");
  const msgKeys = await msgIdx.getAllKeys(id);
  for (const msgId of msgKeys) {
    const annIdx = tx.objectStore("annotations").index("by-messageId");
    const annKeys = await annIdx.getAllKeys(String(msgId));
    for (const annId of annKeys) await tx.objectStore("annotations").delete(String(annId));
    await tx.objectStore("messages").delete(String(msgId));
  }

  await tx.done;
}

export async function localGetConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] } | null> {
  const d = await db();
  const convo = await d.get("conversations", id);
  if (!convo) return null;

  const msgIdx = d.transaction("messages").store.index("by-conversationId");
  const messages = (await msgIdx.getAll(id)) as LocalMessage[];
  messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // Attach annotations to each message
  const annIdx = d.transaction("annotations").store.index("by-messageId");
  for (const m of messages) {
    const anns = (await annIdx.getAll(m.id)) as LocalAnnotation[];
    anns.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    (m as any).annotations = anns;
  }

  return { conversation: convo, messages };
}

export async function localAppendMessage(args: {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  id?: string;
  createdAt?: string;
}): Promise<Message> {
  const d = await db();
  const now = args.createdAt || new Date().toISOString();
  const msg: LocalMessage = {
    id: args.id || uid("msg"),
    conversationId: args.conversationId,
    role: args.role,
    content: args.content,
    createdAt: now,
    annotations: [],
  };
  await d.put("messages", msg);

  const convo = await d.get("conversations", args.conversationId);
  if (convo) {
    await d.put("conversations", { ...convo, updatedAt: now });
  }

  return msg;
}

export async function localAddAnnotation(args: {
  messageId: string;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  occurrence: number;
  prefix: string;
  suffix: string;
  question: string;
  answer: string;
}): Promise<Annotation> {
  const d = await db();
  const now = new Date().toISOString();
  const ann: LocalAnnotation = {
    id: uid("ann"),
    messageId: args.messageId,
    selectedText: args.selectedText,
    startOffset: args.startOffset,
    endOffset: args.endOffset,
    occurrence: args.occurrence,
    prefix: args.prefix,
    suffix: args.suffix,
    question: args.question,
    answer: args.answer,
    createdAt: now,
  };
  await d.put("annotations", ann);
  return ann;
}

export async function localExportAll() {
  const d = await db();
  const conversations = await d.getAll("conversations");

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    conversations: [] as any[],
  };

  for (const c of conversations) {
    const convoId = c.id;
    const msgIdx = d.transaction("messages").store.index("by-conversationId");
    const messages = (await msgIdx.getAll(convoId)) as LocalMessage[];
    messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const convoOut: any = {
      title: c.title,
      provider: c.provider,
      model: c.model,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messages: [],
    };

    const annIdx = d.transaction("annotations").store.index("by-messageId");
    for (const m of messages) {
      const anns = (await annIdx.getAll(m.id)) as LocalAnnotation[];
      anns.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      convoOut.messages.push({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
        annotations: anns.map((a) => ({
          selectedText: a.selectedText,
          startOffset: a.startOffset,
          endOffset: a.endOffset,
          occurrence: a.occurrence,
          prefix: a.prefix,
          suffix: a.suffix,
          question: a.question,
          answer: a.answer,
          createdAt: a.createdAt,
        })),
      });
    }

    payload.conversations.push(convoOut);
  }

  return payload;
}

