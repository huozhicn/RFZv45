OPTION IMPORT;
-- @label 运营活动
-- @group marketing
DEFINE TABLE activity SCHEMAFULL CHANGEFEED 30d;
DEFINE FIELD title                ON activity TYPE string;
DEFINE FIELD description          ON activity TYPE option<string>;
DEFINE FIELD cover_image          ON activity TYPE option<string>;
DEFINE FIELD start_time           ON activity TYPE datetime;
DEFINE FIELD end_time             ON activity TYPE datetime;
DEFINE FIELD location             ON activity TYPE option<string>;
DEFINE FIELD max_participants     ON activity TYPE option<int>;
DEFINE FIELD registration_deadline ON activity TYPE option<datetime>;
DEFINE FIELD price                ON activity TYPE decimal DEFAULT 0;
DEFINE FIELD status               ON activity TYPE string DEFAULT '草稿'
    ASSERT $value IN ['草稿','已发布','已结束','已取消'];
DEFINE FIELD tenant               ON activity TYPE record<tenant>;                    -- ← record link
DEFINE FIELD store                ON activity TYPE option<record<store>>;             -- ← record link
DEFINE FIELD linked_products      ON activity TYPE option<array<object>>;              -- ★ 对象数组：含SKU/数量/活动价
DEFINE FIELD linked_products.*.variant         ON activity TYPE record<product_variant>;
DEFINE FIELD linked_products.*.quantity        ON activity TYPE int DEFAULT 1;
DEFINE FIELD linked_products.*.activity_price  ON activity TYPE option<decimal>;           -- 空=原价
DEFINE FIELD documents            ON activity TYPE array<record<document>> DEFAULT [];     -- 活动海报/材料
DEFINE FIELD created_at           ON activity TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_activity_tenant  ON activity FIELDS tenant;

-- @label 活动报名
-- @group marketing
DEFINE TABLE registration SCHEMAFULL;
DEFINE FIELD activity     ON registration TYPE record<activity>;    -- ← record link
DEFINE FIELD h5_user      ON registration TYPE record<h5_user>;     -- ← record link
DEFINE FIELD quantity     ON registration TYPE int DEFAULT 1;
DEFINE FIELD contact_info ON registration TYPE option<string>;
DEFINE FIELD status       ON registration TYPE string DEFAULT '待确认'
    ASSERT $value IN ['待确认','已确认','已取消','已签到'];
DEFINE FIELD checked_in_at ON registration TYPE option<datetime>;          -- 线下签到时间
DEFINE FIELD created_at   ON registration TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_reg_activity ON registration FIELDS activity;
