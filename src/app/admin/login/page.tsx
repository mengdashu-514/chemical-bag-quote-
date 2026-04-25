"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { AdminApiError, login } from "@/lib/admin-api";

// /admin/login —— 不在 (protected) 组里，因此无 session 也可访问。
// 登录成功后跳到 ?next= 指定的页面（layout 拦截时会带上 next），缺省回 /admin。

export default function LoginPage() {
  const router = useRouter();
  // typedRoutes 要求 router.replace 拿 Route 类型；?next= 是用户输入，断言后由 Next 校验
  const next = (useSearchParams().get("next") ?? "/admin") as Route;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ username, password });
      // 用 replace 避免后退又回到登录页
      router.replace(next);
      router.refresh();
    } catch (err) {
      if (err instanceof AdminApiError) {
        setError(err.message);
      } else {
        setError("登录失败，请稍后重试");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-lg border bg-card p-6 shadow-sm"
      >
        <header className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">后台登录</h1>
          <p className="text-sm text-muted-foreground">化工包装袋报价系统</p>
        </header>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">用户名</span>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="h-10 w-full rounded-md border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">密码</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-10 w-full rounded-md border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="h-10 w-full rounded-md bg-primary font-medium text-primary-foreground disabled:opacity-60"
        >
          {submitting ? "登录中…" : "登录"}
        </button>
      </form>
    </main>
  );
}
