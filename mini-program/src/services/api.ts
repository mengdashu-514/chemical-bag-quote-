import Taro from "@tarojs/taro";

// ============================================================
// 后端地址 —— 部署后替换为你的 HTTPS 域名
// 开发阶段先用完整地址测试
// ============================================================
const BASE_URL = "https://your-domain.com";

// ==================== 类型定义（复用自 public-api.ts） ====================

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
  belowMoq: boolean;
  quotedAt: string;
}

// ==================== 请求封装 ====================

async function request<T>(path: string): Promise<T> {
  const res = await Taro.request({
    url: `${BASE_URL}${path}`,
    header: { Accept: "application/json" },
  });

  if (res.statusCode >= 200 && res.statusCode < 300) {
    return res.data as T;
  }

  const body = res.data as {
    error?: { code: string; message: string };
  };
  const msg = body?.error?.message ?? `请求失败（${res.statusCode}）`;
  throw new Error(msg);
}

// ==================== 公开 API ====================

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
}): Promise<PublicQuote> {
  const params = new URLSearchParams({
    modelId: args.modelId,
    sizeId: args.sizeId,
    materialId: args.materialId,
  });
  return request<PublicQuote>(`/api/public/quote?${params.toString()}`);
}
