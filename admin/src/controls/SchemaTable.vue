<script setup lang="ts">
/**
 * SchemaTable — 零配置表格
 *
 * 从 table meta 自动生成列定义、搜索、排序、分页。
 * 接受 Agent 发来的 filter / highlight action。
 */
import { ref, computed, watch, h } from 'vue'
import { NDataTable, NInput, NButton, NSpace, NPagination } from 'naive-ui'
import type { DataTableColumn } from 'naive-ui'
import { useSdbQuery } from '@/composables/useSdbQuery'
import type { TableMeta, FieldMeta } from '@/lib/schema'
import { extractEnumValues } from '@/lib/schema'

const props = defineProps<{
  tableName: string
  meta: TableMeta | null
}>()

const emit = defineEmits<{
  (e: 'rowClick', recordId: string): void
  (e: 'create'): void
}>()

const { query } = useSdbQuery()

const rows = ref<any[]>([])
const totalCount = ref(0)
const loading = ref(false)
const searchText = ref('')
const page = ref(1)
const pageSize = ref(20)
const highlightedRowIds = ref<string[]>([])

// ── 动态生成列定义 ──

const columns = computed<DataTableColumn<any>[]>(() => {
  if (!props.meta) return []

  return props.meta.fields.map((field) => {
    const col: DataTableColumn<any> = {
      title: field.comment || field.name,
      key: field.name,
      width: columnWidth(field),
      resizable: true,
      sorter: isSortable(field),
      ellipsis: { tooltip: true },
    }

    // 枚举列 → 中文显示
    if (field.assert) {
      const enumValues = extractEnumValues(field.assert)
      if (enumValues.length > 0 && enumValues.length <= 8) {
        col.render = (row: any) => {
          const val = row[field.name]
          const labelMap: Record<string, string> = {
            'active': '激活', 'inactive': '禁用',
            '上架': '上架', '下架': '下架',
            'pending': '待处理', 'done': '已完成',
            '已发货': '已发货', '待付款': '待付款', '已完成': '已完成', '已取消': '已取消',
          }
          return h('span', null, labelMap[val] || val || '-')
        }
      }
    }

    // record 类型 → 显示关联名称
    if (field.isRecord && field.recordTarget) {
      col.render = (row: any) => {
        const nested = row[field.name]
        if (typeof nested === 'object' && nested !== null) {
          return h('span', null, nested.name || nested.id || '-')
        }
        return h('span', null, nested || '-')
      }
    }

    return col
  })
})

function columnWidth(field: FieldMeta): number {
  if (['int', 'float', 'decimal', 'bool'].includes(field.kind)) return 100
  if (field.kind === 'datetime') return 160
  if (field.isRecord) return 160
  if (field.name === 'id') return 200
  if (['name', 'title'].includes(field.name)) return 200
  return 150
}

function isSortable(field: FieldMeta): boolean {
  return ['string', 'int', 'float', 'decimal', 'datetime'].some(t => field.kind.includes(t))
}

// ── 构建搜索 SQL ──

function buildWhereClause(): string {
  const text = searchText.value.trim()
  if (!text || !props.meta) return ''

  const clauses: string[] = []
  for (const field of props.meta.fields) {
    if (['string', 'text'].some(t => field.kind.includes(t))) {
      clauses.push(`${field.name} CONTAINS $search`)
    }
  }
  return clauses.length > 0 ? `WHERE (${clauses.join(' OR ')})` : ''
}

// ── 数据加载 ──

let fetchTimer: ReturnType<typeof setTimeout> | null = null

async function fetchData() {
  if (!props.tableName) return
  loading.value = true
  try {
    const where = buildWhereClause()
    const esc = (s: string) => s.replace(/'/g, "\\'").replace(/"/g, '\\"')

    // 查总数
    const countSql = where
      ? `SELECT count() FROM ${props.tableName} ${where}`
      : `SELECT count() FROM ${props.tableName}`
    const countResult = await query(countSql, where ? { search: esc(searchText.value.trim()) } : undefined)
    totalCount.value = countResult?.[0]?.count ?? 0

    // 查数据
    const dataSql = `SELECT * FROM ${props.tableName} ${where} ORDER BY created_at DESC LIMIT ${pageSize.value} START ${(page.value - 1) * pageSize.value}`
    const rows = await query(dataSql, where ? { search: esc(searchText.value.trim()) } : undefined) || []
    rows.value = rows
  } catch (err: any) {
    console.error(`[SchemaTable] load ${props.tableName} failed:`, err.message)
    rows.value = []
    totalCount.value = 0
  } finally {
    loading.value = false
  }
}

// Debounce search
watch(searchText, () => {
  page.value = 1
  if (fetchTimer) clearTimeout(fetchTimer)
  fetchTimer = setTimeout(fetchData, 300)
})

watch(() => props.tableName, () => {
  searchText.value = ''
  page.value = 1
  highlightedRowIds.value = []
  fetchData()
}, { immediate: true })

watch(page, fetchData)

// ── 行点击 → 打开详情 ──

function handleRowClick(row: any) {
  emit('rowClick', row.id)
}

// ── 行样式（高亮） ──

const rowProps = (row: any) => {
  const isHighlighted = highlightedRowIds.value.includes(row.id)
  return {
    style: isHighlighted ? 'background: #fff3cd; cursor: pointer' : 'cursor: pointer',
    onClick: () => handleRowClick(row),
  }
}

// ── 对外暴露的 TableController 接口 ──

defineExpose({
  setFilter(field: string, value: string) {
    // Agent 的 filter action → 设置搜索文本
    searchText.value = value
  },
  highlightRows(rowIds: string[]) {
    highlightedRowIds.value = rowIds
  },
  refresh() {
    fetchData()
  },
  downloadCSV(_sql: string, _filename?: string) {
    // TODO: 实现 CSV 导出
  },
  openCreate() {
    emit('create')
  },
})
</script>

<template>
  <div class="schema-table">
    <n-space style="margin-bottom: 12px" align="center" justify="space-between">
      <n-space align="center">
        <n-input
          v-model:value="searchText"
          placeholder="搜索..."
          clearable
          style="width: 240px"
        />
        <n-button type="primary" size="small" @click="emit('create')">
          + 新建
        </n-button>
      </n-space>
      <n-pagination
        v-model:page="page"
        :page-size="pageSize"
        :item-count="totalCount"
        size="small"
      />
    </n-space>

    <n-data-table
      :columns="columns"
      :data="rows"
      :loading="loading"
      :row-key="(row: any) => row.id"
      :row-props="rowProps"
      :single-line="false"
      size="small"
    />
  </div>
</template>

<style scoped>
.schema-table {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
