// 后台 CRUD 路由共用的小工具：分页查询、Prisma 错误归一化、动态路由 ID 解析。

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";

// =====================================================================
// 分页：统一并发跑 count + findMany，返回 API 文档约定的分页结构
// =====================================================================

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export async function paginate<T>(
  count: () => Promise<number>,
  find: () => Promise<T[]>,
  page: number,
  pageSize: number,
): Promise<Paginated<T>> {
  const [total, items] = await Promise.all([count(), find()]);
  return { items, total, page, pageSize };
}

// =====================================================================
// Prisma 错误 → 标准错误响应
//   - 命中已知错误 → 返回 NextResponse
//   - 未知错误     → 返回 null，调用方自行 log + 500
// =====================================================================

export function handlePrismaError(err: unknown): NextResponse | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }

  if (err.code === "P2002") {
    const target = ((err.meta?.target as string[] | undefined) ?? []).filter(
      (x) => typeof x === "string",
    );
    // Price 三元组（modelId, sizeId, materialId）冲突单独识别
    if (
      target.includes("materialId") &&
      target.includes("sizeId") &&
      target.includes("modelId")
    ) {
      return apiError(
        "DUPLICATE_PRICE",
        "该 (型号, 尺寸, 材质) 组合已存在价格",
      );
    }
    return apiError(
      "DUPLICATE_NAME",
      target.length
        ? `字段已存在：${target.join(", ")}`
        : "唯一字段冲突",
    );
  }

  if (err.code === "P2025") {
    return apiError("NOT_FOUND", "记录不存在");
  }

  if (err.code === "P2003") {
    return apiError("BAD_REQUEST", "外键引用无效（型号 / 尺寸 / 材质 之一不存在）");
  }

  return null;
}

// 通用 catch 帮手：先尝试归一化已知错误，否则 log + 500
export function handleUnknownError(
  err: unknown,
  contextTag: string,
): NextResponse {
  const handled = handlePrismaError(err);
  if (handled) return handled;
  console.error(`[${contextTag}]`, err);
  return apiError("INTERNAL_ERROR", "服务器内部错误");
}

// =====================================================================
// 动态路由 ID 解析（Next 15 把 params 改成了 Promise）
// =====================================================================

const idSchema = z.string().cuid();

export type IdParseResult =
  | { ok: true; id: string }
  | { ok: false; response: NextResponse };

export async function parseIdParam(
  params: Promise<{ id: string }>,
): Promise<IdParseResult> {
  const { id } = await params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return { ok: false, response: apiError("BAD_REQUEST", "ID 格式不合法") };
  }
  return { ok: true, id: parsed.data };
}
