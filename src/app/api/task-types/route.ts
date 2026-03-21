import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/logger";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const types = await prisma.taskType.findMany({
    orderBy: { name: 'asc' }
  });
  return NextResponse.json(types);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name } = await req.json();
    
    const existing = await prisma.taskType.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: "Тип задачи с таким названием уже существует" }, { status: 400 });
    }

    const type = await prisma.taskType.create({ data: { name } });

    await logAction({
      userId: (session.user as any).id,
      action: "CREATE",
      entity: "TaskType",
      entityId: type.id,
      details: { before: null, after: { name: type.name } }
    });

    return NextResponse.json(type);
  } catch (error) {
    return NextResponse.json({ error: "Ошибка при создании типа задачи" }, { status: 500 });
  }
}
