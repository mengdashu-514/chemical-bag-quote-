import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SizeUpdate, parseBody } from "@/lib/validators";
import { handleUnknownError, parseIdParam } from "@/lib/crud-helpers";
import { apiError } from "@/lib/api-response";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/admin/sizes/{id}
export async function GET(_request: Request, ctx: Ctx) {
  const idResult = await parseIdParam(ctx.params);
  if (!idResult.ok) return idResult.response;

  try {
    const size = await prisma.size.findUnique({ where: { id: idResult.id } });
    if (!size) return apiError("NOT_FOUND", "尺寸不存在");
    return NextResponse.json(size);
  } catch (err) {
    return handleUnknownError(err, "GET /api/admin/sizes/[id]");
  }
}

// PATCH /api/admin/sizes/{id}
export async function PATCH(request: Request, ctx: Ctx) {
  const idResult = await parseIdParam(ctx.params);
  if (!idResult.ok) return idResult.response;

  const body = await parseBody(request, SizeUpdate);
  if (!body.ok) return body.response;

  try {
    const updated = await prisma.size.update({
      where: { id: idResult.id },
      data: body.data,
    });
    return NextResponse.json(updated);
  } catch (err) {
    return handleUnknownError(err, "PATCH /api/admin/sizes/[id]");
  }
}

// DELETE /api/admin/sizes/{id}
//   级联：相关 Price 行通过 schema 的 ON DELETE CASCADE 自动清理
export async function DELETE(_request: Request, ctx: Ctx) {
  const idResult = await parseIdParam(ctx.params);
  if (!idResult.ok) return idResult.response;

  try {
    await prisma.size.delete({ where: { id: idResult.id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleUnknownError(err, "DELETE /api/admin/sizes/[id]");
  }
}
