/**
 * SDB LIVE QUERY 封装（轮询版）
 * 每 2 秒查 agent_message，有结果就回调。
 */
import type { AgentMessage } from './types'

type LiveCallback = (rows: AgentMessage[]) => void

export function subscribeAgentMessages(
  sessionId: string,
  callback: LiveCallback,
  authToken: string,
): () => void {
  if (!authToken) {
    return () => {}
  }

  let stop = false
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  async function poll() {
    if (stop) return
    try {
      const url = `${window.location.origin}/sdb/sql`
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'Accept': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'Surreal-NS': 'huozhi',
          'Surreal-DB': 'rfzv45',
        },
        body: `SELECT * FROM agent_message WHERE session_id = '${sessionId}' AND status IN ('done', 'error') ORDER BY created_at`,
      })
      if (!resp.ok) return
      const data = await resp.json()
      const rows: AgentMessage[] = Array.isArray(data) ? (data[0]?.result || []) : []
      if (rows.length > 0) callback(rows)
    } catch (err) {
      // Silently ignore poll errors — agent_message table may not have results yet
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
