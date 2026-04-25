import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  AdminUserCreateInput,
  AdminUserListQuery,
  parseBody,
  parseQuery,
} from "@/lib/validators";
import { handleUnknownError, paginate } from "@/lib/crud-helpers";

// 列表/详情统一通过 select 排除 passwordHash，绝不外泄
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

// GET /api/admin/users?page=&pageSize=&keyword=&isActive=&role=
export async function GET(request: Request) {
  const q = parseQuery(request, AdminUserListQuery);
  if (!q.ok) return q.response;
  const { page, pageSize, keyword, isActive, role } = q.data;

  const where: Prisma.AdminUserWhereInput = {
    ...(keyword
      ? {
          OR: [
            { username: { contains: keyword } },
            { displayName: { contains: keyword } },
          ],
        }
      : {}),
    ...(isActive !== undefined ? { isActive } : {}),
    ...(role ? { role } : {}),
  };

  try {
    const result = await paginate(
      () => prisma.adminUser.count({ where }),
      () =>
        prisma.adminUser.findMany({
          where,
          select: userSelect,
          orderBy: [{ createdAt: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      page,
      pageSize,
    );
    return NextResponse.json(result);
  } catch (err) {
    return handleUnknownError(err, "GET /api/admin/users");
  }
}

// POST /api/admin/users
export async function POST(request: Request) {
  const body = await parseBody(request, AdminUserCreateInput);
  if (!body.ok) return body.response;
  const { username, password, displayName, role } = body.data;

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const created = await prisma.adminUser.create({
      data: { username, passwordHash, displayName, role },
      select: userSelect,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleUnknownError(err, "POST /api/admin/users");
  }
}
