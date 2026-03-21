import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/logger";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role;
  const userId = (session.user as any).id;
  const { searchParams } = new URL(req.url);
  const executorId = searchParams.get("executorId");

  // Permission check: Executors can only see their own rates
  if (role === "EXECUTOR" && executorId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // UCH and ADMIN can see anything.

  const typeId = searchParams.get("typeId");
  const unit = searchParams.get("unit");
  const sortBy = searchParams.get("sortBy") || "startDate";
  const sortOrder = searchParams.get("sortOrder") || "desc";

  const where: any = {};
  if (executorId) where.executorId = executorId;
  if (typeId) where.typeId = typeId;
  if (unit) where.unit = unit;

  let orderBy: any = {};
  if (sortBy === "executor") {
    orderBy = { executor: { fullName: sortOrder } };
  } else if (sortBy === "type") {
    orderBy = { type: { name: sortOrder } };
  } else {
    orderBy = { [sortBy]: sortOrder };
  }

  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const [total, rates] = await Promise.all([
    prisma.salaryRate.count({ where }),
    prisma.salaryRate.findMany({
      where,
      include: { executor: true, type: true },
      orderBy,
      skip,
      take: limit,
    })
  ]);

  return NextResponse.json({
    rates,
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
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { executorId, typeId, rate, startDate, endDate, unit, comment } = await req.json();

    if (!executorId || !typeId || !rate || !startDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;

    // Robust overlap check
    const overlapping = await prisma.salaryRate.findFirst({
      where: {
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
      return NextResponse.json({ error: "Период действия ставки пересекается с существующим (Исполнитель + Тип задачи + Даты)" }, { status: 400 });
    }

    const newRate = await prisma.salaryRate.create({
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

    const [executor, type] = await Promise.all([
      prisma.user.findUnique({ where: { id: newRate.executorId }, select: { fullName: true } }),
      prisma.taskType.findUnique({ where: { id: newRate.typeId }, select: { name: true } })
    ]);

    await logAction({
      userId: (session.user as any).id,
      action: "CREATE",
      entity: "SalaryRate",
      entityId: newRate.id,
      details: {
        before: null,
        after: {
          executor: executor?.fullName,
          taskType: type?.name,
          rate: newRate.rate,
          startDate: newRate.startDate,
          endDate: newRate.endDate,
          unit: newRate.unit
        }
      }
    });

    return NextResponse.json(newRate);
  } catch (error: any) {
    console.error("Rates POST error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
