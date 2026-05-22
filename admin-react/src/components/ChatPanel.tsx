import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '@/stores/auth'
import { sdbQuery } from '@/lib/sdb'
import { subscribeAgentMessages } from '@/agent/live-query'
import { dispatchActions, type TableController, type DetailController } from '@/agent/dispatcher'
import type { AgentAction, AgentMessage } from '@/agent/types'

interface ChatMsg {
  id: string
  role: 'user' | 'agent'
  text: string
  status: 'pending' | 'done' | 'error'
  actions: AgentAction[]
  timestamp: string
}

interface Props {
  tableRefs: React.MutableRefObject<Map<string, TableController>>
  currentTable: string
  detailCtrl: DetailController
}

export default function ChatPanel({ tableRefs, currentTable, detailCtrl }: Props) {
  const auth = useAuth()
  const sessionId = useRef(`sess_${Date.now()}`)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  function scrollBottom() {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }

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
      setMessages(prev => [...prev, {
        id: result?.[0]?.id ?? '', role: 'user', text, status: 'pending',
        actions: [], timestamp: new Date().toISOString(),
      }])
      setInputText('')
      setTimeout(scrollBottom, 100)
    } catch (err: any) {
      console.error('[Chat] send failed:', err.message)
    } finally {
      setSending(false)
    }
  }

  function handleKeydown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const handleAgentResponse = useCallback((row: AgentMessage) => {
    setMessages(prev => [...prev, {
      id: row.id + '_agent', role: 'agent',
      text: row.response ?? '',
      status: (row.status as 'done' | 'error'),
      actions: row.actions || [],
      timestamp: row.created_at || '',
    }])
    dispatchActions(row.actions || [], {
      router: null as any,
      tableRefs: tableRefs.current,
      detailRef: detailCtrl,
    })
    setTimeout(scrollBottom, 100)
  }, [tableRefs, detailCtrl])

  useEffect(() => {
    if (!auth.token) return
    const unsub = subscribeAgentMessages(sessionId.current, (rows) => {
      for (const row of rows) handleAgentResponse(row)
    }, auth.token)
    return unsub
  }, [auth.token, handleAgentResponse])

  const noMessages = messages.length === 0

  return (
    <div style={{
      width: 380, minWidth: 380,
      borderLeft: '1px solid #e8e8e8',
      background: '#fff',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', fontWeight: 600, fontSize: 14,
        borderBottom: '1px solid #e8e8e8', flexShrink: 0,
        background: '#fafafa',
      }}>
        💬 对话
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {noMessages && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb', fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
            <div>输入指令开始对话</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>试试：「看库存」「新建客户张三」</div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '90%', padding: '8px 14px', borderRadius: 12,
                background: msg.role === 'user' ? '#e8f0fe' : '#f1f3f4',
                fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {msg.status === 'pending' && <div style={{ color: '#999', fontSize: 11, marginBottom: 4 }}>⏳ 思考中...</div>}
                {msg.status === 'error' && <div style={{ color: '#d93025', fontSize: 11, marginBottom: 4 }}>⚠ 出错</div>}
                {msg.text}
                {msg.actions?.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
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
              fontSize: 10, color: '#aaa', marginTop: 2,
              textAlign: msg.role === 'user' ? 'right' : 'left',
            }}>
              {msg.role === 'user' ? '我' : 'Agent'} {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{
        borderTop: '1px solid #e0e0e0', padding: '10px 16px',
        background: '#fff', display: 'flex', gap: 8, alignItems: 'flex-end',
        flexShrink: 0,
      }}>
        <textarea
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeydown}
          placeholder="输入指令..."
          disabled={sending}
          rows={1}
          style={{
            flex: 1, padding: '8px 12px', border: '1px solid #d9d9d9',
            borderRadius: 18, fontSize: 13, resize: 'none',
            fontFamily: 'inherit', outline: 'none',
          }}
          onInput={e => {
            const el = e.currentTarget
            el.style.height = 'auto'
            el.style.height = Math.min(el.scrollHeight, 100) + 'px'
          }}
        />
        <button
          onClick={sendMessage}
          disabled={sending || !inputText.trim()}
          style={{
            padding: '8px 18px', background: sending ? '#91caff' : '#1677ff',
            color: '#fff', border: 'none', borderRadius: 18, fontSize: 13,
            cursor: sending ? 'not-allowed' : 'pointer', fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          {sending ? '...' : '发送'}
        </button>
      </div>
    </div>
  )
}
