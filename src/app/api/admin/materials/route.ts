import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  MaterialInput,
  MaterialListQuery,
  parseBody,
  parseQuery,
} from "@/lib/validators";
import { handleUnknownError, paginate } from "@/lib/crud-helpers";

// GET /api/admin/materials?page=&pageSize=&keyword=&isActive=
export async function GET(request: Request) {
  const q = parseQuery(request, MaterialListQuery);
  if (!q.ok) return q.response;
  const { page, pageSize, keyword, isActive } = q.data;

  const where: Prisma.MaterialWhereInput = {
    ...(keyword ? { name: { contains: keyword } } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
  };

  try {
    const result = await paginate(
      () => prisma.material.count({ where }),
      () =>
        prisma.material.findMany({
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
    return handleUnknownError(err, "GET /api/admin/materials");
  }
}

// POST /api/admin/materials
export async function POST(request: Request) {
  const body = await parseBody(request, MaterialInput);
  if (!body.ok) return body.response;

  try {
    const created = await prisma.material.create({ data: body.data });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleUnknownError(err, "POST /api/admin/materials");
  }
}
