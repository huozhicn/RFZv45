import { TABLE_REGISTRY } from './table-registry'

export interface FieldMeta {
  name: string
  kind: string
  assert: string | null
  default: string | null
  isOption: boolean
  isRecord: boolean
  recordTarget: string | null
  comment: string | null
}

export interface TableMeta {
  name: string
  fields: FieldMeta[]
}

export function extractEnumValues(assert: string | null): string[] {
  if (!assert) return []
  const values = assert.match(/'([^']+)'/g)
  return (values || []).map(v => v.slice(1, -1))
}

function inferKind(val: unknown): string {
  if (val === null || val === undefined) return 'option<string>'
  if (typeof val === 'number') return Number.isInteger(val) ? 'int' : 'float'
  if (typeof val === 'boolean') return 'bool'
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(val)) return 'datetime'
    return 'string'
  }
  if (typeof val === 'object') return 'object'
  return 'string'
}

export function inferFieldsFromRow(row: Record<string, unknown>): FieldMeta[] {
  const fields: FieldMeta[] = []
  for (const [key, val] of Object.entries(row)) {
    if (key.startsWith('_')) continue
    fields.push({
      name: key,
      kind: inferKind(val),
      assert: null, default: null,
      isOption: val === null,
      isRecord: typeof val === 'string' && val.includes(':'),
      recordTarget: null, comment: key,
    })
  }
  return fields
}

export async function loadSchemaMeta(
  queryFn: (sql: string) => Promise<any>
): Promise<Map<string, TableMeta>> {
  const meta = new Map<string, TableMeta>()
  for (const tableName of TABLE_REGISTRY) {
    try {
      const result = await queryFn(`SELECT * FROM ${tableName} LIMIT 1`)
      const rows = result || []
      if (rows.length > 0) {
        meta.set(tableName, { name: tableName, fields: inferFieldsFromRow(rows[0]) })
      } else {
        meta.set(tableName, { name: tableName, fields: [] })
      }
    } catch {
      // skip no-permission tables
    }
  }
  return meta
}
