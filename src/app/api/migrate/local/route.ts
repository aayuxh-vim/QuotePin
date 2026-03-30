import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/supabase/server";

type ImportPayload = {
  version?: number;
  conversations?: Array<{
    title?: string;
    provider?: string;
    model?: string;
    createdAt?: string;
    updatedAt?: string;
    messages?: Array<{
      role: string;
      content: string;
      createdAt?: string;
      annotations?: Array<{
        selectedText: string;
        startOffset: number;
        endOffset: number;
        occurrence?: number;
        prefix?: string;
        suffix?: string;
        question: string;
        answer: string;
        createdAt?: string;
      }>;
    }>;
  }>;
};

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: ImportPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const conversations = payload.conversations || [];
  if (!Array.isArray(conversations) || conversations.length === 0) {
    return NextResponse.json({ error: "No conversations to import" }, { status: 400 });
  }

  let importedConversations = 0;
  let importedMessages = 0;
  let importedAnnotations = 0;

  for (const c of conversations) {
    const convo = await prisma.conversation.create({
      data: {
        ownerId: userId,
        title: c.title || "Imported Chat",
        provider: c.provider || "openai",
        model: c.model || "gpt-4o-mini",
        createdAt: c.createdAt ? new Date(c.createdAt) : undefined,
        updatedAt: c.updatedAt ? new Date(c.updatedAt) : undefined,
      },
    });
    importedConversations += 1;

    for (const m of c.messages || []) {
      const msg = await prisma.message.create({
        data: {
          conversationId: convo.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt ? new Date(m.createdAt) : undefined,
        },
      });
      importedMessages += 1;

      for (const a of m.annotations || []) {
        await prisma.annotation.create({
          data: {
            messageId: msg.id,
            selectedText: a.selectedText,
            startOffset: a.startOffset,
            endOffset: a.endOffset,
            occurrence: typeof a.occurrence === "number" ? a.occurrence : 0,
            prefix: typeof a.prefix === "string" ? a.prefix : "",
            suffix: typeof a.suffix === "string" ? a.suffix : "",
            question: a.question,
            answer: a.answer,
            createdAt: a.createdAt ? new Date(a.createdAt) : undefined,
          },
        });
        importedAnnotations += 1;
      }
    }
  }

  return NextResponse.json({
    importedConversations,
    importedMessages,
    importedAnnotations,
  });
}

