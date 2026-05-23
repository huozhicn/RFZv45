-- RFZv45 Mock Data v3: 直接 ID，不用 LET

DELETE FROM membership;
DELETE FROM store_inventory;
DELETE FROM inventory_count;
DELETE FROM restock_request;
DELETE FROM sales_order;
DELETE FROM order_item;

-- ═══ 租户 ═══
UPSERT tenant:28cbij9m5kkkucnf0du3 SET name = '书院连锁总部', status = 'active';
CREATE tenant:t002 SET name = '禅意福慧空间', status = 'active';
CREATE tenant:t003 SET name = '自在禅文化', status = 'active';

-- ═══ 门店 ═══
UPDATE store:s001 SET name = '书院旗舰店', tenant = tenant:28cbij9m5kkkucnf0du3, status = 'active';
UPDATE store:l6tcfoio5gefypz4frtq SET name = '禅意生活馆', tenant = tenant:t002, status = 'active';
CREATE store:s004 SET name = '自在文创店', tenant = tenant:t003, store_type = '标准店', status = 'active';

-- ═══ 删除旧店 ═══
DELETE store:7mcb0s8opnnkc2d28cli;
