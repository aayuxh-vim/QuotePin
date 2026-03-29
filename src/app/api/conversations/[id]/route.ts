import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          include: { annotations: true },
        },
      },
    });
    if (!conversation) {
      return new Response("Not found", { status: 404 });
    }
    return NextResponse.json(conversation);
  } catch (err) {
    console.error("Failed to fetch conversation:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.conversation.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("Failed to delete conversation:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
