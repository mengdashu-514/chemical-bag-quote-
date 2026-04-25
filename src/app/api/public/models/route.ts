import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleUnknownError } from "@/lib/crud-helpers";

// GET /api/public/models
//   仅返回上架型号；按 sortOrder 升序，code 兜底排序
export async function GET() {
  try {
    const models = await prisma.model.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });
    return NextResponse.json(models);
  } catch (err) {
    return handleUnknownError(err, "GET /api/public/models");
  }
}
