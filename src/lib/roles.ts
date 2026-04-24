// SQLite 不支持 Prisma enum，所以 AdminUser.role 字段是 String。
// 这里定义合法取值，应用层用此常量做约束 / 类型推导，等迁 PostgreSQL 后可改回 Prisma enum。

export const ROLES = ["ADMIN", "STAFF"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
