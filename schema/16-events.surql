-- 下单后自动扣减库存（门店销售→门店库存 / 平台直销→仓库库存）
DEFINE EVENT order_stock_deduction ON order_item WHEN $event = 'CREATE' THEN { 
    LET $item = (SELECT * FROM $after); 
    IF $item.is_reversed != true THEN { 
        LET $so = (SELECT store FROM sales_order WHERE id = $item.order); 
        IF $so.store IS NOT NONE THEN { 
            UPDATE store_inventory SET quantity -= $item.quantity, updated_at = time::now() WHERE store = $so.store AND variant = $item.variant; 
        } ELSE { 
            UPDATE product_variant SET stock -= $item.quantity WHERE id = $item.variant; 
        } END; 
    } END; 
};

-- 冲红/取消后自动回滚库存
DEFINE EVENT order_stock_restore ON order_item WHEN $event = 'UPDATE' AND $after.is_reversed = true AND $before.is_reversed != true THEN { 
    LET $so = (SELECT store FROM sales_order WHERE id = $after.order); 
    IF $so.store IS NOT NONE THEN { 
        UPDATE store_inventory SET quantity += $after.quantity, updated_at = time::now() WHERE store = $so.store AND variant = $after.variant; 
    } ELSE { 
        UPDATE product_variant SET stock += $after.quantity WHERE id = $after.variant; 
    } END; 
};

-- 入库后自动增加库存
DEFINE EVENT inbound_stock ON inbound WHEN $event = 'CREATE' AND $after.is_reversed != true THEN { 
    UPDATE product_variant SET stock += $after.quantity WHERE id = $after.variant; 
};

-- 出库后自动扣减仓库库存 + 铺货到门店时自动增门店库存
DEFINE EVENT outbound_stock ON outbound WHEN $event = 'CREATE' AND $after.is_reversed != true THEN { 
    UPDATE product_variant SET stock -= $after.quantity WHERE id = $after.variant; 
    IF $after.target_store IS NOT NONE THEN { 
        IF (SELECT count() FROM store_inventory WHERE store = $after.target_store AND variant = $after.variant) > 0 THEN { 
            UPDATE store_inventory SET quantity += $after.quantity, updated_at = time::now() WHERE store = $after.target_store AND variant = $after.variant; 
        } ELSE { 
            CREATE store_inventory SET store = $after.target_store, variant = $after.variant, quantity = $after.quantity, inv_type = IF $after.outbound_type = '结缘' THEN 'owned' ELSE 'consigned' END, updated_at = time::now(); 
        } END; 
    } END; 
};

-- 活动报名时校验人数上限
DEFINE EVENT registration_cap ON registration WHEN $event = 'CREATE' THEN { 
    LET $act = (SELECT * FROM activity WHERE id = $after.activity); 
    LET $rows = (SELECT VALUE quantity FROM registration WHERE activity = $after.activity AND status IN ['待确认','已确认']); 
    LET $total = IF count($rows) > 0 THEN math::sum($rows) ELSE 0 END; 
    IF $act.max_participants IS NOT NONE AND $total > $act.max_participants THEN { 
        THROW "活动报名人数已满"; 
    } END; 
};

-- ★ 定时任务完成 → 自动生成下一期
DEFINE EVENT sop_recurring ON sop_task WHEN $event = 'UPDATE' AND $after.status = '已确认' AND $after.schedule_type = 'recurring' AND $after.recurrence_rule IS NOT NONE THEN { 
    LET $interval = IF $after.recurrence_rule = 'daily' THEN 1d ELSE IF $after.recurrence_rule = 'weekly' THEN 7d ELSE 30d END END; 
    CREATE sop_task SET title = $after.title, task_type = $after.task_type, scope = $after.scope, target_mode = $after.target_mode, target_store_types = $after.target_store_types, target_stores = $after.target_stores, tenant = $after.tenant, customer = $after.customer, schedule_type = 'recurring', recurrence_rule = $after.recurrence_rule, created_by = $after.created_by, assigned_to = $after.assigned_to, deadline = $after.deadline + $interval, status = '待执行'; 
};

-- 订单取消：自动冲红所有订单行
DEFINE EVENT order_cancel ON sales_order WHEN $event = 'UPDATE' AND $after.status = '已取消' AND $before.status != '已取消' THEN { 
    UPDATE order_item SET is_reversed = true WHERE order = $after.id; 
};

-- ★ 退货确认 → 自动入库（平台品）或回门店库存（自建品）
DEFINE EVENT return_stock ON product_return WHEN $event = 'UPDATE' AND $after.status = '已处理' AND $before.status != '已处理' THEN { 
    LET $variant = (SELECT * FROM $after.variant); 
    LET $spu = (SELECT * FROM product WHERE id = $variant.spu); 
    IF $spu.owner_tenant IS NONE THEN { 
        CREATE inbound SET variant = $after.variant, quantity = $after.quantity, purchase_type = '退货', unit_price = $after.refund_amount / $after.quantity, total_amount = $after.refund_amount, warehouse = $after.warehouse, linked_order = $after.order, operator = $after.operator, notes = '退货入库：' + $after.return_no; 
    } ELSE { 
        UPDATE store_inventory SET quantity += $after.quantity, updated_at = time::now() WHERE store = $after.store AND variant = $after.variant; 
    } END; 
};

-- ★ 订单完成 → 自动生成佣金记录
DEFINE EVENT order_commission ON sales_order WHEN $event = 'UPDATE' AND $after.status = '已完成' AND $before.status != '已完成' THEN { 
    IF $after.order_type = '分销' THEN { 
        FOR $item IN (SELECT * FROM order_item WHERE order = $after.id AND is_reversed = false) { 
            LET $sel = (SELECT * FROM tenant_product_selection WHERE tenant = $after.tenant AND variant = $item.variant); 
            IF $sel IS NOT NONE AND $sel.commission_rate IS NOT NONE THEN { 
                LET $setting = (SELECT * FROM commission_setting WHERE service_person = $after.operator); 
                LET $total = $item.total_amount * $sel.commission_rate; 
                LET $self = $total * ($setting.self_ratio ?? 1.0); 
                LET $donate = $total * ($setting.donate_ratio ?? 0); 
                CREATE commission_record SET order = $after.id, service_person = $after.operator, variant = $item.variant, total_commission = $total, self_amount = $self, donate_amount = $donate; 
            } END; 
        }; 
    } END; 
};

-- ★ 佣金结算 → 自动生成财务流水
DEFINE EVENT commission_transaction ON commission_record WHEN $event = 'UPDATE' AND $after.status = '已结算' AND $before.status != '已结算' THEN { 
    LET $order = (SELECT * FROM sales_order WHERE id = $after.order); 
    CREATE transaction SET tx_type = '支出', amount = $after.self_amount + $after.donate_amount, category = '佣金支出', linked_commission = $after.id, linked_order = $after.order, operator = $after.service_person, notes = '佣金结算：订单' + $order.so_no; 
};

-- ★ 采购入库 → 自动更新采购单已收数量
DEFINE EVENT po_receive ON inbound WHEN $event = 'CREATE' AND $after.linked_purchase_order IS NOT NONE AND $after.is_reversed != true THEN { 
    UPDATE purchase_order_item SET received_qty += $after.quantity WHERE order = $after.linked_purchase_order AND variant = $after.variant; 
    UPDATE purchase_order SET status = '部分到货' WHERE id = $after.linked_purchase_order AND status = '已确认'; 
    LET $poi = (SELECT * FROM purchase_order_item WHERE order = $after.linked_purchase_order); 
    IF array::all($poi, |$i| $i.received_qty >= $i.quantity) THEN { 
        UPDATE purchase_order SET status = '已完成' WHERE id = $after.linked_purchase_order; 
    } END; 
};
