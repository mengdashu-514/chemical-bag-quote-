import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ModelInput,
  ModelListQuery,
  parseBody,
  parseQuery,
} from "@/lib/validators";
import { handleUnknownError, paginate } from "@/lib/crud-helpers";

// GET /api/admin/models?page=&pageSize=&keyword=&isActive=
export async function GET(request: Request) {
  const q = parseQuery(request, ModelListQuery);
  if (!q.ok) return q.response;
  const { page, pageSize, keyword, isActive } = q.data;

  // 注：SQLite 的 contains 是大小写敏感；切到 PostgreSQL 后可加 mode: "insensitive"
  const where: Prisma.ModelWhereInput = {
    ...(keyword
      ? {
          OR: [
            { code: { contains: keyword } },
            { name: { contains: keyword } },
          ],
        }
      : {}),
    ...(isActive !== undefined ? { isActive } : {}),
  };

  try {
    const result = await paginate(
      () => prisma.model.count({ where }),
      () =>
        prisma.model.findMany({
          where,
          orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      page,
      pageSize,
    );
    return NextResponse.json(result);
  } catch (err) {
    return handleUnknownError(err, "GET /api/admin/models");
  }
}

// POST /api/admin/models
export async function POST(request: Request) {
  const body = await parseBody(request, ModelInput);
  if (!body.ok) return body.response;

  try {
    const created = await prisma.model.create({ data: body.data });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleUnknownError(err, "POST /api/admin/models");
  }
}
