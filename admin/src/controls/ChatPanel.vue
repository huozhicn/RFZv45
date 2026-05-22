<script setup lang="ts">
/**
 * ChatPanel — 底部常驻对话面板
 *
 * 唯一的数据写入入口。用户输入自然语言 → INSERT agent_message → Agent 处理 → 结果回显。
 * 收到的 AgentResponse.actions 通过 emit 交给父组件（App.vue）的 ActionDispatcher 执行。
 */

import { ref, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { NInput, NButton, NSpace, NTag, NSpin, useMessage } from 'naive-ui'
import { useSdbQuery } from '@/composables/useSdbQuery'
import { useAuthStore } from '@/stores/auth'
import { subscribeAgentMessages } from '@/agent/live-query'
import { tenantConfig } from '@/lib/tenant-config'
import type { AgentResponse } from '@/agent/types'

const { query } = useSdbQuery()
const auth = useAuthStore()
const message = useMessage()

const inputText = ref('')
const sending = ref(false)
const messages = ref<ChatMessage[]>([])

interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  text: string
  status: 'pending' | 'done' | 'error'
  actions: any[]
  timestamp: string
}

const sessionId = ref(`sess_${Date.now()}`)
let unsubscribe: (() => void) | null = null

// ── 发消息 ──

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || sending.value) return

  sending.value = true
  try {
    const result = await query(
      `INSERT INTO agent_message {
        user_input: $input,
        status: 'pending',
        session_id: $sid,
        created_by: $uid
      }`,
      {
        input: text,
        sid: sessionId.value,
        uid: auth.user?.id ?? '',
      }
    )

    const newMsg = result[0]?.[0]
    messages.value.push({
      id: newMsg?.id ?? '',
      role: 'user',
      text,
      status: 'pending',
      actions: [],
      timestamp: new Date().toISOString(),
    })

    inputText.value = ''
  } catch (err: any) {
    message.error('发送失败: ' + (err.message || ''))
  } finally {
    sending.value = false
  }
}

// ── 收 Agent 回复 ──

function handleAgentResponse(resp: AgentResponse) {
  // 更新或添加 agent 消息
  const existing = messages.value.find(m => m.id === resp.message_id)
  const agentMsg: ChatMessage = {
    id: resp.message_id + '_agent',
    role: 'agent',
    text: resp.reply,
    status: resp.status,
    actions: resp.actions || [],
    timestamp: new Date().toISOString(),
  }

  if (existing) {
    existing.status = resp.status
  }
  messages.value.push(agentMsg)

  // 将 actions 交给父组件分发
  emit('actions', resp.actions, resp)
}

const emit = defineEmits<{
  (e: 'actions', actions: any[], response: AgentResponse): void
}>()

// ── 订阅 LIVE QUERY ──
// 只在已登录时启动

onMounted(() => {
  if (!auth.token) return
  unsubscribe = subscribeAgentMessages(
    sessionId.value,
    (rows) => {
      for (const row of rows) {
        const resp: AgentResponse = {
          message_id: row.id,
          status: row.status as 'done' | 'error',
          reply: row.response ?? '',
          actions: row.actions || [],
        }
        handleAgentResponse(resp)
      }
    },
    window.location.origin + tenantConfig.sdbEndpoint,
    auth.token ?? '',
    tenantConfig.sdbNamespace,
    tenantConfig.sdbDatabase
  )
})

onUnmounted(() => {
  unsubscribe?.()
})

// ── 滚动到底部 ──

const chatContainer = ref<HTMLElement>()

watch(() => messages.value.length, async () => {
  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
})

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}
</script>

<template>
  <div class="chat-panel">
    <!-- 消息列表 -->
    <div ref="chatContainer" class="chat-messages">
      <div v-if="messages.length === 0" class="chat-empty">
        <p>💬 对话即操作。</p>
        <p style="color: #999; font-size: 13px">
          试试：「看库存」「新建客户张三」「书院旗舰店库存低于5的商品」
        </p>
      </div>

      <div
        v-for="msg in messages"
        :key="msg.id"
        :class="['chat-bubble', msg.role]"
      >
        <div class="bubble-meta">
          <n-tag :type="msg.role === 'user' ? 'info' : 'success'" size="tiny">
            {{ msg.role === 'user' ? '我' : 'Agent' }}
          </n-tag>
          <n-tag v-if="msg.status === 'pending'" type="warning" size="tiny">
            <n-spin :size="12" />
          </n-tag>
          <n-tag v-if="msg.status === 'error'" type="error" size="tiny">失败</n-tag>
        </div>
        <div class="bubble-text">{{ msg.text }}</div>
        <!-- actions 预览 -->
        <div v-if="msg.actions && msg.actions.length > 0" class="bubble-actions">
          <n-tag
            v-for="(action, i) in msg.actions"
            :key="i"
            size="tiny"
            :bordered="false"
          >
            {{ action.type }}
          </n-tag>
        </div>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="chat-input">
      <n-input
        v-model:value="inputText"
        type="textarea"
        placeholder="输入指令... (Enter 发送，Shift+Enter 换行)"
        :autosize="{ minRows: 1, maxRows: 4 }"
        :disabled="sending"
        @keydown="handleKeydown"
      />
      <n-button
        type="primary"
        :loading="sending"
        :disabled="!inputText.trim()"
        @click="sendMessage"
        style="margin-left: 8px"
      >
        发送
      </n-button>
    </div>
  </div>
</template>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 40vh;
  border-top: 1px solid #e8e8e8;
  background: #fafafa;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.chat-empty {
  text-align: center;
  padding: 24px;
  color: #666;
}

.chat-bubble {
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  max-width: 80%;
}

.chat-bubble.user {
  background: #e6f7ff;
  margin-left: auto;
}

.chat-bubble.agent {
  background: #f6ffed;
  margin-right: auto;
}

.bubble-meta {
  display: flex;
  gap: 6px;
  margin-bottom: 4px;
}

.bubble-text {
  white-space: pre-wrap;
  line-height: 1.5;
}

.bubble-actions {
  margin-top: 6px;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.chat-input {
  display: flex;
  align-items: flex-end;
  padding: 8px 16px;
  background: #fff;
  border-top: 1px solid #e8e8e8;
}

.chat-input :deep(.n-input) {
  flex: 1;
}
</style>
