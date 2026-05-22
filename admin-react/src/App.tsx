import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/stores/auth'
import { sdbQuery } from '@/lib/sdb'
import { loadSchemaMeta, type TableMeta } from '@/lib/schema'
import { subscribeAgentMessages } from '@/agent/live-query'
import { dispatchActions, type TableController, type DetailController } from '@/agent/dispatcher'
import type { AgentAction, AgentMessage } from '@/agent/types'
import LoginView from '@/pages/LoginView'
import SchemaTable from '@/components/SchemaTable'
import DetailPanel from '@/components/DetailPanel'

interface ChatMsg {
  id: string
  role: 'user' | 'agent'
  text: string
  status: 'pending' | 'done' | 'error'
  actions: AgentAction[]
  timestamp: string
}

export default function App() {
  const auth = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [schemaMeta, setSchemaMeta] = useState<Map<string, TableMeta>>(new Map())
  const [menuItems, setMenuItems] = useState<{ key: string; label: string }[]>([])
  const [currentTable, setCurrentTable] = useState('')
  const [currentMeta, setCurrentMeta] = useState<TableMeta | null>(null)

  // Detail
  const [detailVisible, setDetailVisible] = useState(false)
  const [detailMode, setDetailMode] = useState<'view' | 'create' | 'edit'>('view')
  const [detailRecordId, setDetailRecordId] = useState<string | null>(null)
  const [detailPrefill, setDetailPrefill] = useState<Record<string, unknown>>()

  // Chat
  const sessionId = useRef(`sess_${Date.now()}`)
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Table refs
  const tableRef = useRef<TableController | null>(null)
  const tableRefs = useRef<Map<string, TableController>>(new Map())

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
      const hash = window.location.hash.slice(1) // remove #
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
    setCollapsed(true)
  }

  // Detail handlers
  function handleRowClick(recordId: string) {
    setDetailRecordId(recordId)
    setDetailMode('view')
    setDetailPrefill(undefined)
    setDetailVisible(true)
  }
  function handleCreate() {
    setDetailRecordId(null)
    setDetailMode('create')
    setDetailPrefill(undefined)
    setDetailVisible(true)
  }
  function handleDetailClose() {
    setDetailVisible(false)
    tableRef.current?.refresh()
  }

  // Send message
  async function sendMessage() {
    const text = inputText.trim()
    if (!text || sending) return
    setSending(true)
    try {
      const result = await sdbQuery(
        `INSERT INTO agent_message { user_input: $input, status: 'pending', session_id: $sid, created_by: $uid }`,
        { input: text, sid: sessionId.current, uid: auth.user?.id ?? '' },
        auth.token
      )
      setChatMessages(prev => [...prev, {
        id: result?.[0]?.id ?? '', role: 'user', text, status: 'pending',
        actions: [], timestamp: new Date().toISOString(),
      }])
      setInputText('')
      setTimeout(scrollChatBottom, 100)
    } catch (err: any) {
      console.error('[App] send failed:', err.message)
    } finally {
      setSending(false)
    }
  }

  function handleKeydown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  function scrollChatBottom() {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }

  // Agent response handler
  const handleAgentResponse = useCallback((row: AgentMessage) => {
    setChatMessages(prev => [...prev, {
      id: row.id + '_agent', role: 'agent',
      text: row.response ?? '',
      status: (row.status as 'done' | 'error'),
      actions: row.actions || [],
      timestamp: row.created_at || '',
    }])
    if (tableRef.current) tableRefs.current.set(currentTable, tableRef.current)
    const detailCtrl: DetailController = {
      openDetail(rid) { setDetailRecordId(rid); setDetailMode('view'); setDetailVisible(true) },
      openCreate(t, pf) { setCurrentTable(t); setCurrentMeta(schemaMeta.get(t) ?? null); setDetailRecordId(null); setDetailMode('create'); setDetailPrefill(pf); setDetailVisible(true); window.location.hash = `#/tables/${t}` },
    }
    dispatchActions(row.actions || [], {
      router: null as any, tableRefs: tableRefs.current, detailRef: detailCtrl,
    })
    setTimeout(scrollChatBottom, 100)
  }, [currentTable, schemaMeta])

  // Live query
  useEffect(() => {
    if (!auth.token) return
    const unsub = subscribeAgentMessages(sessionId.current, (rows) => {
      for (const row of rows) handleAgentResponse(row)
    }, auth.token)
    return unsub
  }, [auth.token, handleAgentResponse])

  if (!auth.isAuthenticated) return <LoginView />

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{
        width: collapsed ? 0 : 220,
        minWidth: collapsed ? 0 : 220,
        transition: 'width 0.2s, min-width 0.2s',
        borderRight: '1px solid #e8e8e8',
        background: '#fafafa',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Collapse toggle bar */}
        <div
          onClick={() => setCollapsed(!collapsed)}
          style={{
            position: 'absolute', left: collapsed ? 0 : 220, top: 0, bottom: 0,
            width: 4, cursor: 'pointer', zIndex: 10,
            background: 'transparent',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#d9d9d9'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        />

        {!collapsed && (
          <>
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
          </>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Scrollable area */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 80px' }}>
          {currentTable ? (
            <div style={{ marginBottom: 16 }}>
              <SchemaTable
                ref={tableRef}
                tableName={currentTable}
                meta={currentMeta}
                onRowClick={handleRowClick}
                onCreate={handleCreate}
              />
            </div>
          ) : chatMessages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: '#999' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#666', marginBottom: 8 }}>对话即操作</div>
              <div style={{ fontSize: 14 }}>👈 选择左侧表 或 💬 在下方对话中输入指令</div>
              <div style={{ fontSize: 13, color: '#bbb', marginTop: 4 }}>
                试试：「看库存」「新建客户张三」
              </div>
            </div>
          ) : null}

          {/* Chat bubbles */}
          {chatMessages.map(msg => (
            <div key={msg.id} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '75%', padding: '10px 16px', borderRadius: 12,
                  background: msg.role === 'user' ? '#e8f0fe' : '#f1f3f4',
                  fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {msg.status === 'pending' && <div style={{ color: '#999', fontSize: 12, marginBottom: 4 }}>⏳ 思考中...</div>}
                  {msg.status === 'error' && <div style={{ color: '#d93025', fontSize: 12, marginBottom: 4 }}>⚠ 出错</div>}
                  {msg.text}
                  {msg.actions?.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {msg.actions.map((a, i) => (
                        <span key={i} style={{
                          padding: '2px 6px', background: '#e6f4ff', borderRadius: 4,
                          fontSize: 11, color: '#1677ff',
                        }}>{a.type}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{
                fontSize: 11, color: '#aaa', marginTop: 4,
                textAlign: msg.role === 'user' ? 'right' : 'left',
              }}>
                {msg.role === 'user' ? '我' : 'Agent'} {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>

        {/* Fixed bottom input */}
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          borderTop: '1px solid #e0e0e0', padding: '12px 24px',
          background: '#fff', display: 'flex', gap: 8, alignItems: 'flex-end',
          zIndex: 10,
        }}>
          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeydown}
            placeholder="输入指令... (Enter 发送，Shift+Enter 换行)"
            disabled={sending}
            rows={1}
            style={{
              flex: 1, padding: '10px 16px', border: '1px solid #d9d9d9',
              borderRadius: 20, fontSize: 14, resize: 'none',
              fontFamily: 'inherit', outline: 'none',
            }}
            onInput={e => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 120) + 'px'
            }}
          />
          <button
            onClick={sendMessage}
            disabled={sending || !inputText.trim()}
            style={{
              padding: '10px 24px', background: sending ? '#91caff' : '#1677ff',
              color: '#fff', border: 'none', borderRadius: 20, fontSize: 14,
              cursor: sending ? 'not-allowed' : 'pointer', fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            {sending ? '...' : '发送'}
          </button>
        </div>
      </div>

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
