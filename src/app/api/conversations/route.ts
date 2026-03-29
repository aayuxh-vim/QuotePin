import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const conversations = await prisma.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        provider: true,
        model: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json(conversations);
  } catch (err) {
    console.error("Failed to fetch conversations:", err);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { provider, model } = await req.json();
    const conversation = await prisma.conversation.create({
      data: { provider: provider || "openai", model: model || "gpt-4o-mini" },
    });
    return NextResponse.json(conversation);
  } catch (err) {
    console.error("Failed to create conversation:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
