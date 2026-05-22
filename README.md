# RFZv45 — 如法造 ERP（对话驱动版）

RFZv4 的继任者。核心变化：**前端只做 3 件事（表格、详情、对话），Agent 驱动一切。**

## 与 v4 的关键区别

| | v4 | v45 |
|---|---|---|
| 前端页面 | 54 个手写 .vue | 3 个控件 |
| 数据入口 | 表单 CRUD | 对话输入 |
| 路由 | 50+ 条手写 | `/tables/:tableName` |
| SQL | 散落各 .vue | Agent 生成 |
| 表单 | 每个页面手写校验 | Schema 自动映射 |
| 权限 | 前端硬编码 | SDB PERMISSIONS 驱动 |

## 架构

```
用户输入 → SDB(agent_message) → Hermes Agent → SDB(回写) → 前端 LIVE QUERY → 渲染
```

详见 `DESIGN.md`。

## 快速开始

```bash
cd admin && npm install && npm run dev    # 开发
bash deploy.sh                            # 部署
bash schema/import-schema.sh              # 导入 schema（在 VPS 上执行）
```
