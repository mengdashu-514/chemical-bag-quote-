// Route Handler 专用：从 next/headers 的 cookies 获取 session。
// 中间件请直接使用 iron-session 的 (request, response) 形态，并 import session-config.ts。

import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session-config";

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}
