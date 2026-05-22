<script setup lang="ts">
/**
 * App.vue — v45 Admin 根组件
 *
 * 核心结构：
 *   菜单（自动从 schema 权限生成）  |  SchemaTable（/tables/:tableName）
 *                                   |  或 Dashboard
 *   ChatPanel（底部常驻）             |  → 收发 Agent 消息，驱动 navigation
 *   DetailPanel（侧边抽屉）          |  → 点行展开
 */

import { ref, onMounted, provide, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  NLayout, NLayoutSider, NLayoutContent, NMenu,
  NMessageProvider, NDialogProvider
} from 'naive-ui'
import type { MenuOption } from 'naive-ui'
import SchemaTable from '@/controls/SchemaTable.vue'
import DetailPanel from '@/controls/DetailPanel.vue'
import ChatPanel from '@/controls/ChatPanel.vue'
import LoginView from '@/views/LoginView.vue'
import { useAuthStore } from '@/stores/auth'
import { useSdbQuery } from '@/composables/useSdbQuery'
import { loadSchemaMeta } from '@/lib/schema'
import type { TableMeta } from '@/lib/schema'
import type { AgentResponse, AgentAction } from '@/agent/types'
import { dispatchActions, type TableController, type DetailController } from '@/agent/dispatcher'

const router = useRouter()
const route = useRoute()
const { query } = useSdbQuery()
const auth = useAuthStore()

// ── Schema 元数据 ──
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

// ── Table / Detail 控件引用 ──
const tableRef = ref<TableController | null>(null)
const detailRef = ref<DetailController | null>(null)

const tableRefs = new Map<string, TableController>()

// ── 侧栏版本 ──
const version = __COMMIT_HASH__

// ── 初始化：登录后才加载 schema ──

watch(() => auth.isAuthenticated, (authed) => {
  if (authed) {
    loadSchemaMeta(query).then(meta => {
      schemaMeta.value = meta
      buildMenu()
    })
  }
}, { immediate: true })

// 移除 onMounted 里的加载逻辑
onMounted(() => {
  // schema 加载由上面的 watch 处理
})

function buildMenu() {
  const options: MenuOption[] = []
  for (const [name, meta] of schemaMeta.value.entries()) {
    // 跳过内部表
    if (name.startsWith('_') || name === 'agent_message') continue

    options.push({
      label: meta.name,
      key: `/tables/${name}`,
    })
  }
  menuOptions.value = options
}

// ── 菜单点击 → 导航 ──

function handleMenuSelect(key: string) {
  router.push(key)
}

// ── 根据路由显示表 ──

watch(() => route.path, (path) => {
  const match = path.match(/^\/tables\/(\w+)/)
  if (match) {
    currentTable.value = match[1]
    currentMeta.value = schemaMeta.value.get(match[1]) ?? null
  }
}, { immediate: true })

// ── 行点击 → 打开详情 ──

function handleRowClick(recordId: string) {
  detailRecordId.value = recordId
  detailMode.value = 'view'
  detailPrefill.value = undefined
  detailVisible.value = true
}

// ── 新建按钮 → 打开创建表单 ──

function handleCreate() {
  detailRecordId.value = null
  detailMode.value = 'create'
  detailPrefill.value = undefined
  detailVisible.value = true
}

// ── Chat Action 分发 ──

function handleAgentActions(actions: AgentAction[], _response: AgentResponse) {
  if (tableRef.value) {
    tableRefs.set(currentTable.value, tableRef.value)
  }

  dispatchActions(actions, {
    router,
    tableRefs,
    detailRef: {
      openDetail(recordId) {
        detailRecordId.value = recordId
        detailMode.value = 'view'
        detailVisible.value = true
      },
      openCreate(table, prefill) {
        currentTable.value = table
        currentMeta.value = schemaMeta.value.get(table) ?? null
        detailRecordId.value = null
        detailMode.value = 'create'
        detailPrefill.value = prefill
        detailVisible.value = true
        router.push(`/tables/${table}`)
      },
    },
  })
}

// ── 详情关闭 → 刷新表格 ──

function handleDetailClose() {
  detailVisible.value = false
  tableRef.value?.refresh()
}
</script>

<template>
  <n-message-provider>
    <n-dialog-provider>
      <!-- 未登录 → 登录页 -->
      <LoginView v-if="!auth.isAuthenticated" />

      <!-- 已登录 → 管理界面 -->
      <n-layout v-else style="height: 100vh">
        <n-layout-sider
          bordered
          collapse-mode="width"
          :width="200"
          :native-scrollbar="false"
        >
          <div style="padding: 12px 16px; font-weight: bold; font-size: 16px">
            RFZv45 如法造
          </div>
          <n-menu
            :options="menuOptions"
            :value="route.path"
            @update:value="handleMenuSelect"
          />
          <div
            style="
              position: absolute;
              bottom: 40%;
              left: 12px;
              color: #999;
              font-size: 11px;
              font-family: monospace;
            "
          >
            v.{{ version }}
          </div>
        </n-layout-sider>

        <n-layout-content>
          <div style="height: 60%; overflow: auto; padding: 16px">
            <SchemaTable
              v-if="currentTable"
              ref="tableRef"
              :table-name="currentTable"
              :meta="currentMeta"
              @row-click="handleRowClick"
              @create="handleCreate"
            />
            <div v-else style="text-align: center; color: #999; padding: 40px">
              <p style="font-size: 18px">👈 选择左侧表 或 💬 在下方对话中输入指令</p>
            </div>
          </div>
          <div style="height: 40%">
            <ChatPanel @actions="handleAgentActions" />
          </div>
        </n-layout-content>
      </n-layout>

      <DetailPanel
        ref="detailRef"
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
    </n-dialog-provider>
  </n-message-provider>
</template>
