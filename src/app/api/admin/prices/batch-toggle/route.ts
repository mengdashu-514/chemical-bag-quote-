import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BatchToggleInput, parseBody } from "@/lib/validators";
import { handleUnknownError } from "@/lib/crud-helpers";

// POST /api/admin/prices/batch-toggle
//   批量上/下架；返回真实命中数（updateMany 的 count），与 ids.length 不一定相等
export async function POST(request: Request) {
  const body = await parseBody(request, BatchToggleInput);
  if (!body.ok) return body.response;
  const { ids, isActive } = body.data;

  try {
    const result = await prisma.price.updateMany({
      where: { id: { in: ids } },
      data: { isActive },
    });
    return NextResponse.json({ updated: result.count });
  } catch (err) {
    return handleUnknownError(err, "POST /api/admin/prices/batch-toggle");
  }
}