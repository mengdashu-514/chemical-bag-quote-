import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PublicSizesQuery, parseQuery } from "@/lib/validators";
import { handleUnknownError } from "@/lib/crud-helpers";

// GET /api/public/sizes?modelId=
//   仅返回「在 Price 表中与该 modelId 至少存在一条 isActive=true 价格」的尺寸。
export async function GET(request: Request) {
  const q = parseQuery(request, PublicSizesQuery);
  if (!q.ok) return q.response;
  const { modelId } = q.data;

  try {
    const sizes = await prisma.size.findMany({
      where: {
        isActive: true,
        prices: {
          some: { modelId, isActive: true },
        },
      },
      select: {
        id: true,
        name: true,
        width: true,
        height: true,
        gusset: true,
        unit: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(sizes);
  } catch (err) {
    return handleUnknownError(err, "GET /api/public/sizes");
  }
}
