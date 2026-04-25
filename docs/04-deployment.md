# 《部署与运维手册》—— 化工包装袋报价系统

> 版本：v0.1（Phase 5）
> 日期：2026-04-25
> 关联文档：`docs/01-prd.md`、`docs/02-database-design.md`、`docs/03-api-spec.md`
> 适用项目根目录：`报价/`

本手册四章逐层覆盖：

1. 环境变量与本地启动
2. **Vercel 部署**（本章）
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

---

## 2. Vercel 部署

### 2.1 先决条件 / 适用边界

Vercel 适合：用户主要在境外或对延迟不敏感、想要"零运维 + Git 推送即上线"。**不适合**：用户全在中国大陆且对首屏延迟敏感（Vercel 默认机房在美国，国内访问慢；中国大陆没有节点可选）—— 这种场景请直接用第 3 章 Docker 自托管。

不能保留 SQLite 上 Vercel：

- Vercel 的 Serverless 函数文件系统是只读 + 短生命周期，每次冷启都是新容器，`prisma/dev.db` 写不进去也不连续。
- 必须切到托管 PostgreSQL。下面默认用 **Vercel Postgres**（同账号一键开），自己接 Supabase / Neon / 阿里云 RDS 也是同样的连接串方式。

### 2.2 准备工作（在推 Vercel 之前完成）

#### 2.2.1 切换 Prisma datasource 到 PostgreSQL

按 §1.6 把 `prisma/schema.prisma` 改成 `provider = "postgresql"`，并把 SQLite 妥协改回原生类型（`Price.unitPrice` → `Decimal @db.Decimal(10, 2)`、`AdminUser.role` → 枚举），然后**生成新的 Postgres 迁移**：

```bash
# 用临时本地 Postgres 试一遍，确认迁移能跑通；用完即弃
docker run --rm -d --name pg-cbq -p 5432:5432 \
  -e POSTGRES_PASSWORD=devpwd -e POSTGRES_DB=cbq postgres:16
DATABASE_URL="postgresql://postgres:devpwd@localhost:5432/cbq?schema=public" \
  npx prisma migrate dev --name init_pg

# 确认 prisma/migrations/ 下新增了一条 *_init_pg/migration.sql
docker rm -f pg-cbq
```

把这条新迁移文件**也 commit 进去**——Vercel 构建时会调用 `prisma migrate deploy` 应用它。

> ⚠️ SQLite 时代生成的那条 `20260424060354_init/migration.sql` 是 SQLite 方言（`DATETIME`、`REAL`），不能直接拿到 Postgres 上跑。Postgres 必须有自己的迁移目录。**生产首次部署前**：要么删掉 SQLite 那条迁移只留 Postgres 版本（项目还没上线、可以重置历史），要么在新分支专门给生产用。本项目 v1 还没上线，推荐前者。

#### 2.2.2 让 build 自动跑 prisma generate + migrate deploy

Vercel 默认只跑 `npm run build`。Prisma 在 Serverless 环境**必须**在 build 阶段生成 client（不然运行时拿不到 `@prisma/client`），生产首次还要把迁移应用到数据库。改 `package.json` 的 build 脚本：

```diff
 "scripts": {
   "dev": "next dev",
-  "build": "next build",
+  "build": "prisma generate && prisma migrate deploy && next build",
   ...
 }
```

> 为什么把 `migrate deploy` 也塞进 build：Vercel 没有"运行一次"的钩子；放 build 里每次部署都会跑，但 `migrate deploy` 是幂等的（已应用的迁移会跳过），安全。

### 2.3 在 Vercel 控制台导入项目

1. 把代码推到 GitHub / GitLab / Bitbucket（任一）。
2. 登录 https://vercel.com → **Add New… → Project** → 选中代码仓库 → **Import**。
3. **Framework Preset** 自动识别为 **Next.js**，不用改。
4. **Root Directory**：如果仓库根就是项目根，留默认；如果项目放在 `chemical-bag-quote/` 子目录里，改成那个子目录。
5. **Build Command / Output Directory** 全部留默认（已经被 §2.2.2 改过的 `build` 脚本接管）。
6. 暂时**别**点 Deploy——先到 Storage 配 Postgres，否则首次 build 一定会因为 `DATABASE_URL` 缺失或连不上而 fail。

### 2.4 开通 Vercel Postgres 并挂到项目

在项目页面 → **Storage** → **Create** → 选 **Postgres** → 起个名（如 `cbq-prod`）→ 选 region（**Singapore (sin1)** 离中国最近，香港 / 国内访问尚可）→ Create。

创建后控制台会自动把这些环境变量注入到项目（**Production / Preview / Development** 三套环境都注入）：

```
POSTGRES_URL
POSTGRES_PRISMA_URL          ← 给 Prisma 用，含连接池参数
POSTGRES_URL_NON_POOLING     ← 给 migrate deploy 用，绕过 PgBouncer
POSTGRES_USER
POSTGRES_HOST
POSTGRES_PASSWORD
POSTGRES_DATABASE
```

我们的 schema 里只读 `DATABASE_URL`，所以再加两条**手动**环境变量来桥接：

| Vercel 环境变量名 | 值（**Reference** 选项里指向） |
|---|---|
| `DATABASE_URL` | `POSTGRES_PRISMA_URL` |
| `DIRECT_URL`（可选） | `POSTGRES_URL_NON_POOLING` |

> 如果用了 `DIRECT_URL`，记得在 schema datasource 里加上 `directUrl = env("DIRECT_URL")`，让 `migrate deploy` 走非池化连接（PgBouncer 不允许 prepared statements，迁移会出错）。

### 2.5 配齐其他环境变量

进 Project → **Settings → Environment Variables**，按下表逐条加，**Production / Preview / Development** 三栏都勾上：

| 变量 | 值 |
|---|---|
| `SESSION_SECRET` | `openssl rand -base64 32` 输出，≥ 32 字符 |
| `NEXT_PUBLIC_SITE_URL` | 部署后的正式域名，如 `https://cbq.your-domain.com`，无尾斜杠 |
| `DATABASE_URL` | 见 §2.4，引用 `POSTGRES_PRISMA_URL` |
| `DIRECT_URL`（可选） | 见 §2.4，引用 `POSTGRES_URL_NON_POOLING` |

> Preview 环境的 `SESSION_SECRET` 可以和 Production 不一样——这样预览站不会"借走"生产的登录态，更安全。

### 2.6 第一次部署

回到 **Deployments** 标签 → **Redeploy** 触发一次。盯着 build log，关键是这几行：

```
✓ Generated Prisma Client (...)        ← prisma generate 成功
✓ All migrations have been successfully applied  ← migrate deploy 成功
✓ Compiled successfully                ← next build 成功
```

任何一行红了就停下来回查 §2.2 / §2.4 / §2.5。Vercel 会保留全量 build log 30 天，可对照原始报错。

### 2.7 首次部署后的硬化（必做）

数据库刚迁好是空的——**还没有任何后台用户能登录**。在 Vercel CLI 或本地都行，跑一次 seed：

```bash
# 拉一份生产 DATABASE_URL（在 Vercel CLI 里）
vercel env pull .env.production.local

# 用生产连接串单跑一次 seed
DATABASE_URL="$(grep '^POSTGRES_PRISMA_URL=' .env.production.local | cut -d= -f2-)" \
  npx tsx prisma/seed.ts
```

跑完后立刻：

1. 用 `admin / admin123` 登一次 `/admin/login` 确认能进。
2. 进 `/admin/users`，**新建一个真实管理员**（独立用户名 + 强密码 ≥ 16 位）。
3. 用新管理员登录 → 把 `admin` 账号停用。
4. 把 `.env.production.local` **从本地删掉**——它含生产数据库直连密码。

### 2.8 Cold start 与函数超时

Vercel Serverless 的冷启对 Prisma 不算友好（首请求要拉 client、建连接池），首响应 P95 可能 1~2 秒。两个常用缓解：

1. **配置函数 region** 与 Postgres region 一致（都用 sin1），避免跨大洲来回。Project → Settings → Functions → **Function Region**。
2. **iron-session cookie 长一点**：`src/lib/session-config.ts` 里 `maxAge` 已经是 7 天，意味着销售/运营登录一次后基本不会重登，冷启只影响 C 端首屏——可以接受。

如果对延迟非常敏感（特别是中国大陆用户为主），就别死磕 Vercel，直接看第 3 章 Docker 自托管。

### 2.9 自检清单（部署完应该满足）

- [ ] Production 域名能打开，C 端首页拉得出"型号"下拉
- [ ] `/admin/login` 用新建的真实管理员账号能登录
- [ ] `admin / admin123` 已停用，登录返回"用户名或密码错误"
- [ ] `/admin/prices` 能列出种子数据（4 条 SKU）
- [ ] Vercel Build Log 里能看到 `prisma migrate deploy` 跑过
- [ ] `SESSION_SECRET` 在 Vercel 环境变量界面是 **Encrypted**，未在 build log 中明文打印
