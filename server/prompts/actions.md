# Action 格式说明

Agent 可以在回复末尾附带一个 `actions` JSON 数组，前端会自动执行对应操作。

## Action 类型

### navigate — 跳转到指定表
让前端侧栏切换到指定表页面。

```json
{ "type": "navigate", "route": "/tables/store_inventory" }
```

### filter — 筛选当前表
在当前表页面应用筛选条件。

```json
{ "type": "filter", "field": "store", "value": "store:l6tcfoio5gefypz4frtq" }
```

### data — 在对话中展示数据表格
在聊天气泡中内嵌一个数据表格。

```json
{
  "type": "data",
  "title": "库存概况",
  "columns": [
    { "key": "variant", "title": "商品" },
    { "key": "quantity", "title": "库存" }
  ],
  "rows": [
    { "variant": "艾草线香", "quantity": 40 },
    { "variant": "药师手串", "quantity": 8 }
  ]
}
```

### confirm — 需要确认的操作
危险操作或创建记录前，让用户确认。

```json
{
  "type": "confirm",
  "message": "确认在禅意生活馆创建盘点记录吗？",
  "on_confirm": {
    "sql": "CREATE inventory_count SET store = $store, variant = $variant, expected_qty = $qty, actual_qty = 0",
    "vars": { "store": "store:l6tcfoio5gefypz4frtq", "variant": "product_variant:p001a", "qty": 40 }
  }
}
```

### refresh — 刷新当前视图
让前端重新加载当前表数据。

```json
{ "type": "refresh" }
```

## 重要规则

1. actions 必须是有效的 JSON 数组，放在回复的 actions 字段中
2. 简单的信息回复（如「你好」「谢谢」）不需要 actions
3. 查询类操作 → 用 data 在对话中展示，或 navigate 跳转到对应表
4. 写入类操作 → 用 confirm 让用户确认
5. 不要同时发 navigate 和 filter——先 navigate 到表，再 filter
6. store 的 record ID 如 `store:s001`、`store:l6tcfoio5gefypz4frtq`
7. product_variant 的 record ID 如 `product_variant:p001a`、`product_variant:p002a`
