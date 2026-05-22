<script setup lang="ts">
/**
 * App.vue — v45 Admin · ChatGPT 风格布局
 *
 * ┌──────────┬─────────────────────────┐
 * │ ☰ 可折叠 │  数据表格 / 欢迎页       │
 * │ 菜单     │                         │
 * │          │  对话消息流（可滚动）     │
 * ├──────────┴─────────────────────────┤
 * │  💬 输入框（固定底部）      [发送]  │
 * └────────────────────────────────────┘
 */
import { ref, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  NLayout, NLayoutSider, NLayoutContent, NLayoutFooter,
  NMenu, NButton, NInput, NSpace, NTag, NSpin, NScrollbar,
  NMessageProvider, NDialogProvider, useMessage
} from 'naive-ui'
import type { MenuOption } from 'naive-ui'
import { onErrorCaptured } from 'vue'
import SchemaTable from '@/controls/SchemaTable.vue'
import DetailPanel from '@/controls/DetailPanel.vue'
import LoginView from '@/views/LoginView.vue'
import { useAuthStore } from '@/stores/auth'
import { useSdbQuery } from '@/composables/useSdbQuery'
import { tenantConfig } from '@/lib/tenant-config'
import { loadSchemaMeta } from '@/lib/schema'
import { subscribeAgentMessages } from '@/agent/live-query'
import type { TableMeta } from '@/lib/schema'
import type { AgentResponse, AgentAction, AgentMessage } from '@/agent/types'
import { dispatchActions, type TableController, type DetailController } from '@/agent/dispatcher'

const router = useRouter()
const route = useRoute()
const { query } = useSdbQuery()
const auth = useAuthStore()
const message = useMessage()

// ── 侧栏 ──
const collapsed = ref(false)
const version = __COMMIT_HASH__

// ── Schema / 菜单 ──
const schemaMeta = ref<Map<string, TableMeta>>(new Map())
const menuOptions = ref<MenuOption[]>([])

// ── 当前表 ──
const currentTable = ref('')
const currentMeta = ref<TableMeta | null>(null)

// ── 详情面板 ──
const detailVisible = ref(false)
const detailMode = ref<'view' | 'create' | 'edit'>('view')
const detailRecordId = ref<string | null>(null)
const detailPrefill = ref<Record<string, unknown> | undefined>()

// ── 控件引用 ──
const tableRef = ref<TableController | null>(null)
const tableRefs = new Map<string, TableController>()

// ── 对话 ──
const sessionId = ref(`sess_${Date.now()}`)
const chatMessages = ref<ChatMsg[]>([])
const inputText = ref('')
const sending = ref(false)
const chatScrollEl = ref<InstanceType<typeof NScrollbar>>()

interface ChatMsg {
  id: string
  role: 'user' | 'agent'
  text: string
  status: 'pending' | 'done' | 'error'
  actions: AgentAction[]
  timestamp: string
}

// ── Error boundary ──
const appError = ref('')
onErrorCaptured((err: any) => {
  console.error('[App] unhandled error:', err)
  appError.value = String(err?.message || err)
  return false // prevent propagation
})

// ── Schema 加载 ──
watch(() => auth.isAuthenticated, (authed) => {
  if (authed) {
    loadSchemaMeta(query).then(meta => {
      schemaMeta.value = meta
      buildMenu()
    }).catch((err: any) => {
      console.error('[App] loadSchemaMeta failed:', err.message)
    })
  }
}, { immediate: true })

function buildMenu() {
  const options: MenuOption[] = []
  for (const [name, meta] of schemaMeta.value.entries()) {
    if (name.startsWith('_') || name === 'agent_message') continue
    options.push({ label: meta.name, key: `/tables/${name}` })
  }
  menuOptions.value = options
}

function handleMenuSelect(key: string) {
  collapsed.value = true // 选完自动收起侧栏
  router.push(key)
}

watch(() => route.path, (path) => {
  const match = path.match(/^\/tables\/(\w+)/)
  if (match) {
    currentTable.value = match[1]
    currentMeta.value = schemaMeta.value.get(match[1]) ?? null
  }
}, { immediate: true })

// ── 详情 ──
function handleRowClick(recordId: string) {
  detailRecordId.value = recordId
  detailMode.value = 'view'
  detailPrefill.value = undefined
  detailVisible.value = true
}
function handleCreate() {
  detailRecordId.value = null
  detailMode.value = 'create'
  detailPrefill.value = undefined
  detailVisible.value = true
}
function handleDetailClose() {
  detailVisible.value = false
  tableRef.value?.refresh()
}

// ── 发送消息 ──
async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || sending.value) return
  sending.value = true
  try {
    const result = await query(
      `INSERT INTO agent_message {
        user_input: $input, status: 'pending',
        session_id: $sid, created_by: $uid
      }`,
      { input: text, sid: sessionId.value, uid: auth.user?.id ?? '' }
    )
    chatMessages.value.push({
      id: result?.[0]?.id ?? '',
      role: 'user', text, status: 'pending',
      actions: [], timestamp: new Date().toISOString(),
    })
    inputText.value = ''
    scrollChatBottom()
  } catch (err: any) {
    message.error('发送失败: ' + (err.message || ''))
  } finally {
    sending.value = false
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
}

function scrollChatBottom() {
  setTimeout(() => {
    chatScrollEl.value?.scrollTo({ top: 99999, behavior: 'smooth' })
  }, 100)
}

// ── 收 Agent 回复 ──
function handleAgentResponse(row: AgentMessage) {
  chatMessages.value.push({
    id: row.id + '_agent',
    role: 'agent',
    text: row.response ?? '',
    status: row.status as 'done' | 'error',
    actions: row.actions || [],
    timestamp: row.created_at || '',
  })
  // 分发 actions
  if (tableRef.value) tableRefs.set(currentTable.value, tableRef.value)
  dispatchActions(row.actions || [], {
    router, tableRefs,
    detailRef: {
      openDetail(rid) { detailRecordId.value = rid; detailMode.value = 'view'; detailVisible.value = true },
      openCreate(t, pf) { currentTable.value = t; currentMeta.value = schemaMeta.value.get(t) ?? null; detailRecordId.value = null; detailMode.value = 'create'; detailPrefill.value = pf; detailVisible.value = true; router.push(`/tables/${t}`) },
    },
  })
  scrollChatBottom()
}

// ── LIVE QUERY ──
let unsub: (() => void) | null = null
watch(() => auth.token, (tok) => {
  unsub?.()
  if (tok) {
    unsub = subscribeAgentMessages(sessionId.value, (rows: AgentMessage[]) => {
      for (const row of rows) handleAgentResponse(row)
    }, tok)
  }
}, { immediate: true })
</script>

<template>
  <n-message-provider>
    <n-dialog-provider>
      <!-- Fatal error boundary -->
      <div v-if="appError" style="padding:40px;text-align:center;color:#d93025">
        <div style="font-size:48px;margin-bottom:16px">⚠️</div>
        <div style="font-size:18px;font-weight:600">应用加载出错</div>
        <div style="color:#999;margin-top:8px;font-size:13px">{{ appError }}</div>
        <n-button style="margin-top:16px" @click="appError='';location.reload()">重试</n-button>
      </div>

      <template v-else>
      <LoginView v-if="!auth.isAuthenticated" />

      <!-- ChatGPT 风格布局 -->
      <n-layout v-else style="height: 100vh" has-sider>
        <!-- 可折叠侧栏 -->
        <n-layout-sider
          bordered
          collapse-mode="width"
          :collapsed-width="0"
          :width="220"
          :collapsed="collapsed"
          show-trigger="bar"
          @collapse="collapsed = true"
          @expand="collapsed = false"
        >
          <div style="padding: 16px; font-weight: 700; font-size: 15px;">
            RFZv45
            <span style="font-weight:400;font-size:12px;color:#999;margin-left:4px">如法造</span>
          </div>
          <n-menu
            :options="menuOptions"
            :value="route.path"
            @update:value="handleMenuSelect"
          />
          <div style="position:absolute;bottom:12px;left:16px;color:#aaa;font-size:11px;font-family:monospace">
            v.{{ version }}
          </div>
        </n-layout-sider>

        <!-- 主内容区 -->
        <n-layout>
          <n-layout-content style="display:flex;flex-direction:column">
            <!-- 上半：表格 + 对话流 -->
            <n-scrollbar ref="chatScrollEl" style="flex:1;padding:16px 24px">
              <!-- 数据表格 -->
              <div v-if="currentTable" style="margin-bottom: 16px">
                <SchemaTable
                  ref="tableRef"
                  :table-name="currentTable"
                  :meta="currentMeta"
                  @row-click="handleRowClick"
                  @create="handleCreate"
                />
              </div>

              <!-- 欢迎语 -->
              <div v-if="!currentTable && chatMessages.length === 0" style="text-align:center;padding:80px 0;color:#999">
                <div style="font-size:48px;margin-bottom:16px">💬</div>
                <div style="font-size:18px;font-weight:600;color:#666;margin-bottom:8px">对话即操作</div>
                <div style="font-size:14px">在下方输入指令，例如「看库存」「新建客户」</div>
              </div>

              <!-- 对话气泡 -->
              <div v-for="msg in chatMessages" :key="msg.id" style="margin-bottom:16px">
                <div :style="{
                  display:'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                }">
                  <div :style="{
                    maxWidth:'75%',
                    padding:'10px 16px',
                    borderRadius:'12px',
                    background: msg.role === 'user' ? '#e8f0fe' : '#f1f3f4',
                    color: '#333',
                    fontSize:'14px',
                    lineHeight:1.6,
                    whiteSpace:'pre-wrap',
                    wordBreak:'break-word',
                  }">
                    <div v-if="msg.status === 'pending'" style="color:#999;font-size:12px;margin-bottom:4px">
                      <n-spin :size="12" /> 思考中...
                    </div>
                    <div v-if="msg.status === 'error'" style="color:#d93025;font-size:12px;margin-bottom:4px">
                      ⚠ 出错
                    </div>
                    {{ msg.text }}
                    <div v-if="msg.actions?.length" style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap">
                      <n-tag v-for="(a,i) in msg.actions" :key="i" size="tiny" :bordered="false">
                        {{ a.type }}
                      </n-tag>
                    </div>
                  </div>
                </div>
                <div :style="{
                  fontSize:'11px', color:'#aaa', marginTop:'4px',
                  textAlign: msg.role === 'user' ? 'right' : 'left',
                  padding: msg.role === 'user' ? '0 4px 0 0' : '0 0 0 4px'
                }">
                  {{ msg.role === 'user' ? '我' : 'Agent' }}
                  {{ new Date(msg.timestamp).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'}) }}
                </div>
              </div>

              <!-- 底部留白 -->
              <div style="height:16px" />
            </n-scrollbar>

            <!-- 底部固定输入栏 -->
            <div style="
              border-top:1px solid #e0e0e0;
              padding:12px 24px;
              background:#fff;
              display:flex;
              gap:8px;
              align-items:flex-end;
              flex-shrink:0;
            ">
              <n-input
                v-model:value="inputText"
                type="textarea"
                placeholder="输入指令... (Enter 发送)"
                :autosize="{ minRows: 1, maxRows: 4 }"
                :disabled="sending"
                @keydown="handleKeydown"
                style="flex:1"
                size="large"
                round
              />
              <n-button
                type="primary"
                :loading="sending"
                :disabled="!inputText.trim()"
                @click="sendMessage"
                size="large"
                style="border-radius:20px;min-width:80px"
              >
                发送
              </n-button>
            </div>
          </n-layout-content>
        </n-layout>
      </n-layout>

      <!-- 详情抽屉 -->
      <DetailPanel
        :visible="detailVisible"
        :table-name="currentTable"
        :meta="currentMeta"
        :record-id="detailRecordId"
        :mode="detailMode"
        :prefill="detailPrefill"
        @close="handleDetailClose"
        @saved="handleDetailClose"
        @deleted="handleDetailClose"
      />
      </template>
    </n-dialog-provider>
  </n-message-provider>
</template>
