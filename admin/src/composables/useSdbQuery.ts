import { useAuthStore } from '@/stores/auth'

/**
 * Direct SDB REST query — minimal, no wrapping, no interpolation magic.
 * Sends raw SQL as body, returns parsed JSON.
 */
export function useSdbQuery() {
  const auth = useAuthStore()

  async function query<T = any>(sql: string): Promise<T> {
    const token = auth.token
    const endpoint = '/sdb' // relative to origin
    const url = `${window.location.origin}${endpoint}/sql`

    const headers: Record<string, string> = {
      'Content-Type': 'text/plain',
      'Accept': 'application/json',
      'Surreal-NS': 'huozhi',
      'Surreal-DB': 'rfzv45',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const resp = await fetch(url, { method: 'POST', headers, body: sql })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      console.error(`[sdb] ${resp.status} on: ${sql.slice(0, 60)}... → ${text.slice(0, 100)}`)
      throw new Error(`SDB ${resp.status}: ${text.slice(0, 80)}`)
    }
    const data = await resp.json()
    // SDB REST /sql returns [{result: [...], status: "OK"}]
    return (Array.isArray(data) ? data[0]?.result ?? [] : []) as T
  }

  return { query }
}
