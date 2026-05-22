import { useAuthStore } from '@/stores/auth'

/**
 * Direct SDB REST query — minimal, no wrapping, no interpolation magic.
 * Sends raw SQL as body, returns parsed JSON.
 */
export function useSdbQuery() {
  const auth = useAuthStore()

  function escapeVal(v: unknown): string {
    if (v === null || v === undefined) return 'NONE'
    if (typeof v === 'boolean') return v ? 'true' : 'false'
    if (typeof v === 'number') return String(v)
    if (typeof v === 'string') return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
    return String(v)
  }

  function interpolate(sql: string, vars?: Record<string, unknown>): string {
    if (!vars) return sql
    return sql.replace(/\$(\w+)/g, (_, name) => {
      if (name in vars) return escapeVal(vars[name])
      return `$${name}` // leave unknown $vars as-is (SDB system vars)
    })
  }

  async function query<T = any>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    const token = auth.token
    const body = interpolate(sql, vars)
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

    const resp = await fetch(url, { method: 'POST', headers, body })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      console.error(`[sdb] ${resp.status} on: ${body.slice(0, 60)}... → ${text.slice(0, 100)}`)
      throw new Error(`SDB ${resp.status}: ${text.slice(0, 80)}`)
    }
    const data = await resp.json()
    // SDB REST /sql returns [{result: [...], status: "OK"}]
    return (Array.isArray(data) ? data[0]?.result ?? [] : []) as T
  }

  return { query }
}
