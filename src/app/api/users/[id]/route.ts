import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/logger";
import bcrypt from "bcryptjs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { email, role, fullName, password, isBlocked } = await req.json();

  if (!email || !role || !fullName) {
    return NextResponse.json({ error: "Все поля обязательны для заполнения" }, { status: 400 });
  }

  // Check email uniqueness if changed
  const existingUser = await prisma.user.findFirst({
    where: {
      email,
      id: { not: id }
    }
  });

  if (existingUser) {
    return NextResponse.json({ error: "Пользователь с таким Email уже существует" }, { status: 400 });
  }

  const updateData: any = {
    email,
    role,
    fullName,
    isBlocked
  };

  if (password) {
    updateData.password = await bcrypt.hash(password, 10);
  }

  try {
    const oldUser = await prisma.user.findUnique({ where: { id } });
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    await logAction({
      userId: (session.user as any).id,
      action: "UPDATE",
      entity: "User",
      entityId: id,
      details: { 
        before: { email: oldUser?.email, fullName: oldUser?.fullName, role: oldUser?.role, isBlocked: oldUser?.isBlocked }, 
        after: { email: updatedUser.email, fullName: updatedUser.fullName, role: updatedUser.role, isBlocked: updatedUser.isBlocked } 
      }
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    return NextResponse.json({ error: "Ошибка при обновлении пользователя" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (id === (session.user as any).id) {
    return NextResponse.json({ error: "Вы не можете удалить самого себя" }, { status: 400 });
  }

  try {
    // Check dependencies
    const reportsCount = await prisma.userWorkReport.count({ where: { OR: [{ executorId: id }, { creatorId: id }] } });
    const tasksCount = await prisma.task.count({ where: { OR: [{ creatorId: id }, { assignees: { some: { userId: id } } }] } });
    const ratesCount = await prisma.salaryRate.count({ where: { executorId: id } });

    if (reportsCount > 0 || tasksCount > 0 || ratesCount > 0) {
      return NextResponse.json({ 
        error: "Невозможно удалить пользователя. С ним связаны отчеты о работе, задачи или зарплатные ставки. Рекомендуется использовать блокировку." 
      }, { status: 400 });
    }

    const oldUser = await prisma.user.findUnique({ where: { id } });
    await prisma.user.delete({ where: { id } });

    await logAction({
      userId: (session.user as any).id,
      action: "DELETE",
      entity: "User",
      entityId: id,
      details: { before: { email: oldUser?.email, fullName: oldUser?.fullName, role: oldUser?.role }, after: null }
    });

    return NextResponse.json({ message: "Пользователь удален" });
  } catch (error) {
    return NextResponse.json({ error: "Ошибка при удалении пользователя" }, { status: 500 });
  }
}
