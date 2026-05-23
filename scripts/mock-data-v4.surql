-- Mock Data v4 — 基于现有 store/tenant 分配

-- ═══ Step 1: 门店归属 ═══
UPDATE store:l6tcfoio5gefypz4frtq SET tenant = tenant:tc4hfcj46tavu5lo5sze;
UPDATE store:s001 SET tenant = tenant:28cbij9m5kkkucnf0du3;
UPDATE store:7mcb0s8opnnkc2d28cli SET tenant = tenant:28cbij9m5kkkucnf0du3;

-- ═══ Step 2: 密码 test123 ═══
UPDATE user:admin SET password_hash = crypto::argon2::generate("test123");
UPDATE user:u002 SET password_hash = crypto::argon2::generate("test123");
UPDATE user:u003 SET password_hash = crypto::argon2::generate("test123");
UPDATE user:u004 SET password_hash = crypto::argon2::generate("test123");
UPDATE user:u005 SET password_hash = crypto::argon2::generate("test123");

-- ═══ Step 3: 角色+租户 ═══
UPDATE user:admin SET current_role = "平台管理员", current_tenant = NONE;
UPDATE user:u002 SET current_role = "经理", current_tenant = tenant:28cbij9m5kkkucnf0du3;
UPDATE user:u003 SET current_role = "门店店长", current_tenant = tenant:tc4hfcj46tavu5lo5sze;
UPDATE user:u004 SET current_role = "店员", current_tenant = tenant:tc4hfcj46tavu5lo5sze;
UPDATE user:u005 SET current_role = "业务员", current_tenant = tenant:28cbij9m5kkkucnf0du3;

-- ═══ Step 4: 清理旧 membership ═══
DELETE FROM membership;

-- ═══ Step 5: Membership ═══
RELATE user:u002->membership->tenant:28cbij9m5kkkucnf0du3 SET role = "经理", status = "active", can_operate = true;
RELATE user:u003->membership->tenant:tc4hfcj46tavu5lo5sze SET role = "门店店长", store = store:l6tcfoio5gefypz4frtq, status = "active", can_operate = true;
RELATE user:u004->membership->tenant:tc4hfcj46tavu5lo5sze SET role = "店员", store = store:l6tcfoio5gefypz4frtq, status = "active", can_operate = true;
RELATE user:u005->membership->tenant:28cbij9m5kkkucnf0du3 SET role = "业务员", status = "active", can_operate = true;

-- ═══ Step 6: 清理旧库存+盘点 ═══
DELETE FROM store_inventory;
DELETE FROM inventory_count;

-- ═══ Step 7: 门店库存 ═══
-- 书院旗舰店 (s001/7mcb)
CREATE store_inventory SET store = store:s001, variant = product_variant:p001a, inv_type = "owned", quantity = 50;
CREATE store_inventory SET store = store:s001, variant = product_variant:p002a, inv_type = "consigned", quantity = 20;

-- 禅意生活馆 (l6tc)
CREATE store_inventory SET store = store:l6tcfoio5gefypz4frtq, variant = product_variant:p001a, inv_type = "owned", quantity = 40;
CREATE store_inventory SET store = store:l6tcfoio5gefypz4frtq, variant = product_variant:p002a, inv_type = "owned", quantity = 8;

-- ═══ Step 8: 盘点记录 ═══
-- 书院旗舰店
CREATE inventory_count SET store = store:s001, variant = product_variant:p001a, expected_qty = 50, actual_qty = 48, diff = -2, inv_type = "owned", operator = user:u003;
CREATE inventory_count SET store = store:s001, variant = product_variant:p002a, expected_qty = 20, actual_qty = 20, diff = 0, inv_type = "consigned", operator = user:u003;
-- 禅意生活馆
CREATE inventory_count SET store = store:l6tcfoio5gefypz4frtq, variant = product_variant:p001a, expected_qty = 40, actual_qty = 37, diff = -3, inv_type = "owned", operator = user:u003;
CREATE inventory_count SET store = store:l6tcfoio5gefypz4frtq, variant = product_variant:p002a, expected_qty = 8, actual_qty = 8, diff = 0, inv_type = "owned", operator = user:u003;
