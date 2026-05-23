OPTION IMPORT;
-- @label 仓库
-- @group org
DEFINE TABLE warehouse SCHEMAFULL;
DEFINE FIELD name    ON warehouse TYPE string;
DEFINE FIELD address ON warehouse TYPE option<string>;

-- 入库
-- @label 入库单
-- @group inventory
DEFINE TABLE inbound SCHEMAFULL CHANGEFEED 30d;
DEFINE FIELD inbound_no    ON inbound TYPE string DEFAULT fn::gen_flow_code("IB", "inbound");
DEFINE FIELD variant       ON inbound TYPE record<product_variant>;   -- ← record link
DEFINE FIELD quantity      ON inbound TYPE int;
DEFINE FIELD unit          ON inbound TYPE string DEFAULT '个';
DEFINE FIELD purchase_type ON inbound TYPE string
    ASSERT $value IN ['采购','生产','退货','样品','调拨','寄售退货'];
DEFINE FIELD unit_price    ON inbound TYPE option<decimal>;
DEFINE FIELD total_amount  ON inbound TYPE option<decimal>;
DEFINE FIELD supplier      ON inbound TYPE option<record<organization>>;  -- ← record link
DEFINE FIELD warehouse     ON inbound TYPE record<warehouse>;            -- ← record link
DEFINE FIELD operator      ON inbound TYPE option<record<user>>;         -- ← record link
DEFINE FIELD is_reversed   ON inbound TYPE bool DEFAULT false;
DEFINE FIELD linked_outbound ON inbound TYPE option<record<outbound>>;   -- ← record link
DEFINE FIELD linked_order  ON inbound TYPE option<record<sales_order>>;  -- ← record link
DEFINE FIELD linked_purchase_order ON inbound TYPE option<record<purchase_order>>;  -- ← 采购入库关联
DEFINE FIELD notes         ON inbound TYPE option<string>;
DEFINE FIELD documents     ON inbound TYPE array<record<document>> DEFAULT [];  -- 单据扫描
DEFINE FIELD created_at    ON inbound TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_inbound_no ON inbound FIELDS inbound_no UNIQUE;
DEFINE INDEX idx_inbound_var ON inbound FIELDS variant;

-- 出库
-- @label 出库单
-- @group inventory
DEFINE TABLE outbound SCHEMAFULL CHANGEFEED 30d;
DEFINE FIELD outbound_no   ON outbound TYPE string DEFAULT fn::gen_flow_code("OB", "outbound");
DEFINE FIELD variant       ON outbound TYPE record<product_variant>;  -- ← record link
DEFINE FIELD quantity      ON outbound TYPE int;
DEFINE FIELD unit          ON outbound TYPE string DEFAULT '个';
DEFINE FIELD outbound_type ON outbound TYPE string
    ASSERT $value IN ['销售','铺货','调拨','结缘'];
DEFINE FIELD target_warehouse ON outbound TYPE option<record<warehouse>>;  -- 调拨时填目标仓库
DEFINE FIELD target_store     ON outbound TYPE option<record<store>>;      -- 铺货/结缘时填目标门店
DEFINE FIELD unit_price    ON outbound TYPE option<decimal>;
DEFINE FIELD total_amount  ON outbound TYPE option<decimal>;
DEFINE FIELD customer      ON outbound TYPE option<record<customer>>; -- ← record link
DEFINE FIELD operator      ON outbound TYPE option<record<user>>;     -- ← record link
DEFINE FIELD is_reversed   ON outbound TYPE bool DEFAULT false;
DEFINE FIELD linked_order  ON outbound TYPE option<record<sales_order>>;  -- ← record link
DEFINE FIELD notes         ON outbound TYPE option<string>;
DEFINE FIELD documents     ON outbound TYPE array<record<document>> DEFAULT [];  -- 出库单据
DEFINE FIELD created_at    ON outbound TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_outbound_no ON outbound FIELDS outbound_no UNIQUE;

-- 寄售点
-- @label 寄售点
-- @group inventory
DEFINE TABLE consignment_location SCHEMAFULL;
DEFINE FIELD name          ON consignment_location TYPE string;
DEFINE FIELD location_type ON consignment_location TYPE string
    ASSERT $value IN ['妙供空间','福慧空间'];
DEFINE FIELD tenant        ON consignment_location TYPE record<tenant>;      -- ← record link
DEFINE FIELD store         ON consignment_location TYPE option<record<store>>;  -- ← record link
DEFINE FIELD address       ON consignment_location TYPE option<string>;
DEFINE FIELD manager       ON consignment_location TYPE option<record<user>>; -- ← record link

-- 寄售库存
-- @label 寄售库存
-- @group inventory
DEFINE TABLE consignment_stock SCHEMAFULL;
DEFINE FIELD variant  ON consignment_stock TYPE record<product_variant>;   -- ← record link
DEFINE FIELD location ON consignment_stock TYPE record<consignment_location>; -- ← record link
DEFINE FIELD quantity ON consignment_stock TYPE int;
DEFINE FIELD last_check_date ON consignment_stock TYPE option<datetime>;
DEFINE INDEX idx_cs_var_loc ON consignment_stock FIELDS variant, location UNIQUE;

-- 盘点
-- @label 寄售盘点
-- @group inventory
DEFINE TABLE consignment_check SCHEMAFULL;
DEFINE FIELD location        ON consignment_check TYPE record<consignment_location>;  -- ← record link
DEFINE FIELD variant         ON consignment_check TYPE record<product_variant>;       -- ← record link
DEFINE FIELD prev_stock      ON consignment_check TYPE int;
DEFINE FIELD actual_stock    ON consignment_check TYPE int;
DEFINE FIELD sold_quantity   ON consignment_check TYPE int;
DEFINE FIELD return_quantity ON consignment_check TYPE int DEFAULT 0;
DEFINE FIELD unit_price      ON consignment_check TYPE option<decimal>;
DEFINE FIELD total_amount    ON consignment_check TYPE option<decimal>;
DEFINE FIELD status      ON consignment_check TYPE string DEFAULT '待处理'
    ASSERT $value IN ['待处理','已盘点','已结算'];
DEFINE FIELD operator     ON consignment_check TYPE option<record<user>>;
DEFINE FIELD check_date      ON consignment_check TYPE datetime DEFAULT time::now();
DEFINE FIELD documents ON consignment_location TYPE array<record<document>> DEFAULT [];  -- 寄售点附件
DEFINE FIELD documents ON restock_request TYPE array<record<document>> DEFAULT [];  -- 补货申请附件
