import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const conversation = await prisma.conversation.findUnique({
      where: { id, ownerId: userId },
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

export async function HEAD(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return new Response(null, { status: 401 });
  const { id } = await params;
  const convo = await prisma.conversation.findUnique({
    where: { id, ownerId: userId },
    select: { id: true },
  });
  if (!convo) return new Response(null, { status: 404 });
  return new Response(null, { status: 204 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await prisma.conversation.delete({ where: { id, ownerId: userId } });
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("Failed to delete conversation:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
