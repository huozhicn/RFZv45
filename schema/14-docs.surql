OPTION IMPORT;
DEFINE TABLE document SCHEMAFULL;
DEFINE FIELD name         ON document TYPE string;                      -- 文件名
DEFINE FIELD file_url     ON document TYPE string;                      -- 文件路径/URL（必填）
DEFINE FIELD file_type    ON document TYPE string DEFAULT 'other'       -- MIME大类
    ASSERT $value IN ['image','pdf','doc','sheet','other'];
DEFINE FIELD file_size    ON document TYPE option<int>;                 -- 字节数
DEFINE FIELD doc_category ON document TYPE string DEFAULT '其他'        -- 业务分类
    ASSERT $value IN ['任务执行','财务凭证','合同','客户档案','活动','产品','文件','其他'];
DEFINE FIELD description  ON document TYPE option<string>;              -- 备注
DEFINE FIELD uploaded_by  ON document TYPE record<user>;                -- ← record link 上传人
DEFINE FIELD created_at   ON document TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_doc_category ON document FIELDS doc_category;

-- ★ 各实体表统一加 documents 数组（graph 反向引用，不建 RELATION）
-- 已加：product.documents / sop_task.documents
-- 以下表加：sales_order / transaction / settlement / customer / activity / dharma_event
--           inbound / outbound / communication_log / inventory_count
