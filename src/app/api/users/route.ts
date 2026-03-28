import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { logAction } from "@/lib/logger";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const searchParams = url.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: limit,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isBlocked: true,
      },
      orderBy: { fullName: 'asc' }
    }),
    prisma.user.count()
  ]);

  return NextResponse.json({
    users,
    pagination: {
      total,
      totalPages: Math.ceil(total / limit),
      page,
      limit
    }
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, role, fullName, password } = await req.json();

  if (!email || !role || !fullName || !password) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "Пользователь с таким Email уже существует" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      role,
      fullName,
      password: hashedPassword,
    },
  });

  await logAction({
    userId: (session.user as any).id,
    action: "CREATE",
    entity: "User",
    entityId: user.id,
    details: { before: null, after: { email: user.email, fullName: user.fullName, role: user.role, isBlocked: user.isBlocked } }
  });

  return NextResponse.json(user);
}
