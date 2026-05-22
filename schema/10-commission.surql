OPTION IMPORT;
DEFINE TABLE commission_setting SCHEMAFULL;
DEFINE FIELD _r          ON commission_setting TYPE bool DEFAULT true
    ASSERT $this.self_ratio + $this.donate_ratio <= 1.0;
DEFINE FIELD service_person ON commission_setting TYPE record<user>;          -- ← record link
DEFINE FIELD self_ratio     ON commission_setting TYPE decimal DEFAULT 1.0;
DEFINE FIELD donate_ratio   ON commission_setting TYPE decimal DEFAULT 0;
DEFINE FIELD donate_target  ON commission_setting TYPE option<record<organization>>;  -- ← record link
DEFINE FIELD updated_at     ON commission_setting TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_cs_sp      ON commission_setting FIELDS service_person UNIQUE;

DEFINE TABLE commission_record SCHEMAFULL;
DEFINE FIELD order            ON commission_record TYPE record<sales_order>;       -- ← record link
DEFINE FIELD service_person   ON commission_record TYPE record<user>;              -- ← record link
DEFINE FIELD variant          ON commission_record TYPE record<product_variant>;   -- ← record link
DEFINE FIELD total_commission ON commission_record TYPE decimal;
DEFINE FIELD self_amount      ON commission_record TYPE decimal;
DEFINE FIELD donate_amount    ON commission_record TYPE decimal;
DEFINE FIELD status           ON commission_record TYPE string DEFAULT '待结算'
    ASSERT $value IN ['待结算','已结算','已提现','已捐赠'];
DEFINE FIELD settled_at       ON commission_record TYPE option<datetime>;
DEFINE FIELD created_at       ON commission_record TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_cr_order     ON commission_record FIELDS order;
DEFINE FIELD documents ON commission_setting TYPE array<record<document>> DEFAULT [];  -- 佣金设置附件
DEFINE FIELD documents ON commission_record TYPE array<record<document>> DEFAULT [];  -- 佣金记录附件
