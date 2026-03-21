import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/logger";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      type: true,
      creator: true,
      assignees: { include: { user: true } },
      directions: { include: { direction: true } },
      comments: { 
        include: { user: true },
        orderBy: { createdAt: "asc" }
      },
      workReports: {
        select: {
          volume: true,
          unitMatched: true
        }
      }
    },
  });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const volumesByUnit: Record<string, number> = {};
  task.workReports.forEach((report: any) => {
    const unit = report.unitMatched || "UNKNOWN";
    volumesByUnit[unit] = (volumesByUnit[unit] || 0) + report.volume;
  });

  const taskWithSpent = {
    ...task,
    spent: Object.entries(volumesByUnit).map(([unit, vol]) => ({
      volume: vol,
      unit
    }))
  };

  return NextResponse.json(taskWithSpent);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const user = session.user as any;
  const userId = user.id;
  const role = user.role;

  const currentTask = await prisma.task.findUnique({
    where: { id },
    include: { creator: true, assignees: true }
  });

  if (!currentTask) return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });

  // Permissions check
  const isCreator = currentTask.creatorId === userId;
  const isAdmin = role === "ADMIN";
  const isUCH = role === "UCH";
  const isExecutor = role === "EXECUTOR";
  const isAssigned = currentTask.assignees.some((a: any) => a.userId === userId);

  // UCH can edit if they created it OR if it was created by another UCH
  const canUCHEdit = isUCH && (isCreator || currentTask.creator.role === "UCH");
  
  if (!isAdmin && !isCreator && !canUCHEdit && !isAssigned) {
    return NextResponse.json({ error: "У вас нет прав на редактирование этой задачи" }, { status: 403 });
  }

  const { title, description, status, deadline, typeId, assignees, directions } = await req.json();

  // Executor specific restrictions
  if (isExecutor && !isAdmin && !isCreator) {
    // Assigned executor can only change description and status
    if (title !== undefined || deadline !== undefined || typeId !== undefined || assignees !== undefined || directions !== undefined) {
      return NextResponse.json({ error: "Исполнитель может менять только описание и статус задачи" }, { status: 403 });
    }
  }

  if (isExecutor && !isAdmin) {
    if (status === "REJECTED" || status === "COMPLETED") {
      return NextResponse.json({ error: "Исполнитель не может перевести задачу в статус 'Отклонена' или 'Завершена'" }, { status: 403 });
    }
  }

  const updateData: any = {
    title,
    description,
    status,
    deadline: deadline ? new Date(deadline) : undefined,
    typeId,
  };

  if (assignees && (isAdmin || isCreator || canUCHEdit)) {
    updateData.assignees = {
        deleteMany: {},
        create: assignees.map((userId: string) => ({ userId }))
    };
  }

  if (directions && (isAdmin || isCreator || canUCHEdit)) {
    updateData.directions = {
        deleteMany: {},
        create: directions.map((directionId: string) => ({ directionId }))
    };
  }

  try {
    const task = await prisma.task.update({
        where: { id },
        data: updateData,
    });

    const [oldType, oldAssignees, oldDirs] = await Promise.all([
      prisma.taskType.findUnique({ where: { id: currentTask.typeId }, select: { name: true } }),
      prisma.user.findMany({ where: { id: { in: currentTask.assignees.map(a => a.userId) } }, select: { fullName: true } }),
      prisma.taskDirection.findMany({ 
        where: { tasks: { some: { taskId: id } } }, 
        select: { name: true } 
      })
    ]);

    const [newType, newAssignees, newDirs] = await Promise.all([
      prisma.taskType.findUnique({ where: { id: task.typeId }, select: { name: true } }),
      prisma.user.findMany({ 
        where: { id: { in: assignees ?? currentTask.assignees.map(a => a.userId) } }, 
        select: { fullName: true } 
      }),
      prisma.taskDirection.findMany({ 
        where: { tasks: { some: { taskId: id } } }, 
        select: { name: true } 
      })
    ]);

    await logAction({
      userId: (session.user as any).id,
      action: "UPDATE",
      entity: "Task",
      entityId: id,
      details: { 
        before: { 
          title: currentTask.title, 
          description: currentTask.description, 
          status: currentTask.status, 
          deadline: currentTask.deadline,
          taskType: oldType?.name,
          assignees: oldAssignees.map(u => u.fullName),
          directions: oldDirs.map(d => d.name)
        }, 
        after: { 
          title: task.title, 
          description: task.description, 
          status: task.status, 
          deadline: task.deadline,
          taskType: newType?.name,
          assignees: newAssignees.map(u => u.fullName),
          directions: newDirs.map(d => d.name)
        } 
      }
    });

    return NextResponse.json(task);
  } catch (error: any) {
    console.error("Failed to update task", error);
    return NextResponse.json({ error: "Ошибка при обновлении задачи" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const user = session.user as any;

  const currentTask = await prisma.task.findUnique({
    where: { id },
    include: { creator: true, _count: { select: { workReports: true } } }
  });

  if (!currentTask) return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });

  const isAdmin = user.role === "ADMIN";
  const isCreator = currentTask.creatorId === user.id;
  const canUCHDelete = user.role === "UCH" && (isCreator || currentTask.creator.role === "UCH");

  if (!isAdmin && !isCreator && !canUCHDelete) {
    return NextResponse.json({ error: "У вас нет прав на удаление этой задачи" }, { status: 403 });
  }

  if (currentTask._count.workReports > 0) {
    return NextResponse.json({ error: "Нельзя удалить задачу, по которой уже есть отчеты о работе" }, { status: 400 });
  }

  try {
    await prisma.task.delete({ where: { id } });

    const [oldType, oldAssignees, oldDirs] = await Promise.all([
      prisma.taskType.findUnique({ where: { id: currentTask.typeId }, select: { name: true } }),
      prisma.user.findMany({ where: { id: { in: currentTask.assignees.map(a => a.userId) } }, select: { fullName: true } }),
      prisma.taskDirection.findMany({ 
        where: { tasks: { some: { taskId: id } } }, 
        select: { name: true } 
      })
    ]);

    await logAction({
      userId: user.id,
      action: "DELETE",
      entity: "Task",
      entityId: id,
      details: { 
        before: { 
          title: currentTask.title, 
          description: currentTask.description, 
          status: currentTask.status, 
          deadline: currentTask.deadline,
          taskType: oldType?.name,
          assignees: oldAssignees.map(u => u.fullName),
          directions: oldDirs.map(d => d.name)
        }, 
        after: null 
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Ошибка при удалении задачи" }, { status: 500 });
  }
}
