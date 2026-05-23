#!/usr/bin/env python3
"""
RFZv45 Mock Data Generator — 按角色/门店分配
产生真实的多租户多门店测试数据并部署到 VPS
"""
import json, subprocess, sys

VPS = "ubuntu@212.64.90.2"
PASS = "sFM@0@LhTY#Oi&"
SDB = "http://127.0.0.1:8000"
AUTH = "root:root"
NS = "huozhi"
DB = "rfzv45"

def sql(query: str) -> list:
    """通过 VPS 执行 SQL 并返回结果"""
    cmd = (
        f'sshpass -p "{PASS}" ssh -o StrictHostKeyChecking=no {VPS} '
        f'"curl -s -X POST {SDB}/sql '
        f'-H \\"Content-Type: text/plain\\" -H \\"Accept: application/json\\" '
        f'-H \\"surreal-ns: {NS}\\" -H \\"surreal-db: {DB}\\" '
        f'-H \\"Authorization: Basic $(echo -n {AUTH} | base64)\\" '
        f'-d \'{query}\' "'
    )
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
    try:
        data = json.loads(r.stdout)
        if isinstance(data, list) and data:
            return data[0].get("result", [])
    except:
        pass
    return []

def sql_exec(queries: list[str]):
    """批量执行 SQL（不期望返回值）"""
    for q in queries:
        sql(q)

print("=== Step 1: 清理旧 membership 和关联数据 ===")
sql_exec([
    "DELETE FROM membership;",
    "DELETE FROM store_inventory;",
    "DELETE FROM inventory_count;",
    "DELETE FROM restock_request;",
    "DELETE FROM sales_order;",
    "DELETE FROM order_item;",
    # 保留 user, tenant, store, product 等基础数据
])

print("=== Step 2: 确保有 3 个租户 ===")
tenants = [
    ("tenant:t1", "书院连锁总部", "连锁总部"),
    ("tenant:t2", "禅意福慧空间", "禅意馆"),
    ("tenant:t3", "自在禅文化", "独立寺院"),
]
for tid, name, ttype in tenants:
    r = sql(f"SELECT id FROM {tid};")
    if not r:
        sql(f"CREATE {tid} SET name = '{name}', tenant_type = '{ttype}', status = 'active';")
        print(f"  创建 {tid}: {name}")
    else:
        # UPSERT
        sql(f"UPDATE {tid} SET name = '{name}', tenant_type = '{ttype}', status = 'active';")
        print(f"  更新 {tid}: {name}")

print("=== Step 3: 确保有门店 ===")
stores = [
    ("store:s1", "书院旗舰店", "tenant:t1", "旗舰店"),
    ("store:s2", "书院校区店", "tenant:t1", "标准店"),
    ("store:s3", "禅意生活馆", "tenant:t2", "标准店"),
    ("store:s4", "自在文创店", "tenant:t3", "标准店"),
]
for sid, sname, tenant_id, stype in stores:
    r = sql(f"SELECT id FROM {sid};")
    if not r:
        sql(f"CREATE {sid} SET name = '{sname}', tenant = {tenant_id}, store_type = '{stype}', status = 'active';")
        print(f"  创建 {sid}: {sname} → {tenant_id}")
    else:
        sql(f"UPDATE {sid} SET name = '{sname}', tenant = {tenant_id}, store_type = '{stype}', status = 'active';")
        print(f"  更新 {sid}: {sname} → {tenant_id}")

print("=== Step 4: 更新用户角色 ===")
users = [
    ("user:admin", "如意管理员", "平台管理员", "tenant:t1"),
    ("user:u002", "张经理", "经理", "tenant:t1"),
    ("user:u003", "李店长", "门店店长", "tenant:t2"),
    ("user:u004", "王店员", "店员", "tenant:t2"),
    ("user:u005", "赵业务", "业务员", "tenant:t1"),
]
for uid, name, role, tenant_id in users:
    # 更新 current_role 和 current_tenant
    r = sql(f"SELECT id, name, current_role FROM {uid};")
    if r:
        sql(f"UPDATE {uid} SET current_role = '{role}', current_tenant = {tenant_id};")
        print(f"  更新 {uid} ({name}): role={role}, tenant={tenant_id}")

print("=== Step 5: 创建 membership ===")
memberships = [
    # 经理 — 总部（无门店绑定）
    ("user:u002", "tenant:t1", "经理", "NONE"),
    # 李店长 — 禅意生活馆
    ("user:u003", "tenant:t2", "门店店长", "store:s3"),
    # 王店员 — 禅意生活馆
    ("user:u004", "tenant:t2", "店员", "store:s3"),
    # 赵业务 — 总部
    ("user:u005", "tenant:t1", "业务员", "NONE"),
]
for uid, tenant_id, role, store_id in memberships:
    store_clause = f"store = {store_id}," if store_id != "NONE" else ""
    sql(f"""
        CREATE membership SET
            in = {uid},
            out = {tenant_id},
            role = '{role}',
            {store_clause}
            status = 'active',
            can_operate = true;
    """)
    print(f"  创建 membership: {uid} → {tenant_id} role={role} store={store_id}")

print("=== Step 6: 确保有产品 SKU ===")
# 如果 product 不存在则创建
variants = [
    ("product_variant:p001a", "product:p001", "艾草线香30支", 30, 45),
    ("product_variant:p002a", "product:p002", "药师手串8mm", 98, 128),
    ("product_variant:p003a", "product:p003", "禅修蒲团", 80, 120),
    ("product_variant:p004a", "product:p004", "心经抄经本", 15, 25),
]
# 确保 product 存在
for vid, pid, name, price, retail in variants:
    r = sql(f"SELECT id FROM {pid};")
    if not r:
        sql(f"CREATE {pid} SET name = '{name}', is_platform_catalog = true, status = 'active';")
    r = sql(f"SELECT id FROM {vid};")
    if not r:
        sql(f"CREATE {vid} SET spu = {pid}, name = '{name}', unit_price = {price}, retail_price = {retail}, status = 'active';")

print("=== Step 7: 创建门店库存 ===")
inv_data = [
    # store:s1 书院旗舰店
    ("store:s1", "product_variant:p001a", "owned", 50),
    ("store:s1", "product_variant:p002a", "consigned", 20),
    ("store:s1", "product_variant:p003a", "owned", 15),
    # store:s2 书院校区店
    ("store:s2", "product_variant:p001a", "owned", 30),
    ("store:s2", "product_variant:p004a", "self_built", 10),
    # store:s3 禅意生活馆
    ("store:s3", "product_variant:p001a", "owned", 40),
    ("store:s3", "product_variant:p002a", "owned", 8),
    ("store:s3", "product_variant:p003a", "consigned", 12),
    # store:s4 自在文创店
    ("store:s4", "product_variant:p001a", "owned", 25),
    ("store:s4", "product_variant:p004a", "owned", 60),
]
for sid, vid, itype, qty in inv_data:
    # UPSERT: 唯一索引 store+variant+inv_type
    r = sql(f"SELECT id FROM store_inventory WHERE store = {sid} AND variant = {vid} AND inv_type = '{itype}';")
    if not r:
        sql(f"""
            CREATE store_inventory SET
                store = {sid},
                variant = {vid},
                inv_type = '{itype}',
                quantity = {qty};
        """)
        print(f"  {sid} + {vid} ({itype}): {qty}")

print("=== Step 8: 创建盘点记录 ===")
counts = [
    ("store:s1", "product_variant:p001a", 50, 48, "owned"),  # 差2
    ("store:s1", "product_variant:p002a", 20, 20, "consigned"),  # 一致
    ("store:s3", "product_variant:p001a", 40, 37, "owned"),  # 差3
    ("store:s3", "product_variant:p003a", 12, 12, "consigned"),  # 一致
]
for sid, vid, expected, actual, itype in counts:
    sql(f"""
        CREATE inventory_count SET
            store = {sid},
            variant = {vid},
            expected_qty = {expected},
            actual_qty = {actual},
            diff = {actual - expected},
            inv_type = '{itype}',
            operator = user:u003;
    """)
    print(f"  盘点 {sid} + {vid}: expected={expected} actual={actual} diff={actual-expected}")

print("=== Step 9: 创建销售订单 ===")
orders = [
    ("tenant:t1", "store:s1", "书院旗舰店", "user:u004", "直销", 300),
    ("tenant:t2", "store:s3", "禅意生活馆", "user:u003", "流通处供货", 500),
    ("tenant:t1", "store:s1", "书院旗舰店", "user:u005", "分销", 200),
]
for tid, sid, sname, op, otype, amount in orders:
    sql(f"""
        CREATE sales_order SET
            tenant = {tid},
            store = {sid},
            operator = {op},
            order_type = '{otype}',
            total_amount = {amount},
            status = '已完成';
    """)
    print(f"  订单 {tid}/{sid}: {otype} ¥{amount} by {op}")

print("\n=== ✅ Mock 数据生成完毕 ===")
print("""
角色-数据对照表：
  如意管理员 → 平台管理员 → 看全部
  张经理     → 经理         → 看全部
  李店长     → 门店店长     → 只看 store:s3 禅意生活馆
  王店员     → 店员         → 只看 store:s3 禅意生活馆
  赵业务     → 业务员       → 看租户内

stie:s1/s2 → tenant:t1 书院
store:s3   → tenant:t2 禅意
store:s4   → tenant:t3 自在
""")
