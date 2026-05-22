OPTION IMPORT;
DEFINE TABLE dharma_event SCHEMAFULL;
DEFINE FIELD event_no    ON dharma_event TYPE string DEFAULT fn::gen_flow_code("DE", "dharma_event");
DEFINE FIELD title       ON dharma_event TYPE string;
DEFINE FIELD temple      ON dharma_event TYPE record<organization>;   -- ← record link
DEFINE FIELD event_type  ON dharma_event TYPE string
    ASSERT $value IN ['水陆法会','开光庆典','禅修营','佛七','其他'];
DEFINE FIELD event_date  ON dharma_event TYPE datetime;
DEFINE FIELD status      ON dharma_event TYPE string DEFAULT '筹备中'
    ASSERT $value IN ['筹备中','执行中','已完成','已取消'];
DEFINE FIELD total_amount ON dharma_event TYPE option<decimal>;
DEFINE FIELD operator    ON dharma_event TYPE option<record<user>>;
DEFINE FIELD orders      ON dharma_event TYPE array<record<sales_order>> DEFAULT [];
DEFINE FIELD documents   ON dharma_event TYPE array<record<document>> DEFAULT [];  -- 法会文件
DEFINE FIELD created_at  ON dharma_event TYPE datetime DEFAULT time::now();
DEFINE FIELD notes       ON dharma_event TYPE option<string>;
DEFINE INDEX idx_event_no ON dharma_event FIELDS event_no UNIQUE;

DEFINE TABLE event_material SCHEMAFULL;
DEFINE FIELD _check      ON event_material TYPE bool DEFAULT true
    ASSERT $this.variant IS NOT NONE OR $this.spu IS NOT NONE;
DEFINE FIELD event       ON event_material TYPE record<dharma_event>;       -- ← record link
DEFINE FIELD variant     ON event_material TYPE option<record<product_variant>>;  -- ← record link
DEFINE FIELD spu         ON event_material TYPE option<record<product>>;    -- ← record link
DEFINE FIELD quantity    ON event_material TYPE int;
DEFINE FIELD unit_price  ON event_material TYPE decimal;
DEFINE FIELD total_amount ON event_material TYPE decimal;
DEFINE FIELD notes       ON event_material TYPE option<string>;
DEFINE INDEX idx_em_event ON event_material FIELDS event;
