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

  // User menu
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [pwdModalOpen, setPwdModalOpen] = useState(false)
  const [pwdOld, setPwdOld] = useState('')
  const [pwdNew, setPwdNew] = useState('')
  const [pwdConfirm, setPwdConfirm] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [pwdOK, setPwdOK] = useState('')
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [userMenuOpen])

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

  async function handleChangePassword() {
    setPwdError('')
    setPwdOK('')
    if (!pwdNew || pwdNew.length < 4) { setPwdError('新密码至少4位'); return }
    if (pwdNew !== pwdConfirm) { setPwdError('两次密码不一致'); return }
    try {
      await auth.changePassword(pwdOld, pwdNew)
      setPwdOK('密码已修改')
      setTimeout(() => { setPwdModalOpen(false); setPwdOld(''); setPwdNew(''); setPwdConfirm(''); setPwdOK(''); setPwdError('') }, 1500)
    } catch (e: any) {
      setPwdError(e.message || '修改失败')
    }
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

        {/* ── User menu ── */}
        <div ref={userMenuRef} style={{ flexShrink: 0, position: 'relative' }}>
          <div
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', cursor: 'pointer',
              borderTop: '1px solid #e8e8e8',
              fontSize: 13, color: '#333',
              userSelect: 'none',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f0f0f0'}
            onMouseLeave={e => { if (!userMenuOpen) (e.currentTarget as HTMLElement).style.background = '' }}
          >
            <span style={{
              width: 28, height: 28, borderRadius: '50%',
              background: '#1677ff', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600, flexShrink: 0,
            }}>
              {auth.user?.username?.[0]?.toUpperCase() || '?'}
            </span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {auth.user?.username || '?'}
            </span>
            <span style={{ fontSize: 10, color: '#aaa' }}>▼</span>
          </div>

          {userMenuOpen && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 8, right: 8,
              background: '#fff', borderRadius: 6,
              boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
              border: '1px solid #e8e8e8',
              overflow: 'hidden',
              zIndex: 100,
            }}>
              <div
                onClick={() => { setUserMenuOpen(false); setPwdModalOpen(true); setPwdError(''); setPwdOK('') }}
                style={{
                  padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: '#333',
                  borderBottom: '1px solid #f0f0f0',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f5f5f5'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
              >
                🔒 修改密码
              </div>
              <div
                onClick={() => { setUserMenuOpen(false); auth.logout() }}
                style={{
                  padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: '#e74c3c',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fff5f5'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
              >
                🚪 退出系统
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '8px 16px 12px', color: '#aaa', fontSize: 11, fontFamily: 'monospace', flexShrink: 0 }}>
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

      {/* ── Password change modal ── */}
      {pwdModalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => { setPwdModalOpen(false); setPwdError(''); setPwdOK(''); setPwdOld(''); setPwdNew(''); setPwdConfirm('') }}
        >
          <div
            style={{
              background: '#fff', borderRadius: 8, padding: '24px 28px',
              minWidth: 340, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: '#333' }}>
              🔒 修改密码
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>旧密码</div>
              <input
                type="password" value={pwdOld} onChange={e => setPwdOld(e.target.value)}
                style={{
                  width: '100%', padding: '8px 10px', border: '1px solid #d9d9d9', borderRadius: 4,
                  fontSize: 13, outline: 'none', boxSizing: 'border-box',
                }}
                placeholder="输入旧密码"
                autoFocus
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>新密码</div>
              <input
                type="password" value={pwdNew} onChange={e => setPwdNew(e.target.value)}
                style={{
                  width: '100%', padding: '8px 10px', border: '1px solid #d9d9d9', borderRadius: 4,
                  fontSize: 13, outline: 'none', boxSizing: 'border-box',
                }}
                placeholder="至少4位"
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>确认新密码</div>
              <input
                type="password" value={pwdConfirm} onChange={e => setPwdConfirm(e.target.value)}
                style={{
                  width: '100%', padding: '8px 10px', border: '1px solid #d9d9d9', borderRadius: 4,
                  fontSize: 13, outline: 'none', boxSizing: 'border-box',
                }}
                placeholder="再输一遍"
                onKeyDown={e => { if (e.key === 'Enter') handleChangePassword() }}
              />
            </div>

            {pwdError && <div style={{ color: '#e74c3c', fontSize: 12, marginBottom: 8 }}>{pwdError}</div>}
            {pwdOK && <div style={{ color: '#27ae60', fontSize: 12, marginBottom: 8 }}>{pwdOK}</div>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
              <button
                onClick={() => { setPwdModalOpen(false); setPwdError(''); setPwdOK(''); setPwdOld(''); setPwdNew(''); setPwdConfirm('') }}
                style={{
                  padding: '6px 16px', border: '1px solid #d9d9d9', borderRadius: 4,
                  background: '#fff', cursor: 'pointer', fontSize: 13,
                }}
              >取消</button>
              <button
                onClick={handleChangePassword}
                style={{
                  padding: '6px 20px', border: 'none', borderRadius: 4,
                  background: '#1677ff', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                }}
              >确认修改</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
