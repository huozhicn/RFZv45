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
  label: string
  group: string
}

export interface MenuGroup {
  key: string
  label: string
  tables: { key: string; label: string }[]
}

export const menuGroups: MenuGroup[] = menuConfig.groups

// ── Field visibility & ordering ─────────────────────────────────────

/** Fields never shown in table columns */
const HIDDEN_FIELDS = new Set([
  'id',
  'password_hash',
  'content_embedding',
])

/** Fields always pushed to the end of columns */
const LATE_FIELDS = new Set([
  'created_at',
  'updated_at',
  'created_by',
])

export interface VisibleResult {
  fields: FieldMeta[]
  fetchClause: string   // e.g. "FETCH store, warehouse, operator" or ""
}

/**
 * Filter and sort table fields for display.
 * - Hides system/internal fields
 * - Pushes created_at/updated_at/created_by to the end
 * - Keeps .surql DEFINE FIELD order for everything else
 * - Builds FETCH clause for all visible record<> fields
 */
export function visibleFields(meta: TableMeta): VisibleResult {
  const visible = meta.fields
    .filter(f => !f.name.startsWith('_') && !HIDDEN_FIELDS.has(f.name))

  // Stable sort: move late fields to end, keep original order within groups
  const early: FieldMeta[] = []
  const late: FieldMeta[] = []
  for (const f of visible) {
    if (LATE_FIELDS.has(f.name)) late.push(f)
    else early.push(f)
  }

  // FETCH all visible record fields (so renderCell shows names, not IDs)
  const fetchTargets = early.concat(late)
    .filter(f => f.isRecord && f.recordTarget)
    .map(f => f.name)

  const fetchClause = fetchTargets.length > 0
    ? `FETCH ${fetchTargets.join(', ')}`
    : ''

  return { fields: early.concat(late), fetchClause }
}

const labelMap = new Map<string, { label: string; group: string }>()
for (const g of menuGroups) {
  for (const t of g.tables) {
    labelMap.set(t.key, { label: t.label, group: g.key })
  }
}

/**
 * Chinese label for a field name.
 * Falls back: explicit mapping → field.comment → field.name
 */
export function fieldLabel(field: FieldMeta): string {
  if (FIELD_ZH[field.name]) return FIELD_ZH[field.name]
  if (field.comment) return field.comment
  return field.name
}

// ── Field name → Chinese label ──────────────────────────────────────
const FIELD_ZH: Record<string, string> = {
  id: 'ID',
  name: '名称',
  title: '标题',
  description: '描述',
  notes: '备注',
  status: '状态',
  created_at: '创建时间',
  updated_at: '更新时间',
  joined_at: '加入时间',
  left_at: '离开时间',
  created_by: '创建人',
  assigned_to: '指派给',
  operator: '操作人',
  uploaded_by: '上传人',
  sort_order: '排序',
  is_active: '启用',
  is_reversed: '已冲正',
  phone: '电话',
  wechat: '微信',
  address: '地址',
  avatar: '头像',
  avatar_url: '头像URL',
  email: '邮箱',
  sku: 'SKU编码',
  unit: '单位',
  price: '价格',
  cost_price: '成本价',
  custom_price: '自定义价格',
  stock: '库存',
  quantity: '数量',
  amount: '金额',
  total_amount: '总金额',
  unit_price: '单价',
  channels: '销售渠道',
  categories: '类目',
  suppliers: '供应商',
  documents: '附件',
  spec_name: '规格',
  spu: '所属SPU',
  product_name: '产品名称',
  product_price: '产品价格',
  product_image: '产品图片',
  product_intro: '产品介绍',
  main_image_url: '主图',
  detail_image_urls: '详情图',
  content_embedding: '内容向量',
  is_platform_catalog: '平台目录',
  owner_tenant: '所属租户',
  variant: 'SKU',
  slug: '标识',
  category: '类目',
  doc_category: '文档分类',
  store: '门店',
  tenant: '租户',
  user: '用户',
  user_type: '用户类型',
  tenant_type: '租户类型',
  store_type: '门店类型',
  org_type: '组织类型',
  wechat_openid: '微信OpenID',
  wechat_merchant_id: '商户号',
  logo_url: 'Logo',
  primary_color: '主题色',
  domain_prefix: '域名前缀',
  cover_image: '封面图',
  opening_hours: '营业时间',
  location: '位置',
  warehouse: '仓库',
  target_warehouse: '目标仓库',
  target_store: '目标门店',
  supplier: '供应商',
  inv_type: '库存类型',
  inbound_no: '入库单号',
  outbound_no: '出库单号',
  inbound_type: '入库类型',
  outbound_type: '出库类型',
  purchase_type: '采购类型',
  expected_qty: '预期数量',
  actual_qty: '实际数量',
  diff: '差异',
  received_qty: '已收数量',
  last_check_date: '上次盘点',
  check_date: '盘点日期',
  sold_quantity: '已售数量',
  return_quantity: '退货数量',
  prev_stock: '盘点前库存',
  actual_stock: '实盘库存',
  reason: '原因',
  location_type: '寄售点类型',
  order: '订单',
  so_no: '订单号',
  po_no: '采购单号',
  order_type: '订单类型',
  linked_order: '关联订单',
  linked_inbound: '关联入库',
  linked_outbound: '关联出库',
  linked_purchase_order: '关联采购单',
  converted_order: '转化订单',
  payment_method: '支付方式',
  shipping_method: '物流方式',
  tracking_number: '运单号',
  shipped_by: '发货方',
  shipped_at: '发货时间',
  shipping_address: '收货地址',
  refund_amount: '退款金额',
  expected_date: '预计到货',
  customer: '客户',
  contact: '联系人',
  customer_type: '客户类型',
  contact_info: '联系方式',
  communication_date: '沟通日期',
  method: '方式',
  purpose: '目的',
  summary: '摘要',
  follow_up: '跟进计划',
  source: '来源',
  source_detail: '来源详情',
  level: '等级',
  referred_by: '推荐人',
  organizations: '关联组织',
  linked_organization: '关联机构',
  linked_campaign: '关联战役',
  linked_demand: '关联需求',
  linked_commission: '关联佣金',
  linked_products: '关联产品',
  demand_type: '需求类型',
  priority: '优先级',
  quoted_amount: '报价金额',
  campaign_no: '战役编号',
  target_mode: '推送模式',
  target_store_types: '目标店型',
  target_stores: '目标门店',
  start_date: '开始日期',
  end_date: '结束日期',
  feedback: '反馈',
  contacted_at: '联系时间',
  activity_price: '活动价',
  event_no: '法会编号',
  event_type: '法会类型',
  event_date: '法会日期',
  temple: '寺院',
  start_time: '开始时间',
  end_time: '结束时间',
  max_participants: '上限人数',
  registration_deadline: '报名截止',
  checked_in_at: '签到时间',
  image_url: '图片URL',
  link_type: '链接类型',
  link_value: '链接值',
  rec_type: '推荐类型',
  target_id: '目标ID',
  service_person: '服务人员',
  self_ratio: '自留比例',
  donate_ratio: '捐赠比例',
  donate_target: '捐赠对象',
  donate_amount: '捐赠金额',
  self_amount: '自留金额',
  total_commission: '佣金总额',
  settled_at: '结算时间',
  settlement_no: '结算单号',
  period_start: '账期开始',
  period_end: '账期结束',
  total_purchase_amount: '采购总额',
  total_payment_received: '收款总额',
  balance: '余额',
  account: '账户',
  account_type: '账户类型',
  tx_no: '流水号',
  tx_type: '交易类型',
  tx_date: '交易日期',
  return_no: '退货单号',
  return_type: '退货类型',
  task_type: '任务类型',
  schedule_type: '排程类型',
  recurrence_rule: '重复规则',
  scope: '范围',
  objective: '目标',
  deadline: '截止时间',
  result: '结果',
  file_url: '文件URL',
  file_type: '文件类型',
  file_size: '文件大小',
  password_hash: '密码哈希',
  current_role: '当前角色',
  current_tenant: '当前租户',
  platform: '平台',
  platform_id: '平台ID',
  display_name: '显示名称',
  role: '角色',
  can_operate: '可操作',
  addresses: '地址簿',
  h5_user: 'C端用户',
  orders: '关联订单',
  task: '盘点任务',
  in: '成员',
  out: '组织',
  _r: '校验',
  _check: '校验',
}

export function extractEnumValues(assert: string | null): string[] {
  if (!assert) return []
  const match = assert.match(/'([^']+)'/g)
  return (match || []).map(v => v.slice(1, -1))
}

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
