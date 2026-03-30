import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const conversation = await prisma.conversation.findFirst({
    where: { shareEnabled: true, shareToken: token },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { annotations: true },
      },
    },
  });

  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // View-only: do not expose ownerId / token
  const { ownerId: _ownerId, shareToken: _shareToken, shareEnabled: _shareEnabled, ...rest } = conversation as any;
  return NextResponse.json(rest);
}

