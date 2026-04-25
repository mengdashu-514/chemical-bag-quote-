import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PublicMaterialsQuery, parseQuery } from "@/lib/validators";
import { handleUnknownError } from "@/lib/crud-helpers";

// GET /api/public/materials?modelId=&sizeId=
//   仅返回「在 (modelId, sizeId) 下至少存在一条 isActive=true 价格」的材质。
export async function GET(request: Request) {
  const q = parseQuery(request, PublicMaterialsQuery);
  if (!q.ok) return q.response;
  const { modelId, sizeId } = q.data;

  try {
    const materials = await prisma.material.findMany({
      where: {
        isActive: true,
        prices: {
          some: { modelId, sizeId, isActive: true },
        },
      },
      select: { id: true, name: true, description: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(materials);
  } catch (err) {
    return handleUnknownError(err, "GET /api/public/materials");
  }
}
