import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  SizeInput,
  SizeListQuery,
  parseBody,
  parseQuery,
} from "@/lib/validators";
import { handleUnknownError, paginate } from "@/lib/crud-helpers";

// GET /api/admin/sizes?page=&pageSize=&keyword=&isActive=
export async function GET(request: Request) {
  const q = parseQuery(request, SizeListQuery);
  if (!q.ok) return q.response;
  const { page, pageSize, keyword, isActive } = q.data;

  const where: Prisma.SizeWhereInput = {
    ...(keyword ? { name: { contains: keyword } } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
  };

  try {
    const result = await paginate(
      () => prisma.size.count({ where }),
      () =>
        prisma.size.findMany({
          where,
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      page,
      pageSize,
    );
    return NextResponse.json(result);
  } catch (err) {
    return handleUnknownError(err, "GET /api/admin/sizes");
  }
}

// POST /api/admin/sizes
export async function POST(request: Request) {
  const body = await parseBody(request, SizeInput);
  if (!body.ok) return body.response;

  try {
    const created = await prisma.size.create({ data: body.data });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleUnknownError(err, "POST /api/admin/sizes");
  }
}
