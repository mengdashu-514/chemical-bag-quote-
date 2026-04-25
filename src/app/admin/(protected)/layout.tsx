import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isRole } from "@/lib/roles";
import { Sidebar } from "@/components/admin/sidebar";
import { LogoutButton } from "@/components/admin/logout-button";

// 受保护的 admin 区域：服务端校验 session，未登录直接跳 /admin/login。
//   middleware 已经守住 /api/admin/*，这里再守住页面路由本身。
//   登录页放在 /admin/login（在 (protected) 组之外），保持自由可达。

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.userId) {
    redirect("/admin/login");
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

  if (!user || !user.isActive || !isRole(user.role)) {
    session.destroy();
    await session.save();
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen bg-muted/40">
      <Sidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b bg-card px-6 py-3">
          <div className="text-sm text-muted-foreground">后台管理</div>
          <div className="flex items-center gap-3">
            <span className="text-sm">
              {user.displayName ?? user.username}
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {user.role}
              </span>
            </span>
            <LogoutButton />
          </div>
        </header>
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
