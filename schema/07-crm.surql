OPTION IMPORT;
-- @label 组织机构
-- @group org
DEFINE TABLE organization SCHEMAFULL CHANGEFEED 30d;
DEFINE FIELD name     ON organization TYPE string;
DEFINE FIELD org_type ON organization TYPE string
    ASSERT $value IN ['供应商','寺院','代工厂','妙供空间','福慧空间'];
DEFINE FIELD phone    ON organization TYPE option<string>;
DEFINE FIELD address  ON organization TYPE option<string>;
DEFINE FIELD notes    ON organization TYPE option<string>;
DEFINE INDEX idx_org_name ON organization FIELDS name;

-- organization vs customer 区分：organization 是业务实体，customer 是销售对象。同一寺院可同时是两者——用 customer.linked_organization 桥接。

-- @label 联系人
-- @group crm
DEFINE TABLE contact SCHEMAFULL;
DEFINE FIELD name         ON contact TYPE string;
DEFINE FIELD phone        ON contact TYPE option<string>;
DEFINE FIELD wechat       ON contact TYPE option<string>;
DEFINE FIELD title        ON contact TYPE option<string>;
DEFINE FIELD organization ON contact TYPE record<organization>;  -- ← record link（替代 works_at RELATION）
DEFINE FIELD notes        ON contact TYPE option<string>;
DEFINE INDEX idx_contact_org ON contact FIELDS organization;

-- 客户档案
-- @label 客户
-- @group crm
DEFINE TABLE customer SCHEMAFULL CHANGEFEED 30d;
DEFINE FIELD name          ON customer TYPE string;
DEFINE FIELD customer_type ON customer TYPE string
    ASSERT $value IN ['寺院','居士','福慧空间'];
DEFINE FIELD phone         ON customer TYPE option<string>;
DEFINE FIELD wechat        ON customer TYPE option<string>;
DEFINE FIELD address       ON customer TYPE option<string>;
DEFINE FIELD assigned_to   ON customer TYPE option<record<user>>;      -- ← record link
DEFINE FIELD referred_by   ON customer TYPE option<record<customer>>;  -- ← record link（替代 customer_referred_by RELATION，推荐链）
DEFINE FIELD organizations ON customer TYPE array<record<organization>> DEFAULT [];  -- ← array 替代 customer_related_to
DEFINE FIELD linked_organization ON customer TYPE option<record<organization>>;  -- ★ 桥接：当客户同时是寺院/机构实体时
DEFINE FIELD source        ON customer TYPE option<string>;
DEFINE FIELD source_detail ON customer TYPE option<string>;
DEFINE FIELD level         ON customer TYPE string DEFAULT '普通'
    ASSERT $value IN ['普通','潜力','大客户'];
DEFINE FIELD notes         ON customer TYPE option<string>;
DEFINE FIELD documents     ON customer TYPE array<record<document>> DEFAULT [];  -- 客户资质/合同
DEFINE FIELD created_at    ON customer TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_cust_name ON customer FIELDS name;

-- 沟通记录
-- @label 沟通记录
-- @group crm
DEFINE TABLE communication_log SCHEMAFULL CHANGEFEED 30d;
DEFINE FIELD customer           ON communication_log TYPE record<customer>;     -- ← record link
DEFINE FIELD contact            ON communication_log TYPE option<record<contact>>;  -- ← record link
DEFINE FIELD communication_date ON communication_log TYPE datetime DEFAULT time::now();
DEFINE FIELD method             ON communication_log TYPE string
    ASSERT $value IN ['电话','微信','上门拜访','线下见面','其他'];
DEFINE FIELD purpose            ON communication_log TYPE string
    ASSERT $value IN ['主动推介','随缘需求','定期回访','售后','其他'];
DEFINE FIELD summary            ON communication_log TYPE string;
DEFINE FIELD follow_up          ON communication_log TYPE option<string>;
DEFINE FIELD operator           ON communication_log TYPE record<user>;       -- ← record link
DEFINE FIELD linked_campaign    ON communication_log TYPE option<record<sales_campaign>>;  -- ← record link
DEFINE FIELD linked_demand      ON communication_log TYPE option<record<demand>>;          -- ← record link
DEFINE FIELD documents          ON communication_log TYPE array<record<document>> DEFAULT [];  -- 沟通记录附件
DEFINE FIELD documents     ON organization TYPE array<record<document>> DEFAULT [];         -- 组织附件
DEFINE FIELD documents     ON demand TYPE array<record<document>> DEFAULT [];               -- 需求附件
DEFINE FIELD documents     ON sales_campaign TYPE array<record<document>> DEFAULT [];        -- 战役附件
DEFINE INDEX idx_comm_customer ON communication_log FIELDS customer;

-- 销售战役
-- @label 销售战役
-- @group marketing
DEFINE TABLE sales_campaign SCHEMAFULL;
DEFINE FIELD campaign_no  ON sales_campaign TYPE string DEFAULT fn::gen_flow_code("CP", "sales_campaign");
DEFINE FIELD title         ON sales_campaign TYPE string;
DEFINE FIELD description   ON sales_campaign TYPE option<string>;
DEFINE FIELD start_date    ON sales_campaign TYPE datetime;
DEFINE FIELD end_date      ON sales_campaign TYPE datetime;
DEFINE FIELD status        ON sales_campaign TYPE string DEFAULT '计划中'
    ASSERT $value IN ['计划中','进行中','已完成','已停止'];
DEFINE FIELD created_by    ON sales_campaign TYPE record<user>;
DEFINE FIELD created_at    ON sales_campaign TYPE datetime DEFAULT time::now();

-- 战役目标客户
-- @label 战役目标
-- @group marketing
DEFINE TABLE campaign_target SCHEMAFULL;
DEFINE FIELD campaign     ON campaign_target TYPE record<sales_campaign>;   -- ← record link
DEFINE FIELD customer     ON campaign_target TYPE record<customer>;         -- ← record link
DEFINE FIELD status       ON campaign_target TYPE string DEFAULT '待联系'
    ASSERT $value IN ['待联系','已联系','有意向','无兴趣','已完成'];
DEFINE FIELD feedback     ON campaign_target TYPE option<string>;
DEFINE FIELD contacted_at ON campaign_target TYPE option<datetime>;
DEFINE FIELD operator     ON campaign_target TYPE record<user>;            -- ← record link
DEFINE INDEX idx_ct_campaign ON campaign_target FIELDS campaign;

-- 随缘需求
-- @label 随缘需求
-- @group crm
DEFINE TABLE demand SCHEMAFULL;
DEFINE FIELD customer        ON demand TYPE record<customer>;         -- ← record link
DEFINE FIELD description     ON demand TYPE string;
DEFINE FIELD demand_type     ON demand TYPE string
    ASSERT $value IN ['法会采购','补货','定制','咨询','售后','其他'];
DEFINE FIELD priority        ON demand TYPE string DEFAULT '普通'
    ASSERT $value IN ['紧急','高','普通','低'];
DEFINE FIELD status          ON demand TYPE string DEFAULT '待处理'
    ASSERT $value IN ['待处理','已报价','已转化','已关闭'];
DEFINE FIELD quoted_amount   ON demand TYPE option<decimal>;           -- 报价金额
DEFINE FIELD operator        ON demand TYPE record<user>;     -- ← record link 登记人
DEFINE FIELD converted_order ON demand TYPE option<record<sales_order>>; -- ← record link
DEFINE FIELD created_at      ON demand TYPE datetime DEFAULT time::now();
