import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AdminUserUpdateInput, parseBody } from "@/lib/validators";
import { handleUnknownError, parseIdParam } from "@/lib/crud-helpers";
import { apiError } from "@/lib/api-response";
import { getSession } from "@/lib/session";

const userSelect = {
  id: true,
  username: true,
  displayName: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AdminUserSelect;

type Ctx = { params: Promise<{ id: string }> };

// GET /api/admin/users/{id}
export async function GET(_request: Request, ctx: Ctx) {
  const idResult = await parseIdParam(ctx.params);
  if (!idResult.ok) return idResult.response;

  try {
    const user = await prisma.adminUser.findUnique({
      where: { id: idResult.id },
      select: userSelect,
    });
    if (!user) return apiError("NOT_FOUND", "用户不存在");
    return NextResponse.json(user);
  } catch (err) {
    return handleUnknownError(err, "GET /api/admin/users/[id]");
  }
}

// PATCH /api/admin/users/{id}
//   只能改 displayName / role / isActive；username/password 不开放
export async function PATCH(request: Request, ctx: Ctx) {
  const idResult = await parseIdParam(ctx.params);
  if (!idResult.ok) return idResult.response;

  const body = await parseBody(request, AdminUserUpdateInput);
  if (!body.ok) return body.response;

  // 防止管理员把自己降级 / 停用，导致后续无人能管理用户
  const session = await getSession();
  if (
    session.userId === idResult.id &&
    (body.data.role !== undefined || body.data.isActive === false)
  ) {
    return apiError("BAD_REQUEST", "不能修改自己的角色或停用自己");
  }

  try {
    const updated = await prisma.adminUser.update({
      where: { id: idResult.id },
      data: body.data,
      select: userSelect,
    });
    return NextResponse.json(updated);
  } catch (err) {
    return handleUnknownError(err, "PATCH /api/admin/users/[id]");
  }
}

// DELETE /api/admin/users/{id}
//   软删除：仅 isActive=false。物理删除会破坏审计日志（若后续接入）。
export async function DELETE(_request: Request, ctx: Ctx) {
  const idResult = await parseIdParam(ctx.params);
  if (!idResult.ok) return idResult.response;

  const session = await getSession();
  if (session.userId === idResult.id) {
    return apiError("BAD_REQUEST", "不能删除当前登录用户");
  }

  try {
    await prisma.adminUser.update({
      where: { id: idResult.id },
      data: { isActive: false },
    });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleUnknownError(err, "DELETE /api/admin/users/[id]");
  }
}
