/**
 * Table Registry — 已知表列表
 * 从 schema/ 目录自动维护。增删表时修改此文件。
 * 运行时通过 PERMISSIONS 自然过滤：用户只能查到有权限的表。
 */
export const TABLE_REGISTRY: string[] = [
  // 身份与组织
  'user',
  'tenant',
  'store',
  'membership',
  // 产品
  'product',
  'product_variant',
  'product_category',
  'tenant_product_selection',
  // 库存
  'store_inventory',
  'warehouse',
  'inbound',
  'outbound',
  'consignment_location',
  'consignment_stock',
  'consignment_check',
  'restock_request',
  'product_return',
  'purchase_order',
  'purchase_order_item',
  'sop_task',
  'inventory_count',
  // 订单
  'sales_order',
  'order_item',
  // CRM
  'organization',
  'contact',
  'customer',
  'communication_log',
  'sales_campaign',
  'campaign_target',
  'demand',
  // 活动
  'activity',
  'registration',
  // 财务
  'account',
  'transaction',
  'settlement',
  'commission_setting',
  'commission_record',
  // H5
  'h5_user',
  'service_binding',
  'cart',
  'favorite',
  'banner',
  'home_recommendation',
  // 法会
  'dharma_event',
  'event_material',
  // 文档
  'document',
  // Agent
  'agent_message',
]
