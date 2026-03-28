import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { content } = await req.json();

  if (!content) return NextResponse.json({ error: "Content required" }, { status: 400 });

  const comment = await prisma.comment.create({
    data: {
      content,
      taskId: id,
      userId: (session.user as any).id,
    },
    include: {
      user: true,
    },
  });

  return NextResponse.json(comment);
}
