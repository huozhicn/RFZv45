-- ============================================================================
-- 20-agent.surql — Agent 对话系统
-- 用户与 Hermes Agent 之间的对话消息存储、预处理、分发
-- ============================================================================

-- ── 1. 对话消息表 ──

DEFINE TABLE agent_message SCHEMAFULL PERMISSIONS
  FOR select WHERE $auth.current_role IS NOT NULL
  FOR create WHERE true
  FOR update WHERE $auth.current_role INSIDE ['经理', '平台管理员']
  FOR delete WHERE false
;

DEFINE FIELD user_input ON agent_message TYPE string
  COMMENT '用户原始输入（自然语言）';

DEFINE FIELD attachments ON agent_message TYPE option<array>
  COMMENT '用户附件: [{name, type, data(base64), size}]';

DEFINE FIELD response ON agent_message TYPE option<string>
  COMMENT 'Agent 文字回复';

DEFINE FIELD actions ON agent_message TYPE option<array>
  COMMENT 'Agent 操作指令序列: navigate | filter | highlight | open_detail | open_create | data | confirm | download | refresh | reply';

DEFINE FIELD status ON agent_message TYPE string
  ASSERT $value INSIDE ['pending', 'processing', 'done', 'error']
  DEFAULT 'pending'
  COMMENT 'pending=待处理 | processing=Agent处理中 | done=已完成 | error=出错';

DEFINE FIELD session_id ON agent_message TYPE string
  COMMENT '会话 ID，同一用户同一次对话共享';

DEFINE FIELD created_by ON agent_message TYPE record<user>
  COMMENT '发送消息的用户';

DEFINE FIELD created_at ON agent_message TYPE datetime DEFAULT time::now();

DEFINE FIELD processed_at ON agent_message TYPE option<datetime>
  COMMENT 'Agent 完成处理的时间';

DEFINE INDEX idx_agent_session ON agent_message FIELDS session_id, created_at;
DEFINE INDEX idx_agent_status ON agent_message FIELDS status, created_at;


-- ── 2. Agent 消息预处理函数 ──
-- SDB 层注入权限上下文，Agent 收到后无需再查表

DEFINE FUNCTION fn::agent_payload($msg_id: record<agent_message>) {
  LET $msg = (SELECT id, user_input, session_id, created_by FROM agent_message WHERE id = $msg_id)[0];
  LET $u = (SELECT id, name, current_role, current_tenant FROM user WHERE id = $msg.created_by)[0];
  
  -- 获取店员/店长的绑定门店
  LET $store = IF $u.current_role INSIDE ['门店店长', '店员'] THEN
    (SELECT VALUE ->membership.store[0] FROM user WHERE id = $msg.created_by)
  ELSE NONE END;
  
  RETURN {
    message_id: <string> $msg.id,
    user_input: $msg.user_input,
    session_id: $msg.session_id,
    auth: {
      role: $u.current_role,
      tenant: $u.current_tenant,
      store: IF $store THEN <string> $store ELSE NONE END,
      user_id: <string> $u.id,
      user_name: $u.name
    }
  };
} PERMISSIONS FULL;


-- ── 3. 事件：新消息 → 通知 Hermes Agent ──
-- 注意：http::post 的 URL 需要在部署时替换为实际的 Hermes webhook 地址

-- DEFINE EVENT agent_dispatch ON agent_message
--   WHEN $event = 'CREATE' AND $after.status = 'pending' THEN {
--     LET $payload = fn::agent_payload($after.id);
--     LET $resp = http::post('http://localhost:PORT/webhooks/rfzv4-chat', $payload);
--   };

-- 暂时注释：等 Hermes webhook 注册后取消注释
