#!/bin/bash
# ============================================================================
# RFZv45 Schema Import Script for SurrealDB 3.0.5
# ============================================================================
#
# 目标: 将 RFZv4 全部 schema 导入到远程 VPS 的 SurrealDB 实例
# 命名空间: huozhi
# 数据库:   rfzv45
#
# ============================================================================
# 为什么写得这么啰嗦？
# ============================================================================
#
# 踩过的坑:
#   1. cat *.surql | surreal sql → 不支持 $value 参数，报 Parse error
#   2. surreal import --endpoint ws://  → WS 协议不支持 import
#   3. surreal import --endpoint http:// → 只支持 DEFINE TABLE/FIELD/INDEX 语句，
#      DEFINE FUNCTION / DEFINE EVENT / ALTER TABLE / DEFINE ACCESS 必须走 REST API
#   4. REST API header 必须用小写: surreal-ns / surreal-db (不是 Surreal-NS)
#   5. schema 文件里的 \ 续行符是 2.x 语法，3.0.5 不支持，sed 去掉
#
# 正确流程:
#   Phase A: surreal import (HTTP)  → DEFINE TABLE, FIELD, INDEX
#   Phase B: REST API /sql endpoint → DEFINE FUNCTION, EVENT, ACCESS, ALTER TABLE
#
# ============================================================================

set -euo pipefail

# ── 配置 ──────────────────────────────────────────────────────────
VPS_IP="212.64.90.2"
VPS_USER="ubuntu"
VPS_PASS="sFM@0@LhTY#Oi&"
SDB_ENDPOINT="http://127.0.0.1:8000"
SDB_USER="root"
SDB_PASS="root"
NAMESPACE="huozhi"
DATABASE="rfzv45"
SCHEMA_DIR="/data/sdb/schema"

# ── Phase A: 用 surreal import 导入纯 DEFINE 语句 ─────────────────
# 这些文件只包含 DEFINE TABLE / DEFINE FIELD / DEFINE INDEX
# surreal import 对这类语句最稳定
IMPORT_FILES=(
  "01-identity.surql"
  "02-tenant.surql"
  "03-product.surql"
  "04-product-selection.surql"
  "05-inventory.surql"
  "05b-store-inventory.surql"
  "06-order.surql"
  "07-crm.surql"
  "08-activity.surql"
  "09-finance.surql"
  "10-commission.surql"
  "11-h5-user.surql"
  "12-h5-content.surql"
  "13-dharma-event.surql"
  "14-docs.surql"
  "20-agent.surql"
)

# ── Phase B: 用 REST API 导入非纯 DEFINE 语句 ─────────────────────
# 这些文件包含 DEFINE FUNCTION, DEFINE EVENT, ALTER TABLE, DEFINE ACCESS
# surreal import 不支持这些，必须走 /sql endpoint
#
# 注意: 文件中有 2.x 的 \ 续行符，需要在发送前用 sed 去掉
REST_FILES=(
  "15-functions.surql"
  "16-events.surql"
  "17-permissions.surql"
  "18-access.surql"
)

# ============================================================================
# Phase A: Import DEFINE-only files
# ============================================================================
echo "=== Phase A: Importing DEFINE statements ==="
echo "  目标: ${NAMESPACE}/${DATABASE}"
echo "  方式: surreal import (HTTP)"
echo ""

# 先导入种子文件 (设置 NS/DB 上下文)
sshpass -p "${VPS_PASS}" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "
  /usr/local/bin/surreal import \
    --endpoint ${SDB_ENDPOINT} \
    --username ${SDB_USER} \
    --password ${SDB_PASS} \
    --namespace ${NAMESPACE} \
    --database ${DATABASE} \
    ${SCHEMA_DIR}/00-init.surql
" 2>&1

for f in "${IMPORT_FILES[@]}"; do
  echo "  [import] ${f}..."
  sshpass -p "${VPS_PASS}" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "
    /usr/local/bin/surreal import \
      --endpoint ${SDB_ENDPOINT} \
      --username ${SDB_USER} \
      --password ${SDB_PASS} \
      --namespace ${NAMESPACE} \
      --database ${DATABASE} \
      ${SCHEMA_DIR}/${f}
  " 2>&1 | grep -E "error|ERROR|executed" || true
done

echo ""
echo "=== Phase A 完成 ==="

# ============================================================================
# Phase B: REST API for non-DEFINE statements
# ============================================================================
echo ""
echo "=== Phase B: Importing FUNCTIONS / EVENTS / PERMISSIONS / ACCESS ==="
echo "  方式: REST API /sql endpoint"
echo "  ⚠️  会自动去掉 2.x 续行符 \\"
echo ""

for f in "${REST_FILES[@]}"; do
  echo "  [rest] ${f}..."
  sshpass -p "${VPS_PASS}" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "
    # 去掉 2.x 的 \ 续行符（3.0.5 不支持）
    TMPFILE=\$(mktemp)
    sed 's/\\\\$//g' ${SCHEMA_DIR}/${f} > \$TMPFILE
    curl -s -u ${SDB_USER}:${SDB_PASS} \
      -H 'Content-Type: text/plain' \
      -H 'surreal-ns: ${NAMESPACE}' \
      -H 'surreal-db: ${DATABASE}' \
      '${SDB_ENDPOINT}/sql' \
      --data-binary @\$TMPFILE 2>&1 | python3 -c "
import sys, json
d = json.load(sys.stdin)
errs = [r for r in d if r.get('status') != 'OK']
if errs:
    for e in errs[:5]:
        msg = str(e.get('result', '?'))
        # 'already exists' 不算错（幂等导入）
        if 'already exists' not in msg:
            print('  ⚠️  ' + msg[:120])
else:
    print('  ✅')
" 2>&1
    rm -f \$TMPFILE
  "
done

echo ""
echo "=== 全部完成 ==="
echo "  NS/DB: ${NAMESPACE}/${DATABASE}"
echo "  端点:   ${SDB_ENDPOINT}"
echo ""
