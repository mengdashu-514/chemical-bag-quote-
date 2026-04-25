import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ModelUpdate, parseBody } from "@/lib/validators";
import {
  handleUnknownError,
  parseIdParam,
} from "@/lib/crud-helpers";
import { apiError } from "@/lib/api-response";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/admin/models/{id}
export async function GET(_request: Request, ctx: Ctx) {
  const idResult = await parseIdParam(ctx.params);
  if (!idResult.ok) return idResult.response;

  try {
    const model = await prisma.model.findUnique({ where: { id: idResult.id } });
    if (!model) return apiError("NOT_FOUND", "型号不存在");
    return NextResponse.json(model);
  } catch (err) {
    return handleUnknownError(err, "GET /api/admin/models/[id]");
  }
}

// PATCH /api/admin/models/{id}
export async function PATCH(request: Request, ctx: Ctx) {
  const idResult = await parseIdParam(ctx.params);
  if (!idResult.ok) return idResult.response;

  const body = await parseBody(request, ModelUpdate);
  if (!body.ok) return body.response;

  try {
    const updated = await prisma.model.update({
      where: { id: idResult.id },
      data: body.data,
    });
    return NextResponse.json(updated);
  } catch (err) {
    return handleUnknownError(err, "PATCH /api/admin/models/[id]");
  }
}

// DELETE /api/admin/models/{id}
//   级联：相关 Price 行通过 schema 的 ON DELETE CASCADE 自动清理
export async function DELETE(_request: Request, ctx: Ctx) {
  const idResult = await parseIdParam(ctx.params);
  if (!idResult.ok) return idResult.response;

  try {
    await prisma.model.delete({ where: { id: idResult.id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleUnknownError(err, "DELETE /api/admin/models/[id]");
  }
}
