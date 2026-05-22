OPTION IMPORT;
-- ============================================================================
-- 00-bootstrap.surql — RFZv45 种子数据
-- 创建平台管理员用户 + 必要的初始数据
-- ============================================================================

LET $admin_id = user:admin;

-- 平台管理员（密码: admin123，用 argon2id）
CREATE $admin_id CONTENT {
  name: '如意管理员',
  password_hash: '$argon2id$v=19$m=19456,t=2,p=1$4A84Lkd6wf4j4nnhbgl5ZA$ehhqGTTAJvGJSWUI00hxgbWgrDGgJJJTqPEe59GPiHw',
  user_type: '平台',
  phone: '13800000001',
  current_role: '平台管理员',
  is_active: true,
};
