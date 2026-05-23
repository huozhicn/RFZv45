/**
 * Extract menu configuration from .surql schema files.
 * 
 * Scans schema/ directory for table definitions annotated with:
 *   -- @label 中文名
 *   -- @group group_key
 * 
 * Output: src/lib/menu-config.json
 * 
 * Run: npx tsx scripts/extract-menu.ts
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA_DIR = resolve(__dirname, '../../schema')
const OUTPUT = resolve(__dirname, '../src/lib/menu-config.json')

const GROUP_ORDER = ['org', 'product', 'inventory', 'crm', 'order', 'marketing', 'finance', 'service']

const GROUP_NAMES: Record<string, string> = {
  org: '组织架构',
  product: '商品管理',
  inventory: '库存物流',
  crm: '客户管理',
  order: '交易订单',
  marketing: '活动运营',
  finance: '分润结算',
  service: '售后服务',
}

interface TableEntry {
  key: string
  label: string
  group: string
}

interface MenuConfig {
  groups: {
    key: string
    label: string
    tables: { key: string; label: string }[]
  }[]
}

function extract(): MenuConfig {
  const tables = new Map<string, TableEntry>()

  // Parse all .surql files
  const files = readdirSync(SCHEMA_DIR)
    .filter(f => f.endsWith('.surql'))
    .sort()

  for (const file of files) {
    const content = readFileSync(join(SCHEMA_DIR, file), 'utf-8')
    const lines = content.split('\n')

    let pendingLabel = ''
    let pendingGroup = ''

    for (const line of lines) {
      // Track annotations
      const labelMatch = line.match(/^--\s*@label\s+(.+)/)
      const groupMatch = line.match(/^--\s*@group\s+(\w+)/)

      if (labelMatch) {
        pendingLabel = labelMatch[1].trim()
        continue
      }
      if (groupMatch) {
        pendingGroup = groupMatch[1].trim()
        continue
      }

      // Match table definition
      const tableMatch = line.match(/^DEFINE TABLE\s+(\w+)/)
      if (tableMatch) {
        const tableName = tableMatch[1]
        // Skip system/internal tables
        if (tableName.startsWith('_') || tableName === 'agent_message' || tableName === 'identity') {
          pendingLabel = ''
          pendingGroup = ''
          continue
        }

        if (pendingLabel && pendingGroup) {
          tables.set(tableName, {
            key: tableName,
            label: pendingLabel,
            group: pendingGroup,
          })
        } else {
          console.warn(`[extract-menu] ⚠ No @label/@group for table: ${tableName} in ${file}`)
        }

        // Reset for next table
        pendingLabel = ''
        pendingGroup = ''
      }
    }
  }

  // Build grouped output, maintaining GROUP_ORDER
  const groupMap = new Map<string, { key: string; label: string }[]>()
  for (const [_, entry] of tables) {
    if (!groupMap.has(entry.group)) {
      groupMap.set(entry.group, [])
    }
    groupMap.get(entry.group)!.push({ key: entry.key, label: entry.label })
  }

  const groups = GROUP_ORDER
    .filter(g => groupMap.has(g))
    .map(g => ({
      key: g,
      label: GROUP_NAMES[g] || g,
      tables: groupMap.get(g)!,
    }))

  // Append any groups not in GROUP_ORDER
  for (const [g, tbls] of groupMap) {
    if (!GROUP_ORDER.includes(g)) {
      groups.push({
        key: g,
        label: GROUP_NAMES[g] || g,
        tables: tbls,
      })
    }
  }

  console.log(`[extract-menu] Found ${tables.size} tables in ${groups.length} groups`)
  for (const g of groups) {
    console.log(`  ${g.label} (${g.key}): ${g.tables.length} tables`)
  }

  return { groups }
}

const config = extract()
writeFileSync(OUTPUT, JSON.stringify(config, null, 2) + '\n')
console.log(`[extract-menu] Written to ${OUTPUT}`)
