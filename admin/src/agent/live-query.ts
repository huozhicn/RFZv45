/**
 * SDB LIVE QUERY 封装（轮询降级版）
 *
 * SDB 3.0 REST API 不支持 /live WebSocket，用轮询模拟。
 * 启动后每 2 秒查一次 agent_message 表。
 */
import type { AgentMessage } from './types'

type LiveCallback = (rows: AgentMessage[]) => void

export function subscribeAgentMessages(
  sessionId: string,
  callback: LiveCallback,
  sdbEndpoint: string,
  authToken: string,
  ns: string,
  db: string
): () => void {
  if (!authToken) {
    console.warn('[live-query] no auth token, skipping subscription')
    return () => {}
  }

  let stop = false
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  async function poll() {
    if (stop) return
    try {
      const resp = await fetch(`${sdbEndpoint}/sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Surreal-NS': ns,
          'Surreal-DB': db,
          'Authorization': `Bearer ${authToken}`,
        },
        body: `SELECT * FROM agent_message WHERE session_id = '${sessionId}' AND status IN ('done', 'error') ORDER BY created_at`,
      })
      if (!resp.ok) {
        console.error('[live-query] HTTP error:', resp.status)
        return
      }
      const data = await resp.json()
      // REST /sql 返回 [{result: [...], status: "OK"}, ...]
      const rows: AgentMessage[] = Array.isArray(data) ? (data[0]?.result || []) : []
      if (rows.length > 0) {
        callback(rows)
      }
    } catch (err) {
      console.error('[live-query] poll error:', err)
    }
    if (!stop) {
      timeoutId = setTimeout(poll, 2000)
    }
  }

  poll()

  return () => {
    stop = true
    if (timeoutId) clearTimeout(timeoutId)
  }
}
