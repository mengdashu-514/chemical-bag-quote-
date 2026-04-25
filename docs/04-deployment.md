# 《部署与运维手册》—— 化工包装袋报价系统

> 版本：v0.1（Phase 5）
> 日期：2026-04-25
> 关联文档：`docs/01-prd.md`、`docs/02-database-design.md`、`docs/03-api-spec.md`
> 适用项目根目录：`报价/`

本手册四章逐层覆盖：

1. 环境变量与本地启动
2. Vercel 部署
3. Docker 自托管
4. **运维 / 故障排查 / 升级手册**（本章）

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

---

## 3. Docker 自托管

### 3.1 适用场景

国内用户为主、数据要落自家机房 / 阿里云 / 腾讯云、需要可掌控的备份策略——这套用 Docker。一台 2 核 4G 的 VPS 跑 app + Postgres 单机就够撑 v1。

仓库根已经备好：

| 文件 | 作用 |
|---|---|
| `Dockerfile` | 多阶段构建（deps → builder → runner），输出 ~150MB 镜像 |
| `docker-entrypoint.sh` | 容器启动时先 `prisma migrate deploy` 再 `exec node server.js` |
| `docker-compose.yml` | app + Postgres 16 + 命名卷 + healthcheck，一键起 |
| `.dockerignore` | 防止 `node_modules` / `.next` / `.env` 进上下文 |

`next.config.mjs` 里已经开了 `output: "standalone"`，build 产物会被精简成自含的 server——Vercel 不受影响。

### 3.2 前置：Prisma schema 必须切到 PostgreSQL

Docker 跑的也是 Postgres，所以**先按 §2.2.1 把 `prisma/schema.prisma` 改成 `provider = "postgresql"` 并产生新的 Postgres 迁移**。否则 `docker-entrypoint.sh` 里那条 `prisma migrate deploy` 会因为方言不匹配（SQLite 的 `DATETIME`/`REAL`）失败。

### 3.3 环境变量

`docker-compose.yml` 从执行目录的 `.env` 文件读以下三项（`compose` 默认行为）：

| 变量 | 必填 | 说明 |
|---|---|---|
| `SESSION_SECRET` | ✅ | 用于签 cookie；compose 用了 `${SESSION_SECRET:?...}` 形式，缺失则启动报错 |
| `POSTGRES_PASSWORD` | 推荐 | Postgres `cbq` 用户的密码；不设会用占位 `cbq_dev_pwd_change_me`，生产**必须**改 |
| `NEXT_PUBLIC_SITE_URL` | 否 | 缺省 `http://localhost:3000` |
| `APP_PORT` | 否 | 宿主机暴露端口，缺省 3000 |

> Postgres 端口（5432）**没有**暴露到宿主机——容器间走 Docker 网络访问。需要本地工具直连调试时再单独加端口（见 §3.7）。

最小 `.env`：

```bash
# 生成强随机串
openssl rand -base64 32
# 写到 .env 里
SESSION_SECRET=<上一步输出>
POSTGRES_PASSWORD=<另一串强密码>
NEXT_PUBLIC_SITE_URL=https://cbq.your-domain.com
APP_PORT=3000
```

### 3.4 一键启动

```bash
# 首次构建会拉 node:20-alpine + postgres:16-alpine + npm ci，5~10 分钟左右
docker compose up -d --build

# 看日志确认启动顺序：db healthy → app entrypoint 跑迁移 → next server listen
docker compose logs -f app
```

> 如果你的项目目录含**非 ASCII 字符**（如中文 `报价/`），Compose 会报 `project name must not be empty`。给所有 `docker compose ...` 都加上 `-p cbq` 即可（会被用作项目名），如：`docker compose -p cbq up -d --build`。

期望看到的关键行：

```
[entrypoint] running prisma migrate deploy...
All migrations have been successfully applied.
[entrypoint] starting next server: node server.js
   ▲ Next.js 15.x  ... started server on 0.0.0.0:3000
```

容器跑起来之后，访问 `http://<host>:${APP_PORT}/` 应该能看到 C 端首页。

### 3.5 首次部署后的硬化（必做，与 §2.7 同样的步骤）

数据库现在是空的，先灌种子拿到默认管理员，然后立刻替换：

```bash
# 在 app 容器里跑 seed（一次即可，跑两次会上报 unique 冲突）
docker compose exec app npx tsx prisma/seed.ts
```

成功后：

1. 浏览器开 `/admin/login` 用 `admin / admin123` 登入。
2. 进 `/admin/users` → 新建真实管理员（强密码 ≥ 16 位）。
3. 用新管理员登录 → 把 `admin` 账号停用。

### 3.6 反向代理 / TLS

容器只听 3000，**不要**直接把 3000 暴露到公网——session cookie 默认 `secure: NODE_ENV === "production"`，没有 HTTPS 时浏览器会拒绝携带，导致登录后立刻被踢。

正确姿势：

- 用 Caddy（最省事，自动 Let's Encrypt）：
  ```caddyfile
  cbq.your-domain.com {
      reverse_proxy 127.0.0.1:3000
  }
  ```
- 或 Nginx + certbot，转发到 `127.0.0.1:3000`。

设置完反向代理后，`NEXT_PUBLIC_SITE_URL` 改成 `https://...`，重启 app 容器。

### 3.7 调试小贴士

| 场景 | 做法 |
|---|---|
| 想用 DBeaver / TablePlus 直连 Postgres | 临时 `docker compose run --rm --service-ports db`，或在 compose 里把 `expose: ["5432"]` 改成 `ports: ["5432:5432"]` 后只对内网开放 |
| 应用代码改了想重新部署 | `docker compose up -d --build app`（只重建 app，db 保留数据） |
| 想清空数据从头来 | `docker compose down -v` —— **`-v` 会删掉命名卷 `cbq_pg_data`，整库丢失**，确认后再敲 |
| 看 Prisma 慢查询 | `DEBUG=prisma:query` 注入到 app 服务的 `environment` 里，重启 app |

### 3.8 升级流程（已经在线，要发新版本）

```bash
git pull
# 如果本次有 schema 改动：本地先 prisma migrate dev 产生新迁移并 commit；
# 这里只跑 build + 启动，entrypoint 自己会 migrate deploy
docker compose up -d --build app
docker compose logs -f app   # 确认迁移行通过、首请求 200
```

如果迁移会破坏旧版（如 drop 列），**先停旧版再起新版**：

```bash
docker compose stop app
docker compose up -d --build app
```

### 3.9 自检清单

- [ ] `docker compose ps` 两个服务都是 `running` / `healthy`
- [ ] `docker compose logs app | grep "All migrations have been successfully applied"` 有匹配
- [ ] 反向代理配置完，`https://...` 能访问 C 端首页
- [ ] 真实管理员能登录，`admin / admin123` 已停用
- [ ] `.env` 文件本机权限 `chmod 600`，不在备份里裸传

---

## 4. 运维 / 故障排查 / 升级手册

> 这一章假设你已经按 §2 或 §3 把项目部署上线了。以下是上线**之后**会反复用到的操作清单。

### 4.1 看日志

#### Vercel 部署

| 入口 | 内容 |
|---|---|
| Project → **Deployments** → 选某次部署 → **Build Logs** | `prisma generate` / `migrate deploy` / `next build` 的输出 |
| Project → **Logs** | Function 运行时日志，按 path 过滤；`/api/admin/*` 报 500 时来这里捞 stack |
| Project → **Logs** → 选时间范围 → **Live** | 实时尾随，调试登录 / 报价异常时打开 |

代码里 catch 到未知错误时会 `console.error("[GET /api/admin/...]", err)`（见 `src/lib/crud-helpers.ts:81`），日志里搜对应路径就能定位。

#### Docker 自托管

```bash
# 全部服务实时日志
docker compose logs -f

# 只看应用，过去 200 行
docker compose logs --tail=200 app

# 只看 db 启动健康状态
docker compose logs db | grep -E "ready to accept|failed"
```

容器外只想观察活体状态：

```bash
docker compose ps                       # 哪个服务挂了一目了然
docker stats --no-stream                # CPU / 内存占用
docker compose exec db pg_isready       # Postgres 探活
```

### 4.2 重置某个管理员的密码

当前 v1 **没有**自助改密接口（PRD §B 列在 v2）。运维只有两种正解：

**方案 A：删了重建（推荐）**

1. 用别的 ADMIN 账号登录 → `/admin/users` → 把目标账号"停用"（已经是软删，username 仍占用，不能复用）
2. 新建一个同岗位、新 username 的账号给当事人
3. 旧账号永久停用即可

**方案 B：直接改 `passwordHash`（仅限只剩唯一 ADMIN 账号且自己也忘了密码）**

```bash
# 在 Docker 自托管：进 app 容器
docker compose exec app node -e '
  const bcrypt = require("bcryptjs");
  const { PrismaClient } = require("@prisma/client");
  const p = new PrismaClient();
  (async () => {
    const hash = await bcrypt.hash(process.env.NEW_PASSWORD, 10);
    const r = await p.adminUser.update({
      where: { username: process.env.TARGET_USERNAME },
      data: { passwordHash: hash, isActive: true },
    });
    console.log("updated:", r.username);
    await p.$disconnect();
  })();
' \
  TARGET_USERNAME=admin \
  NEW_PASSWORD='Reset!New_Pwd_2026'

# Vercel 部署：本地用生产 DATABASE_URL 跑同一段
DATABASE_URL="$(grep '^POSTGRES_PRISMA_URL=' .env.production.local | cut -d= -f2-)" \
  TARGET_USERNAME=admin \
  NEW_PASSWORD='Reset!New_Pwd_2026' \
  npx tsx -e '... 上面的脚本主体 ...'
```

> 走 B 之后，请立刻让当事人登录修改身份信息或改用 A 流程把账号轮换。bcrypt 强度（cost=10）继承 `src/app/api/admin/users/route.ts:67` 的设定，与日常注册一致。

### 4.3 错误码 → 定位手册

`src/lib/api-response.ts:3-22` 已经枚举了 8 个错误码。用户在浏览器开发者工具里看到的 `error.code`，按下表反查：

| `error.code` | HTTP | 最常见原因 | 第一时间该查哪 |
|---|---|---|---|
| `BAD_REQUEST` | 400 | 请求体不是合法 JSON / 路由 ID 格式不对 / 改自己 role | 客户端请求体；middleware/路由参数解析 |
| `UNAUTHORIZED` | 401 | session cookie 过期、被 destroy（用户已停用） | `src/lib/session-config.ts` 的 `maxAge`；用户表 `isActive` |
| `FORBIDDEN` | 403 | STAFF 调 `/api/admin/users` | `src/middleware.ts:21-29` |
| `NOT_FOUND` | 404 | 删除时已被别人先删；C 端 `/api/public/quote` 命中下架价格 | DB 当前数据 |
| `DUPLICATE_PRICE` | 422 | 已有 `(modelId, sizeId, materialId)` 三元组 | `crud-helpers.ts:43-54`；前端会引导改去编辑 |
| `DUPLICATE_NAME` | 422 | `Model.code` / `Size.name` / `Material.name` / `AdminUser.username` 撞唯一索引 | `crud-helpers.ts:55-61` |
| `VALIDATION_ERROR` | 422 | zod 校验失败；`details` 里有字段级原因 | 客户端表单；`src/lib/validators.ts` |
| `INTERNAL_ERROR` | 500 | catch-all：未识别的 Prisma 错误 / 编程问题 | 服务端日志（§4.1）；带 `[contextTag]` 前缀 |

> Prisma 错误码 `P2002 / P2003 / P2025` 已在 `crud-helpers.ts:35-71` 转译过，新增了未见过的码请按同一处补全，不要让原始 Prisma 异常裸抛给前端。

### 4.4 备份与恢复

**Postgres 是唯一有状态数据**——备份它就行（应用容器无状态）。

#### Docker 自托管：每天 cron 一份 dump

```bash
# /etc/cron.d/cbq-backup —— root 用户
0 3 * * * cd /opt/cbq && \
  docker compose exec -T db pg_dump -U cbq -d cbq -Fc \
    > /var/backups/cbq/cbq-$(date +\%F).dump && \
  find /var/backups/cbq -name "cbq-*.dump" -mtime +30 -delete
```

`-Fc`（custom format）比明文 SQL 体积小、可以用 `pg_restore` 选择性恢复。**保留 30 天**，按业务可调。

恢复：

```bash
# 假设要恢复 2026-04-25 的快照到当前 db
docker compose exec -T db pg_restore -U cbq -d cbq --clean --if-exists \
  < /var/backups/cbq/cbq-2026-04-25.dump
```

> `--clean --if-exists`：先 DROP 再 CREATE，避免与现有表冲突。**这条命令会清掉当前数据**，确认后再敲。

#### Vercel Postgres：用 Storage 控制台

Storage → 选你的 Postgres → **Backups**。Vercel Postgres 默认每天自动一次快照，保留 7 天；可点击恢复到新数据库（不能直接覆盖原库）。需要更长保留期或异地备份，改用外部脚本：

```bash
# 用 vercel env pull 拿到 POSTGRES_URL_NON_POOLING（不能走 PgBouncer）
vercel env pull .env.production.local
DATABASE_URL_PG="$(grep '^POSTGRES_URL_NON_POOLING=' .env.production.local | cut -d= -f2-)"
pg_dump "$DATABASE_URL_PG" -Fc > cbq-$(date +%F).dump
rm .env.production.local   # 含连接密码，跑完立刻删
```

### 4.5 SQLite → PostgreSQL 数据迁移（如果开发期已经积了真实数据）

> 大多数情况下 v1 上线前 SQLite 数据是开发的"垃圾数据"，**直接重建 + 重灌种子**最快。下面这段只在你**真的**要把 SQLite 里的运营数据搬到生产时用。

```bash
# 1. 在 SQLite 库上导出每张表为 JSON（用 prisma studio 或 sqlite3 .dump 都行）
# 这里给一段 tsx 脚本思路：
DATABASE_URL="file:./prisma/dev.db" npx tsx -e '
  const { PrismaClient } = require("@prisma/client");
  const fs = require("fs");
  const p = new PrismaClient();
  (async () => {
    const out = {
      models: await p.model.findMany(),
      sizes: await p.size.findMany(),
      materials: await p.material.findMany(),
      prices: await p.price.findMany(),
      adminUsers: await p.adminUser.findMany(),
    };
    fs.writeFileSync("dump.json", JSON.stringify(out, null, 2));
    await p.$disconnect();
  })();
'

# 2. 在 Postgres 库上反向导入（注意 ID 全字段保留，避免外键失效）
DATABASE_URL="postgresql://..." npx tsx -e '
  const { PrismaClient } = require("@prisma/client");
  const fs = require("fs");
  const p = new PrismaClient();
  const data = JSON.parse(fs.readFileSync("dump.json", "utf8"));
  (async () => {
    // 顺序：先建基础库再建价格，避免外键炸
    for (const m of data.models)    await p.model.create({ data: m });
    for (const s of data.sizes)     await p.size.create({ data: s });
    for (const m of data.materials) await p.material.create({ data: m });
    for (const pr of data.prices)   await p.price.create({ data: pr });
    for (const u of data.adminUsers) await p.adminUser.create({ data: u });
    console.log("import done");
    await p.$disconnect();
  })();
'

# 3. 立刻删掉 dump.json —— 它含 passwordHash
shred -u dump.json   # Linux；macOS 用 rm -P dump.json
```

### 4.6 版本升级与回滚

#### 升级（已经在线，要发新版本）

```bash
# 1. 拉新代码
git pull

# 2. 必看：本次有没有 schema 改动？
git diff <prev-tag>..HEAD -- prisma/migrations
#    有新迁移文件 → entrypoint 会自动应用；继续即可
#    有破坏性 DDL（drop column 等）→ 务必先备份（§4.4）

# 3. 触发部署
#    Vercel：git push 即可，Vercel 自动重新构建
#    Docker：docker compose up -d --build app
```

#### 回滚（新版本上线后炸了）

| 部署方式 | 回滚操作 |
|---|---|
| Vercel | Project → Deployments → 找上一个 ✅ Production → **Promote to Production**（秒级回滚，不重 build） |
| Docker | `git checkout <prev-tag> && docker compose up -d --build app` |

**数据库回滚特别注意**：Prisma migrate 没有自动 down 脚本。如果新版本里跑了破坏性迁移（drop / rename），代码回滚 ≠ schema 回滚，旧版本可能跑不动新 schema。**结论**：

1. 上线**破坏性**迁移前，永远先备份一份 dump（§4.4）。
2. 真出事 → 代码回滚 + 用 dump 把库恢复到迁移前。
3. 之后再排查为什么新迁移失败。

### 4.7 常见疑难一句话定位

| 现象 | 第一嫌疑 |
|---|---|
| C 端首页空白 / 接口 500 | DATABASE_URL 缺失或连不上；查 §4.1 日志 |
| 登录后立刻被踢 / `/api/auth/me` 401 | 反向代理没开 HTTPS，cookie 因 `secure: true` 没回传（§3.6） |
| 登录返回"用户名或密码错误"但密码确认正确 | 该账号 `isActive=false`；§4.2 重置或换账号 |
| `/api/admin/*` 全 401 | `SESSION_SECRET` 不一致（重启前后变了，老 cookie 全部失效） |
| build 时 "Could not load query engine" | Prisma 运行时缺 alpine 引擎；schema 里加 `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` 后重 build |
| `prisma migrate deploy` 在 Vercel 报 "prepared statement" | DATABASE_URL 走了 PgBouncer 池化连接；按 §2.4 加 `DIRECT_URL` |
| 后台改了价格但 C 端还看得见旧的 | 同一账号下 Service Worker 缓存（v1 没注册）通常不是问题；先排查是否点了"下架"而不是"删除" |

### 4.8 升级路线图（v2 候选）

PRD §3.2 列了不在 v1 范围的事项；v2 上来运维侧最值得做的：

- 操作审计日志（谁在何时改了哪条价格）—— 上线前先建表，再加路由级中间件
- C 端询价日志（写 `InquiryLog`，给销售跟进）—— API 规范 §6.A1 已经预留
- 价格历史曲线 —— 用 audit 表回放即可
- Excel 批量导入 —— `/admin/prices/import` 上传 + zod 行级校验

这些都不影响 v1 已上线的服务，可灰度推进。

---

部署文档全部完成。配套阅读：`docs/01-prd.md`（业务边界）、`docs/02-database-design.md`（schema 决策）、`docs/03-api-spec.md`（接口契约）。
