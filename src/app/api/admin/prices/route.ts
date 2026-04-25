import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  PriceInput,
  PriceListQuery,
  parseBody,
  parseQuery,
} from "@/lib/validators";
import { handleUnknownError, paginate } from "@/lib/crud-helpers";

// 服务端 join：列表/详情统一带出 model/size/material 三个嵌套对象，避免前端 N+1
const priceInclude = {
  model: { select: { id: true, code: true, name: true } },
  size: { select: { id: true, name: true } },
  material: { select: { id: true, name: true } },
} satisfies Prisma.PriceInclude;

// GET /api/admin/prices?page=&pageSize=&modelId=&sizeId=&materialId=&isActive=
export async function GET(request: Request) {
  const q = parseQuery(request, PriceListQuery);
  if (!q.ok) return q.response;
  const { page, pageSize, modelId, sizeId, materialId, isActive } = q.data;

  const where: Prisma.PriceWhereInput = {
    ...(modelId ? { modelId } : {}),
    ...(sizeId ? { sizeId } : {}),
    ...(materialId ? { materialId } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
  };

  try {
    const result = await paginate(
      () => prisma.price.count({ where }),
      () =>
        prisma.price.findMany({
          where,
          include: priceInclude,
          orderBy: [{ updatedAt: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      page,
      pageSize,
    );
    return NextResponse.json(result);
  } catch (err) {
    return handleUnknownError(err, "GET /api/admin/prices");
  }
}

// POST /api/admin/prices
export async function POST(request: Request) {
  const body = await parseBody(request, PriceInput);
  if (!body.ok) return body.response;

  try {
    const created = await prisma.price.create({
      data: body.data,
      include: priceInclude,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleUnknownError(err, "POST /api/admin/prices");
  }
}
