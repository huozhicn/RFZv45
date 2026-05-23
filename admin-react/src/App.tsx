import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/stores/auth'
import { sdbQuery } from '@/lib/sdb'
import { loadSchemaMeta, menuGroups, type TableMeta, type MenuGroup } from '@/lib/schema'
import type { TableController, DetailController } from '@/agent/dispatcher'
import LoginView from '@/pages/LoginView'
import SchemaTable from '@/components/SchemaTable'
import DetailPanel from '@/components/DetailPanel'
import ChatPanel from '@/components/ChatPanel'

/** Find which group a table belongs to */
function findGroup(tableName: string): string {
  for (const g of menuGroups) {
    if (g.tables.some(t => t.key === tableName)) return g.key
  }
  return ''
}

export default function App() {
  const auth = useAuth()
  const [schemaMeta, setSchemaMeta] = useState<Map<string, TableMeta>>(new Map())
  const [currentTable, setCurrentTable] = useState('')
  const [currentMeta, setCurrentMeta] = useState<TableMeta | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // Detail
  const [detailVisible, setDetailVisible] = useState(false)
  const [detailMode, setDetailMode] = useState<'view' | 'create' | 'edit'>('view')
  const [detailRecordId, setDetailRecordId] = useState<string | null>(null)
  const [detailPrefill, setDetailPrefill] = useState<Record<string, unknown>>()

  // Table refs
  const tableRef = useRef<TableController | null>(null)
  const tableRefs = useRef<Map<string, TableController>>(new Map())

  const detailCtrl: DetailController = {
    openDetail(rid) { setDetailRecordId(rid); setDetailMode('view'); setDetailVisible(true) },
    openCreate(t, pf) {
      setCurrentTable(t)
      setCurrentMeta(schemaMeta.get(t) ?? null)
      setDetailRecordId(null)
      setDetailMode('create')
      setDetailPrefill(pf)
      setDetailVisible(true)
      window.location.hash = `#/tables/${t}`
    },
  }

  // @ts-ignore
  const version: string = __COMMIT_HASH__

  // Auto-expand the group of the current table
  useEffect(() => {
    if (!currentTable) return
    const group = findGroup(currentTable)
    if (group && collapsedGroups.has(group)) {
      setCollapsedGroups(prev => {
        const next = new Set(prev)
        next.delete(group)
        return next
      })
    }
  }, [currentTable])

  // Load schema on auth
  useEffect(() => {
    if (!auth.isAuthenticated) return
    loadSchemaMeta((sql: string) => sdbQuery(sql, undefined, auth.token)).then(meta => {
      setSchemaMeta(meta)
    }).catch((err: any) => console.error('[App] schema load failed:', err.message))
  }, [auth.isAuthenticated, auth.token])

  // Hash router
  useEffect(() => {
    function handleHash() {
      const hash = window.location.hash.slice(1)
      const match = hash.match(/^\/tables\/(\w+)/)
      if (match) {
        setCurrentTable(match[1])
        setCurrentMeta(schemaMeta.get(match[1]) ?? null)
      }
    }
    window.addEventListener('hashchange', handleHash)
    handleHash()
    return () => window.removeEventListener('hashchange', handleHash)
  }, [schemaMeta])

  function navigateTable(name: string) {
    window.location.hash = `#/tables/${name}`
  }

  function toggleGroup(key: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleRowClick(recordId: string) {
    setDetailRecordId(recordId)
    setDetailMode('view')
    setDetailPrefill(undefined)
    setDetailVisible(true)
  }
  function handleDetailClose() {
    setDetailVisible(false)
    if (tableRef.current) tableRefs.current.set(currentTable, tableRef.current)
    tableRef.current?.refresh()
  }

  if (!auth.isAuthenticated) return <LoginView />

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{
        width: 220, minWidth: 220,
        borderRight: '1px solid #e8e8e8',
        background: '#fafafa',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
          RFZv45 <span style={{ fontWeight: 400, fontSize: 12, color: '#999' }}>如法造</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
          {menuGroups.map(group => {
            const isCollapsed = collapsedGroups.has(group.key)
            return (
              <div key={group.key}>
                {/* Group header */}
                <div
                  onClick={() => toggleGroup(group.key)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 16px', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, color: '#888',
                    userSelect: 'none',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f0f0f0'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                >
                  <span>{group.label}</span>
                  <span style={{
                    fontSize: 10, transition: 'transform 0.2s',
                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  }}>
                    ▼
                  </span>
                </div>
                {/* Table items */}
                <div style={{
                  maxHeight: isCollapsed ? 0 : group.tables.length * 36,
                  overflow: 'hidden',
                  transition: 'max-height 0.25s ease',
                }}>
                  {group.tables.map(table => (
                    <div
                      key={table.key}
                      onClick={() => navigateTable(table.key)}
                      style={{
                        padding: '8px 16px 8px 28px', cursor: 'pointer', fontSize: 13,
                        background: currentTable === table.key ? '#e6f4ff' : undefined,
                        color: currentTable === table.key ? '#1677ff' : '#333',
                        borderRight: currentTable === table.key ? '3px solid #1677ff' : undefined,
                      }}
                      onMouseEnter={e => { if (currentTable !== table.key) (e.currentTarget as HTMLElement).style.background = '#f0f0f0' }}
                      onMouseLeave={e => { if (currentTable !== table.key) (e.currentTarget as HTMLElement).style.background = '' }}
                    >
                      {table.label}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ padding: '12px 16px', color: '#aaa', fontSize: 11, fontFamily: 'monospace', flexShrink: 0 }}>
          v.{version}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {currentTable ? (
            <SchemaTable
              ref={tableRef}
              tableName={currentTable}
              meta={currentMeta}
              onRowClick={handleRowClick}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '80px 0', color: '#999' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#666', marginBottom: 8 }}>模式驱动 ERP</div>
              <div style={{ fontSize: 14 }}>👈 选择左侧表 或 💬 在右侧对话中输入指令</div>
              <div style={{ fontSize: 13, color: '#bbb', marginTop: 4 }}>
                试试：「看库存」「新建客户张三」
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat panel */}
      <ChatPanel tableRefs={tableRefs} currentTable={currentTable} detailCtrl={detailCtrl} />

      {/* Detail drawer */}
      <DetailPanel
        visible={detailVisible}
        tableName={currentTable}
        meta={currentMeta}
        recordId={detailRecordId}
        mode={detailMode}
        prefill={detailPrefill}
        onClose={handleDetailClose}
      />
    </div>
  )
}
