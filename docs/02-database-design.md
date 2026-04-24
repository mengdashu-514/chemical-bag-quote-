# 《数据库设计文档》—— 化工包装袋报价系统

> 版本：v0.1（Phase 1 草案）
> 日期：2026-04-24
> 适用阶段：Phase 1 — 需求与数据模型设计
> 数据库：开发期 SQLite，生产期 PostgreSQL（通过 Prisma 一键切换）

---

## 1. 设计目标

围绕**「型号 → 尺寸 → 材质 → 价格」三级联动**这一核心业务流，建立可被 Prisma + Next.js 直接消费的关系模型。设计原则：

1. **三个维度独立成表**（Model / Size / Material），保证后台可单独 CRUD、可复用，避免冗余。
2. **价格集中在一张映射表**（`Price`），用「(型号+尺寸+材质)」三元组唯一定位一个 SKU 价格。
3. **联动逻辑由 `Price` 表驱动**：只要 `Price` 中存在某条 (M, S, Mat) 记录，前端联动选择器就把这个组合视为「可选 / 有报价」。这样后台无需另维护「型号下挂哪些尺寸 / 哪些材质」的关联表，**单点维护、自动联动**。
4. **后台用户与业务数据隔离**，便于后续接入鉴权与权限粒度。

---

## 2. 实体与字段（ER 概念层）

### 2.1 Model（型号 / 种类）
| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | String (cuid) | PK | 主键 |
| code | String | UNIQUE | 业务编码（如 `FFS-25`），便于销售口播 |
| name | String | NOT NULL | 中文名称（如 「FFS 重包装袋」） |
| description | String? | 可空 | 适用场景说明 |
| isActive | Boolean | 默认 true | 软下架开关 |
| sortOrder | Int | 默认 0 | C 端展示排序 |
| createdAt / updatedAt | DateTime | — | 审计字段 |

### 2.2 Size（尺寸）
| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | String (cuid) | PK | 主键 |
| name | String | UNIQUE | 显示名（如「800×1200mm」） |
| width | Float? | 可空 | 宽（mm） |
| height | Float? | 可空 | 高（mm） |
| gusset | Float? | 可空 | 侧封 / 风琴边（mm），化工袋常见 |
| unit | String | 默认 `mm` | 长度单位 |
| isActive | Boolean | 默认 true | — |
| sortOrder | Int | 默认 0 | — |
| createdAt / updatedAt | DateTime | — | — |

> 备注：保留 `width / height / gusset` 数值字段是为了后续可能按面积自动算价、按规格筛选。前期 C 端只展示 `name` 即可。

### 2.3 Material（材质）
| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | String (cuid) | PK | — |
| name | String | UNIQUE | 如「PE 单层」「PP 编织 + PE 内膜」 |
| description | String? | 可空 | 工艺、克重、用途等 |
| isActive | Boolean | 默认 true | — |
| sortOrder | Int | 默认 0 | — |
| createdAt / updatedAt | DateTime | — | — |

### 2.4 Price（价格映射 —— 核心表）
| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | String (cuid) | PK | — |
| modelId | String | FK → Model.id, ON DELETE CASCADE | — |
| sizeId | String | FK → Size.id, ON DELETE CASCADE | — |
| materialId | String | FK → Material.id, ON DELETE CASCADE | — |
| unitPrice | Decimal(10,2) | NOT NULL | **单条/件 价格**，单位元 |
| currency | String | 默认 `CNY` | 预留多币种 |
| moq | Int? | 可空 | 最小起订量（条），C 端可在数量低于 MOQ 时给出提示 |
| remark | String? | 可空 | 备注（如「不含税」「含 13% 税」） |
| isActive | Boolean | 默认 true | 单条价格停用开关 |
| createdAt / updatedAt | DateTime | — | — |
| **复合唯一** | — | `@@unique([modelId, sizeId, materialId])` | 同一三元组只允许一条价格 |
| **复合索引** | — | `@@index([modelId])`, `@@index([modelId, sizeId])` | 加速联动查询 |

### 2.5 AdminUser（后台管理员）
| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | String (cuid) | PK | — |
| username | String | UNIQUE | 登录名 |
| passwordHash | String | NOT NULL | bcrypt 哈希，**永不存明文** |
| displayName | String? | — | 显示名 |
| role | String(`ADMIN`/`STAFF`) | 默认 `STAFF` | 预留权限分级。SQLite 不支持 enum，应用层用 `src/lib/roles.ts` 约束取值；迁 PG 后可改回 Prisma enum |
| isActive | Boolean | 默认 true | — |
| lastLoginAt | DateTime? | — | 审计 |
| createdAt / updatedAt | DateTime | — | — |

---

## 3. ER 图（实体关系图）

```
┌─────────────┐          ┌──────────────────┐          ┌─────────────┐
│   Model     │          │      Price       │          │  Material   │
│─────────────│ 1      N │──────────────────│ N      1 │─────────────│
│ id (PK)     │──────────│ modelId    (FK)  │──────────│ id (PK)     │
│ code (UQ)   │          │ sizeId     (FK)  │          │ name (UQ)   │
│ name        │          │ materialId (FK)  │          │ description │
│ description │          │ unitPrice        │          │ isActive    │
│ isActive    │          │ currency         │          │ sortOrder   │
│ sortOrder   │          │ moq              │          └─────────────┘
└─────────────┘          │ remark           │
                         │ isActive         │
┌─────────────┐          │ @@unique(M,S,Mt) │
│   Size      │ 1      N │                  │
│─────────────│──────────│                  │
│ id (PK)     │          └──────────────────┘
│ name (UQ)   │
│ width       │
│ height      │
│ gusset      │
│ unit        │
│ isActive    │
│ sortOrder   │
└─────────────┘

┌─────────────────┐
│   AdminUser     │   （独立实体，与业务表无外键）
│─────────────────│
│ id (PK)         │
│ username (UQ)   │
│ passwordHash    │
│ role (ADMIN/    │
│       STAFF)    │
│ isActive        │
└─────────────────┘
```

### 3.1 关系说明

| 关系 | 基数 | 说明 |
|---|---|---|
| Model ↔ Price | 1 : N | 一个型号可出现在多条价格记录中 |
| Size ↔ Price | 1 : N | 一个尺寸可出现在多条价格记录中 |
| Material ↔ Price | 1 : N | 一个材质可出现在多条价格记录中 |
| Model ↔ Size | **N : N（隐式，通过 Price）** | 不建独立关联表，由 Price 表中存在的 (M, S) 组合天然表达 |
| Model ↔ Material | **N : N（隐式，通过 Price）** | 同上 |
| Size ↔ Material | **N : N（隐式，通过 Price）** | 同上 |

> **设计要点**：传统做法可能会建 `ModelSize`、`ModelSizeMaterial` 多张关联表来限定「哪些组合合法」。本方案故意**不建**，因为「合法」与「有报价」在本业务里是同义的——后台录入价格的瞬间，组合即合法；删除价格的瞬间，组合即不可选。这把数据维护点从 3+ 张表压缩到 1 张，后台体验大幅简化。

---

## 4. 三级联动查询逻辑（C 端）

> 这是 Phase 2 的 API 实现依据，先在此文档定义清楚。

| 步骤 | C 端动作 | 服务端查询（伪 SQL） |
|---|---|---|
| ① | 进入页面，加载所有可选型号 | `SELECT * FROM Model WHERE isActive = true ORDER BY sortOrder` |
| ② | 选定 modelId → 加载该型号下可选尺寸 | `SELECT DISTINCT s.* FROM Size s JOIN Price p ON p.sizeId = s.id WHERE p.modelId = ? AND p.isActive AND s.isActive ORDER BY s.sortOrder` |
| ③ | 再选定 sizeId → 加载可选材质 | `SELECT DISTINCT m.* FROM Material m JOIN Price p ON p.materialId = m.id WHERE p.modelId = ? AND p.sizeId = ? AND p.isActive AND m.isActive ORDER BY m.sortOrder` |
| ④ | 再选定 materialId → 命中报价 | `SELECT unitPrice, currency, moq, remark FROM Price WHERE modelId=? AND sizeId=? AND materialId=? AND isActive` |

---

## 5. 数据完整性策略

1. **级联删除**：`Price.modelId / sizeId / materialId` 设为 `ON DELETE CASCADE`。当后台删除一个型号 / 尺寸 / 材质时，对应的所有价格行自动删除，避免悬空外键。
2. **软下架优先**：业务上**强烈建议**优先用 `isActive = false`「下架」而非「删除」，避免历史报价丢失。后台 UI 应把「删除」做成需二次确认的危险操作。
3. **唯一约束**：`Price` 三元组唯一，杜绝同一组合录入两条价格的歧义。
4. **价格精度**：使用 `Decimal(10, 2)`（PostgreSQL）/ 在 SQLite 期间用 `Float` 但保留迁移注释，避免浮点误差影响财务核对。

---

## 6. 待确认事项（需要业务方拍板）

| # | 问题 | 影响 |
|---|---|---|
| Q1 | 单价计量单位是「条/件」还是「克重/平米/米」？ | 若非按条计价，需在 `Price` 增加 `priceUnit` 字段并调整 C 端总价公式 |
| Q2 | 是否存在按数量的**阶梯价**（如 ≥1000 条降价）？ | 若有，需将 `Price` 拆分为「价格规则」+「阶梯区间」两表 |
| Q3 | 是否需要保留**历史价格**与**客户询价日志**？ | 若需要，新增 `PriceHistory`、`InquiryLog` 两表，并在写入路径加触发 |
| Q4 | C 端是否要求**留资**（手机号 / 公司名）才能看到报价？ | 影响 C 端首屏交互与是否新增 `Customer` 表 |
| Q5 | 是否多管理员协作？需不需要操作日志（谁改的价格）？ | 若需要，新增 `AuditLog` 表 |

---

## 7. 配套交付

- 本文档对应的 Prisma Schema 文件：`prisma/schema.prisma`
- 后续 Phase 2 将基于本 Schema 生成迁移文件并实现 API
