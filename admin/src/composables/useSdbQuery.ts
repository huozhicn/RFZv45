     1|import { useAuthStore } from '@/stores/auth'
     2|import { restQuery } from '@/stores/auth'
     3|
     4|/**
     5| * Recursively remove null values from arrays in SDB query results.
     6| * SDB returns [null] for empty record-link arrays like `categories: [null]`,
     7| * which would break any `.map()` call downstream (e.g., `arr.map(c => c.id)`).
     8| * Objects retain null fields — only array-level nulls are stripped.
     9| */
    10|function deepCleanNulls(value: unknown): unknown {
    11|  if (Array.isArray(value)) {
    12|    const cleaned = value.filter(v => v != null)
    13|    return cleaned.map(deepCleanNulls)
    14|  }
    15|  if (value !== null && typeof value === 'object') {
    16|    const cleaned: Record<string, unknown> = {}
    17|    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    18|      cleaned[k] = deepCleanNulls(v)
    19|    }
    20|    return cleaned
    21|  }
    22|  return value
    23|}
    24|
    25|/**
    26| * Replace $varName placeholders in SQL with properly escaped values.
    27| * SDB 3.0.5 REST API does not support parameterized queries in a way that
    28| * returns results (the {query, vars} JSON format only echoes input).
    29| * Client-side interpolation is the pragmatic workaround.
    30| */
    31|function interpolateVars(sql: string, vars?: Record<string, unknown>): string {
    32|  if (!vars) return sql
    33|  return sql.replace(/\$(\w+)/g, (_, name) => {
    34|    const val = vars[name]
    35|    if (val === undefined) return `$${name}`
    36|    if (typeof val === 'string') {
    37|      const escaped = val.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    38|      return `'${escaped}'`
    39|    }
    40|    if (val === null) return 'NONE'
    41|    if (typeof val === 'boolean') return val ? 'true' : 'false'
    42|    if (typeof val === 'number') return String(val)
    43|    if (Array.isArray(val)) {
    44|      const items = val.map(v => {
    45|        if (typeof v === 'string') return `'${v.replace(/'/g, "\\'")}'`
    46|        return String(v)
    47|      })
    48|      return `[${items.join(', ')}]`
    49|    }
    50|    return String(val)
    51|  })
    52|}
    53|
    54|export function useSdbQuery() {
    55|  const auth = useAuthStore()
    56|
    57|  async function query<T = any>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    58|    const token = auth.token
    59|    const interpolated = interpolateVars(sql, vars)
    60|    const results = await restQuery(interpolated, token ?? undefined)
    61|    // REST /sql returns [{result: [...], status: "OK"}, ...]
    62|    // Unwrap to [result[0].result] to match legacy SurrealDB SDK format
    63|    // So callers use: result[0] to get the first query's data array
    64|    if (Array.isArray(results) && results.length >= 1) {
    65|      const cleaned = deepCleanNulls(results[0].result)
    66|      return [cleaned] as T
    67|    }
    68|    return results as T
    69|  }
    70|
    71|  function getTenantId(): string | null {
    72|    return auth.currentTenantId
    73|  }
    74|
    75|  function getTenantFilter(): string {
    76|    const tid = auth.currentTenantId
    77|    return tid ? `tenant = '${tid}'` : ''
    78|  }
    79|
    80|  return { query, getTenantId, getTenantFilter }
    81|}
    82|