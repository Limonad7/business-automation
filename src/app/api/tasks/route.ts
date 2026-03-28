import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/logger";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const skip = (page - 1) * limit;

  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const responsible = searchParams.get("responsible") || "";
  const typeId = searchParams.get("typeId") || "";
  const directionId = searchParams.get("directionId") || "";
  const createdFrom = searchParams.get("createdFrom") || "";
  const createdTo = searchParams.get("createdTo") || "";
  const deadlineFrom = searchParams.get("deadlineFrom") || "";
  const deadlineTo = searchParams.get("deadlineTo") || "";
  const sortBy = searchParams.get("sortBy") || "deadline";
  const sortOrder = searchParams.get("sortOrder") || "asc";

  const role = (session.user as any).role;
  const userId = (session.user as any).id;

  let where: any = {};

  // Default filter: exclude REJECTED and COMPLETED if no status specified
  if (status) {
    where.status = status;
  } else {
    where.status = { notIn: ["REJECTED", "COMPLETED"] };
  }

  if (responsible) {
    where.assignees = { some: { userId: responsible } };
  }

  if (typeId) {
    where.typeId = typeId;
  }

  if (directionId) {
    where.directions = { some: { directionId: directionId } };
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } }
    ];
  }

  if (createdFrom || createdTo) {
    where.createdAt = {};
    if (createdFrom) where.createdAt.gte = new Date(createdFrom);
    if (createdTo) {
      const toDate = new Date(createdTo);
      toDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = toDate;
    }
  }

  if (deadlineFrom || deadlineTo) {
    where.deadline = {};
    if (deadlineFrom) where.deadline.gte = new Date(deadlineFrom);
    if (deadlineTo) {
      const toDate = new Date(deadlineTo);
      toDate.setHours(23, 59, 59, 999);
      where.deadline.lte = toDate;
    }
  }

  // Role-based access
  if (role === "EXECUTOR") {
    // Executors see: tasks they created OR tasks where they are assigned
    const baseWhere = { ...where };
    where = {
      ...baseWhere,
      OR: [
        { creatorId: userId },
        { assignees: { some: { userId } } },
      ],
    };
  }

  const validSortFields = ["title", "deadline", "createdAt", "status"];
  const isCustomSort = ["responsible", "directions", "type"].includes(sortBy);
  const orderByField = validSortFields.includes(sortBy) ? sortBy : "deadline";

  const [total, rawTasks] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      include: {
        type: true,
        creator: true,
        assignees: { include: { user: true } },
        directions: { include: { direction: true } },
        workReports: {
          select: {
            volume: true,
            unitMatched: true
          }
        }
      },
      orderBy: isCustomSort ? undefined : { [orderByField]: sortOrder === "desc" ? "desc" : "asc" },
      skip,
      take: limit,
    })
  ]);

  // Calculate volume spent per task
  const tasks = rawTasks.map((task: any) => {
    const volumesByUnit: Record<string, number> = {};
    task.workReports.forEach((report: any) => {
      const unit = report.unitMatched || "UNKNOWN";
      volumesByUnit[unit] = (volumesByUnit[unit] || 0) + report.volume;
    });

    return {
      ...task,
      spent: Object.entries(volumesByUnit).map(([unit, vol]) => ({
        volume: vol,
        unit
      }))
    };
  });

  // Manual sorting for relations if needed
  if (isCustomSort) {
    tasks.sort((a: any, b: any) => {
      let valA = "";
      let valB = "";

      if (sortBy === "responsible") {
        valA = a.assignees[0]?.user.fullName || "";
        valB = b.assignees[0]?.user.fullName || "";
      } else if (sortBy === "directions") {
        valA = a.directions?.map((d: any) => d.direction.name).join(", ") || "";
        valB = b.directions?.map((d: any) => d.direction.name).join(", ") || "";
      } else if (sortBy === "type") {
        valA = a.type?.name || "";
        valB = b.type?.name || "";
      }

      if (sortOrder === "desc") return valB.localeCompare(valA);
      return valA.localeCompare(valB);
    });
  }

  return NextResponse.json({
    tasks,
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
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, description, typeId, deadline, assignees, directions, status } = await req.json();

  if (!title || !description || !typeId || !deadline || !assignees?.length || !directions?.length) {
    return NextResponse.json({ error: "Все поля обязательны для заполнения" }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      title,
      description,
      typeId,
      deadline: new Date(deadline),
      status: status || "PENDING",
      creatorId: (session.user as any).id,
      assignees: {
        create: assignees.map((id: string) => ({ userId: id })),
      },
      directions: {
        create: directions.map((id: string) => ({ directionId: id })),
      },
    },
  });

  const [taskType, performers, dirs] = await Promise.all([
    prisma.taskType.findUnique({ where: { id: task.typeId }, select: { name: true } }),
    prisma.user.findMany({ where: { id: { in: assignees } }, select: { fullName: true } }),
    prisma.taskDirection.findMany({ where: { id: { in: directions } }, select: { name: true } })
  ]);

  await logAction({
    userId: (session.user as any).id,
    action: "CREATE",
    entity: "Task",
    entityId: task.id,
    details: { 
      before: null, 
      after: { 
        title: task.title, 
        description: task.description, 
        taskType: taskType?.name, 
        deadline: task.deadline, 
        status: task.status,
        assignees: performers.map(u => u.fullName),
        directions: dirs.map(d => d.name)
      } 
    }
  });

  return NextResponse.json(task);
}
