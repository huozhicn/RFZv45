/**
 * Action Dispatcher — 分发 Agent 返回的 action 序列
 *
 * 每个 action 类型对应不同的前端行为：
 *   navigate  → router.push()
 *   filter    → table.setFilter()
 *   highlight → table.highlightRows()
 *   ...
 */

import type { Router } from 'vue-router'
import type { AgentAction } from './types'

export interface ActionContext {
  router: Router
  /** 外部注入的表格控件引用（SchemaTable 注册自己） */
  tableRefs: Map<string, TableController>
  /** 外部注入的详情面板引用 */
  detailRef: DetailController | null
}

export interface TableController {
  setFilter(field: string, value: string): void
  highlightRows(rowIds: string[]): void
  refresh(): void
  downloadCSV(sql: string, filename?: string): void
}

export interface DetailController {
  openDetail(recordId: string): void
  openCreate(table: string, prefill?: Record<string, unknown>): void
}

/**
 * 逐一执行 action 列表
 */
export async function dispatchActions(
  actions: AgentAction[],
  ctx: ActionContext
): Promise<void> {
  for (const action of actions) {
    switch (action.type) {
      case 'navigate': {
        await ctx.router.push({
          path: action.route,
          query: action.params,
        })
        break
      }
      case 'filter': {
        // 通知当前页面上的表格设置筛选
        ctx.tableRefs.forEach((t) => t.setFilter(action.field, action.value))
        break
      }
      case 'highlight': {
        ctx.tableRefs.forEach((t) => t.highlightRows(action.row_ids))
        break
      }
      case 'open_detail': {
        ctx.detailRef?.openDetail(action.record_id)
        break
      }
      case 'open_create': {
        ctx.detailRef?.openCreate(action.table, action.prefill)
        break
      }
      case 'refresh': {
        ctx.tableRefs.forEach((t) => t.refresh())
        break
      }
      case 'data':
      case 'confirm':
      case 'download':
      case 'reply': {
        // 这些由 ChatPanel 自行处理（展示卡片、确认框、下载、纯文本）
        break
      }
    }
  }
}
