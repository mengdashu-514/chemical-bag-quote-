import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PublicQuoteQuery, parseQuery } from "@/lib/validators";
import { handleUnknownError } from "@/lib/crud-helpers";
import { apiError } from "@/lib/api-response";

// GET /api/public/quote?modelId=&sizeId=&materialId=&quantity=
//   只返回 isActive=true 的价格；找不到 → 404 NOT_FOUND
export async function GET(request: Request) {
  const q = parseQuery(request, PublicQuoteQuery);
  if (!q.ok) return q.response;
  const { modelId, sizeId, materialId, quantity } = q.data;

  try {
    const price = await prisma.price.findUnique({
      where: {
        modelId_sizeId_materialId: { modelId, sizeId, materialId },
      },
    });

    if (!price || !price.isActive) {
      return apiError("NOT_FOUND", "该组合暂未配置报价");
    }

    const totalPrice =
      quantity !== undefined ? price.unitPrice * quantity : undefined;
    const belowMoq =
      quantity !== undefined && price.moq !== null
        ? quantity < price.moq
        : false;

    return NextResponse.json({
      modelId: price.modelId,
      sizeId: price.sizeId,
      materialId: price.materialId,
      unitPrice: price.unitPrice,
      currency: price.currency,
      moq: price.moq,
      remark: price.remark,
      ...(quantity !== undefined ? { quantity, totalPrice } : {}),
      belowMoq,
      quotedAt: new Date().toISOString(),
    });
  } catch (err) {
    return handleUnknownError(err, "GET /api/public/quote");
  }
}
