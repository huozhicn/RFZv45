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
  /** PERMISSIONS info: which operations are allowed for current user */
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

export function extractEnumValues(assert: string | null): string[] {
  if (!assert) return []
  const values = assert.match(/'([^']+)'/g)
  return (values || []).map(v => v.slice(1, -1))
}

/**
 * Parse a SurrealDB field definition line into FieldMeta.
 *
 * Examples:
 *   DEFINE FIELD name ON store TYPE string COMMENT '店铺名称' PERMISSIONS FULL
 *   DEFINE FIELD status ON store TYPE string ASSERT $value INSIDE ['active','inactive'] DEFAULT 'active' PERMISSIONS FULL
 *   DEFINE FIELD address ON store TYPE none | string PERMISSIONS FULL
 *   DEFINE FIELD tenant ON store TYPE record<tenant> PERMISSIONS FULL
 *   DEFINE FIELD created_at ON store TYPE datetime DEFAULT time::now() PERMISSIONS FULL
 *   DEFINE FIELD items ON store TYPE option<array> PERMISSIONS FULL
 */
function parseFieldDef(def: string): FieldMeta | null {
  // Extract field name: DEFINE FIELD <name> ON ...
  const nameMatch = def.match(/^DEFINE FIELD (\w+) ON /)
  if (!nameMatch) return null
  const name = nameMatch[1]

  // Skip nested field definitions like "actions.*"
  if (name.includes('.')) return null

  // Extract TYPE clause
  const typeMatch = def.match(/TYPE (.+?)(?:\s+(?:COMMENT|ASSERT|DEFAULT|PERMISSIONS|READONLY)\b|\s*$)/)
  if (!typeMatch) return null
  const typeStr = typeMatch[1].trim()

  // Parse type
  let kind = 'string'
  let isOption = false
  let isRecord = false
  let recordTarget: string | null = null

  const optMatch = typeStr.match(/^none\s*\|\s*(.+)/)
  if (optMatch) {
    isOption = true
    kind = parseBaseType(optMatch[1])
  } else if (typeStr.startsWith('option<')) {
    isOption = true
    const inner = typeStr.slice(7, -1)
    kind = parseBaseType(inner)
  } else {
    kind = parseBaseType(typeStr)
  }

  // Check for record references
  const recMatch = typeStr.match(/record<(\w+)>/)
  if (recMatch) {
    isRecord = true
    recordTarget = recMatch[1]
    kind = 'record'
  }

  // Extract ASSERT
  const assertMatch = def.match(/ASSERT (.+?)(?:\s+(?:DEFAULT|PERMISSIONS|COMMENT|READONLY)\b|\s*$)/)
  const assert = assertMatch ? assertMatch[1] : null

  // Extract DEFAULT
  const defMatch = def.match(/DEFAULT (.+?)(?:\s+(?:PERMISSIONS|COMMENT|ASSERT|READONLY)\b|\s*$)/)
  const defaultVal = defMatch ? defMatch[1] : null

  // Extract COMMENT
  const commentMatch = def.match(/COMMENT ['"](.+?)['"](?:\s+(?:PERMISSIONS|ASSERT|DEFAULT|READONLY)\b|\s*$)/)
  const comment = commentMatch ? commentMatch[1] : null

  return { name, kind, assert, default: defaultVal, isOption, isRecord, recordTarget, comment }
}

function parseBaseType(type: string): string {
  const t = type.trim()
  if (t === 'int' || t === 'number') return 'int'
  if (t === 'float' || t === 'decimal') return 'float'
  if (t === 'bool' || t === 'boolean') return 'bool'
  if (t === 'datetime') return 'datetime'
  if (t === 'string' || t === 'text') return 'string'
  if (t.startsWith('array') || t.startsWith('option<array')) return 'array'
  if (t.startsWith('geometry')) return 'geometry'
  if (t.startsWith('record')) return 'record'
  if (t.startsWith('option<record')) { return 'record' }
  return 'string'
}

/**
 * Parse permissions string to determine which operations are allowed.
 * PERMISSIONS FULL → all true
 * FOR select WHERE ... FOR create,update WHERE ... → parse
 */
function parsePermissions(permStr: string | undefined): { create: boolean; update: boolean; delete: boolean } {
  if (!permStr) return { create: true, update: true, delete: true } // default: allow
  if (permStr === 'FULL') return { create: true, update: true, delete: true }
  if (permStr === 'NONE') return { create: false, update: false, delete: false }

  const create = !permStr.includes('FOR create NONE') && !permStr.includes('FOR create WHERE false')
  const update = !permStr.includes('FOR update NONE') && !permStr.includes('FOR update WHERE false')
  const delete_ = !permStr.includes('FOR delete NONE') && !permStr.includes('FOR delete WHERE false')
  return { create, update, delete: delete_ }
}

/**
 * Load schema metadata for all tables in TABLE_REGISTRY.
 * Uses INFO FOR TABLE to get real field definitions (types, comments, enums, permissions).
 */
export async function loadSchemaMeta(
  queryFn: (sql: string) => Promise<any>
): Promise<Map<string, TableMeta>> {
  const meta = new Map<string, TableMeta>()

  for (const tableName of TABLE_REGISTRY) {
    try {
      const raw = await queryFn(`INFO FOR TABLE ${tableName}`)
      // queryFn wraps SDB response: returns result array or raw object
      const info = Array.isArray(raw) ? (raw[0] ?? raw) : raw

      const fields: FieldMeta[] = []
      const fieldDefs = (info?.fields ?? {}) as Record<string, string>

      for (const [key, def] of Object.entries(fieldDefs)) {
        // Skip nested definitions (e.g. "actions.*")
        if (key.includes('.')) continue
        const parsed = parseFieldDef(def)
        if (parsed) fields.push(parsed)
      }

      // Always add id field if not present (SDB doesn't list it in INFO FOR TABLE)
      if (!fields.find(f => f.name === 'id')) {
        fields.unshift({ name: 'id', kind: 'string', assert: null, default: null, isOption: false, isRecord: false, recordTarget: null, comment: 'ID' })
      }

      const perms = parsePermissions(info?.permissions)
      meta.set(tableName, {
        name: tableName,
        fields,
        canCreate: perms.create,
        canUpdate: perms.update,
        canDelete: perms.delete,
      })
    } catch {
      // Table might not exist or no permission — skip
    }
  }

  return meta
}
