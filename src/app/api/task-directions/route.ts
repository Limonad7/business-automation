import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/logger";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const directions = await prisma.taskDirection.findMany({
    orderBy: { name: 'asc' }
  });
  return NextResponse.json(directions);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name } = await req.json();
    
    const existing = await prisma.taskDirection.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: "Направление с таким названием уже существует" }, { status: 400 });
    }

    const direction = await prisma.taskDirection.create({ data: { name } });

    await logAction({
      userId: (session.user as any).id,
      action: "CREATE",
      entity: "TaskDirection",
      entityId: direction.id,
      details: { before: null, after: { name: direction.name } }
    });

    return NextResponse.json(direction);
  } catch (error) {
    return NextResponse.json({ error: "Ошибка при создании направления" }, { status: 500 });
  }
}
