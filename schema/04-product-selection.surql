OPTION IMPORT;
DEFINE TABLE tenant_product_selection SCHEMAFULL CHANGEFEED 30d;
DEFINE FIELD tenant       ON tenant_product_selection TYPE record<tenant>;      -- ← record link
DEFINE FIELD variant      ON tenant_product_selection TYPE record<product_variant>; -- ← record link
DEFINE FIELD custom_price ON tenant_product_selection TYPE decimal;
DEFINE FIELD commission_rate ON tenant_product_selection TYPE option<decimal>;    -- 机构自设佣金比例
DEFINE FIELD is_active    ON tenant_product_selection TYPE bool DEFAULT true;
DEFINE FIELD selected_at  ON tenant_product_selection TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_sel_tenant_var ON tenant_product_selection FIELDS tenant, variant UNIQUE;
DEFINE INDEX idx_sel_tenant ON tenant_product_selection FIELDS tenant;
