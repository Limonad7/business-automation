import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/logger";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  const userId = (session.user as any).id;
  const { searchParams } = new URL(req.url);

  const executorId = searchParams.get("executorId");
  const taskId = searchParams.get("taskId");
  const creatorId = searchParams.get("creatorId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const sortBy = searchParams.get("sortBy") || "recordDate";
  const sortOrder = searchParams.get("sortOrder") || "desc";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const where: any = {};
  if (role === "EXECUTOR") {
    where.executorId = userId;
  } else {
    if (executorId) where.executorId = executorId;
  }
  
  if (taskId) where.taskId = taskId;
  if (creatorId) where.creatorId = creatorId;
  if (startDate || endDate) {
    where.recordDate = {
      ...(startDate ? { gte: new Date(startDate) } : {}),
      ...(endDate ? { lte: new Date(endDate) } : {}),
    };
  }

  let orderBy: any = {};
  if (sortBy === "executor") orderBy = { executor: { fullName: sortOrder } };
  else if (sortBy === "task") orderBy = { task: { title: sortOrder } };
  else if (sortBy === "creator") orderBy = { creator: { fullName: sortOrder } };
  else orderBy = { [sortBy]: sortOrder };

  const [total, reports] = await Promise.all([
    prisma.userWorkReport.count({ where }),
    prisma.userWorkReport.findMany({
      where,
      include: { 
        executor: true, 
        task: { include: { type: true } }, 
        creator: true 
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    })
  ]);

  return NextResponse.json({
    reports,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { executorId, taskId, volume, comment, recordDate } = await req.json();
    const creatorId = (session.user as any).id;
    const role = (session.user as any).role;
    const today = recordDate ? new Date(recordDate) : new Date();
    today.setHours(0, 0, 0, 0);

    // Permission check for executor
    if (role === "EXECUTOR" && executorId !== (session.user as any).id) {
      return NextResponse.json({ error: "Вы можете добавлять записи только для себя" }, { status: 403 });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { type: true, assignees: true },
    });

    if (!task) return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });

    // Check if executor is assigned to task (for executors)
    if (role === "EXECUTOR") {
      const isAssigned = task.assignees.some((a: { userId: string }) => a.userId === (session.user as any).id);
      if (!isAssigned) return NextResponse.json({ error: "Вы не назначены на эту задачу" }, { status: 403 });
    }

    // Matching rate
    const rate = await prisma.salaryRate.findFirst({
      where: {
        executorId,
        typeId: task.typeId,
        startDate: { lte: today },
        OR: [{ endDate: { gte: today } }, { endDate: null }],
      },
    });

    let amountCalculated = null;
    let unitMatched = null;
    let finalVolume = typeof volume === "string" ? parseFloat(volume.replace(",", ".")) : volume;

    if (rate) {
      unitMatched = rate.unit;
      if (rate.unit === "FIX") {
        amountCalculated = rate.rate;
        finalVolume = 1; // Always 1 for FIX
      } else {
        amountCalculated = rate.rate * finalVolume;
      }
    }

    const report = await prisma.userWorkReport.create({
      data: {
        executorId,
        taskId,
        volume: finalVolume,
        comment: comment?.substring(0, 300),
        creatorId,
        amountCalculated,
        unitMatched,
        recordDate: today, // Manual or current date
      },
    });

    const [executor, taskObj] = await Promise.all([
      prisma.user.findUnique({ where: { id: report.executorId }, select: { fullName: true } }),
      prisma.task.findUnique({ where: { id: report.taskId }, select: { title: true } })
    ]);

    await logAction({
      userId: creatorId,
      action: "CREATE",
      entity: "WorkReport",
      entityId: report.id,
      details: {
        before: null,
        after: {
          executor: executor?.fullName,
          task: taskObj?.title,
          volume: report.volume,
          recordDate: report.recordDate,
          amountCalculated: report.amountCalculated,
          unitMatched: report.unitMatched
        }
      }
    });

  return NextResponse.json(report);
  } catch (error: any) {
    console.error("Work Report POST error:", error);
    return NextResponse.json({ error: error.message || "Ошибка при сохранении" }, { status: 500 });
  }
}
