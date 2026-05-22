-- 流水序列计数器
DEFINE TABLE code_counter SCHEMAFULL;
DEFINE FIELD entity_type ON code_counter TYPE string;
DEFINE FIELD year_month   ON code_counter TYPE string;
DEFINE FIELD current_seq  ON code_counter TYPE int DEFAULT 0;
DEFINE INDEX idx_counter  ON code_counter FIELDS entity_type, year_month UNIQUE;

-- A类：流水编码（自动递增）
DEFINE FUNCTION fn::gen_flow_code($prefix: string, $entity: string) { 
    LET $ym = time::format(time::now(), "%y%m"); 
    LET $row = (SELECT * FROM code_counter WHERE entity_type = $entity AND year_month = $ym LIMIT 1); 
    IF count($row) = 0 THEN { 
        CREATE code_counter SET entity_type = $entity, year_month = $ym, current_seq = 1; 
        RETURN $prefix + "-" + $ym + "-00001"; 
    } END; 
    LET $updated = (UPDATE code_counter SET current_seq += 1 WHERE entity_type = $entity AND year_month = $ym RETURN AFTER); 
    LET $seq_str = <string>$updated.current_seq; 
    LET $padded = string::slice("00000" + $seq_str, string::len($seq_str)); 
    RETURN $prefix + "-" + $ym + "-" + $padded; 
};

-- B类：基准编码（取 UUID v4 前5位大写，16^5=1M 空间足够）
DEFINE FUNCTION fn::gen_ref_code($prefix: string, $table: string) { 
    LET $uuid = string::replace(<string>rand::uuid::v4(), "-", ""); 
    LET $code = $prefix + "-" + string::uppercase(string::slice($uuid, 0, 5)); 
    LET $exists = (SELECT VALUE count() FROM type::table($table) WHERE string::starts_with(meta::id(id), $code) LIMIT 1)[0] ?? 0; 
    IF $exists > 0 THEN { 
        RETURN fn::gen_ref_code($prefix, $table); 
    } END; 
    RETURN $code; 
};

DEFINE FUNCTION fn::warehouse_stock($variant: record<product_variant>) { 
    LET $in_rows = (SELECT quantity FROM inbound WHERE variant = $variant AND is_reversed = false); 
    LET $in_qty = math::sum($in_rows.quantity); 
    LET $out_rows = (SELECT quantity FROM outbound WHERE variant = $variant AND is_reversed = false); 
    LET $out_qty = math::sum($out_rows.quantity); 
    RETURN $in_qty - $out_qty; 
};

DEFINE FUNCTION fn::consignment_qty($variant: record<product_variant>, $loc: record<consignment_location>) { 
    LET $cs = (SELECT VALUE quantity FROM consignment_stock WHERE variant = $variant AND location = $loc); 
    RETURN $cs ?? 0; 
};

DEFINE FUNCTION fn::total_stock($variant: record<product_variant>) { 
    LET $wh = fn::warehouse_stock($variant); 
    LET $cs_rows = (SELECT quantity FROM consignment_stock WHERE variant = $variant); 
    LET $cs = math::sum($cs_rows.quantity); 
    RETURN $wh + $cs; 
};

-- 租户可见产品
DEFINE FUNCTION fn::tenant_products($t: record<tenant>) { 
    RETURN SELECT * FROM product WHERE (is_platform_catalog = true AND status = '上架') OR owner_tenant = $t; 
};

-- 历史采购均价
DEFINE FUNCTION fn::avg_purchase_price($variant: record<product_variant>) { 
    LET $rows = (SELECT unit_price FROM inbound WHERE variant = $variant AND purchase_type = '采购' AND is_reversed = false AND unit_price IS NOT NONE); 
    RETURN math::mean($rows.unit_price); 
};

-- 利润率参考
DEFINE FUNCTION fn::profit_analysis($variant: record<product_variant>) { 
    LET $avg_cost = fn::avg_purchase_price($variant); 
    LET $spu = (SELECT * FROM product WHERE id = $variant.spu); 
    IF $avg_cost IS NONE OR $spu.price IS NONE THEN { RETURN NONE; } END; 
    RETURN { avg_cost: $avg_cost, current_cost: $spu.cost_price, suggested_price: $spu.price, margin_rate: ($spu.price - $avg_cost) / $spu.price, cost_trend: IF $spu.cost_price > $avg_cost THEN '成本上涨' ELSE IF $spu.cost_price < $avg_cost THEN '成本下降' ELSE '持平' END }; 
};

-- H5 聚合查询：某机构所有活跃门店
DEFINE FUNCTION fn::tenant_stores($tid: record<tenant>) { 
    RETURN (SELECT id, name, store_type, address, phone, cover_image, description, opening_hours, location FROM store WHERE tenant = $tid AND status = 'active' ORDER BY store_type, name); 
};

-- H5 聚合查询：某机构所有在职服务人员
DEFINE FUNCTION fn::tenant_service_staff($tid: record<tenant>) { 
    RETURN (SELECT id, (SELECT display_name FROM identity WHERE user = $parent.id LIMIT 1)[0].display_name AS name, phone, (SELECT avatar_url FROM identity WHERE user = $parent.id LIMIT 1)[0].avatar_url AS avatar, ->membership.store AS store FROM user WHERE ->membership->tenant = $tid AND ->membership.role = '服务人员' AND ->membership.status = 'active' ORDER BY name); 
};
