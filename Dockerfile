# =====================================================================
# 化工包装袋报价系统 - 多阶段 Dockerfile
#   deps    : 装全部依赖（含 dev，给 build 用）
#   builder : prisma generate + next build → standalone 产物
#   runner  : 运行时镜像，仅含 standalone + prisma 客户端 + CLI
# 详见 docs/04-deployment.md §3
# =====================================================================

# -------- 1. deps --------
FROM node:20-alpine AS deps
WORKDIR /app
# Prisma 在 alpine 上需要 openssl / libc 兼容
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# -------- 2. builder --------
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# 生成 Prisma client 必须在 next build 之前，否则 build 解析不到 @prisma/client 类型
RUN npx prisma generate
RUN npm run build

# -------- 3. runner --------
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# 非 root 运行；Next standalone server 只需要读自己的目录
RUN addgroup -S app && adduser -S app -G app

# Standalone 产物：含被 tree-shake 后的最小 node_modules + server.js
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public

# Prisma 运行时所需：迁移文件、生成的 client、CLI 二进制
COPY --from=builder --chown=app:app /app/prisma ./prisma
COPY --from=builder --chown=app:app /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=app:app /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=app:app /app/node_modules/prisma ./node_modules/prisma

# 入口脚本：先跑 migrate deploy 再 exec node server.js
COPY --chown=app:app docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

USER app
EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "server.js"]
