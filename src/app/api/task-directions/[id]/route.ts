import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/logger";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Check for dependencies (TaskDirectionMapping)
  const taskCount = await prisma.taskDirectionMapping.count({ where: { directionId: id } });
  if (taskCount > 0) {
    return NextResponse.json(
      { error: `Нельзя удалить направление, так как оно используется в задачах (найдено: ${taskCount}).` },
      { status: 400 }
    );
  }

  try {
    const oldDir = await prisma.taskDirection.findUnique({ where: { id } });
    await prisma.taskDirection.delete({
      where: { id },
    });

    await logAction({
      userId: (session.user as any).id,
      action: "DELETE",
      entity: "TaskDirection",
      entityId: id,
      details: { before: { name: oldDir?.name }, after: null }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Ошибка при удалении направления" }, { status: 500 });
  }
}
