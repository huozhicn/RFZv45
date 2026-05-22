/**
 * Schema 元数据加载器
 *
 * 用 INFO FOR TABLE 获取字段定义、类型、断言（枚举值），
 * 驱动 SchemaTable 和 DetailPanel 的自动渲染。
 *
 * INFO FOR DB 需要高权限（scope token 不可用），
 * 改用 TABLE_REGISTRY 枚举所有表，逐个查 INFO FOR TABLE。
 */
import { TABLE_REGISTRY } from './table-registry'

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
 */
export function extractEnumValues(assert: string | null): string[] {
  if (!assert) return []
  const values = assert.match(/'([^']+)'/g)
  return (values || []).map(v => v.slice(1, -1))
}

/**
 * 从 SDB INFO FOR TABLE 返回的原始数据中解析字段列表
 */
export function parseTableMeta(raw: Record<string, unknown>, tableName: string): TableMeta | null {
  const fields = raw.fields as Record<string, string> | undefined
  if (!fields) return null

  const fieldList: FieldMeta[] = []
  for (const stmt of Object.values(fields)) {
    const meta = parseFieldDefine(stmt)
    if (meta) fieldList.push(meta)
  }

  return { name: tableName, fields: fieldList }
}

/**
 * INFO FOR TABLE 返回多种数据格式：
 * - 数组 [{ events, fields, indexes, lives, tables }]（正常）
 * - 字符串 "IAM error: ..."（无权限）
 *
 * 尝试多种解析路径。
 */
function extractFieldsObject(data: unknown): Record<string, unknown> | null {
  // 路径1: [{ fields: {...} }]
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
    return data[0] as Record<string, unknown>
  }
  // 路径2: 纯字符串 → 无权限
  if (typeof data === 'string') return null
  // 路径3: 直接是对象
  if (typeof data === 'object' && data !== null && 'fields' in data) {
    return data as Record<string, unknown>
  }
  return null
}

/**
 * 加载所有表的元数据
 */
export async function loadSchemaMeta(
  queryFn: (sql: string) => Promise<any>
): Promise<Map<string, TableMeta>> {
  const meta = new Map<string, TableMeta>()

  for (const tableName of TABLE_REGISTRY) {
    try {
      const result = await queryFn(`INFO FOR TABLE ${tableName}`)
      const raw = extractFieldsObject(result[0]?.[0] ?? result[0])
      if (raw) {
        const tableMeta = parseTableMeta(raw, tableName)
        if (tableMeta && tableMeta.fields.length > 0) {
          meta.set(tableName, tableMeta)
        }
      }
      // 无权限的表静默跳过
    } catch {
      // 静默跳过
    }
  }

  return meta
}
