import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/logger";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = (session.user as any).role;
  const userId = (session.user as any).id;

  try {
    const report = await prisma.userWorkReport.findUnique({ where: { id } });
    if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Permissions: Admin can edit anything, UCH can edit their own
    if (role === "EXECUTOR") {
      return NextResponse.json({ error: "Исполнители не могут изменять отчеты" }, { status: 403 });
    }
    if (role === "UCH" && report.creatorId !== userId) {
      return NextResponse.json({ error: "Вы можете изменять только свои записи" }, { status: 403 });
    }

    const { executorId, taskId, volume, comment, recordDate } = await req.json();
    
    // Use manual date or existing report date
    const finalDate = recordDate ? new Date(recordDate) : new Date(report.recordDate);
    finalDate.setHours(0, 0, 0, 0);

    const task = await prisma.task.findUnique({
      where: { id: taskId || report.taskId },
      include: { type: true },
    });

    const rate = await prisma.salaryRate.findFirst({
      where: {
        executorId: executorId || report.executorId,
        typeId: task?.typeId,
        startDate: { lte: finalDate },
        OR: [{ endDate: { gte: finalDate } }, { endDate: null }],
      },
    });

    let amountCalculated = null;
    let unitMatched = null;
    let finalVolume = typeof volume === "string" ? parseFloat(volume.replace(",", ".")) : (volume ?? report.volume);

    if (rate) {
      unitMatched = rate.unit;
      if (rate.unit === "FIX") {
        amountCalculated = rate.rate;
        finalVolume = 1;
      } else {
        amountCalculated = rate.rate * finalVolume;
      }
    }

    const updated = await prisma.userWorkReport.update({
      where: { id },
      data: {
        executorId: executorId || undefined,
        taskId: taskId || undefined,
        volume: finalVolume,
        comment: comment !== undefined ? comment.substring(0, 300) : undefined,
        recordDate: recordDate ? finalDate : undefined,
        amountCalculated,
        unitMatched,
      },
    });

    const [oldExec, oldTask] = await Promise.all([
      prisma.user.findUnique({ where: { id: report.executorId }, select: { fullName: true } }),
      prisma.task.findUnique({ where: { id: report.taskId }, select: { title: true } })
    ]);
    const [newExec, newTask] = await Promise.all([
      prisma.user.findUnique({ where: { id: updated.executorId }, select: { fullName: true } }),
      prisma.task.findUnique({ where: { id: updated.taskId }, select: { title: true } })
    ]);

    await logAction({
      userId: userId,
      action: "UPDATE",
      entity: "WorkReport",
      entityId: id,
      details: {
        before: {
          executor: oldExec?.fullName,
          task: oldTask?.title,
          volume: report.volume,
          recordDate: report.recordDate,
          amountCalculated: report.amountCalculated,
          unitMatched: report.unitMatched
        },
        after: {
          executor: newExec?.fullName,
          task: newTask?.title,
          volume: updated.volume,
          recordDate: updated.recordDate,
          amountCalculated: updated.amountCalculated,
          unitMatched: updated.unitMatched
        }
      }
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = (session.user as any).role;
  const userId = (session.user as any).id;

  try {
    const report = await prisma.userWorkReport.findUnique({ 
      where: { id },
      include: { 
        executor: { select: { fullName: true } },
        task: { select: { title: true } }
      }
    });
    if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (role === "EXECUTOR") {
      return NextResponse.json({ error: "Исполнители не могут удалять отчеты" }, { status: 403 });
    }
    if (role === "UCH" && report.creatorId !== userId) {
      return NextResponse.json({ error: "Вы можете удалять только свои записи" }, { status: 403 });
    }

    await prisma.userWorkReport.delete({ where: { id } });

    await logAction({
      userId: userId,
      action: "DELETE",
      entity: "WorkReport",
      entityId: id,
      details: {
        before: {
          executor: report.executor.fullName,
          task: report.task.title,
          volume: report.volume,
          recordDate: report.recordDate,
          amountCalculated: report.amountCalculated,
          unitMatched: report.unitMatched
        },
        after: null
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
