import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // 1) 默认管理员：admin / admin123（首次登录请立即修改）
  const passwordHash = await bcrypt.hash("admin123", 10);
  await prisma.adminUser.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash,
      displayName: "系统管理员",
      role: "ADMIN",
    },
  });

  // 2) 示例基础数据
  const ffs = await prisma.model.upsert({
    where: { code: "FFS-25" },
    update: {},
    create: {
      code: "FFS-25",
      name: "FFS 重包装袋",
      description: "适合 25kg 化工原料",
      sortOrder: 0,
    },
  });

  const woven = await prisma.model.upsert({
    where: { code: "PP-WV-50" },
    update: {},
    create: {
      code: "PP-WV-50",
      name: "PP 编织袋",
      description: "适合 50kg 大宗化工",
      sortOrder: 1,
    },
  });

  const size800 = await prisma.size.upsert({
    where: { name: "800×1200mm" },
    update: {},
    create: { name: "800×1200mm", width: 800, height: 1200, sortOrder: 0 },
  });

  const size600 = await prisma.size.upsert({
    where: { name: "600×900mm" },
    update: {},
    create: { name: "600×900mm", width: 600, height: 900, sortOrder: 1 },
  });

  const matPePp = await prisma.material.upsert({
    where: { name: "PP 编织 + PE 内膜" },
    update: {},
    create: {
      name: "PP 编织 + PE 内膜",
      description: "防潮，承重 50kg",
      sortOrder: 0,
    },
  });

  const matPe = await prisma.material.upsert({
    where: { name: "PE 单层" },
    update: {},
    create: { name: "PE 单层", description: "轻量，常规用途", sortOrder: 1 },
  });

  // 3) 示例价格（4 条 SKU）
  const priceRows: Array<{
    modelId: string;
    sizeId: string;
    materialId: string;
    unitPrice: number;
    moq: number;
  }> = [
    { modelId: ffs.id, sizeId: size800.id, materialId: matPePp.id, unitPrice: 3.85, moq: 1000 },
    { modelId: ffs.id, sizeId: size800.id, materialId: matPe.id, unitPrice: 2.95, moq: 1000 },
    { modelId: ffs.id, sizeId: size600.id, materialId: matPe.id, unitPrice: 2.10, moq: 2000 },
    { modelId: woven.id, sizeId: size800.id, materialId: matPePp.id, unitPrice: 4.20, moq: 500 },
  ];

  for (const row of priceRows) {
    await prisma.price.upsert({
      where: {
        modelId_sizeId_materialId: {
          modelId: row.modelId,
          sizeId: row.sizeId,
          materialId: row.materialId,
        },
      },
      update: { unitPrice: row.unitPrice, moq: row.moq },
      create: {
        modelId: row.modelId,
        sizeId: row.sizeId,
        materialId: row.materialId,
        unitPrice: row.unitPrice,
        moq: row.moq,
        remark: "不含税",
      },
    });
  }

  console.log("Seed completed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
