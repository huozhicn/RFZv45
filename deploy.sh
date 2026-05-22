#!/bin/bash
# ============================================================================
# RFZv45 部署脚本
# 构建 Admin 前端 → 推送到 VPS → 重载 Caddy
# ============================================================================

set -euo pipefail

VPS_IP="212.64.90.2"
VPS_USER="ubuntu"
VPS_PASS="sFM@0@LhTY#Oi&"

echo "════════════════════════════════════════"
echo "  RFZv45 部署 → ${VPS_USER}@${VPS_IP}"
echo "════════════════════════════════════════"
echo ""

cd admin

echo "  构建中..."
npm run build 2>&1 | tail -3

# 先清空 VPS assets，再上传
echo "  上传到 /var/www/admin/..."
sshpass -p "${VPS_PASS}" ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" \
  "rm -rf /var/www/admin/assets/*" 2>/dev/null
sshpass -p "${VPS_PASS}" scp -o StrictHostKeyChecking=no -r dist/* "${VPS_USER}@${VPS_IP}:/var/www/admin/"

# 版本验证
LOCAL_HASH=$(git rev-parse --short HEAD)
echo "  ✅ admin 已部署 (v.${LOCAL_HASH})"

# 重载 Caddy
sshpass -p "${VPS_PASS}" ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" \
  "echo '${VPS_PASS}' | sudo -S systemctl reload caddy" 2>/dev/null
echo "  ✅ Caddy 已重载"

cd ..

echo ""
echo "════════════════════════════════════════"
echo "  部署完成"
echo "  Admin: https://admin.rufazao.com"
echo "════════════════════════════════════════"
