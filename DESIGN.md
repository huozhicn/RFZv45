# RFZv45 设计文档

## 为什么不是 v4 的延续

RFZv4 走了 11 个 Phase，写了几十个 .vue 文件，每次改一行 SQL 要 grep 全局修 16 处。
前端代码量指数增长，Agent token 大量浪费在 UI 胶水代码上。

**RFZv4 的架构本质是把 SurrealDB 当成远程 MySQL，把 Vue 页面当成存储过程。**

v45 推翻这个模型。前端从 54 个手写 CRUD 页面砍成 **3 个控件**。

---

## 三大核心原则

### 1. SDB = 唯一真相源 + Data Hub

```
┌─────────────────────────────────────────────────────────┐
│                      SurrealDB                           │
│                                                          │
│  • Schema 定义（表结构、字段类型、枚举、关联）               │
│  • 菜单定义（-- @label / -- @group 注释）                  │
│  • 业务逻辑（FUNCTION、EVENT）                             │
│  • 权限系统（PERMISSIONS、ACCESS）                         │
│  • 对话消息（agent_message 表）                            │
│  • 消息预处理（fn::agent_payload）                         │
│  • 实时推送（LIVE QUERY）                                  │
│                                                          │
│        ↗ Admin 前端（只读 + 展示）                          │
│        ↗ H5 用户端（只读 + 展示）                           │
│        ↗ Hermes Agent（理解意图 + 执行操作）                │
│        ↗ 外部系统（Webhook、API）                           │
└─────────────────────────────────────────────────────────┘
```

Schema 文件（.surql）是唯一被修改的源文件。所有变更先改 schema、commit、再导入 VPS。

### 2. 对话是第一公民

传统 ERP 的数据是「填出来」的——表单 → 表记录。

RFZv45 的数据是「说出来」的——对话 → SDB → 表记录。

```
用户: "新建客户张三，居士，普通，13800001111"
         │
         ▼ INSERT INTO agent_message
    SDB EVENT 触发
         │
         ▼ fn::agent_payload() 注入权限上下文
    { user_input, auth: { role, tenant, store, user_id } }
         │
         ▼ POST Hermes webhook
    Agent 理解意图 → CREATE customer CONTENT { name: '张三', ... }
         │
         ▼ UPDATE agent_message SET response=..., status='done'
         │
         ▼ LIVE QUERY 推给前端
    Chat 面板展示结果 + 可选 actions
```

**每一句话都存进 SDB。** 全链路可追溯。Hermes 下线重连后扫 `SELECT * FROM agent_message WHERE status='pending'` 补处理。

### 3. Agent 驱动一切，前端只管展示

Agent 返回的不是纯文本，是**操作序列**：

```json
{
  "reply": "已为你打开书院旗舰店库存。3 个商品低于安全线。",
  "actions": [
    { "type": "navigate", "route": "/tables/store_inventory", "params": { "store": "书院旗舰店" } },
    { "type": "filter", "field": "store.name", "value": "书院旗舰店" },
    { "type": "highlight", "row_ids": ["si:001", "si:007"] }
  ]
}
```

前端 Chat 控件的 action dispatcher 执行这些指令：导航、筛选、高亮、打开详情、下载 CSV。

---

## UI 布局命名

为避免沟通歧义，统一以下命名：

### 三栏主布局

```
┌──────────┬──────────────────────────┬────────────┐
│          │                          │            │
│  侧栏     │      主内容区             │  对话面板   │
│ 220px    │     flex:1              │  固定宽度   │
│          │                          │            │
│ 菜单导航  │   SchemaTable 表格       │  ChatPanel │
│ 用户区    │   首页欢迎页             │  AI 助手   │
│ 版本号    │                          │            │
└──────────┴──────────────────────────┴────────────┘
```

| 区域 | 命名 | 说明 |
|------|------|------|
| 左侧 220px | **侧栏** | 分组菜单 + 用户区 + 版本号 |
| 中间 flex:1 | **主内容区** | SchemaTable 或首页 |
| 右侧固定宽 | **对话面板** | ChatPanel，AI 助手常驻 |

### 浮层/弹窗

| 组件 | 命名 | 触发方式 |
|------|------|---------|
| **详情面板** | 右侧滑出抽屉 | 点表格行 → 查看/编辑/新建单条记录 |
| **用户菜单** | 侧栏底部弹出 | 点头像 → 修改密码 / 退出 |
| **修改密码弹窗** | 居中 Modal | 用户菜单 → 修改密码 |

### 页面

| 命名 | URL | 说明 |
|------|-----|------|
| **表页面** | `#/tables/:tableName` | 侧栏点表→主内容区显示 SchemaTable |
| **首页** | `#/` | 未选表时的欢迎页 |
| **登录页** | `/login` | LoginView |

### 控件

| 命名 | 文件 | 说明 |
|------|------|------|
| **SchemaTable** | `components/SchemaTable.tsx` | 零配置数据表格，从 schema 生成列 |
| **DetailPanel** | `components/DetailPanel.tsx` | 侧滑抽屉，字段→控件自动映射 |
| **ChatPanel** | `components/ChatPanel.tsx` | 对话面板，Agent actions 分发 |

---

## 三个核心控件

### 1. SchemaTable

零配置表格。启动时加载 build-time schema snapshot（`schema-snapshot.json`），拿到所有表的字段定义、类型、断言。

| SDB 类型 | 表格行为 |
|----------|---------|
| `string` | 文本列，可搜索 |
| `int / float / decimal` | 数字列，右对齐 |
| `datetime` | 格式化为日期，可排序 |
| `bool` | ✓/✗ 图标 |
| `record<T>` | 显示关联记录 name（FETCH 一级） |
| `array<float>` | 隐藏 |
| 字段名 `_` 开头 | 隐藏 |

路由统一为 `/tables/:tableName`。PERMISSIONS 控制谁能看到哪个表。

Agent action 控制表格行为：
- `filter` → 前端本地筛选
- `highlight` → 行变色
- `refresh` → 重新加载
- `download` → 导出 CSV

### 2. DetailPanel

侧边滑出面板。点行展开详情/编辑。字段 → 控件自动映射：

```
string     → Input
text       → Textarea
int/float  → InputNumber
datetime   → DatePicker
bool       → Switch
enum       → Select（从 ASSERT $value INSIDE [...] 提取）
record<T>  → Select（异步搜索关联表）
```

新建/编辑/删除按钮可见性由 PERMISSIONS（FOR create/update/delete）决定。

### 3. ChatPanel

底部常驻对话面板。整个 Admin 的指挥中心：

**输入能力**
- 多行 textarea（Enter 发送，Shift+Enter 换行）
- 📎 附件按钮（图片/PDF/CSV/Excel/Word，最多 10 个，缩略图预览可删除）
- Ctrl+V 粘贴图片自动识别为附件

**Agent 交互**

| 用户输入 | Agent action |
|----------|-------------|
| 「看库存」 | `navigate → /tables/store_inventory` |
| 「新建客户张三」 | `navigate → /tables/customer` + `open_create` + 预填 |
| 「书院旗舰店库存低于 5」 | `navigate` + `filter` + `highlight` |
| 「上月销售额」 | `data` 卡片（不导航，直接展示） |
| 「把这条订单取消」 | `confirm → 执行 UPDATE → refresh` |

---

## 菜单系统

侧栏菜单从 schema 注释自动生成，不是手写路由列表。

### 注释格式

在 .surql 中每张表定义前添加：

```sql
-- @label 产品SPU
-- @group product
DEFINE TABLE product SCHEMAFULL ...;
```

### 生成流程

```bash
npm run menu-config   # 解析 .surql → src/lib/menu-config.json
```

`scripts/extract-menu.ts` 遍历 schema/ 下所有 .surql，提取 `@label`/`@group`，按 GROUP_ORDER 排序输出 JSON。

### 8 个业务分组

| 分组 key | 中文名 | 表数 | 包含的表 |
|----------|--------|------|---------|
| org | 组织架构 | 6 | user, tenant, membership, organization, store, warehouse |
| product | 商品管理 | 4 | product_category, product, product_variant, tenant_product_selection |
| inventory | 库存物流 | 8 | inbound, outbound, consignment_location, consignment_stock, consignment_check, store_inventory, restock_request, inventory_count |
| crm | 客户管理 | 5 | customer, contact, h5_user, communication_log, demand |
| order | 交易订单 | 6 | sales_order, order_item, cart, transaction, purchase_order, purchase_order_item |
| marketing | 活动运营 | 8 | dharma_event, event_material, activity, registration, sales_campaign, campaign_target, banner, home_recommendation |
| finance | 分润结算 | 4 | commission_setting, commission_record, settlement, account |
| service | 售后服务 | 5 | product_return, favorite, service_binding, sop_task, document |

### 交互行为

- 点击分组标题：展开/收起该组，▼ 箭头旋转
- 点击表名：导航到 `/tables/:tableName`
- 当前表高亮：蓝色背景 + 右侧蓝色竖线
- 默认全部收起，点表时自动展开并关闭其他分组（始终只有一个分组展开）
- 回到首页时全部收起

### i18n 基础

`@label` 注解天然是多语言 key。扩展 `extract-menu.ts` 输出多语言映射即可：
```json
{ "key": "product", "label": { "zh": "产品SPU", "en": "Product SPU" } }
```
前端根据 locale 选择对应语言，不改 .surql。

---

## Agent 通信协议

### 表：agent_message

```sql
DEFINE TABLE agent_message SCHEMAFULL;

DEFINE FIELD user_input  ON agent_message TYPE string;
DEFINE FIELD attachments ON agent_message TYPE option<array>;
DEFINE FIELD response    ON agent_message TYPE option<string>;
DEFINE FIELD actions     ON agent_message TYPE option<array<object>>;
DEFINE FIELD status      ON agent_message TYPE string 
  ASSERT $value INSIDE ['pending', 'processing', 'done', 'error'];
DEFINE FIELD session_id  ON agent_message TYPE string;
DEFINE FIELD created_by  ON agent_message TYPE record<user>;
DEFINE FIELD created_at  ON agent_message TYPE datetime DEFAULT time::now();
```

### SDB 预处理函数

```sql
DEFINE FUNCTION fn::agent_payload($msg_id: record<agent_message>) {
  LET $msg = (SELECT id, user_input, session_id, created_by FROM agent_message WHERE id = $msg_id)[0];
  LET $u = (SELECT id, name, current_role, current_tenant FROM user WHERE id = $msg.created_by)[0];
  LET $store = IF $u.current_role IN ['门店店长','店员'] THEN
    (SELECT VALUE ->membership.store[0] FROM user WHERE id = $msg.created_by)
  ELSE NONE END;
  
  RETURN {
    user_input: $msg.user_input,
    message_id: $msg.id,
    session_id: $msg.session_id,
    auth: {
      role: $u.current_role,
      tenant: $u.current_tenant,
      store: $store,
      user_id: $u.id,
      user_name: $u.name
    }
  };
};
```

### Agent Action 类型

```typescript
type AgentAction =
  | { type: 'navigate'; route: string; params?: Record<string, string> }
  | { type: 'filter'; field: string; value: string }
  | { type: 'highlight'; row_ids: string[] }
  | { type: 'open_detail'; record_id: string }
  | { type: 'open_create'; table: string; prefill?: Record<string, any> }
  | { type: 'data'; title: string; columns: ColumnDef[]; rows: any[] }
  | { type: 'confirm'; message: string; on_confirm: { sql: string } }
  | { type: 'download'; format: 'csv' | 'pdf'; sql: string }
  | { type: 'refresh' }
  | { type: 'reply'; text: string }

type AgentResponse = {
  message_id: string
  status: 'done' | 'error'
  reply: string
  actions: AgentAction[]
}
```

---

## 与 RFZv4 的关系

| | v4 | v45 |
|---|---|---|
| 前端框架 | Vue 3 + NaiveUI | React 19 + 纯 CSS |
| 前端页面 | 54 个手写 .vue 文件 | 3 个控件 |
| SQL 位置 | 散落在每个 .vue 里 | Agent 生成 |
| 路由 | 手写 50+ 条 | `/tables/:tableName` |
| 菜单 | 手写角色过滤 | `-- @label`/`-- @group` 注释自动生成 |
| 表单 | 每个页面手写控件+校验 | 从 schema 字段类型自动映射 |
| 枚举值 | 前端和后端各写一遍 | ASSERT 定义 → 自动提取 |
| 权限 | auth.ts canCreate 硬编码 | SDB PERMISSIONS 驱动 |
| 数据入口 | 表单 | 对话 |
| 追溯性 | created_by 字段 | 全对话链路可查 |
| 部署路径 | /var/www/admin/ | /var/www/v45-admin/（Caddy /v45/*） |

---

## 目录结构

```
RFZv45/
├── DESIGN.md                    ← 本文件
├── AGENTS.md                    ← Agent 工作指令
├── schema/                      ← SDB schema（唯一真相源）
│   ├── 00-init.surql
│   ├── 01-identity.surql
│   ├── 02-tenant.surql
│   ├── 03-product.surql
│   ├── 04-product-selection.surql
│   ├── 05-inventory.surql
│   ├── 05b-store-inventory.surql
│   ├── 06-order.surql
│   ├── 07-crm.surql
│   ├── 08-activity.surql
│   ├── 09-finance.surql
│   ├── 10-commission.surql
│   ├── 11-h5-user.surql
│   ├── 12-h5-content.surql
│   ├── 13-dharma-event.surql
│   ├── 14-docs.surql
│   ├── 15-functions.surql
│   ├── 16-events.surql
│   ├── 17-permissions.surql
│   ├── 18-access.surql
│   ├── 20-agent.surql
│   └── import-schema.sh
├── admin-react/                 ← React Admin 前端
│   ├── package.json
│   ├── vite.config.ts
│   ├── scripts/
│   │   └── extract-menu.ts     ← 菜单解析脚本
│   ├── src/
│   │   ├── App.tsx             ← 主布局（含分组侧栏）
│   │   ├── main.tsx
│   │   ├── components/
│   │   │   ├── SchemaTable.tsx
│   │   │   ├── DetailPanel.tsx
│   │   │   └── ChatPanel.tsx
│   │   ├── agent/
│   │   │   ├── types.ts
│   │   │   ├── dispatcher.ts
│   │   │   └── live-query.ts
│   │   ├── stores/
│   │   │   └── auth.tsx
│   │   ├── pages/
│   │   │   └── LoginView.tsx
│   │   └── lib/
│   │       ├── schema.ts           ← 类型定义 + FIELD_ZH + 菜单加载
│   │       ├── sdb.ts              ← SDB REST 查询封装
│   │       ├── markdown.tsx        ← Agent 响应 Markdown 渲染
│   │       ├── table-registry.ts   ← 表名→查询映射
│   │       ├── schema-snapshot.json  ← 构建时字段快照
│   │       └── menu-config.json      ← 构建时菜单配置
│   └── dist/                   ← 构建产物
├── deploy.sh
└── seeds/
    └── 00-bootstrap.surql
```
