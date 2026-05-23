OPTION IMPORT;
-- @label 销售订单
-- @group order
DEFINE TABLE sales_order SCHEMAFULL CHANGEFEED 30d;
DEFINE FIELD so_no       ON sales_order TYPE string DEFAULT fn::gen_flow_code("SO", "sales_order");
DEFINE FIELD title       ON sales_order TYPE option<string>;
DEFINE FIELD order_type  ON sales_order TYPE string
    ASSERT $value IN ['法会项目','流通处供货','直销','分销'];
DEFINE FIELD tenant      ON sales_order TYPE option<record<tenant>>;
DEFINE FIELD store       ON sales_order TYPE option<record<store>>;
DEFINE FIELD h5_user     ON sales_order TYPE option<record<h5_user>>;
DEFINE FIELD total_amount ON sales_order TYPE decimal;
DEFINE FIELD status      ON sales_order TYPE string DEFAULT '待确认'
    ASSERT $value IN ['待确认','已确认','已发货','已完成','已取消'];
DEFINE FIELD customer    ON sales_order TYPE option<record<customer>>;
DEFINE FIELD operator    ON sales_order TYPE option<record<user>>;
-- ★ 补丁2：物流追踪
DEFINE FIELD shipping_method  ON sales_order TYPE option<string>;
DEFINE FIELD tracking_number  ON sales_order TYPE option<string>;
DEFINE FIELD shipped_by       ON sales_order TYPE option<record<tenant>>;
DEFINE FIELD shipped_at       ON sales_order TYPE option<datetime>;
DEFINE FIELD payment_method   ON sales_order TYPE option<string>
    ASSERT $value IN ['wechat_pay','wechat_transfer','bank_transfer','cash','other'];
DEFINE FIELD shipping_address ON sales_order TYPE option<object>;        -- ★ 下单时快照地址（省/市/区/详细/收件人/电话）
DEFINE FIELD notes       ON sales_order TYPE option<string>;
DEFINE FIELD documents   ON sales_order TYPE array<record<document>> DEFAULT [];  -- 订单合同/附件
DEFINE FIELD created_at  ON sales_order TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_so_no   ON sales_order FIELDS so_no UNIQUE;
DEFINE INDEX idx_so_tenant ON sales_order FIELDS tenant;

-- @label 订单明细
-- @group order
DEFINE TABLE order_item SCHEMAFULL CHANGEFEED 30d;
DEFINE FIELD order         ON order_item TYPE record<sales_order>;       -- ← record link
DEFINE FIELD variant       ON order_item TYPE record<product_variant>;   -- ← record link
DEFINE FIELD quantity      ON order_item TYPE int;
DEFINE FIELD unit_price    ON order_item TYPE decimal;
DEFINE FIELD total_amount  ON order_item TYPE decimal;
DEFINE FIELD is_reversed   ON order_item TYPE bool DEFAULT false;
DEFINE FIELD linked_inbound ON order_item TYPE option<record<inbound>>;  -- ← record link
DEFINE INDEX idx_oi_order  ON order_item FIELDS order;
