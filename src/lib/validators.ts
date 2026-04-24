// 所有 API 请求 / 查询参数的 zod schema 与解析帮手。
// Route Handler 调用 parseBody / parseQuery 即可一行完成校验，失败时直接返回 422 响应。

import { z } from "zod";
import type { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";

// =====================================================================
// 解析帮手
// =====================================================================

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

export async function parseBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<ParseResult<z.output<T>>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: apiError("BAD_REQUEST", "请求体必须是合法 JSON"),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: apiError(
        "VALIDATION_ERROR",
        "参数校验失败",
        parsed.error.flatten(),
      ),
    };
  }

  return { ok: true, data: parsed.data };
}

export function parseQuery<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): ParseResult<z.output<T>> {
  const url = new URL(request.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    params[k] = v;
  });

  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    return {
      ok: false,
      response: apiError(
        "VALIDATION_ERROR",
        "查询参数校验失败",
        parsed.error.flatten(),
      ),
    };
  }

  return { ok: true, data: parsed.data };
}

// =====================================================================
// 共用原子
// =====================================================================

const cuid = z.string().cuid();

// URL query 里布尔值是字符串 "true"/"false"，单独处理
const boolFromQuery = z
  .union([z.literal("true"), z.literal("false")])
  .transform((v) => v === "true");

export const PaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuery>;

// =====================================================================
// Model
// =====================================================================

export const ModelInput = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  description: z.string().max(1000).nullish(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
export type ModelInput = z.infer<typeof ModelInput>;

export const ModelUpdate = ModelInput.partial();
export type ModelUpdate = z.infer<typeof ModelUpdate>;

export const ModelListQuery = PaginationQuery.extend({
  keyword: z.string().min(1).max(64).optional(),
  isActive: boolFromQuery.optional(),
});
export type ModelListQuery = z.infer<typeof ModelListQuery>;

// =====================================================================
// Size
// =====================================================================

export const SizeInput = z.object({
  name: z.string().min(1).max(128),
  width: z.number().positive().nullish(),
  height: z.number().positive().nullish(),
  gusset: z.number().nonnegative().nullish(),
  unit: z.string().min(1).max(16).default("mm"),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
export type SizeInput = z.infer<typeof SizeInput>;

export const SizeUpdate = SizeInput.partial();
export type SizeUpdate = z.infer<typeof SizeUpdate>;

export const SizeListQuery = PaginationQuery.extend({
  keyword: z.string().min(1).max(64).optional(),
  isActive: boolFromQuery.optional(),
});
export type SizeListQuery = z.infer<typeof SizeListQuery>;

// =====================================================================
// Material
// =====================================================================

export const MaterialInput = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(1000).nullish(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
export type MaterialInput = z.infer<typeof MaterialInput>;

export const MaterialUpdate = MaterialInput.partial();
export type MaterialUpdate = z.infer<typeof MaterialUpdate>;

export const MaterialListQuery = PaginationQuery.extend({
  keyword: z.string().min(1).max(64).optional(),
  isActive: boolFromQuery.optional(),
});
export type MaterialListQuery = z.infer<typeof MaterialListQuery>;

// =====================================================================
// Price（核心：三元组 + 单价）
// =====================================================================

export const PriceInput = z.object({
  modelId: cuid,
  sizeId: cuid,
  materialId: cuid,
  unitPrice: z.number().positive(),
  currency: z.string().length(3).default("CNY"),
  moq: z.number().int().positive().nullish(),
  remark: z.string().max(500).nullish(),
  isActive: z.boolean().default(true),
});
export type PriceInput = z.infer<typeof PriceInput>;

// PATCH 不允许修改 (modelId, sizeId, materialId)，要换三元组请删除后重建。详见 docs/03-api-spec.md §3.4
export const PriceUpdate = z.object({
  unitPrice: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  moq: z.number().int().positive().nullish(),
  remark: z.string().max(500).nullish(),
  isActive: z.boolean().optional(),
});
export type PriceUpdate = z.infer<typeof PriceUpdate>;

export const PriceListQuery = PaginationQuery.extend({
  modelId: cuid.optional(),
  sizeId: cuid.optional(),
  materialId: cuid.optional(),
  isActive: boolFromQuery.optional(),
});
export type PriceListQuery = z.infer<typeof PriceListQuery>;

// =====================================================================
// Batch 操作
// =====================================================================

export const BatchToggleInput = z.object({
  ids: z.array(cuid).min(1).max(500),
  isActive: z.boolean(),
});
export type BatchToggleInput = z.infer<typeof BatchToggleInput>;

// =====================================================================
// 公开（C 端）查询
// =====================================================================

export const PublicSizesQuery = z.object({
  modelId: cuid,
});
export type PublicSizesQuery = z.infer<typeof PublicSizesQuery>;

export const PublicMaterialsQuery = z.object({
  modelId: cuid,
  sizeId: cuid,
});
export type PublicMaterialsQuery = z.infer<typeof PublicMaterialsQuery>;

export const PublicQuoteQuery = z.object({
  modelId: cuid,
  sizeId: cuid,
  materialId: cuid,
  quantity: z.coerce.number().int().positive().optional(),
});
export type PublicQuoteQuery = z.infer<typeof PublicQuoteQuery>;
