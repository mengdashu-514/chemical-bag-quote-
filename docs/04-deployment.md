# 《部署与运维手册》—— 化工包装袋报价系统

> 版本：v0.1（Phase 5）
> 日期：2026-04-25
> 关联文档：`docs/01-prd.md`、`docs/02-database-design.md`、`docs/03-api-spec.md`
> 适用项目根目录：`报价/`

本手册四章逐层覆盖：

1. **环境变量与本地启动**（本章）
2. Vercel 部署
3. Docker 自托管
4. 运维 / 故障排查 / 升级手册

> 读者：第一次拉到代码、想在自己机器上 `npm run dev` 跑起来的开发者；以及之后做生产部署的运维。先读完第 1 章再去看 2 / 3 章，省事。

---

## 1. 环境变量与本地启动

### 1.1 前置依赖

| 工具 | 版本 | 说明 |
|---|---|---|
| Node.js | ≥ 20.x | Next 15 要求；推荐 LTS |
| npm | ≥ 10.x | 跟随 Node 安装 |
| 操作系统 | macOS / Linux / Windows（WSL2） | 直接 Windows 跑 SQLite 也行，但路径分隔符容易踩坑 |

> 不需要 Docker、不需要单独装数据库——开发期用嵌入式 SQLite。生产期再切 PostgreSQL，见第 2 章。

### 1.2 环境变量字段说明

代码里只读 3 个变量，全部以 `.env.example` 为准：

| 变量 | 必填 | 用途 | 默认 / 示例 |
|---|---|---|---|
| `DATABASE_URL` | ✅ | Prisma datasource。开发期 SQLite 文件，生产期换 Postgres 连接串 | `file:./dev.db`（开发） |
| `SESSION_SECRET` | ✅ | iron-session 用它签 cookie。**必须 ≥ 32 字符随机串**，少于此长度 iron-session 首次使用就抛错（fail-fast） | 用 `openssl rand -base64 32` 生成 |
| `NEXT_PUBLIC_SITE_URL` | ⛔（v1 暂未使用） | 预留：未来生成"销售转发链接"会用到。带 `NEXT_PUBLIC_` 前缀，会被打进客户端包 | `http://localhost:3000` |

> **不要**把 `SESSION_SECRET` 写到代码或 README 里，它能直接伪造任何后台用户的 session cookie。

`.env` 已在 `.gitignore` 里（见 `.gitignore:30-33`），仓库里只提交 `.env.example` 模板。

### 1.3 首次启动 5 步

```bash
# 1) 拉代码 & 装依赖
git clone <repo-url> chemical-bag-quote
cd chemical-bag-quote
npm install

# 2) 准备环境变量
cp .env.example .env
# 编辑 .env：把 SESSION_SECRET 换成 openssl rand -base64 32 的输出
# DATABASE_URL 保持 file:./dev.db 即可

# 3) 应用数据库迁移（创建 SQLite 文件 + 5 张表）
npm run db:migrate
#   ↑ 这条会读 prisma/migrations/ 下的版本，落到 prisma/dev.db
#   ↑ 顺带触发 prisma generate，生成 @prisma/client 类型

# 4) 灌入示例数据（管理员 admin/admin123 + 2 型号 / 2 尺寸 / 2 材质 / 4 SKU）
npm run db:seed

# 5) 启动开发服
npm run dev
#   → http://localhost:3000        C 端报价计算器
#   → http://localhost:3000/admin  后台（用 admin / admin123 登录）
```

跑完第 4 步后，C 端就能看见联动下拉、能出价了；后台登录后能看见 4 条 SKU。

### 1.4 常用脚本

`package.json` 里已经有的脚本（不用再加）：

| 脚本 | 命令 | 用途 |
|---|---|---|
| `dev` | `next dev` | 开发服务器（含热重载） |
| `build` | `next build` | 生产构建（生成 `.next/`） |
| `start` | `next start` | 启动构建产物（端口默认 3000） |
| `lint` | `next lint` | ESLint 检查 |
| `typecheck` | `tsc --noEmit` | 不生成 JS，只跑类型检查 |
| `db:generate` | `prisma generate` | 重新生成 `@prisma/client` 类型（改完 schema 跑） |
| `db:migrate` | `prisma migrate dev` | 应用迁移到 dev DB；schema 有新改动时会让你给迁移命名 |
| `db:reset` | `prisma migrate reset` | **会删库重建**，重跑所有迁移并执行 seed。**仅开发用** |
| `db:studio` | `prisma studio` | 打开 5555 端口的可视化数据库面板 |
| `db:seed` | `tsx prisma/seed.ts` | 单独跑种子（已被 `prisma migrate reset` 自动调用） |

### 1.5 默认管理员账号

`prisma/seed.ts` 写死了一条：

| 字段 | 值 |
|---|---|
| 用户名 | `admin` |
| 密码 | `admin123` |
| 角色 | `ADMIN` |

> ⚠️ **生产环境部署后第一件事**：登录后台 → `/admin/users` → 新建一个真实管理员（密码 ≥ 8 位）→ 用新管理员登录 → 把默认 `admin` 账号停用。`admin123` 这种弱密码不要带到生产。

### 1.6 SQLite 与 PostgreSQL 的切换

**开发期**：保持 `provider = "sqlite"`、`DATABASE_URL = "file:./dev.db"`，零依赖。

**生产期**（需要并发写、需要 `Decimal` 精确金额）：改 `prisma/schema.prisma` 的 datasource：

```diff
 datasource db {
-  provider = "sqlite"
+  provider = "postgresql"
   url      = env("DATABASE_URL")
 }
```

接着把 schema 里 SQLite 兼容的妥协改回 Postgres 原生类型（详见 `docs/02-database-design.md`）：

- `Price.unitPrice`：`Float` → `Decimal @db.Decimal(10, 2)`（避免浮点舍入丢钱）
- `AdminUser.role`：`String` → 改回 Prisma enum（`enum Role { ADMIN STAFF }`），同时删掉 `src/lib/roles.ts` 里 SQLite 解释层

然后：

```bash
# 切到生产数据库
DATABASE_URL="postgresql://user:pass@host:5432/cbq?schema=public" \
  npx prisma migrate deploy

# 首次需要灌种子（仅一次！别在已有数据的库上跑 seed）
DATABASE_URL="postgresql://..." npx tsx prisma/seed.ts
```

> `prisma migrate deploy` 与 `migrate dev` 的区别：deploy 不会生成新迁移、不会提示重命名，专给 CI / 生产用；`dev` 是开发交互式工具。生产环境**永远**用 `deploy`。

### 1.7 自检清单（跑通本章后应该满足）

- [ ] `npm run typecheck` 通过
- [ ] `npm run dev` 启动后访问 `/` 看到联动下拉，能选完三步出价
- [ ] `/admin/login` 用 `admin / admin123` 能登录
- [ ] 登录后 `/admin/prices` 能看到 4 条 SKU
- [ ] `prisma/dev.db` 文件存在（约几十 KB）
- [ ] `.env` 里的 `SESSION_SECRET` 已改成你自己生成的 32+ 字符随机串

第 1 步全部就绪。下一章讲怎么把这套东西推到 Vercel。
