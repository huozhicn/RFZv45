# AGENTS.md — RFZv45 Agent 工作指令

## 🚨 最高原则：Schema 是唯一真相源

**schema/ 目录下的 .surql 文件是唯一被修改的源文件。**

1. 任何 DB 结构变更 → **先改本地 .surql** → git commit → 再导入 VPS
2. **绝对禁止在 VPS 上直接用 surreal sql 改表结构**
3. 调试时不得已临时改了 VPS → **立刻回写到本地 .surql 并 commit**

---

## 环境速查

| 环境 | 地址 | 说明 |
|------|------|------|
| VPS | 212.64.90.2 | SSH: ubuntu / sFM@0@LhTY#Oi& |
| SDB | http://127.0.0.1:8000 | root/root, ns=huozhi, db=rfzv45 |
| Admin | https://admin.rufazao.com/v45 | Caddy handle_path /v45 → /var/www/v45-admin |
| Hermes Webhook | http://localhost:PORT/webhooks/rfzv4-chat | Agent 接收消息的端点 |

---

## 架构概要

**前端只需要做 3 件事：渲染表格、展示详情、收发对话。** Agent 负责理解意图和执行操作。

```
用户输入 → agent_message 表 → SDB EVENT → Hermes Webhook → Agent 处理 → 回写 SDB
                                                                              ↓
前端 Chat 控件 ← LIVE QUERY ← agent_message.response
前端表格    ← Agent action: navigate / filter / highlight
```

详细设计见 `DESIGN.md`。

---

## 菜单系统

侧栏菜单从 schema 注释自动生成。每张表定义前标注：

```sql
-- @label 产品SPU
-- @group product
DEFINE TABLE product SCHEMAFULL ...;
```

8 个分组（按 `scripts/extract-menu.ts` 中 GROUP_ORDER 排序）：

| 分组 key | 中文名 | 表数 |
|----------|--------|------|
| org | 组织架构 | 6 |
| product | 商品管理 | 4 |
| inventory | 库存物流 | 8 |
| crm | 客户管理 | 5 |
| order | 交易订单 | 6 |
| marketing | 活动运营 | 8 |
| finance | 分润结算 | 4 |
| service | 售后服务 | 5 |

新增/改名表 → 在对应 .surql 加 `-- @label` / `-- @group` → 跑 `npm run menu-config` → 提交生成的 `src/lib/menu-config.json`。

---

## SDB 避坑知识（从 v4 继承）

### 🔥 ALTER TABLE PERMISSIONS 互相覆盖
对同一张表分别执行 `FOR select` / `FOR create` 会互相覆盖。
**必须合并为一条语句。** 参见 17-permissions.surql。

### 🔥 FETCH 语法：ORDER BY 必须在 FETCH 之前
```sql
-- ✅ 正确
SELECT * FROM store_inventory ORDER BY store.name FETCH variant, store;
-- ❌ 错误（400 parse error）
SELECT * FROM store_inventory FETCH variant ORDER BY store.name;
```

### 🔥 别名 + FETCH 不兼容
需要 FETCH 才能解析的嵌套字段不能用 `AS` 别名——别名在 FETCH 前求值。
```sql
-- ❌ product_name 永远是 null
SELECT *, spu.name AS product_name FROM product_variant FETCH spu;
-- ✅ 前端用 row.spu?.name
SELECT * FROM product_variant FETCH spu;
```

### 🔥 `surreal sql --multi` 不共享 LET 变量
批量操作需要 LET 变量传递 → 用交互模式（heredoc 管道）。

### SCHEMAFULL 表必须填满所有必填字段
CREATE CONTENT 必须包含所有无 DEFAULT 的字段。用 `INFO FOR TABLE` 查定义。

### SDB 3.0.6 Bug: INFO FOR TABLE 不报告 ALTER TABLE 权限
`permissions` 字段始终 `MISSING`。判断权限是否生效 → 用 scope token 实际查询。

---

## agent_message 通信协议

### 发消息（前端 → SDB）

```sql
INSERT INTO agent_message {
  user_input: $msg,
  status: 'pending',
  session_id: $sid,
  created_by: $uid
};
```

### 收结果（前端 ← SDB）

```sql
LIVE SELECT * FROM agent_message 
WHERE session_id = $sid AND status IN ('done', 'error') 
ORDER BY created_at;
```

### Agent 回写格式

```sql
UPDATE agent_message SET 
  response = '文字回复内容',
  actions = [
    { type: 'navigate', route: '/tables/store_inventory' },
    { type: 'filter', field: 'store.name', value: '书院旗舰店' }
  ],
  status = 'done'
WHERE id = $msg_id;
```

Agent actions 完整类型定义见 `admin-react/src/agent/types.ts`。

---

## UI 命名规范（来自 DESIGN.md）

沟通中统一使用以下命名，避免歧义：

| 命名 | 是什么 |
|------|--------|
| **侧栏** | 左侧 220px 菜单区 |
| **主内容区** | 中间表格/首页区域 |
| **对话面板** | 右侧 ChatPanel |
| **详情面板** | 右侧滑出抽屉 |
| **用户菜单** | 侧栏底部头像弹出菜单 |
| **SchemaTable** | 零配置数据表格控件 |
| **表页面** | `#/tables/:tableName` |

---

## 前端开发原则

1. **不要手写表格列定义** → 从 schema-snapshot.json 自动生成
2. **不要手写 SQL** → Agent 生成
3. **不要手写路由** → 统一 `/tables/:tableName`
4. **不要手写权限判断** → SDB PERMISSIONS 自动过滤
5. **不要手写枚举选项** → 从 ASSERT 自动提取
6. **不要手写菜单** → 从 `-- @label` / `-- @group` 注释自动生成

---

## 构建部署

```bash
cd admin-react && npm run build   # 构建前端（React + Vite）
bash deploy.sh                    # 部署到 VPS /var/www/v45-admin/
bash schema/import-schema.sh      # 导入 schema（在 VPS 上执行）

# 菜单配置有变更时
cd admin-react && npm run menu-config  # 重新生成 menu-config.json
```
