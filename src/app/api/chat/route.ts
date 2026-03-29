import { streamText, APICallError } from "ai";
import { getModel, type Provider } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, conversationId, provider, model, apiKey } = body;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key is required. Open Settings to add one." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!provider || !model) {
      return new Response(JSON.stringify({ error: "Provider and model are required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let convoId = conversationId;

    if (!convoId) {
      const convo = await prisma.conversation.create({
        data: { provider, model },
      });
      convoId = convo.id;
    }

    const lastUserMsg = messages[messages.length - 1];
    if (lastUserMsg?.role === "user") {
      await prisma.message.create({
        data: {
          conversationId: convoId,
          role: "user",
          content: lastUserMsg.content,
        },
      });
    }

    const result = streamText({
      model: modelInstance,
      maxRetries: 0,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      async onFinish({ text }) {
        try {
          if (text) {
            await prisma.message.create({
              data: {
                conversationId: convoId,
                role: "assistant",
                content: text,
              },
            });
          }

          if (messages.length <= 2 && text) {
            const userContent = lastUserMsg?.content || "";
            const title = userContent.length > 50
              ? userContent.slice(0, 50).trim() + "..."
              : userContent.trim();
            if (title) {
              await prisma.conversation.update({
                where: { id: convoId },
                data: { title },
              });
            }
          }
        } catch (err) {
          console.error("Error in onFinish:", err);
        }
      },
    });

    const response = result.toDataStreamResponse({
      getErrorMessage: (error) => {
        if (error instanceof Error) {
          return error.message;
        }
        return String(error);
      },
    });
    response.headers.set("X-Conversation-Id", convoId);
    response.headers.set("Access-Control-Expose-Headers", "X-Conversation-Id");
    return response;
  } catch (err) {
    console.error("Chat API error:", err);
    let message = "Internal server error";
    if (err instanceof APICallError) {
      message = err.message;
    } else if (err instanceof Error) {
      message = err.message;
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
