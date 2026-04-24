import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session-config";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(
    request,
    response,
    sessionOptions,
  );

  if (!session.userId) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 },
    );
  }

  // 用户管理仅 ADMIN 可访问
  if (
    request.nextUrl.pathname.startsWith("/api/admin/users") &&
    session.role !== "ADMIN"
  ) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "需要管理员权限" } },
      { status: 403 },
    );
  }

  return response;
}

export const config = {
  matcher: ["/api/admin/:path*"],
};
