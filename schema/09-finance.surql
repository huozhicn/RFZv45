OPTION IMPORT;
-- @label 账户
-- @group finance
DEFINE TABLE account SCHEMAFULL;
DEFINE FIELD name         ON account TYPE string;
DEFINE FIELD account_type ON account TYPE string
    ASSERT $value IN ['微信商户','银行账户','现金','其他'];
DEFINE FIELD notes        ON account TYPE option<string>;

-- @label 交易流水
-- @group order
DEFINE TABLE transaction SCHEMAFULL CHANGEFEED 30d;
DEFINE FIELD tx_no        ON transaction TYPE string DEFAULT fn::gen_flow_code("TX", "transaction");
DEFINE FIELD tx_type      ON transaction TYPE string 
    ASSERT $value IN ['收入','支出','转账'];
DEFINE FIELD amount       ON transaction TYPE decimal;
DEFINE FIELD tx_date      ON transaction TYPE datetime DEFAULT time::now();
DEFINE FIELD category     ON transaction TYPE string
    ASSERT $value IN ['销售收入','采购支出','物流','运营','佣金支出','佣金捐赠','退款','随喜捐赠','其他'];
DEFINE FIELD operator     ON transaction TYPE option<record<user>>;      -- ← record link
DEFINE FIELD account      ON transaction TYPE option<record<account>>;   -- ← record link
DEFINE FIELD linked_order     ON transaction TYPE option<record<sales_order>>;     -- ← record link
DEFINE FIELD linked_commission ON transaction TYPE option<record<commission_record>>; -- ← record link 佣金支付
DEFINE FIELD linked_organization ON transaction TYPE option<record<organization>>;    -- ← record link 供应商付款
DEFINE FIELD notes        ON transaction TYPE option<string>;
DEFINE FIELD documents    ON transaction TYPE array<record<document>> DEFAULT [];  -- 回单/发票
DEFINE FIELD is_reversed  ON transaction TYPE bool DEFAULT false;   -- ★ 会计冲正
DEFINE INDEX idx_tx_no    ON transaction FIELDS tx_no UNIQUE;
DEFINE INDEX idx_tx_order ON transaction FIELDS linked_order;

-- 对账单
-- @label 对账单
-- @group finance
DEFINE TABLE settlement SCHEMAFULL CHANGEFEED 90d;
DEFINE FIELD settlement_no          ON settlement TYPE string DEFAULT fn::gen_flow_code("STL", "settlement");
DEFINE FIELD tenant                 ON settlement TYPE record<tenant>;  -- ← record link
DEFINE FIELD period_start           ON settlement TYPE datetime;
DEFINE FIELD period_end             ON settlement TYPE datetime;
DEFINE FIELD total_purchase_amount  ON settlement TYPE decimal DEFAULT 0;
DEFINE FIELD total_payment_received ON settlement TYPE decimal DEFAULT 0;
DEFINE FIELD balance                ON settlement TYPE decimal DEFAULT 0;
DEFINE FIELD status                 ON settlement TYPE string DEFAULT '待确认'
    ASSERT $value IN ['待确认','已确认','已结算'];
DEFINE FIELD notes                  ON settlement TYPE option<string>;
DEFINE FIELD documents              ON settlement TYPE array<record<document>> DEFAULT [];  -- 结算凭证
DEFINE FIELD created_at             ON settlement TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_settlement_tenant  ON settlement FIELDS tenant;

-- 对账生成：每月 1 号由应用层定时任务生成上月对账单——汇总该时段内该 tenant 的所有 sales_order + commission_record 数据，填入 total_purchase_amount / total_payment_received / balance，生成后状态为「待确认」，机构确认后标记「已确认」，如法造核对无误后标记「已结算」。
