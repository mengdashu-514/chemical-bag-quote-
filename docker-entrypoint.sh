#!/bin/sh
# =====================================================================
# 容器启动前：把未应用的 Prisma 迁移落到生产数据库（幂等）。
# 失败即 exit，让编排层（compose / k8s）按重启策略处理。
# 注意：seed 不在这里跑——种子只应在数据库首次部署时手动触发一次。
# =====================================================================
set -e

# Next.js standalone 产物不带 node_modules/.bin 链接，所以不能用 npx prisma；
# 直接调 prisma 包里的 build/index.js 入口。
echo "[entrypoint] running prisma migrate deploy..."
node /app/node_modules/prisma/build/index.js migrate deploy

echo "[entrypoint] starting next server: $*"
exec "$@"
