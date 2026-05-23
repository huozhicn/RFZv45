OPTION IMPORT;
-- ============================================================================
-- 00-bootstrap.surql — RFZv45 种子数据
-- 创建平台管理员用户
-- ============================================================================

LET $admin_id = user:admin;

-- 平台管理员（密码: admin123）
CREATE $admin_id CONTENT {
  name: '如意管理员',
  password_hash: '$argon2id$v=19$m=19456,t=2,p=1$4A84Lkd6wf4j4nnhbgl5ZA$ehhqGTTAJvGJSWUI00hxgbWgrDGgJJJTqPEe59GPiHw',
  user_type: '平台',
  phone: '13800000001',
  current_role: '平台管理员',
  is_active: true,
};

-- 其他测试用户密码统一为 test123
-- 张经理   (经理)     李店长   (门店店长)
-- 王店员   (店员)     赵业务   (业务员)
