OPTION IMPORT;
DEFINE TABLE product_category SCHEMAFULL CHANGEFEED 30d;
DEFINE FIELD name        ON product_category TYPE string;
DEFINE FIELD slug        ON product_category TYPE string;
DEFINE FIELD description ON product_category TYPE option<string>;
DEFINE FIELD sort_order  ON product_category TYPE int DEFAULT 0;
DEFINE INDEX idx_cat_slug ON product_category FIELDS slug UNIQUE;

DEFINE TABLE product SCHEMAFULL CHANGEFEED 30d;
DEFINE FIELD name               ON product TYPE string;
DEFINE FIELD sku                ON product TYPE string;
DEFINE FIELD description        ON product TYPE option<string>;
DEFINE FIELD unit               ON product TYPE string DEFAULT '个';
-- 定价（简化：只留成本、售价、佣金比例）
DEFINE FIELD cost_price         ON product TYPE option<decimal>;          -- 进货成本
DEFINE FIELD price              ON product TYPE decimal;                  -- 建议零售价
DEFINE FIELD channels           ON product TYPE option<array>;            -- ["线下","商城"]
DEFINE FIELD status             ON product TYPE string DEFAULT '上架'
    ASSERT $value IN ['上架','下架'];
-- 内容（平台统一）
DEFINE FIELD main_image_url     ON product TYPE option<string>;
DEFINE FIELD detail_image_urls  ON product TYPE option<array>;
DEFINE FIELD product_intro      ON product TYPE option<string>;
DEFINE FIELD content_embedding  ON product TYPE option<array<float>>;
-- 所有权
DEFINE FIELD owner_tenant       ON product TYPE option<record<tenant>>;  -- NULL=平台
DEFINE FIELD is_platform_catalog ON product TYPE bool DEFAULT true;
-- ★ 多分类：用 array<record<>> 替代 categorized_as RELATION
DEFINE FIELD categories         ON product TYPE array<record<product_category>> DEFAULT [];
-- ★ 多供应商：用 array<record<>> 替代 supplied_by RELATION
DEFINE FIELD suppliers          ON product TYPE array<record<organization>> DEFAULT [];
-- ★ 法律文件：用 array<record<>> 替代 attached_to RELATION
DEFINE FIELD documents          ON product TYPE array<record<document>> DEFAULT [];
DEFINE FIELD notes              ON product TYPE option<string>;
DEFINE FIELD created_at         ON product TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_product_sku    ON product FIELDS sku UNIQUE;
DEFINE INDEX idx_product_vec    ON product FIELDS content_embedding HNSW DIMENSION 1024 DIST COSINE TYPE F32;
-- 全文搜索（SDB 原生 ANALYZER）
DEFINE ANALYZER product_search TOKENIZERS blank, class FILTERS lowercase, ngram(2,5);
DEFINE INDEX idx_product_fts_name  ON product FIELDS name FULLTEXT ANALYZER product_search BM25(1.2,0.75);
DEFINE INDEX idx_product_fts_desc  ON product FIELDS description FULLTEXT ANALYZER product_search BM25(1.2,0.75);
DEFINE INDEX idx_product_fts_intro ON product FIELDS product_intro FULLTEXT ANALYZER product_search BM25(1.2,0.75);

-- SKU
DEFINE TABLE product_variant SCHEMAFULL CHANGEFEED 30d;
DEFINE FIELD spu        ON product_variant TYPE record<product>;   -- ← record link
DEFINE FIELD sku        ON product_variant TYPE string;
DEFINE FIELD spec_name  ON product_variant TYPE string;
DEFINE FIELD price      ON product_variant TYPE decimal;           -- ⚠️ 必须 decimal
DEFINE FIELD stock      ON product_variant TYPE int DEFAULT 0;
DEFINE FIELD image_url  ON product_variant TYPE option<string>;
DEFINE FIELD is_active  ON product_variant TYPE bool DEFAULT true;
DEFINE FIELD created_at ON product_variant TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_var_sku ON product_variant FIELDS sku UNIQUE;
DEFINE INDEX idx_var_spu ON product_variant FIELDS spu;
