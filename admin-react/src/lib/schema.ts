import schemaSnapshot from './schema-snapshot.json'
import menuConfig from './menu-config.json'

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
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  /** Chinese label from schema @label annotation */
  label: string
  /** Group key from schema @group annotation */
  group: string
}

/** Menu group from .surql @group annotations */
export interface MenuGroup {
  key: string
  label: string
  tables: { key: string; label: string }[]
}

/** Build-time menu config loaded from menu-config.json */
export const menuGroups: MenuGroup[] = menuConfig.groups

/** Map table name → {label, group} for fast lookup */
const labelMap = new Map<string, { label: string; group: string }>()
for (const g of menuGroups) {
  for (const t of g.tables) {
    labelMap.set(t.key, { label: t.label, group: g.key })
  }
}

export function extractEnumValues(assert: string | null): string[] {
  if (!assert) return []
  const match = assert.match(/'([^']+)'/g)
  return (match || []).map(v => v.slice(1, -1))
}

/**
 * Load schema metadata from build-time snapshot.
 * Merges field definitions from schema-snapshot.json with
 * Chinese labels / group info from menu-config.json.
 */
export async function loadSchemaMeta(
  _queryFn: (sql: string) => Promise<any>
): Promise<Map<string, TableMeta>> {
  const meta = new Map<string, TableMeta>()
  const snapshot = schemaSnapshot as Record<string, { name: string; fields: FieldMeta[] }>

  for (const [tableName, def] of Object.entries(snapshot)) {
    const menu = labelMap.get(tableName)
    meta.set(tableName, {
      name: tableName,
      fields: def.fields,
      canCreate: true,
      canUpdate: true,
      canDelete: true,
      label: menu?.label ?? tableName,
      group: menu?.group ?? '',
    })
  }

  return meta
}
