<script setup lang="ts">
/**
 * DetailPanel — 侧边滑出详情/编辑面板
 *
 * 字段类型自动映射控件（string→Input, int→InputNumber, enum→Select...）
 */

import { ref, watch, computed, h } from 'vue'
import {
  NDrawer, NDrawerContent, NForm, NFormItem, NInput, NInputNumber,
  NSelect, NSwitch, NDatePicker, NButton, NSpace, NTag, useMessage
} from 'naive-ui'
import type { TableMeta } from '@/lib/schema'
import { extractEnumValues } from '@/lib/schema'
import { useSdbQuery } from '@/composables/useSdbQuery'

const props = defineProps<{
  visible: boolean
  tableName: string
  meta: TableMeta | null
  recordId: string | null
  mode: 'view' | 'create' | 'edit'
  prefill?: Record<string, unknown>
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved'): void
  (e: 'deleted'): void
}>()

const { query } = useSdbQuery()
const message = useMessage()

const record = ref<Record<string, unknown>>({})
const formData = ref<Record<string, any>>({})
const loading = ref(false)
const saving = ref(false)

// ── 加载记录 ──

async function loadRecord() {
  if (!props.recordId || props.mode === 'create') {
    formData.value = props.prefill ? { ...props.prefill } : {}
    return
  }
  loading.value = true
  try {
    const result = await query(`SELECT * FROM ${props.recordId}`)
    const data = result[0]?.[0]
    if (data) {
      record.value = data
      formData.value = { ...data }
    }
  } finally {
    loading.value = false
  }
}

watch(() => [props.recordId, props.visible], () => {
  if (props.visible) loadRecord()
})

// ── 保存 / 删除 ──

async function handleSave() {
  saving.value = true
  try {
    if (props.mode === 'create') {
      const fields = Object.entries(formData.value)
        .filter(([_, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join(', ')
      await query(`CREATE ${props.tableName} CONTENT { ${fields} }`)
      message.success('创建成功')
    } else {
      const updates = Object.entries(formData.value)
        .filter(([k, v]) => v !== record.value[k])
        .map(([k, v]) => `${k} = ${JSON.stringify(v)}`)
        .join(', ')
      if (updates) {
        await query(`UPDATE ${props.recordId} MERGE { ${updates} }`)
        message.success('保存成功')
      }
    }
    emit('saved')
  } catch (err: any) {
    message.error('保存失败: ' + (err.message || ''))
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (!props.recordId) return
  try {
    await query(`DELETE ${props.recordId}`)
    message.success('已删除')
    emit('deleted')
  } catch (err: any) {
    message.error('删除失败: ' + (err.message || ''))
  }
}

// ── 暴露 openDetail / openCreate ──

defineExpose({
  openDetail(recordId: string) {
    emit('close')
    // 父组件重新打开
  },
  openCreate(table: string, prefill?: Record<string, unknown>) {
    // 同上
  },
})
</script>

<template>
  <n-drawer
    :show="visible"
    :width="480"
    placement="right"
    @update:show="(v: boolean) => !v && emit('close')"
  >
    <n-drawer-content :title="mode === 'create' ? `新建 ${tableName}` : `详情`">
      <n-form v-if="meta && !loading" label-placement="left" label-width="100">
        <template v-for="field in meta.fields" :key="field.name">
          <!-- 隐藏 ID 列 -->
          <n-form-item v-if="field.name !== 'id'" :label="field.comment || field.name">
            <!-- string → Input -->
            <n-input
              v-if="field.kind === 'string' || field.kind.includes('string')"
              v-model:value="formData[field.name]"
              :disabled="mode === 'view'"
            />
            <!-- int/float/decimal → InputNumber -->
            <n-input-number
              v-else-if="field.kind === 'int' || field.kind === 'float' || field.kind === 'decimal'"
              v-model:value="formData[field.name]"
              :disabled="mode === 'view'"
              style="width: 100%"
            />
            <!-- bool → Switch -->
            <n-switch
              v-else-if="field.kind === 'bool'"
              v-model:value="formData[field.name]"
              :disabled="mode === 'view'"
            />
            <!-- datetime → DatePicker -->
            <n-date-picker
              v-else-if="field.kind === 'datetime'"
              v-model:value="formData[field.name]"
              :disabled="mode === 'view'"
              type="datetime"
              style="width: 100%"
            />
            <!-- enum → Select -->
            <n-select
              v-else-if="field.assert"
              v-model:value="formData[field.name]"
              :disabled="mode === 'view'"
              :options="extractEnumValues(field.assert).map(v => ({ label: v, value: v }))"
            />
            <!-- record<T> → 只读显示 -->
            <span v-else-if="field.isRecord">
              <n-tag>{{ (formData[field.name] as any)?.name || formData[field.name] || '-' }}</n-tag>
            </span>
            <!-- fallback → Input -->
            <n-input v-else v-model:value="formData[field.name]" :disabled="mode === 'view'" />
          </n-form-item>
        </template>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <n-button v-if="mode === 'view'" @click="emit('close')">关闭</n-button>
          <template v-else>
            <n-button @click="emit('close')">取消</n-button>
            <n-button type="primary" :loading="saving" @click="handleSave">保存</n-button>
          </template>
          <n-button
            v-if="mode === 'view' && recordId"
            type="error"
            secondary
            @click="handleDelete"
          >
            删除
          </n-button>
        </n-space>
      </template>
    </n-drawer-content>
  </n-drawer>
</template>
