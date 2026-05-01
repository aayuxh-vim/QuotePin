import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!userId) return new Response("Unauthorized. Please sign in.", { status: 401 });

    const {
      messageId,
      selectedText,
      startOffset,
      endOffset,
      occurrence,
      prefix,
      suffix,
      question,
      answer,
    } = await req.json();

    if (!messageId || !selectedText || !question || !answer) {
      return new Response("Missing required fields", { status: 400 });
    }

    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      select: { conversation: { select: { ownerId: true } } },
    });
    if (!msg || msg.conversation.ownerId !== userId) {
      return new Response("Not found", { status: 404 });
    }

    const created = await prisma.annotation.create({
      data: {
        messageId,
        selectedText,
        startOffset: typeof startOffset === "number" ? startOffset : 0,
        endOffset: typeof endOffset === "number" ? endOffset : 0,
        occurrence: typeof occurrence === "number" ? occurrence : 0,
        prefix: typeof prefix === "string" ? prefix : "",
        suffix: typeof suffix === "string" ? suffix : "",
        question,
        answer,
      },
    });

    return Response.json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(message, { status: 500 });
  }
}

