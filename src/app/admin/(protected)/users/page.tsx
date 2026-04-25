import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

// 仅 ADMIN 可访问；非 ADMIN 直接踢回 /admin。
//   中间件已经守住 /api/admin/users 接口，但页面路由不会经过 middleware，所以这里二次校验。
export default async function UsersPage() {
  const session = await getSession();
  if (session.role !== "ADMIN") {
    redirect("/admin");
  }
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">后台账号</h1>
      <p className="text-sm text-muted-foreground">本节将在 Phase 3 第 4 步实现。</p>
    </div>
  );
}
