// 浏览器侧调用 /api/public/* 的强类型封装。
// 所有方法在 HTTP 错误时抛 ApiClientError，调用方在 UI 层 catch 并展示友好文案。

export interface PublicModel {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
}

export interface PublicSize {
  id: string;
  name: string;
  width: number | null;
  height: number | null;
  gusset: number | null;
  unit: string;
}

export interface PublicMaterial {
  id: string;
  name: string;
  description: string | null;
}

export interface PublicQuote {
  modelId: string;
  sizeId: string;
  materialId: string;
  unitPrice: number;
  currency: string;
  moq: number | null;
  remark: string | null;
  quantity?: number;
  totalPrice?: number;
  belowMoq: boolean;
  quotedAt: string;
}

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "DUPLICATE_PRICE"
  | "DUPLICATE_NAME"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode | "NETWORK_ERROR" | "UNKNOWN",
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch (err) {
    throw new ApiClientError(0, "NETWORK_ERROR", "网络请求失败，请稍后重试");
  }

  if (res.ok) {
    return (await res.json()) as T;
  }

  // 失败：尝试解析统一错误体；解析失败时退化为通用错误
  let code: ApiClientError["code"] = "UNKNOWN";
  let message = `请求失败（${res.status}）`;
  try {
    const body = (await res.json()) as { error?: { code: ApiErrorCode; message: string } };
    if (body?.error) {
      code = body.error.code;
      message = body.error.message;
    }
  } catch {
    // ignore
  }
  throw new ApiClientError(res.status, code, message);
}

export function fetchPublicModels(): Promise<PublicModel[]> {
  return request<PublicModel[]>("/api/public/models");
}

export function fetchPublicSizes(modelId: string): Promise<PublicSize[]> {
  return request<PublicSize[]>(
    `/api/public/sizes?modelId=${encodeURIComponent(modelId)}`,
  );
}

export function fetchPublicMaterials(
  modelId: string,
  sizeId: string,
): Promise<PublicMaterial[]> {
  return request<PublicMaterial[]>(
    `/api/public/materials?modelId=${encodeURIComponent(modelId)}&sizeId=${encodeURIComponent(sizeId)}`,
  );
}

export function fetchPublicQuote(args: {
  modelId: string;
  sizeId: string;
  materialId: string;
  quantity?: number;
}): Promise<PublicQuote> {
  const params = new URLSearchParams({
    modelId: args.modelId,
    sizeId: args.sizeId,
    materialId: args.materialId,
  });
  if (args.quantity !== undefined) {
    params.set("quantity", String(args.quantity));
  }
  return request<PublicQuote>(`/api/public/quote?${params.toString()}`);
}
