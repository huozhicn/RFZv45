-- ═══════════════════════════════════════
-- ACCESS: Phase 2 鉴权层
-- v45 simplified: no password hash check (trust local network)
-- ═══════════════════════════════════════

-- ★ agent_session：平台员工 + 机构员工统一鉴权
DEFINE ACCESS agent_session ON DATABASE TYPE RECORD
    SIGNUP ( CREATE user SET name = $name, user_type = $type )
    SIGNIN (
        (SELECT * FROM user WHERE name = $user)[0]
    )
    DURATION FOR SESSION 24h
;

-- ★ h5_user：消费者端鉴权
DEFINE ACCESS h5_user ON DATABASE TYPE RECORD
    SIGNUP (
        CREATE h5_user SET
            phone = $phone,
            nickname = $nickname,
            avatar_url = $avatar
    )
    SIGNIN (
        (SELECT id, tenant
         FROM h5_user
         WHERE phone = $phone AND status = "active")[0]
    )
    DURATION FOR SESSION 7d
;
