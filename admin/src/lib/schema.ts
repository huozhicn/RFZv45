/**
 * Schema 元数据加载器
 *
 * 调用 INFO FOR TABLE 获取字段定义、类型、断言（枚举值），
 * 驱动 SchemaTable 和 DetailPanel 的自动渲染。
 */

export interface FieldMeta {
  name: string
  kind: string             // TYPE string, TYPE int, TYPE datetime, etc.
  assert: string | null    // ASSERT $value INSIDE [...] → 提取枚举选项
  default: string | null
  isOption: boolean
  isRecord: boolean        // TYPE record<xxx>
  recordTarget: string | null
  comment: string | null
}

export interface TableMeta {
  name: string
  fields: FieldMeta[]
}

/**
 * 解析 INFO FOR TABLE 返回的 DEFINE FIELD 语句
 */
function parseFieldDefine(stmt: string): FieldMeta | null {
  // DEFINE FIELD name ON table TYPE string ASSERT $value INSIDE ['a','b']
  const nameMatch = stmt.match(/DEFINE FIELD (\w+) ON/)
  if (!nameMatch) return null

  const name = nameMatch[1]

  // 隐藏内部字段
  if (name.startsWith('_')) return null

  const typeMatch = stmt.match(/TYPE (\S+)/)
  const kind = typeMatch?.[1] ?? 'string'

  const assertMatch = stmt.match(/ASSERT \$value INSIDE \[(.*?)\]/)
  const assert = assertMatch ? assertMatch[1] : null

  const defaultMatch = stmt.match(/DEFAULT ([\w:.()'"]+)/)
  const defaultValue = defaultMatch?.[1] ?? null

  const isOption = stmt.includes('option<')
  const recordMatch = stmt.match(/record<(\w+)>/)
  const isRecord = !!recordMatch
  const recordTarget = recordMatch?.[1] ?? null

  const commentMatch = stmt.match(/COMMENT ['"](.+?)['"]/)
  const comment = commentMatch?.[1] ?? null

  return { name, kind, assert, default: defaultValue, isOption, isRecord, recordTarget, comment }
}

/**
 * 从 ASSERT 字符串提取枚举选项
 * e.g. "['pending', 'done']" → ['pending', 'done']
 */
export function extractEnumValues(assert: string | null): string[] {
  if (!assert) return []
  const values = assert.match(/'([^']+)'/g)
  return (values || []).map(v => v.slice(1, -1))
}

/**
 * 从 SDB INFO FOR TABLE 返回的原始数据中解析字段列表
 */
export function parseTableMeta(raw: Record<string, unknown>): TableMeta | null {
  const fields = raw.fields as Record<string, string> | undefined
  if (!fields) return null

  const fieldList: FieldMeta[] = []
  for (const [key, stmt] of Object.entries(fields)) {
    const meta = parseFieldDefine(stmt)
    if (meta) fieldList.push(meta)
  }

  // 找到表名（从第一个字段的 ON xxx 中提取）
  const firstStmt = Object.values(fields)[0] ?? ''
  const tableMatch = firstStmt.match(/ON (\w+)/)
  const name = tableMatch?.[1] ?? 'unknown'

  return { name, fields: fieldList }
}

/**
 * 加载所有表的元数据
 * 返回 { tableName: TableMeta }
 */
export async function loadSchemaMeta(
  query: (sql: string) => Promise<any>
): Promise<Map<string, TableMeta>> {
  const meta = new Map<string, TableMeta>()

  try {
    const result = await query('INFO FOR DB')
    const dbInfo = result[0]?.[0]
    if (!dbInfo?.tables) return meta

    const tables = dbInfo.tables as Record<string, string>

    for (const [tableName, _tableDef] of Object.entries(tables)) {
      try {
        const tableResult = await query(`INFO FOR TABLE ${tableName}`)
        const tableInfo = tableResult[0]?.[0]
        if (tableInfo) {
          const tableMeta = parseTableMeta(tableInfo)
          if (tableMeta) {
            meta.set(tableName, tableMeta)
          }
        }
      } catch {
        // 某些表可能拒绝 INFO 查询，跳过
      }
    }
  } catch (err) {
    console.error('[schema] loadSchemaMeta failed:', err)
  }

  return meta
}
