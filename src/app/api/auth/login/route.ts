import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { apiError } from "@/lib/api-response";
import { isRole } from "@/lib/roles";

const LoginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("BAD_REQUEST", "请求体必须是合法 JSON");
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "参数校验失败", parsed.error.flatten());
  }

  const { username, password } = parsed.data;

  const user = await prisma.adminUser.findUnique({ where: { username } });
  // 用户不存在 / 已禁用 / 密码错都统一返回相同错误，避免泄露用户名是否存在
  if (!user || !user.isActive) {
    return apiError("UNAUTHORIZED", "用户名或密码错误");
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return apiError("UNAUTHORIZED", "用户名或密码错误");
  }

  if (!isRole(user.role)) {
    return apiError("INTERNAL_ERROR", "用户角色配置异常，请联系管理员");
  }

  await prisma.adminUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const session = await getSession();
  session.userId = user.id;
  session.username = user.username;
  session.displayName = user.displayName;
  session.role = user.role;
  await session.save();

  return NextResponse.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  });
}
