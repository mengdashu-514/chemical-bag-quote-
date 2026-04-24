-- CreateTable
CREATE TABLE "Model" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Size" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "width" REAL,
    "height" REAL,
    "gusset" REAL,
    "unit" TEXT NOT NULL DEFAULT 'mm',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Price" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "unitPrice" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "moq" INTEGER,
    "remark" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Price_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Price_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "Size" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Price_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Model_code_key" ON "Model"("code");

-- CreateIndex
CREATE INDEX "Model_isActive_sortOrder_idx" ON "Model"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Size_name_key" ON "Size"("name");

-- CreateIndex
CREATE INDEX "Size_isActive_sortOrder_idx" ON "Size"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Material_name_key" ON "Material"("name");

-- CreateIndex
CREATE INDEX "Material_isActive_sortOrder_idx" ON "Material"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Price_modelId_idx" ON "Price"("modelId");

-- CreateIndex
CREATE INDEX "Price_modelId_sizeId_idx" ON "Price"("modelId", "sizeId");

-- CreateIndex
CREATE INDEX "Price_isActive_idx" ON "Price"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Price_modelId_sizeId_materialId_key" ON "Price"("modelId", "sizeId", "materialId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");
