// 浏览器侧调用 /api/auth/* 与 /api/admin/* 的强类型封装。
// 与 public-api.ts 共用一套 ApiClientError 形态，UI 层统一 catch。

import type { Role } from "@/lib/roles";

// =====================================================================
// 错误
// =====================================================================

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "DUPLICATE_PRICE"
  | "DUPLICATE_NAME"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export class AdminApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode | "NETWORK_ERROR" | "UNKNOWN",
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

async function request<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new AdminApiError(0, "NETWORK_ERROR", "网络请求失败，请稍后重试");
  }

  // 204 / 空响应
  if (res.status === 204) {
    return undefined as T;
  }

  if (res.ok) {
    return (await res.json()) as T;
  }

  let code: AdminApiError["code"] = "UNKNOWN";
  let message = `请求失败（${res.status}）`;
  let details: unknown;
  try {
    const body = (await res.json()) as {
      error?: { code: ApiErrorCode; message: string; details?: unknown };
    };
    if (body?.error) {
      code = body.error.code;
      message = body.error.message;
      details = body.error.details;
    }
  } catch {
    // ignore
  }
  throw new AdminApiError(res.status, code, message, details);
}

// =====================================================================
// 类型
// =====================================================================

export interface CurrentUser {
  id: string;
  username: string;
  displayName: string | null;
  role: Role;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminModel {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSize {
  id: string;
  name: string;
  width: number | null;
  height: number | null;
  gusset: number | null;
  unit: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminMaterial {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPrice {
  id: string;
  modelId: string;
  sizeId: string;
  materialId: string;
  unitPrice: number;
  currency: string;
  moq: number | null;
  remark: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  model: { id: string; code: string; name: string };
  size: { id: string; name: string };
  material: { id: string; name: string };
}

export interface AdminUser {
  id: string;
  username: string;
  displayName: string | null;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// =====================================================================
// Auth
// =====================================================================

export function login(input: {
  username: string;
  password: string;
}): Promise<CurrentUser> {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function logout(): Promise<void> {
  return request("/api/auth/logout", { method: "POST" });
}

export function fetchMe(): Promise<CurrentUser> {
  return request("/api/auth/me");
}

// =====================================================================
// 通用 query string 拼装
// =====================================================================

function qs<T extends object>(params: T) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

// =====================================================================
// Models
// =====================================================================

export interface ModelListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  isActive?: boolean;
}

export function listModels(p: ModelListParams = {}) {
  return request<Paginated<AdminModel>>(`/api/admin/models${qs(p)}`);
}

export function createModel(input: {
  code: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}) {
  return request<AdminModel>("/api/admin/models", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateModel(
  id: string,
  input: Partial<{
    code: string;
    name: string;
    description: string | null;
    isActive: boolean;
    sortOrder: number;
  }>,
) {
  return request<AdminModel>(`/api/admin/models/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteModel(id: string) {
  return request<void>(`/api/admin/models/${id}`, { method: "DELETE" });
}

// =====================================================================
// Sizes
// =====================================================================

export interface SizeListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  isActive?: boolean;
}

export function listSizes(p: SizeListParams = {}) {
  return request<Paginated<AdminSize>>(`/api/admin/sizes${qs(p)}`);
}

export function createSize(input: {
  name: string;
  width?: number | null;
  height?: number | null;
  gusset?: number | null;
  unit?: string;
  isActive?: boolean;
  sortOrder?: number;
}) {
  return request<AdminSize>("/api/admin/sizes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSize(
  id: string,
  input: Partial<{
    name: string;
    width: number | null;
    height: number | null;
    gusset: number | null;
    unit: string;
    isActive: boolean;
    sortOrder: number;
  }>,
) {
  return request<AdminSize>(`/api/admin/sizes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteSize(id: string) {
  return request<void>(`/api/admin/sizes/${id}`, { method: "DELETE" });
}

// =====================================================================
// Materials
// =====================================================================

export interface MaterialListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  isActive?: boolean;
}

export function listMaterials(p: MaterialListParams = {}) {
  return request<Paginated<AdminMaterial>>(`/api/admin/materials${qs(p)}`);
}

export function createMaterial(input: {
  name: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}) {
  return request<AdminMaterial>("/api/admin/materials", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateMaterial(
  id: string,
  input: Partial<{
    name: string;
    description: string | null;
    isActive: boolean;
    sortOrder: number;
  }>,
) {
  return request<AdminMaterial>(`/api/admin/materials/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteMaterial(id: string) {
  return request<void>(`/api/admin/materials/${id}`, { method: "DELETE" });
}

// =====================================================================
// Prices
// =====================================================================

export interface PriceListParams {
  page?: number;
  pageSize?: number;
  modelId?: string;
  sizeId?: string;
  materialId?: string;
  isActive?: boolean;
}

export function listPrices(p: PriceListParams = {}) {
  return request<Paginated<AdminPrice>>(`/api/admin/prices${qs(p)}`);
}

export function createPrice(input: {
  modelId: string;
  sizeId: string;
  materialId: string;
  unitPrice: number;
  currency?: string;
  moq?: number | null;
  remark?: string | null;
  isActive?: boolean;
}) {
  return request<AdminPrice>("/api/admin/prices", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePrice(
  id: string,
  input: Partial<{
    unitPrice: number;
    currency: string;
    moq: number | null;
    remark: string | null;
    isActive: boolean;
  }>,
) {
  return request<AdminPrice>(`/api/admin/prices/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deletePrice(id: string) {
  return request<void>(`/api/admin/prices/${id}`, { method: "DELETE" });
}

export function batchTogglePrices(input: {
  ids: string[];
  isActive: boolean;
}) {
  return request<{ updated: number }>(
    "/api/admin/prices/batch-toggle",
    { method: "POST", body: JSON.stringify(input) },
  );
}

// =====================================================================
// Users
// =====================================================================

export interface UserListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  isActive?: boolean;
  role?: Role;
}

export function listUsers(p: UserListParams = {}) {
  return request<Paginated<AdminUser>>(`/api/admin/users${qs(p)}`);
}

export function createUser(input: {
  username: string;
  password: string;
  displayName?: string | null;
  role?: Role;
}) {
  return request<AdminUser>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateUser(
  id: string,
  input: Partial<{
    displayName: string | null;
    role: Role;
    isActive: boolean;
  }>,
) {
  return request<AdminUser>(`/api/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteUser(id: string) {
  return request<void>(`/api/admin/users/${id}`, { method: "DELETE" });
}
