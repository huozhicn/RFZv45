OPTION IMPORT;
DEFINE TABLE h5_user SCHEMAFULL;
DEFINE FIELD wechat_openid ON h5_user TYPE string;
DEFINE FIELD tenant        ON h5_user TYPE record<tenant>;       -- ★ 租户隔离
DEFINE FIELD phone         ON h5_user TYPE option<string>;
DEFINE FIELD name          ON h5_user TYPE option<string>;       -- 昵称（每个商城独立）
DEFINE FIELD avatar        ON h5_user TYPE option<string>;       -- 头像（每个商城独立）
DEFINE FIELD addresses     ON h5_user TYPE option<array>;        -- ★ 地址簿内嵌，不独立建表
DEFINE FIELD addresses.*   ON h5_user TYPE object;
DEFINE FIELD addresses.*.name       ON h5_user TYPE string;
DEFINE FIELD addresses.*.phone      ON h5_user TYPE string;
DEFINE FIELD addresses.*.province   ON h5_user TYPE string;
DEFINE FIELD addresses.*.city       ON h5_user TYPE string;
DEFINE FIELD addresses.*.district   ON h5_user TYPE string;
DEFINE FIELD addresses.*.detail     ON h5_user TYPE string;
DEFINE FIELD addresses.*.is_default ON h5_user TYPE bool DEFAULT false;
DEFINE FIELD created_at    ON h5_user TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_h5u_openid_tenant ON h5_user FIELDS wechat_openid, tenant UNIQUE;
DEFINE INDEX idx_h5u_tenant ON h5_user FIELDS tenant;

-- 服务人员绑定
DEFINE TABLE service_binding SCHEMAFULL;
DEFINE FIELD h5_user        ON service_binding TYPE record<h5_user>;   -- ← record link
DEFINE FIELD service_person ON service_binding TYPE record<user>;      -- ← record link
DEFINE FIELD tenant         ON service_binding TYPE record<tenant>;    -- ← record link
DEFINE FIELD created_at     ON service_binding TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_sb_user    ON service_binding FIELDS h5_user, tenant UNIQUE;

-- 购物车（独立表，因为需要独立查询"哪些购物车含某variant"）
DEFINE TABLE cart SCHEMAFULL;
DEFINE FIELD h5_user  ON cart TYPE record<h5_user>;          -- ← record link
DEFINE FIELD tenant   ON cart TYPE record<tenant>;            -- ← record link
DEFINE FIELD variant  ON cart TYPE record<product_variant>;   -- ← record link
DEFINE FIELD quantity ON cart TYPE int DEFAULT 1;
DEFINE FIELD created_at ON cart TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON cart TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_cart_uv ON cart FIELDS h5_user, tenant, variant UNIQUE;

-- 收藏
DEFINE TABLE favorite SCHEMAFULL;
DEFINE FIELD h5_user       ON favorite TYPE record<h5_user>;          -- ← record link
DEFINE FIELD variant       ON favorite TYPE record<product_variant>;  -- ← record link
DEFINE FIELD product_name  ON favorite TYPE string;
DEFINE FIELD product_price ON favorite TYPE decimal;
DEFINE FIELD product_image ON favorite TYPE option<string>;
DEFINE FIELD created_at    ON favorite TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_fav_uv    ON favorite FIELDS h5_user, variant UNIQUE;
