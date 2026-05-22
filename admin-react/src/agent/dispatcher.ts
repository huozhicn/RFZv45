import type { AgentAction, NavigateAction, FilterAction, HighlightAction, OpenDetailAction, OpenCreateAction } from './types'

export interface TableController {
  setFilter: (field: string, value: string) => void
  highlightRows: (rowIds: string[]) => void
  refresh: () => void
}

export interface DetailController {
  openDetail: (recordId: string) => void
  openCreate: (table: string, prefill?: Record<string, unknown>) => void
}

interface DispatchContext {
  router: any
  tableRefs: Map<string, TableController>
  detailRef: DetailController
}

export function dispatchActions(actions: AgentAction[], ctx: DispatchContext) {
  for (const action of actions) {
    switch (action.type) {
      case 'navigate': {
        const a = action as NavigateAction
        const tableName = a.route.replace(/^\/tables\//, '')
        window.location.hash = `#/tables/${tableName}`
        break
      }
      case 'filter': {
        const a = action as FilterAction
        const hash = window.location.hash.slice(1)
        const match = hash.match(/^\/tables\/(\w+)/)
        if (match) {
          const tc = ctx.tableRefs.get(match[1])
          tc?.setFilter(a.field, a.value)
        }
        break
      }
      case 'highlight': {
        const a = action as HighlightAction
        const hash = window.location.hash.slice(1)
        const match = hash.match(/^\/tables\/(\w+)/)
        if (match) {
          const tc = ctx.tableRefs.get(match[1])
          tc?.highlightRows(a.row_ids)
        }
        break
      }
      case 'open_detail': {
        const a = action as OpenDetailAction
        ctx.detailRef.openDetail(a.record_id)
        break
      }
      case 'open_create': {
        const a = action as OpenCreateAction
        ctx.detailRef.openCreate(a.table, a.prefill)
        break
      }
    }
  }
}
