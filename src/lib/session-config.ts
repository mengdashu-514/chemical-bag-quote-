// 中间件（Edge）与 Route Handler（Node）共用的 session 配置 / 类型。
// 注意：本文件不能 import "next/headers" 等仅 Node 可用的 API，否则中间件会构建失败。

import type { SessionOptions } from "iron-session";
import type { Role } from "@/lib/roles";

export interface SessionData {
  userId?: string;
  username?: string;
  displayName?: string | null;
  role?: Role;
}

export const sessionOptions: SessionOptions = {
  // SESSION_SECRET 必须 ≥32 字符；缺失或过短时 iron-session 会在首次使用抛错（fail-fast）
  password: process.env.SESSION_SECRET!,
  cookieName: "cbq_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 天
  },
};
