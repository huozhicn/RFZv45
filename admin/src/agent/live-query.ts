/**
 * SDB LIVE QUERY 封装
 *
 * 使用 SDB REST API 的 /live 端点订阅实时更新。
 * 如果 /live 不可用，降级为轮询。
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
        body: JSON.stringify({
          query: `SELECT * FROM agent_message WHERE session_id = '${sessionId}' AND status IN ('done', 'error') ORDER BY created_at`,
        }),
      })
      const data = await resp.json()
      const rows: AgentMessage[] = data[0]?.result || []
      callback(rows)
    } catch (err) {
      console.error('[live-query] poll error:', err)
    }
    timeoutId = setTimeout(poll, 2000) // 2秒轮询
  }

  poll()

  return () => {
    stop = true
    if (timeoutId) clearTimeout(timeoutId)
  }
}
