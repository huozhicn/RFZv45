/**
 * Schema 元数据加载器 — v2 简化版
 *
 * 不查 INFO FOR TABLE（scope token 无权限），
 * 直接从 TABLE_REGISTRY 生成菜单，
 * 点表后用 SELECT * LIMIT 1 拿字段名当列头。
 */
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

/**
 * 从 ASSERT 字符串提取枚举选项
 */
export function extractEnumValues(assert: string | null): string[] {
  if (!assert) return []
  const values = assert.match(/'([^']+)'/g)
  return (values || []).map(v => v.slice(1, -1))
}

/**
 * 从一行数据的 keys 推断列定义
 */
export function inferFieldsFromRow(row: Record<string, unknown>): FieldMeta[] {
  const fields: FieldMeta[] = []
  for (const [key, val] of Object.entries(row)) {
    if (key.startsWith('_')) continue
    const kind = inferKind(val)
    fields.push({
      name: key,
      kind,
      assert: null,
      default: null,
      isOption: val === null,
      isRecord: typeof val === 'string' && val.includes(':'),
      recordTarget: null,
      comment: key,
    })
  }
  return fields
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

/**
 * 加载所有可访问表的基本信息。
 * 传入 queryFn 用 auth token 查。
 * 对每张表查 SELECT * LIMIT 1 获取字段结构。
 */
export async function loadSchemaMeta(
  queryFn: (sql: string) => Promise<any>
): Promise<Map<string, TableMeta>> {
  const meta = new Map<string, TableMeta>()

  for (const tableName of TABLE_REGISTRY) {
    try {
      const result = await queryFn(`SELECT * FROM ${tableName} LIMIT 1`)
      const rows = result || []
      if (rows.length > 0) {
        meta.set(tableName, {
          name: tableName,
          fields: inferFieldsFromRow(rows[0]),
        })
      } else {
        // 空表也加到菜单（可以新建记录）
        meta.set(tableName, {
          name: tableName,
          fields: [],
        })
      }
    } catch {
      // 无权限或表不存在 → 静默跳过
    }
  }

  return meta
}
