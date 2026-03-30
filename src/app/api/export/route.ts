import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/supabase/server";

export async function GET(_req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversations = await prisma.conversation.findMany({
    where: { ownerId: userId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { annotations: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    conversations,
  });
}

