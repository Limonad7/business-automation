import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  const userId = (session.user as any).id;

  const url = new URL(req.url);
  const searchParams = url.searchParams;
  const executorId = searchParams.get("executorId");
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const sortBy = searchParams.get("sortBy") || "period";
  const sortOrder = searchParams.get("sortOrder") || "desc";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");

  // Permission check
  const finalExecutorId = role === "EXECUTOR" ? userId : (executorId || undefined);

  // Fetch all relevant work reports to group them
  // We can't easily paginate grouped results in Prisma without raw SQL or fetching many,
  // so we'll fetch filtered results and group in memory for this scale.
  const where: any = {};
  if (finalExecutorId) where.executorId = finalExecutorId;
  if (month && year) {
    where.recordDate = {
      gte: new Date(parseInt(year), parseInt(month) - 1, 1),
      lt: new Date(parseInt(year), parseInt(month), 1),
    };
  } else if (year) {
    where.recordDate = {
      gte: new Date(parseInt(year), 0, 1),
      lt: new Date(parseInt(year) + 1, 0, 1),
    };
  }

  const reports = await prisma.userWorkReport.findMany({
    where,
    include: { executor: true },
  });

  // Grouping
  const grouped: Record<string, any> = {};
  reports.forEach((report: any) => {
    const d = new Date(report.recordDate);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const key = `${report.executorId}_${m}_${y}`;
    
    if (!grouped[key]) {
      grouped[key] = {
        executor: report.executor.fullName,
        executorId: report.executorId,
        month: m,
        year: y,
        total: 0,
        hasError: false,
        period: y * 100 + m // For sorting
      };
    }

    if (report.amountCalculated === null) {
      grouped[key].hasError = true;
    } else {
      grouped[key].total += report.amountCalculated;
    }
  });

  let results = Object.values(grouped);

  // Sorting
  results.sort((a: any, b: any) => {
    let comparison = 0;
    if (sortBy === "executor") {
      comparison = a.executor.localeCompare(b.executor);
    } else if (sortBy === "total") {
      comparison = a.total - b.total;
    } else {
      comparison = a.period - b.period;
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  // Pagination
  const totalItems = results.length;
  const totalPages = Math.ceil(totalItems / limit);
  const paginatedResults = results.slice((page - 1) * limit, page * limit);

  return NextResponse.json({
    summary: paginatedResults,
    pagination: {
      total: totalItems,
      totalPages: totalPages,
      page: page,
      limit: limit
    }
  });
}
