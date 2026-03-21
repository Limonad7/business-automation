import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/logger";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { executorId, typeId, rate, startDate, endDate, unit, comment } = await req.json();

    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;

    // Overlap check (excluding current ID)
    const overlapping = await prisma.salaryRate.findFirst({
      where: {
        id: { not: id },
        executorId,
        typeId,
        AND: [
          {
            OR: [
              { endDate: null },
              { endDate: { gte: start } }
            ]
          },
          {
            OR: [
              { startDate: { lte: end || new Date("9999-12-31") } }
            ]
          }
        ]
      },
    });

    if (overlapping) {
      return NextResponse.json({ error: "Период действия ставки пересекается с существующим" }, { status: 400 });
    }

    const oldRate = await prisma.salaryRate.findUnique({ where: { id } });
    const updatedRate = await prisma.salaryRate.update({
      where: { id },
      data: {
        executorId,
        typeId,
        rate: parseFloat(rate),
        startDate: start,
        endDate: end,
        unit,
        comment: comment?.substring(0, 500),
      },
    });

    const [oldExecutor, oldType] = await Promise.all([
      prisma.user.findUnique({ where: { id: oldRate?.executorId || "" }, select: { fullName: true } }),
      prisma.taskType.findUnique({ where: { id: oldRate?.typeId || "" }, select: { name: true } })
    ]);
    const [newExecutor, newType] = await Promise.all([
      prisma.user.findUnique({ where: { id: updatedRate.executorId }, select: { fullName: true } }),
      prisma.taskType.findUnique({ where: { id: updatedRate.typeId }, select: { name: true } })
    ]);

    await logAction({
      userId: (session.user as any).id,
      action: "UPDATE",
      entity: "SalaryRate",
      entityId: id,
      details: { 
        before: { 
          executor: oldExecutor?.fullName, 
          taskType: oldType?.name, 
          rate: oldRate?.rate, 
          startDate: oldRate?.startDate, 
          endDate: oldRate?.endDate, 
          unit: oldRate?.unit 
        }, 
        after: { 
          executor: newExecutor?.fullName, 
          taskType: newType?.name, 
          rate: updatedRate.rate, 
          startDate: updatedRate.startDate, 
          endDate: updatedRate.endDate, 
          unit: updatedRate.unit 
        } 
      }
    });

    return NextResponse.json(updatedRate);
  } catch (error: any) {
    console.error("Rates PATCH error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const rate = await prisma.salaryRate.findUnique({ 
    where: { id },
    include: { executor: { select: { fullName: true } }, type: { select: { name: true } } }
  });
  if (!rate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const reportCount = await prisma.userWorkReport.count({
    where: {
      executorId: rate.executorId,
      recordDate: {
        gte: rate.startDate,
        ...(rate.endDate ? { lte: rate.endDate } : {})
      },
      task: {
        typeId: rate.typeId
      }
    }
  });

  if (reportCount > 0) {
    return NextResponse.json({ error: `Нельзя удалить ставку, так как она использована в ${reportCount} отчетах о работе.` }, { status: 400 });
  }

  await prisma.salaryRate.delete({ where: { id } });

  await logAction({
    userId: (session.user as any).id,
    action: "DELETE",
    entity: "SalaryRate",
    entityId: id,
    details: { 
      before: { 
        executor: rate.executor.fullName, 
        taskType: rate.type.name, 
        rate: rate.rate, 
        startDate: rate.startDate, 
        endDate: rate.endDate, 
        unit: rate.unit 
      }, 
      after: null 
    }
  });

  return NextResponse.json({ success: true });
}
