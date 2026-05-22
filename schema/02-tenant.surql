OPTION IMPORT;
DEFINE TABLE tenant SCHEMAFULL CHANGEFEED 30d;
DEFINE FIELD name              ON tenant TYPE string;
DEFINE FIELD tenant_type       ON tenant TYPE string
    ASSERT $value IN ['国学机构','寺院流通处','福慧社区','福慧小店'];
DEFINE FIELD wechat_merchant_id ON tenant TYPE option<string>;
DEFINE FIELD logo_url          ON tenant TYPE option<string>;
DEFINE FIELD primary_color     ON tenant TYPE option<string>;
DEFINE FIELD domain_prefix     ON tenant TYPE option<string>;
DEFINE FIELD status            ON tenant TYPE string DEFAULT 'active'
    ASSERT $value IN ['active','inactive','suspended'];
DEFINE FIELD created_at        ON tenant TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_tenant_name   ON tenant FIELDS name;

DEFINE TABLE store SCHEMAFULL CHANGEFEED 30d;
DEFINE FIELD name          ON store TYPE string;
DEFINE FIELD store_type    ON store TYPE string DEFAULT '标准店'
    ASSERT $value IN ['旗舰店','标准店','流通点','法会摊位','社区点'];
DEFINE FIELD tenant        ON store TYPE record<tenant>;
DEFINE FIELD address       ON store TYPE option<string>;
DEFINE FIELD phone         ON store TYPE option<string>;
DEFINE FIELD cover_image   ON store TYPE option<string>;        -- 门店照片/门头照
DEFINE FIELD description   ON store TYPE option<string>;        -- 门店简介
DEFINE FIELD opening_hours ON store TYPE option<string>;        -- 营业时间
DEFINE FIELD location      ON store TYPE option<geometry<point>>; -- ★ H5地图：经纬度
DEFINE FIELD manager       ON store TYPE option<record<user>>;
DEFINE FIELD status     ON store TYPE string DEFAULT 'active'
    ASSERT $value IN ['active','inactive'];
DEFINE FIELD created_at ON store TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_store_tenant ON store FIELDS tenant;
DEFINE INDEX idx_store_geo    ON store FIELDS location;  -- ★ H5附近门店查询（SDB 3.0 自动用空间索引）

DEFINE FIELD documents ON tenant TYPE array<record<document>> DEFAULT [];  -- 租户附件
