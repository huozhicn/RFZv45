OPTION IMPORT;
-- @label 用户
-- @group org
DEFINE TABLE user SCHEMAFULL CHANGEFEED 30d;
DEFINE FIELD name          ON user TYPE string;
DEFINE FIELD user_type     ON user TYPE string
    ASSERT $value IN ['平台', '租户'];
DEFINE FIELD phone         ON user TYPE option<string>;
DEFINE FIELD wechat        ON user TYPE option<string>;
DEFINE FIELD is_active     ON user TYPE bool DEFAULT true;
DEFINE FIELD password_hash ON user TYPE option<string>
    COMMENT 'argon2 hash for agent_session SIGNIN';
DEFINE FIELD current_role   ON user TYPE option<string>
    COMMENT 'Denormalized: synced from membership by Event';
DEFINE FIELD current_tenant ON user TYPE option<record<tenant>>
    COMMENT 'Denormalized: synced from membership by Event';
DEFINE FIELD notes         ON user TYPE option<string>;
DEFINE FIELD created_at    ON user TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_user_name ON user FIELDS name UNIQUE;

-- 多渠道身份：N:1 → identity 通过 record<link> 指回 user
DEFINE TABLE identity SCHEMAFULL;

DEFINE FIELD platform     ON identity TYPE string
    ASSERT $value IN ['wecom','telegram'];
DEFINE FIELD platform_id  ON identity TYPE string;
DEFINE FIELD display_name ON identity TYPE string;
DEFINE FIELD avatar_url   ON identity TYPE option<string>;
DEFINE FIELD user         ON identity TYPE record<user>;    -- ← record link, 不再用 RELATION
DEFINE INDEX idx_identity ON identity FIELDS platform, platform_id UNIQUE;


-- ★ 人事管理：membership 是 user → tenant 的图边（RELATION），边上带人事属性
-- @label 成员关系
-- @group org
DEFINE TABLE membership TYPE RELATION IN user OUT tenant SCHEMAFULL CHANGEFEED 90d;

DEFINE FIELD store       ON membership TYPE option<record<store>>;  -- 门店员工必填，总部员工为空
DEFINE FIELD role        ON membership TYPE string
    ASSERT $value IN ['经理','业务员','财务','门店店长','店员','服务人员','空间负责人'];
DEFINE FIELD status      ON membership TYPE string DEFAULT 'active'
    ASSERT $value IN ['active','suspended','resigned','terminated'];
DEFINE FIELD joined_at   ON membership TYPE datetime DEFAULT time::now();
DEFINE FIELD left_at     ON membership TYPE option<datetime>;
DEFINE FIELD can_operate ON membership TYPE bool DEFAULT true;
DEFINE FIELD notes       ON membership TYPE option<string>;
DEFINE INDEX idx_membership_user ON membership FIELDS in, out UNIQUE;
DEFINE INDEX idx_membership_store ON membership FIELDS store;
