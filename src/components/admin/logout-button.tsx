"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/admin-api";

export function LogoutButton() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function onClick() {
    setSubmitting(true);
    try {
      await logout();
    } catch {
      // 即便失败也尝试跳登录页：cookie 大概率已被服务端清掉
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={submitting}
      className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60"
    >
      {submitting ? "注销中…" : "注销"}
    </button>
  );
}
