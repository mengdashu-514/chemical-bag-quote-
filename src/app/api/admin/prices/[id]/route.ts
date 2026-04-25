import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PriceUpdate, parseBody } from "@/lib/validators";
import { handleUnknownError, parseIdParam } from "@/lib/crud-helpers";
import { apiError } from "@/lib/api-response";

const priceInclude = {
  model: { select: { id: true, code: true, name: true } },
  size: { select: { id: true, name: true } },
  material: { select: { id: true, name: true } },
} as const;

type Ctx = { params: Promise<{ id: string }> };

// GET /api/admin/prices/{id}
export async function GET(_request: Request, ctx: Ctx) {
  const idResult = await parseIdParam(ctx.params);
  if (!idResult.ok) return idResult.response;

  try {
    const price = await prisma.price.findUnique({
      where: { id: idResult.id },
      include: priceInclude,
    });
    if (!price) return apiError("NOT_FOUND", "价格不存在");
    return NextResponse.json(price);
  } catch (err) {
    return handleUnknownError(err, "GET /api/admin/prices/[id]");
  }
}

// PATCH /api/admin/prices/{id}
//   不允许修改三元组 (modelId/sizeId/materialId)；schema 已约束
export async function PATCH(request: Request, ctx: Ctx) {
  const idResult = await parseIdParam(ctx.params);
  if (!idResult.ok) return idResult.response;

  const body = await parseBody(request, PriceUpdate);
  if (!body.ok) return body.response;

  try {
    const updated = await prisma.price.update({
      where: { id: idResult.id },
      data: body.data,
      include: priceInclude,
    });
    return NextResponse.json(updated);
  } catch (err) {
    return handleUnknownError(err, "PATCH /api/admin/prices/[id]");
  }
}

// DELETE /api/admin/prices/{id}
export async function DELETE(_request: Request, ctx: Ctx) {
  const idResult = await parseIdParam(ctx.params);
  if (!idResult.ok) return idResult.response;

  try {
    await prisma.price.delete({ where: { id: idResult.id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleUnknownError(err, "DELETE /api/admin/prices/[id]");
  }
}