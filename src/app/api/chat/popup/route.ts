import { streamText } from "ai";
import { getModel, type Provider } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { requireUserId } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!userId) return new Response("Unauthorized. Please sign in.", { status: 401 });

    const {
      messageId,
      selectedText,
      question,
      startOffset,
      endOffset,
      occurrence,
      prefix,
      suffix,
      originalContent,
      provider,
      model,
      apiKey,
    } = await req.json();

    if (!apiKey) {
      return new Response("API key is required", { status: 400 });
    }

    let modelInstance;
    try {
      modelInstance = getModel({
        provider: provider as Provider,
        model,
        apiKey,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid provider configuration";
      return new Response(msg, { status: 400 });
    }

    const systemPrompt = `The user is reading an AI response and selected the text "${selectedText}" to ask about. Here is the full message they were reading for context:\n\n---\n${originalContent}\n---\n\nAnswer their question about the selected text concisely and clearly. Keep responses brief but informative.`;

    const result = streamText({
      model: modelInstance,
      maxRetries: 0,
      system: systemPrompt,
      messages: [{ role: "user", content: question }],
      async onFinish({ text }) {
        try {
          if (messageId) {
            // Verify the message belongs to a conversation owned by this user.
            const msg = await prisma.message.findUnique({
              where: { id: messageId },
              select: { conversation: { select: { ownerId: true } } },
            });
            if (!msg || msg.conversation.ownerId !== userId) return;

            await prisma.annotation.create({
              data: {
                messageId,
                selectedText,
                startOffset,
                endOffset,
                occurrence: typeof occurrence === "number" ? occurrence : 0,
                prefix: typeof prefix === "string" ? prefix : "",
                suffix: typeof suffix === "string" ? suffix : "",
                question,
                answer: text,
              },
            });
          }
        } catch (err) {
          console.error("Error saving annotation:", err);
        }
      },
    });

    return result.toDataStreamResponse({
      getErrorMessage: (error) => {
        if (error instanceof Error) {
          return error.message;
        }
        return String(error);
      },
    });
  } catch (err) {
    console.error("Popup API error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(message, { status: 500 });
  }
}
