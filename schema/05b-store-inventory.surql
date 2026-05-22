OPTION IMPORT;
-- 门店自建产品库存（自建产品发货前在这里追踪）
DEFINE TABLE store_inventory SCHEMAFULL;
DEFINE FIELD store      ON store_inventory TYPE record<store>;
DEFINE FIELD variant    ON store_inventory TYPE record<product_variant>;
DEFINE FIELD quantity   ON store_inventory TYPE int;
DEFINE FIELD inv_type   ON store_inventory TYPE string
    ASSERT $value IN ['owned','consigned','self_built'];
-- owned=买断品(机构管) consigned=寄售品(如法造赊给机构) self_built=自建品
DEFINE FIELD updated_at ON store_inventory TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_si_sv  ON store_inventory FIELDS store, variant, inv_type UNIQUE;

-- 门店补货需求（主动向如法造申请补货）
DEFINE TABLE restock_request SCHEMAFULL;
DEFINE FIELD request_no  ON restock_request TYPE string DEFAULT fn::gen_flow_code("RR", "restock_request");
DEFINE FIELD store       ON restock_request TYPE record<store>;
DEFINE FIELD tenant      ON restock_request TYPE record<tenant>;
DEFINE FIELD variant     ON restock_request TYPE record<product_variant>;
DEFINE FIELD quantity    ON restock_request TYPE int;
DEFINE FIELD reason      ON restock_request TYPE option<string>;
DEFINE FIELD status      ON restock_request TYPE string DEFAULT '待处理'
    ASSERT $value IN ['待处理','已发货','已取消'];
DEFINE FIELD operator    ON restock_request TYPE record<user>;          -- 谁申请的
DEFINE FIELD created_at  ON restock_request TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_rr_store ON restock_request FIELDS store;

-- 退换货管理（客户退货 + 滞销退货 + 质量问题）
DEFINE TABLE product_return SCHEMAFULL;
DEFINE FIELD return_no   ON product_return TYPE string DEFAULT fn::gen_flow_code("RT", "product_return");
DEFINE FIELD return_type ON product_return TYPE string
    ASSERT $value IN ['客户退货','滞销退货','质量问题'];
DEFINE FIELD order       ON product_return TYPE option<record<sales_order>>;   -- 客户退货关联原订单
DEFINE FIELD variant     ON product_return TYPE record<product_variant>;
DEFINE FIELD quantity    ON product_return TYPE int;
DEFINE FIELD reason      ON product_return TYPE string;
DEFINE FIELD refund_amount ON product_return TYPE option<decimal>;
DEFINE FIELD status      ON product_return TYPE string DEFAULT '待处理'
    ASSERT $value IN ['待处理','已处理','已关闭'];
DEFINE FIELD warehouse   ON product_return TYPE option<record<warehouse>>;  -- 平台品退货入库仓
DEFINE FIELD documents   ON product_return TYPE array<record<document>> DEFAULT [];  -- 退货拍照/凭证
DEFINE FIELD store       ON product_return TYPE option<record<store>>;
DEFINE FIELD tenant      ON product_return TYPE record<tenant>;
DEFINE FIELD operator    ON product_return TYPE option<record<user>>;
DEFINE FIELD created_at   ON product_return TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_pr_no   ON product_return FIELDS return_no UNIQUE;

-- ★ 采购管理（如法造 → 供应商）
DEFINE TABLE purchase_order SCHEMAFULL CHANGEFEED 90d;
DEFINE FIELD po_no         ON purchase_order TYPE string DEFAULT fn::gen_flow_code("PO", "purchase_order");
DEFINE FIELD supplier      ON purchase_order TYPE record<organization>; -- ← record link 供应商
DEFINE FIELD status        ON purchase_order TYPE string DEFAULT '草稿'
    ASSERT $value IN ['草稿','已下单','部分到货','已完成','已取消'];
DEFINE FIELD total_amount  ON purchase_order TYPE decimal DEFAULT 0;
DEFINE FIELD expected_date ON purchase_order TYPE option<datetime>;    -- 期望到货日
DEFINE FIELD operator      ON purchase_order TYPE record<user>;        -- 谁创建的
DEFINE FIELD notes         ON purchase_order TYPE option<string>;
DEFINE FIELD documents     ON purchase_order TYPE array<record<document>> DEFAULT [];
DEFINE FIELD created_at    ON purchase_order TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_po_no     ON purchase_order FIELDS po_no UNIQUE;
DEFINE INDEX idx_po_supplier ON purchase_order FIELDS supplier;

DEFINE TABLE purchase_order_item SCHEMAFULL;
DEFINE FIELD order        ON purchase_order_item TYPE record<purchase_order>;    -- ← record link
DEFINE FIELD variant      ON purchase_order_item TYPE record<product_variant>;   -- ← record link
DEFINE FIELD quantity     ON purchase_order_item TYPE int;
DEFINE FIELD unit_price   ON purchase_order_item TYPE decimal;
DEFINE FIELD total_amount ON purchase_order_item TYPE decimal;
DEFINE FIELD received_qty ON purchase_order_item TYPE int DEFAULT 0;             -- 已入库数量
DEFINE FIELD status       ON purchase_order_item TYPE string DEFAULT '待收货'
    ASSERT $value IN ['待收货','部分收货','已收齐'];
DEFINE FIELD notes        ON purchase_order_item TYPE option<string>;
DEFINE INDEX idx_poi_order ON purchase_order_item FIELDS order;

-- ★ 通用 SOP 任务（机构总部 → 门店）
DEFINE TABLE sop_task SCHEMAFULL;
DEFINE FIELD title       ON sop_task TYPE string;
DEFINE FIELD objective   ON sop_task TYPE option<string>;             -- 任务目标/拜访目的
DEFINE FIELD task_type   ON sop_task TYPE string
    ASSERT $value IN ['盘点','布展','卫生','促销','培训','调货',          -- 机构门店
                      '拜访客户','客户回访',                                -- CRM
                      '财务对账','库存检查','数据报表','合同跟进','其他'];   -- 平台
DEFINE FIELD scope       ON sop_task TYPE string DEFAULT 'chain'
    ASSERT $value IN ['chain','platform','crm'];
-- ★ 推送粒度：全量 / 按店型 / 指定门店
DEFINE FIELD target_mode ON sop_task TYPE string DEFAULT 'specific'
    ASSERT $value IN ['all','by_type','specific'];
DEFINE FIELD target_store_types ON sop_task TYPE option<array<string>>;  -- by_type时：['旗舰店','标准店']
DEFINE FIELD target_stores ON sop_task TYPE option<array<record<store>>>; -- specific时：[store:xxx, store:yyy]
DEFINE FIELD tenant      ON sop_task TYPE option<record<tenant>>;  -- chain时必填（限定机构范围）
DEFINE FIELD customer    ON sop_task TYPE option<record<customer>>;  -- crm时必填
DEFINE FIELD schedule_type ON sop_task TYPE string DEFAULT 'once'
    ASSERT $value IN ['once','recurring'];
DEFINE FIELD recurrence_rule ON sop_task TYPE option<string>;      -- recurring 时填：'daily','weekly','monthly'
DEFINE FIELD created_by  ON sop_task TYPE record<user>;               -- 谁发的（机构总部）
DEFINE FIELD assigned_to ON sop_task TYPE option<record<user>>;       -- 指派给谁（门店店员）
DEFINE FIELD status      ON sop_task TYPE string DEFAULT '待执行'
    ASSERT $value IN ['待执行','执行中','已完成','已确认','已取消'];
DEFINE FIELD deadline    ON sop_task TYPE option<datetime>;
DEFINE FIELD result      ON sop_task TYPE option<string>;             -- 执行结果摘要
DEFINE FIELD documents   ON sop_task TYPE array<record<document>> DEFAULT [];  -- 执行拍照/合同扫描
DEFINE FIELD created_at  ON sop_task TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_sop_tenant ON sop_task FIELDS tenant;

-- 盘点结果（sop_task type='盘点' 时的附加明细）
DEFINE TABLE inventory_count SCHEMAFULL;
DEFINE FIELD task         ON inventory_count TYPE record<sop_task>;
DEFINE FIELD store        ON inventory_count TYPE record<store>;
DEFINE FIELD variant      ON inventory_count TYPE record<product_variant>;
DEFINE FIELD inv_type     ON inventory_count TYPE string
    ASSERT $value IN ['owned','consigned','self_built'];
DEFINE FIELD expected_qty ON inventory_count TYPE int;
DEFINE FIELD actual_qty   ON inventory_count TYPE int;
DEFINE FIELD diff         ON inventory_count TYPE int;
DEFINE FIELD operator     ON inventory_count TYPE record<user>;
DEFINE FIELD check_date   ON inventory_count TYPE datetime DEFAULT time::now();
DEFINE FIELD documents    ON inventory_count TYPE array<record<document>> DEFAULT [];  -- 盘点拍照
DEFINE INDEX idx_ic_task ON inventory_count FIELDS task;
