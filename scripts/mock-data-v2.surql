-- RFZv45 Mock Data v2: 多租户 · 多门店 · 角色隔离
-- 通过 VPS root 直接执行

-- ═══ 清理旧关联数据 ═══
DELETE FROM membership;
DELETE FROM store_inventory;
DELETE FROM inventory_count;
DELETE FROM restock_request;
DELETE FROM sales_order;
DELETE FROM order_item;

-- ═══ 确保租户（UPSERT） ═══
LET $t1 = (UPSERT tenant:28cbij9m5kkkucnf0du3 SET name = '书院连锁总部', tenant_type = '连锁总部', status = 'active' RETURN id)[0].id;
LET $t2 = (UPSERT tenant:t002 SET name = '禅意福慧空间', tenant_type = '禅意馆', status = 'active' RETURN id)[0].id;
LET $t3 = (UPSERT tenant:t003 SET name = '自在禅文化', tenant_type = '独立寺院', status = 'active' RETURN id)[0].id;

-- ═══ 确保门店 ═══
LET $s1 = (UPSERT store:s001 SET name = '书院旗舰店', tenant = $t1, store_type = '旗舰店', status = 'active' RETURN id)[0].id;
LET $s3 = (UPSERT store:l6tcfoio5gefypz4frtq SET name = '禅意生活馆', tenant = $t2, store_type = '标准店', status = 'active' RETURN id)[0].id;
LET $s4 = (UPSERT store:s004 SET name = '自在文创店', tenant = $t3, store_type = '标准店', status = 'active' RETURN id)[0].id;

-- ═══ 用户角色 ═══
UPDATE user:admin SET current_role = '平台管理员', current_tenant = $t1;
UPDATE user:u002 SET current_role = '经理', current_tenant = $t1;
UPDATE user:u003 SET current_role = '门店店长', current_tenant = $t2;
UPDATE user:u004 SET current_role = '店员', current_tenant = $t2;
UPDATE user:u005 SET current_role = '业务员', current_tenant = $t1;

-- ═══ 密码: test123 ═══
UPDATE user:admin SET password_hash = crypto::argon2::generate('test123');
UPDATE user:u002 SET password_hash = crypto::argon2::generate('test123');
UPDATE user:u003 SET password_hash = crypto::argon2::generate('test123');
UPDATE user:u004 SET password_hash = crypto::argon2::generate('test123');
UPDATE user:u005 SET password_hash = crypto::argon2::generate('test123');

-- ═══ membership ═══
CREATE membership SET in = user:u002, out = $t1, role = '经理', status = 'active', can_operate = true;
CREATE membership SET in = user:u003, out = $t2, role = '门店店长', store = $s3, status = 'active', can_operate = true;
CREATE membership SET in = user:u004, out = $t2, role = '店员', store = $s3, status = 'active', can_operate = true;
CREATE membership SET in = user:u005, out = $t1, role = '业务员', status = 'active', can_operate = true;

-- ═══ 产品 SKU ═══
LET $p001 = (UPSERT product:p001 SET name = '艾草线香30支', is_platform_catalog = true, status = 'active' RETURN id)[0].id;
LET $p002 = (UPSERT product:p002 SET name = '药师手串8mm', is_platform_catalog = true, status = 'active' RETURN id)[0].id;
LET $p003 = (UPSERT product:p003 SET name = '禅修蒲团', is_platform_catalog = true, status = 'active' RETURN id)[0].id;
LET $p004 = (UPSERT product:p004 SET name = '心经抄经本', is_platform_catalog = true, status = 'active' RETURN id)[0].id;

LET $v1 = (UPSERT product_variant:p001a SET spu = $p001, name = '艾草线香30支', unit_price = 30, retail_price = 45, status = 'active' RETURN id)[0].id;
LET $v2 = (UPSERT product_variant:p002a SET spu = $p002, name = '药师手串8mm', unit_price = 98, retail_price = 128, status = 'active' RETURN id)[0].id;
LET $v3 = (UPSERT product_variant:p003a SET spu = $p003, name = '禅修蒲团', unit_price = 80, retail_price = 120, status = 'active' RETURN id)[0].id;
LET $v4 = (UPSERT product_variant:p004a SET spu = $p004, name = '心经抄经本', unit_price = 15, retail_price = 25, status = 'active' RETURN id)[0].id;

-- ═══ 门店库存 (每门店 2-3 个 SKU) ═══
-- 书院旗舰店 (s001)
UPSERT store_inventory:s001_inv1 SET store = $s1, variant = $v1, inv_type = 'owned', quantity = 50;
UPSERT store_inventory:s001_inv2 SET store = $s1, variant = $v2, inv_type = 'consigned', quantity = 20;
UPSERT store_inventory:s001_inv3 SET store = $s1, variant = $v3, inv_type = 'owned', quantity = 15;

-- 禅意生活馆 (s3 = l6tcfoio5gefypz4frtq)
UPSERT store_inventory:s3_inv1 SET store = $s3, variant = $v1, inv_type = 'owned', quantity = 40;
UPSERT store_inventory:s3_inv2 SET store = $s3, variant = $v2, inv_type = 'owned', quantity = 8;
UPSERT store_inventory:s3_inv3 SET store = $s3, variant = $v3, inv_type = 'consigned', quantity = 12;

-- 自在文创店 (s004)
UPSERT store_inventory:s4_inv1 SET store = $s4, variant = $v1, inv_type = 'owned', quantity = 25;
UPSERT store_inventory:s4_inv2 SET store = $s4, variant = $v4, inv_type = 'owned', quantity = 60;

-- ═══ 盘点记录 (每门店 1-2 条) ═══
-- 书院旗舰店
UPSERT inventory_count:ic_s1_a SET store = $s1, variant = $v1, expected_qty = 50, actual_qty = 48, diff = -2, inv_type = 'owned', operator = user:u003;
UPSERT inventory_count:ic_s1_b SET store = $s1, variant = $v2, expected_qty = 20, actual_qty = 20, diff = 0, inv_type = 'consigned', operator = user:u003;

-- 禅意生活馆
UPSERT inventory_count:ic_s3_a SET store = $s3, variant = $v1, expected_qty = 40, actual_qty = 37, diff = -3, inv_type = 'owned', operator = user:u003;
UPSERT inventory_count:ic_s3_b SET store = $s3, variant = $v3, expected_qty = 12, actual_qty = 12, diff = 0, inv_type = 'consigned', operator = user:u003;

-- ═══ 销售订单 ═══
UPSERT sales_order:so001 SET tenant = $t1, store = $s1, operator = user:u005, order_type = '直销', total_amount = 300, status = '已完成';
UPSERT sales_order:so002 SET tenant = $t2, store = $s3, operator = user:u003, order_type = '流通处供货', total_amount = 500, status = '已完成';
