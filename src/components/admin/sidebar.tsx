"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

// 用 as const 保留 href 字面量类型，配合 next 的 typedRoutes 校验
const NAV = [
  { href: "/admin/prices", label: "价格管理", adminOnly: false },
  { href: "/admin/models", label: "型号管理", adminOnly: false },
  { href: "/admin/sizes", label: "尺寸管理", adminOnly: false },
  { href: "/admin/materials", label: "材质管理", adminOnly: false },
  { href: "/admin/users", label: "后台账号", adminOnly: true },
] as const;

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  return (
    <nav className="flex w-56 flex-col gap-1 border-r bg-card p-3">
      <div className="px-2 pb-3 text-sm font-semibold">化工包装袋报价</div>
      {NAV.filter((item) => !item.adminOnly || role === "ADMIN").map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-foreground/80 hover:bg-muted",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
