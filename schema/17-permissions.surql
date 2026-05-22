-- ★★★ 核心表：Schemafull 表必须显式赋权，否则默认 PERMISSIONS NONE ★★★
-- ★★★ 所有写权限包含 '平台管理员'（admin 角色）★★★
-- user: 用户只能查自己，经理可以查所有
ALTER TABLE user PERMISSIONS
  FOR select WHERE id = $auth OR $auth.current_role IN ['经理', '平台管理员']
  FOR create WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR update WHERE id = $auth OR $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false;

-- membership: 经理全见，普通用户只能看自己
ALTER TABLE membership PERMISSIONS
  FOR select WHERE in = $auth OR $auth.current_role IN ['经理', '平台管理员']
  FOR create WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false;

-- 门店：仅所属连锁机构可见
ALTER TABLE tenant PERMISSIONS
  FOR select WHERE $auth.current_role IN ['经理', '平台管理员'] OR id = $auth.current_tenant
  FOR create WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false
;

-- 产品：平台品全员可见，自建品仅所属租户
ALTER TABLE store PERMISSIONS
  FOR select WHERE $auth.current_role IN ['经理', '平台管理员'] OR tenant = $auth.current_tenant
  FOR create WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员'] OR ($auth.store = id AND $auth.current_role = '门店店长')
  FOR delete WHERE false
;

-- 选品表：租户自己管自己
ALTER TABLE product PERMISSIONS
  FOR select WHERE is_platform_catalog = true OR owner_tenant = $auth.current_tenant OR $auth.current_role IN ['经理', '平台管理员']
  FOR create WHERE $auth.current_role IN ['经理', '门店店长', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员'] OR (owner_tenant = $auth.current_tenant AND $auth.current_role = '门店店长')
  FOR delete WHERE false
;

-- 订单：机构内可见
ALTER TABLE tenant_product_selection PERMISSIONS
  FOR select WHERE tenant = $auth.current_tenant OR $auth.current_role IN ['经理', '平台管理员']
  FOR create WHERE $auth.current_role IN ['经理', '门店店长', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '门店店长', '平台管理员'] AND tenant = $auth.current_tenant
  FOR delete WHERE false
;

-- 活动：租户内可见
ALTER TABLE sales_order PERMISSIONS
  FOR select WHERE $auth.current_role IN ['经理', '平台管理员'] OR tenant = $auth.current_tenant
  FOR create WHERE $auth.current_role IN ['经理', '业务员', '门店店长', '店员', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员'] OR (tenant = $auth.current_tenant AND $auth.current_role IN ['门店店长', '店员'])
  FOR delete WHERE false
;

-- 门店库存：仅本门店
ALTER TABLE activity PERMISSIONS
  FOR select WHERE $auth.current_role IN ['经理', '平台管理员'] OR tenant = $auth.current_tenant
  FOR create WHERE $auth.current_role IN ['经理', '门店店长', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '门店店长', '平台管理员'] AND tenant = $auth.current_tenant
  FOR delete WHERE false
;

-- 补货申请：本门店提 + 经理审
ALTER TABLE store_inventory PERMISSIONS
  FOR select WHERE store = $auth.store OR $auth.current_role IN ['经理', '平台管理员']
  FOR update WHERE store = $auth.store OR $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false
;

-- 退换货：本机构
ALTER TABLE restock_request PERMISSIONS
  FOR select WHERE store = $auth.store OR $auth.current_role IN ['经理', '平台管理员']
  FOR create WHERE $auth.current_role IN ['经理', '门店店长', '店员', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false
;

-- 通用 SOP 任务：机构内可见
ALTER TABLE product_return PERMISSIONS
  FOR select WHERE tenant = $auth.current_tenant OR $auth.current_role IN ['经理', '平台管理员']
  FOR create WHERE $auth.current_role IN ['经理', '门店店长', '店员', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员'] OR (tenant = $auth.current_tenant AND $auth.current_role = '门店店长')
  FOR delete WHERE false
;

-- CRM：仅平台方
ALTER TABLE sop_task PERMISSIONS
  FOR select WHERE tenant = $auth.current_tenant OR $auth.current_role IN ['经理', '平台管理员']
  FOR create WHERE $auth.current_role IN ['经理', '门店店长', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '门店店长', '平台管理员'] AND tenant = $auth.current_tenant
  FOR delete WHERE false
;

-- 以下为补全权限（所有表必须有 PERMISSIONS）
-- 基础数据
ALTER TABLE customer PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR $auth.current_role = '平台管理员'
  FOR create WHERE $auth.current_role IN ['经理', '业务员', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '业务员', '平台管理员']
  FOR delete WHERE false
;

ALTER TABLE product_category PERMISSIONS
  FOR select WHERE true
  FOR create WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false
;

-- 仓储：仅平台
ALTER TABLE code_counter PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR $auth.current_role = '平台管理员'
  FOR create WHERE $auth.user_type = '平台' OR $auth.current_role = '平台管理员'
  FOR update WHERE $auth.user_type = '平台' OR $auth.current_role = '平台管理员'
  FOR delete WHERE false
;

ALTER TABLE warehouse PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR $auth.current_role = '平台管理员'
  FOR create WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false
;

ALTER TABLE inbound PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR $auth.current_role = '平台管理员'
  FOR create WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false
;

-- 寄售：平台 + 关联机构
ALTER TABLE outbound PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR $auth.current_role = '平台管理员'
  FOR create WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false
;

ALTER TABLE consignment_location PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR tenant = $auth.current_tenant OR $auth.current_role = '平台管理员'
  FOR create WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false
;

ALTER TABLE consignment_stock PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR location.tenant = $auth.current_tenant OR $auth.current_role = '平台管理员'
  FOR update WHERE $auth.user_type = '平台' OR $auth.current_role = '平台管理员'
  FOR delete WHERE false
;

-- 盘点明细：关联 SOP 的门店
ALTER TABLE consignment_check PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR location.tenant = $auth.current_tenant OR $auth.current_role = '平台管理员'
  FOR create WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false
;

-- 采购：仅平台
ALTER TABLE inventory_count PERMISSIONS
  FOR select WHERE store = $auth.store OR $auth.current_role IN ['经理', '平台管理员']
  FOR create WHERE $auth.current_role IN ['经理', '门店店长', '店员', '平台管理员']
  FOR update WHERE store = $auth.store OR $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false
;

ALTER TABLE purchase_order PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR $auth.current_role = '平台管理员'
  FOR create WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false
;

-- 财务：平台可见
ALTER TABLE purchase_order_item PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR $auth.current_role = '平台管理员'
  FOR create WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false
;

-- 对账单：平台 + 对应机构
ALTER TABLE transaction PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR $auth.current_role = '平台管理员'
  FOR create WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false
;

-- 佣金：平台 + 本人
ALTER TABLE settlement PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR tenant = $auth.current_tenant OR $auth.current_role = '平台管理员'
  FOR create WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false
;

ALTER TABLE commission_setting PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR service_person = $auth.id OR $auth.current_role = '平台管理员'
  FOR create WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员'] OR service_person = $auth.id
  FOR delete WHERE false
;

-- H5用户：用户本人可见（H5 端用独立 scope，此处为管理后台视图）
ALTER TABLE commission_record PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR service_person = $auth.id OR $auth.current_role = '平台管理员'
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false
;

ALTER TABLE h5_user PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR tenant = $auth.current_tenant OR $auth.current_role = '平台管理员'
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false
;

ALTER TABLE service_binding PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR tenant = $auth.current_tenant OR $auth.current_role = '平台管理员'
  FOR create WHERE $auth.current_role IN ['经理', '业务员', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false
;

ALTER TABLE cart PERMISSIONS
  FOR select WHERE true
  FOR update WHERE true
  FOR delete WHERE true
;

-- H5 内容：公开读，机构可改自己
ALTER TABLE favorite PERMISSIONS
  FOR select WHERE true
  FOR update WHERE true
  FOR delete WHERE true
;

ALTER TABLE banner PERMISSIONS
  FOR select WHERE true
  FOR create WHERE $auth.current_role IN ['经理', '门店店长', '平台管理员'] AND tenant = $auth.current_tenant
  FOR update WHERE $auth.current_role IN ['经理', '门店店长', '平台管理员'] AND tenant = $auth.current_tenant
  FOR delete WHERE false
;

-- 法会：仅平台
ALTER TABLE home_recommendation PERMISSIONS
  FOR select WHERE true
  FOR create WHERE $auth.current_role IN ['经理', '门店店长', '平台管理员'] AND tenant = $auth.current_tenant
  FOR update WHERE $auth.current_role IN ['经理', '门店店长', '平台管理员'] AND tenant = $auth.current_tenant
  FOR delete WHERE false
;

ALTER TABLE dharma_event PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR $auth.current_role = '平台管理员'
  FOR create WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false
;

-- 文档：上传者 + 平台
ALTER TABLE event_material PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR $auth.current_role = '平台管理员'
  FOR create WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false
;

ALTER TABLE document PERMISSIONS
  FOR select WHERE uploaded_by = $auth.id OR $auth.user_type = '平台' OR $auth.current_role = '平台管理员'
  FOR create WHERE true
  FOR update WHERE uploaded_by = $auth.id OR $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false
;

ALTER TABLE organization PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR $auth.current_role = '平台管理员'
  FOR create WHERE $auth.current_role IN ['经理', '业务员', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '业务员', '平台管理员']
  FOR delete WHERE false
;

ALTER TABLE contact PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR $auth.current_role = '平台管理员'
  FOR create WHERE $auth.current_role IN ['经理', '业务员', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '业务员', '平台管理员']
  FOR delete WHERE false
;

ALTER TABLE communication_log PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR $auth.current_role = '平台管理员'
  FOR create WHERE $auth.current_role IN ['经理', '业务员', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '业务员', '平台管理员']
  FOR delete WHERE false
;

ALTER TABLE sales_campaign PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR $auth.current_role = '平台管理员'
  FOR create WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false
;

ALTER TABLE campaign_target PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR $auth.current_role = '平台管理员'
  FOR create WHERE $auth.current_role IN ['经理', '业务员', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '业务员', '平台管理员']
  FOR delete WHERE false
;

-- 报名：机构内可见
ALTER TABLE demand PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR $auth.current_role = '平台管理员'
  FOR create WHERE $auth.current_role IN ['经理', '业务员', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '业务员', '平台管理员']
  FOR delete WHERE false
;

-- 订单明细：继承订单权限（SDB 图遍历自动鉴权）
ALTER TABLE registration PERMISSIONS
  FOR select WHERE activity.tenant = $auth.current_tenant OR $auth.current_role IN ['经理', '平台管理员']
  FOR create WHERE true
  FOR update WHERE $auth.current_role IN ['经理', '门店店长', '平台管理员'] AND activity.tenant = $auth.current_tenant
  FOR delete WHERE false
;

ALTER TABLE order_item PERMISSIONS
  FOR select WHERE order.tenant = $auth.current_tenant OR $auth.current_role IN ['经理', '平台管理员']
  FOR create WHERE $auth.current_role IN ['经理', '业务员', '门店店长', '店员', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false
;

-- ★★★ 以下为之前缺失的表（2026-05-22 补全）★★★

-- 商品规格：平台商品目录全员可读，写权限仅经理+平台管理员
ALTER TABLE product_variant PERMISSIONS
  FOR select WHERE true
  FOR create WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false
;

-- 财务核算科目：仅平台
ALTER TABLE account PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR $auth.current_role = '平台管理员'
  FOR create WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false
;

-- 身份认证：仅平台
ALTER TABLE identity PERMISSIONS
  FOR select WHERE $auth.user_type = '平台' OR $auth.current_role = '平台管理员'
  FOR create WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR update WHERE $auth.current_role IN ['经理', '平台管理员']
  FOR delete WHERE false
;
