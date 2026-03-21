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

  // Check for dependencies
  const taskCount = await prisma.task.count({ where: { typeId: id } });
  if (taskCount > 0) {
    return NextResponse.json(
      { error: `Нельзя удалить тип задачи, так как он используется в ${taskCount} задачах.` },
      { status: 400 }
    );
  }

  const rateCount = await prisma.salaryRate.count({ where: { typeId: id } });
  if (rateCount > 0) {
    return NextResponse.json(
      { error: `Нельзя удалить тип задачи, так как для него установлены ставки оплаты (найдено: ${rateCount}).` },
      { status: 400 }
    );
  }

  try {
    const oldType = await prisma.taskType.findUnique({ where: { id } });
    await prisma.taskType.delete({
      where: { id },
    });

    await logAction({
      userId: (session.user as any).id,
      action: "DELETE",
      entity: "TaskType",
      entityId: id,
      details: { before: { name: oldType?.name }, after: null }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Ошибка при удалении типа задачи" }, { status: 500 });
  }
}
