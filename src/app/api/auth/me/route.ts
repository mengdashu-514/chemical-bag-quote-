import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { apiError } from "@/lib/api-response";

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return apiError("UNAUTHORIZED", "未登录");
  }

  // 每次取最新用户状态，避免 cookie 仍有效但用户已被禁用 / 删除
  const user = await prisma.adminUser.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    session.destroy();
    return apiError("UNAUTHORIZED", "登录态已失效");
  }

  return NextResponse.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  });
}
