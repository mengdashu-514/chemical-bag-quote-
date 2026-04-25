import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { UsersAdmin } from "./users-admin";

// 仅 ADMIN 可访问；非 ADMIN 直接踢回 /admin。
//   中间件已经守住 /api/admin/users 接口，但页面路由不会经过 middleware，所以这里二次校验。
export default async function UsersPage() {
  const session = await getSession();
  if (session.role !== "ADMIN") {
    redirect("/admin");
  }
  return <UsersAdmin currentUserId={session.userId!} />;
}
