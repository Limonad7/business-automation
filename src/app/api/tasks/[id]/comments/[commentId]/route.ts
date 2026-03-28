import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/logger";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: taskId, commentId } = await params;

  try {
    const oldComment = await prisma.comment.findUnique({ where: { id: commentId } });
    await prisma.comment.delete({
      where: { id: commentId },
    });

    const task = await prisma.task.findUnique({ 
      where: { id: taskId },
      select: { title: true }
    });

    await logAction({
      userId: (session.user as any).id,
      action: "DELETE",
      entity: "Comment",
      entityId: commentId,
      details: { 
        before: { 
          task: task?.title, 
          content: oldComment?.content 
        }, 
        after: null 
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Ошибка при удалении комментария" }, { status: 500 });
  }
}
