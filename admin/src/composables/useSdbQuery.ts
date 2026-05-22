import { useAuthStore } from '@/stores/auth'
import { restQuery } from '@/stores/auth'

/**
 * Recursively remove null values from arrays in SDB query results.
 * SDB returns [null] for empty record-link arrays like `categories: [null]`,
 * which would break any `.map()` call downstream (e.g., `arr.map(c => c.id)`).
 * Objects retain null fields — only array-level nulls are stripped.
 */
function deepCleanNulls(value: unknown): unknown {
  if (Array.isArray(value)) {
    const cleaned = value.filter(v => v != null)
    return cleaned.map(deepCleanNulls)
  }
  if (value !== null && typeof value === 'object') {
    const cleaned: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      cleaned[k] = deepCleanNulls(v)
    }
    return cleaned
  }
  return value
}

/**
 * Replace $varName placeholders in SQL with properly escaped values.
 * SDB 3.0.5 REST API does not support parameterized queries in a way that
 * returns results (the {query, vars} JSON format only echoes input).
 * Client-side interpolation is the pragmatic workaround.
 */
function interpolateVars(sql: string, vars?: Record<string, unknown>): string {
  if (!vars) return sql
  return sql.replace(/\$(\w+)/g, (_, name) => {
    const val = vars[name]
    if (val === undefined) return `$${name}`
    if (typeof val === 'string') {
      const escaped = val.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      return `'${escaped}'`
    }
    if (val === null) return 'NONE'
    if (typeof val === 'boolean') return val ? 'true' : 'false'
    if (typeof val === 'number') return String(val)
    if (Array.isArray(val)) {
      const items = val.map(v => {
        if (typeof v === 'string') return `'${v.replace(/'/g, "\\'")}'`
        return String(v)
      })
      return `[${items.join(', ')}]`
    }
    return String(val)
  })
}

export function useSdbQuery() {
  const auth = useAuthStore()

  async function query<T = any>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    const token = auth.token
    const interpolated = interpolateVars(sql, vars)
    const results = await restQuery(interpolated, token ?? undefined)
    // REST /sql returns [{result: [...], status: "OK"}, ...]
    // Unwrap to [result[0].result] to match legacy SurrealDB SDK format
    // So callers use: result[0] to get the first query's data array
    if (Array.isArray(results) && results.length >= 1) {
      const cleaned = deepCleanNulls(results[0].result)
      return [cleaned] as T
    }
    return results as T
  }

  function getTenantId(): string | null {
    return auth.currentTenantId
  }

  function getTenantFilter(): string {
    const tid = auth.currentTenantId
    return tid ? `tenant = '${tid}'` : ''
  }

  return { query, getTenantId, getTenantFilter }
}
