OPTION IMPORT;
DEFINE TABLE banner SCHEMAFULL;
DEFINE FIELD tenant     ON banner TYPE record<tenant>;     -- ← record link
DEFINE FIELD title      ON banner TYPE string;
DEFINE FIELD image_url  ON banner TYPE string;
DEFINE FIELD link_type  ON banner TYPE string 
    ASSERT $value IN ['product','activity','url'];
DEFINE FIELD link_value ON banner TYPE string;
DEFINE FIELD sort_order ON banner TYPE int DEFAULT 0;
DEFINE FIELD is_active  ON banner TYPE bool DEFAULT true;
DEFINE INDEX idx_banner_tenant ON banner FIELDS tenant;

DEFINE TABLE home_recommendation SCHEMAFULL;
DEFINE FIELD tenant     ON home_recommendation TYPE record<tenant>;  -- ← record link
DEFINE FIELD title      ON home_recommendation TYPE string;
DEFINE FIELD rec_type   ON home_recommendation TYPE string
    ASSERT $value IN ['product','activity','hot','new'];
DEFINE FIELD target_id  ON home_recommendation TYPE string;
DEFINE FIELD image_url  ON home_recommendation TYPE option<string>;
DEFINE FIELD sort_order ON home_recommendation TYPE int DEFAULT 0;
DEFINE FIELD is_active  ON home_recommendation TYPE bool DEFAULT true;
DEFINE INDEX idx_hr_tenant ON home_recommendation FIELDS tenant;
