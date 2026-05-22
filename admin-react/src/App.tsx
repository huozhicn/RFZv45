import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/stores/auth'
import { sdbQuery } from '@/lib/sdb'
import { loadSchemaMeta, type TableMeta } from '@/lib/schema'
import type { TableController, DetailController } from '@/agent/dispatcher'
import LoginView from '@/pages/LoginView'
import SchemaTable from '@/components/SchemaTable'
import DetailPanel from '@/components/DetailPanel'
import ChatPanel from '@/components/ChatPanel'

export default function App() {
  const auth = useAuth()
  const [schemaMeta, setSchemaMeta] = useState<Map<string, TableMeta>>(new Map())
  const [menuItems, setMenuItems] = useState<{ key: string; label: string }[]>([])
  const [currentTable, setCurrentTable] = useState('')
  const [currentMeta, setCurrentMeta] = useState<TableMeta | null>(null)

  // Detail
  const [detailVisible, setDetailVisible] = useState(false)
  const [detailMode, setDetailMode] = useState<'view' | 'create' | 'edit'>('view')
  const [detailRecordId, setDetailRecordId] = useState<string | null>(null)
  const [detailPrefill, setDetailPrefill] = useState<Record<string, unknown>>()

  // Table refs — shared with ChatPanel for agent actions
  const tableRef = useRef<TableController | null>(null)
  const tableRefs = useRef<Map<string, TableController>>(new Map())

  // Detail controller — passed to ChatPanel for agent open_detail/open_create actions
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

  // @ts-ignore — replaced by vite define
  const version: string = __COMMIT_HASH__

  // Load schema on auth
  useEffect(() => {
    if (!auth.isAuthenticated) return
    loadSchemaMeta((sql: string) => sdbQuery(sql, undefined, auth.token)).then(meta => {
      setSchemaMeta(meta)
      const items: { key: string; label: string }[] = []
      for (const [name, m] of meta.entries()) {
        if (name.startsWith('_') || name === 'agent_message') continue
        items.push({ key: name, label: m.name })
      }
      setMenuItems(items)
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

  function handleRowClick(recordId: string) {
    setDetailRecordId(recordId)
    setDetailMode('view')
    setDetailPrefill(undefined)
    setDetailVisible(true)
  }
  function handleDetailClose() {
    setDetailVisible(false)
    // Save table ref to shared map for agent actions
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
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {menuItems.map(item => (
            <div
              key={item.key}
              onClick={() => navigateTable(item.key)}
              style={{
                padding: '8px 16px', cursor: 'pointer', fontSize: 13,
                background: currentTable === item.key ? '#e6f4ff' : undefined,
                color: currentTable === item.key ? '#1677ff' : '#333',
                borderRight: currentTable === item.key ? '3px solid #1677ff' : undefined,
              }}
              onMouseEnter={e => { if (currentTable !== item.key) (e.currentTarget as HTMLElement).style.background = '#f0f0f0' }}
              onMouseLeave={e => { if (currentTable !== item.key) (e.currentTarget as HTMLElement).style.background = '' }}
            >
              {item.label}
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 16px', color: '#aaa', fontSize: 11, fontFamily: 'monospace', flexShrink: 0 }}>
          v.{version}
        </div>
      </div>

      {/* Main content — table */}
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

      {/* Chat panel — right side */}
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
