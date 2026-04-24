# 《API 接口文档》—— 化工包装袋报价系统

> 版本：v0.1（Phase 1 草案）
> 日期：2026-04-24
> 关联文档：`docs/01-prd.md`、`docs/02-database-design.md`
> 实现技术：Next.js App Router 的 Route Handlers（`src/app/api/**/route.ts`）

---

## 0. 通用约定

### 0.1 路径分组

| 前缀 | 用途 | 鉴权 |
|---|---|---|
| `/api/public/*` | C 端（采购客户）只读 | **不需要** |
| `/api/admin/*`  | B 端后台读写 | **需要**（Cookie Session） |
| `/api/auth/*`   | 后台登录 / 注销 / 当前用户 | 部分需要 |

### 0.2 数据格式

- 请求体：`Content-Type: application/json; charset=utf-8`
- 响应体：JSON
- 时间字段：ISO 8601 字符串（如 `"2026-04-24T03:14:15.926Z"`）
- 金额字段：number（开发期 SQLite 用 Float；切到 PostgreSQL 后改 string 以避免精度丢失）
- ID：cuid 字符串

### 0.3 响应规范

**成功**：HTTP `2xx` + 直接返回业务数据。

```json
// 例：GET /api/public/models
[
  { "id": "ck...", "code": "FFS-25", "name": "FFS 重包装袋" }
]
```

**失败**：HTTP `4xx` / `5xx` + 统一错误体：

```json
{
  "error": {
    "code": "DUPLICATE_PRICE",
    "message": "该 (型号, 尺寸, 材质) 组合已存在价格"
  }
}
```

### 0.4 错误码表

| code | HTTP | 含义 |
|---|---|---|
| `BAD_REQUEST` | 400 | 参数缺失 / 类型错误 |
| `UNAUTHORIZED` | 401 | 未登录或 session 失效 |
| `FORBIDDEN` | 403 | 已登录但无权限（如 STAFF 访问用户管理） |
| `NOT_FOUND` | 404 | 资源不存在 |
| `DUPLICATE_PRICE` | 422 | Price 三元组冲突 |
| `DUPLICATE_NAME` | 422 | Model.code / Size.name / Material.name 等唯一字段冲突 |
| `VALIDATION_ERROR` | 422 | 业务校验失败（详情见 `error.details`） |
| `INTERNAL_ERROR` | 500 | 服务端异常 |

### 0.5 列表分页

所有列表型 GET 接口均支持：

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `page` | int | 1 | 从 1 开始 |
| `pageSize` | int | 20 | 上限 100 |

分页响应统一结构：

```json
{
  "items": [ /* ... */ ],
  "page": 1,
  "pageSize": 20,
  "total": 137
}
```

### 0.6 鉴权

- 登录后服务端下发 **HttpOnly Cookie**：`session=<token>`
- 所有 `/api/admin/*` 请求自动携带；服务端中间件校验
- 未登录 → 401，前端拦截后跳转 `/admin/login`

---

## 1. C 端公开接口（`/api/public`）

### 1.1 获取所有可用型号

```
GET /api/public/models
```

**响应** `200`：

```json
[
  {
    "id": "ckxx1",
    "code": "FFS-25",
    "name": "FFS 重包装袋",
    "description": "适合 25kg 化工原料",
    "sortOrder": 0
  }
]
```

> 仅返回 `isActive=true` 的型号，按 `sortOrder` 升序。

---

### 1.2 获取指定型号下的可选尺寸

```
GET /api/public/sizes?modelId={modelId}
```

**Query 参数**

| 名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| modelId | string | ✅ | Model.id |

**响应** `200`：

```json
[
  {
    "id": "ckxx2",
    "name": "800×1200mm",
    "width": 800,
    "height": 1200,
    "gusset": null,
    "unit": "mm"
  }
]
```

**说明**：仅返回「在 `Price` 表中与该 modelId 至少存在一条 `isActive=true` 价格」的尺寸；按 `Size.sortOrder` 升序，去重。

---

### 1.3 获取指定型号 + 尺寸下的可选材质

```
GET /api/public/materials?modelId={modelId}&sizeId={sizeId}
```

**响应** `200`：

```json
[
  {
    "id": "ckxx3",
    "name": "PP 编织 + PE 内膜",
    "description": "防潮，承重 50kg"
  }
]
```

---

### 1.4 获取最终报价

```
GET /api/public/quote?modelId={...}&sizeId={...}&materialId={...}&quantity={int?}
```

**Query 参数**

| 名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| modelId | string | ✅ | — |
| sizeId | string | ✅ | — |
| materialId | string | ✅ | — |
| quantity | int | ❌ | 不传时仅返回单价，不返回 totalPrice |

**响应** `200`（找到价格）：

```json
{
  "modelId": "ckxx1",
  "sizeId": "ckxx2",
  "materialId": "ckxx3",
  "unitPrice": 3.85,
  "currency": "CNY",
  "moq": 1000,
  "remark": "不含税，量大可议",
  "quantity": 5000,
  "totalPrice": 19250.00,
  "belowMoq": false,
  "quotedAt": "2026-04-24T03:14:15.926Z"
}
```

**响应** `404`（组合无报价）：

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "该组合暂未配置报价"
  }
}
```

**业务规则**：
- `totalPrice = unitPrice * quantity`，仅在 `quantity > 0` 时返回。
- `belowMoq = quantity != null && moq != null && quantity < moq`。

---

## 2. 后台鉴权（`/api/auth`）

### 2.1 登录

```
POST /api/auth/login
```

**请求体**

```json
{ "username": "admin", "password": "******" }
```

**响应** `200`：

```json
{
  "id": "ckusr1",
  "username": "admin",
  "displayName": "张三",
  "role": "ADMIN"
}
```

副作用：下发 `Set-Cookie: session=<token>; HttpOnly; SameSite=Lax; Path=/; Max-Age=...`

**失败** `401`：

```json
{ "error": { "code": "UNAUTHORIZED", "message": "用户名或密码错误" } }
```

### 2.2 注销

```
POST /api/auth/logout
```

**响应** `204`，并清除 Cookie。

### 2.3 当前用户

```
GET /api/auth/me
```

**响应** `200`：同 2.1 成功体。
**未登录** `401`。

---

## 3. 后台业务接口（`/api/admin`）

> 以下接口均需登录；标注 `[ADMIN]` 的仅 ADMIN 角色可调用。

### 3.1 型号 Models

#### `GET /api/admin/models`

**Query**：`page`, `pageSize`, `keyword`（可选，模糊匹配 code/name）, `isActive`（可选，true/false）

**响应** `200`：分页结构，items 为完整 Model 对象（含全部字段）。

#### `POST /api/admin/models`

**请求体**

```json
{
  "code": "FFS-25",
  "name": "FFS 重包装袋",
  "description": "适合 25kg 化工原料",
  "isActive": true,
  "sortOrder": 0
}
```

**响应** `201`：完整 Model 对象。
**冲突** `422` → `DUPLICATE_NAME`（code 已存在）。

#### `GET /api/admin/models/{id}`

**响应** `200`：完整 Model 对象。
**404** 未找到。

#### `PATCH /api/admin/models/{id}`

**请求体**：上述字段的子集（部分更新）。
**响应** `200`：更新后的 Model 对象。

#### `DELETE /api/admin/models/{id}`

**响应** `204`。**副作用**：级联删除该型号下所有 Price。

---

### 3.2 尺寸 Sizes

接口形态与 3.1 完全一致，路径 `/api/admin/sizes`。

**新增请求体示例**

```json
{
  "name": "800×1200mm",
  "width": 800,
  "height": 1200,
  "gusset": null,
  "unit": "mm",
  "isActive": true,
  "sortOrder": 0
}
```

---

### 3.3 材质 Materials

接口形态同上，路径 `/api/admin/materials`。

**新增请求体示例**

```json
{
  "name": "PP 编织 + PE 内膜",
  "description": "防潮，承重 50kg",
  "isActive": true,
  "sortOrder": 0
}
```

---

### 3.4 价格 Prices（核心）

#### `GET /api/admin/prices`

**Query**

| 名 | 类型 | 说明 |
|---|---|---|
| page / pageSize | int | 分页 |
| modelId | string? | 按型号过滤 |
| sizeId | string? | 按尺寸过滤 |
| materialId | string? | 按材质过滤 |
| isActive | bool? | 上下架过滤 |

**响应** `200`：分页结构，items 形如：

```json
{
  "id": "ckp1",
  "modelId": "ckxx1",
  "sizeId": "ckxx2",
  "materialId": "ckxx3",
  "unitPrice": 3.85,
  "currency": "CNY",
  "moq": 1000,
  "remark": "不含税",
  "isActive": true,
  "createdAt": "2026-04-24T...",
  "updatedAt": "2026-04-24T...",
  "model": { "id": "ckxx1", "code": "FFS-25", "name": "FFS 重包装袋" },
  "size":  { "id": "ckxx2", "name": "800×1200mm" },
  "material": { "id": "ckxx3", "name": "PP 编织 + PE 内膜" }
}
```

> `model / size / material` 三个嵌套对象由服务端 join 返回，避免前端 N+1 查询。

#### `POST /api/admin/prices`

**请求体**

```json
{
  "modelId": "ckxx1",
  "sizeId": "ckxx2",
  "materialId": "ckxx3",
  "unitPrice": 3.85,
  "currency": "CNY",
  "moq": 1000,
  "remark": "不含税",
  "isActive": true
}
```

**响应** `201`：完整 Price 对象（含三个嵌套对象）。
**冲突** `422` → `DUPLICATE_PRICE`：

```json
{
  "error": {
    "code": "DUPLICATE_PRICE",
    "message": "该 (型号, 尺寸, 材质) 组合已存在价格",
    "details": { "existingPriceId": "ckp7" }
  }
}
```

#### `GET /api/admin/prices/{id}`

**响应** `200`：单条 Price（含 join）。

#### `PATCH /api/admin/prices/{id}`

**请求体**：可更新 `unitPrice / currency / moq / remark / isActive`。
> **不允许**修改三元组（modelId/sizeId/materialId）。如需变更请删除后重建。

#### `DELETE /api/admin/prices/{id}`

**响应** `204`。

#### `POST /api/admin/prices/batch-toggle`

批量上下架。

**请求体**

```json
{ "ids": ["ckp1", "ckp2"], "isActive": false }
```

**响应** `200`：

```json
{ "updated": 2 }
```

---

### 3.5 后台用户 Users `[ADMIN]`

#### `GET /api/admin/users`

分页列表，items 为 AdminUser（**不含 passwordHash**）。

#### `POST /api/admin/users`

**请求体**

```json
{
  "username": "sales01",
  "password": "Init@1234",
  "displayName": "李四",
  "role": "STAFF"
}
```

服务端 bcrypt(password) → passwordHash。

#### `PATCH /api/admin/users/{id}`

**请求体**：可更新 `displayName / role / isActive`，**不允许**直接改 username；改密码请走专用接口（v2 实现）。

#### `DELETE /api/admin/users/{id}`

软删除：实际执行 `isActive=false`，避免误删导致 session 异常。

---

## 4. 接口与文件路径映射（Phase 2 实现指引）

| 路径 | 文件 |
|---|---|
| `GET /api/public/models` | `src/app/api/public/models/route.ts` |
| `GET /api/public/sizes` | `src/app/api/public/sizes/route.ts` |
| `GET /api/public/materials` | `src/app/api/public/materials/route.ts` |
| `GET /api/public/quote` | `src/app/api/public/quote/route.ts` |
| `POST /api/auth/login` | `src/app/api/auth/login/route.ts` |
| `POST /api/auth/logout` | `src/app/api/auth/logout/route.ts` |
| `GET /api/auth/me` | `src/app/api/auth/me/route.ts` |
| `GET/POST /api/admin/models` | `src/app/api/admin/models/route.ts` |
| `GET/PATCH/DELETE /api/admin/models/{id}` | `src/app/api/admin/models/[id]/route.ts` |
| Sizes / Materials | 同上结构，路径替换 |
| `GET/POST /api/admin/prices` | `src/app/api/admin/prices/route.ts` |
| `GET/PATCH/DELETE /api/admin/prices/{id}` | `src/app/api/admin/prices/[id]/route.ts` |
| `POST /api/admin/prices/batch-toggle` | `src/app/api/admin/prices/batch-toggle/route.ts` |
| Users | `src/app/api/admin/users/...` |

鉴权中间件统一在 `src/middleware.ts` 处理 `/api/admin/*` 前缀。

---

## 5. 调用示例（cURL）

```bash
# 1. C 端联动查询
curl 'https://your.domain/api/public/models'
curl 'https://your.domain/api/public/sizes?modelId=ckxx1'
curl 'https://your.domain/api/public/materials?modelId=ckxx1&sizeId=ckxx2'
curl 'https://your.domain/api/public/quote?modelId=ckxx1&sizeId=ckxx2&materialId=ckxx3&quantity=5000'

# 2. 后台登录 → 拿 cookie 后访问 admin
curl -c cookies.txt -X POST 'https://your.domain/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"changeme"}'

curl -b cookies.txt 'https://your.domain/api/admin/prices?modelId=ckxx1'

# 3. 新增价格
curl -b cookies.txt -X POST 'https://your.domain/api/admin/prices' \
  -H 'Content-Type: application/json' \
  -d '{"modelId":"ckxx1","sizeId":"ckxx2","materialId":"ckxx3","unitPrice":3.85,"moq":1000}'
```

---

## 6. 待与业务方确认的接口级问题

| # | 问题 | 影响接口 |
|---|---|---|
| A1 | `/api/public/quote` 是否需要打日志（写一张 `InquiryLog` 表）以便销售跟进？ | `quote` 写入路径增加 |
| A2 | C 端 `/api/public/quote` 是否需要节流 / 风控（避免被爬全价格表）？ | 全部 public 接口可能加 IP 限流 |
| A3 | 后台是否需要「按型号一键导出 Excel 价格表」？ | 新增 `GET /api/admin/prices/export` |
| A4 | 是否要让销售直接生成「带预填参数的 C 端链接」做精准转发？ | 可在 C 端支持 query 预填，无需新增 API |
