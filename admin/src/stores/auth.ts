     1|import { ref, computed } from 'vue'
     2|import { defineStore } from 'pinia'
     3|import { tenantConfig } from '@/lib/tenant-config'
     4|
     5|interface Membership {
     6|  role: string
     7|  name: string
     8|  tenant_id: string
     9|}
    10|
    11|function sdbRestEndpoint(): string {
    12|  const ep = tenantConfig.sdbEndpoint
    13|  if (ep.startsWith('/')) {
    14|    return `${window.location.protocol}//${window.location.host}${ep}`
    15|  }
    16|  return ep.replace(/^ws/, 'http')
    17|}
    18|
    19|async function restQuery(sql: string, token?: string): Promise<any> {
    20|  const config = tenantConfig
    21|  const headers: Record<string, string> = {
    22|    'Content-Type': 'application/json',
    23|    'Accept': 'application/json',
    24|    'Surreal-NS': config.sdbNamespace,
    25|    'Surreal-DB': config.sdbDatabase,
    26|  }
    27|  if (token) {
    28|    headers['Authorization'] = `Bearer ${token}`
    29|  }
    30|  const resp = await fetch(`${sdbRestEndpoint()}/sql`, {
    31|    method: 'POST',
    32|    headers,
    33|    body: sql,
    34|  })
    35|  if (!resp.ok) throw new Error(`Query failed: ${resp.status}`)
    36|  return resp.json()
    37|}
    38|
    39|export { sdbRestEndpoint, restQuery }
    40|
    41|const STORAGE_KEY = 'rfzv4-auth'
    42|
    43|function saveToStorage(user: any, token: string | null, memberships: Membership[], currentTenantId: string | null) {
    44|  try {
    45|    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token, memberships, currentTenantId }))
    46|  } catch {}
    47|}
    48|
    49|function loadFromStorage() {
    50|  try {
    51|    const raw = sessionStorage.getItem(STORAGE_KEY)
    52|    if (raw) return JSON.parse(raw)
    53|  } catch {}
    54|  return null
    55|}
    56|
    57|function clearStorage() {
    58|  try { sessionStorage.removeItem(STORAGE_KEY) } catch {}
    59|}
    60|
    61|export const useAuthStore = defineStore('auth', () => {
    62|  // Restore from sessionStorage on init
    63|  const saved = loadFromStorage()
    64|
    65|  const user = ref<any>(saved?.user ?? null)
    66|  const memberships = ref<Membership[]>(saved?.memberships ?? [])
    67|  const token = ref<string | null>(saved?.token ?? null)
    68|  const currentTenantId = ref<string | null>(saved?.currentTenantId ?? null)
    69|  const loading = ref(false)
    70|  const isPlatform = ref(false)
    71|
    72|  async function login(username: string, password: string) {
    73|    const config = tenantConfig
    74|    isPlatform.value = config.isPlatform
    75|    loading.value = true
    76|    try {
    77|      // REST signin
    78|      const resp = await fetch(`${sdbRestEndpoint()}/signin`, {
    79|        method: 'POST',
    80|        headers: {
    81|          'Content-Type': 'application/json',
    82|          'Surreal-NS': config.sdbNamespace,
    83|          'Surreal-DB': config.sdbDatabase,
    84|        },
    85|        body: JSON.stringify({
    86|          ns: config.sdbNamespace,
    87|          db: config.sdbDatabase,
    88|          ac: 'agent_session',
    89|          user: username,
    90|          pass: password,
    91|        }),
    92|      })
    93|      if (!resp.ok) {
    94|        const err = await resp.json().catch(() => ({}))
    95|        throw new Error(err.details || '登录失败')
    96|      }
    97|      const { token: authToken } = await resp.json()
    98|
    99|      // Save token for subsequent REST queries
   100|      token.value = authToken
   101|
   102|      // Decode JWT for user ID
   103|      const payload = JSON.parse(atob(authToken.split('.')[1]))
   104|      const userId = payload.ID || payload.id || ''
   105|      user.value = { id: userId, username, ns: payload.NS, db: payload.DB }
   106|
   107|      // Query user's current role and tenant directly
   108|      if (userId) {
   109|        const result = await restQuery(
   110|          `SELECT current_role, current_tenant FROM ${userId}`,
   111|          authToken
   112|        )
   113|        const data = result[0]?.result?.[0]
   114|        if (data?.current_role) {
   115|          memberships.value = [{
   116|            role: data.current_role,
   117|            name: '',
   118|            tenant_id: data.current_tenant ?? '',
   119|          }]
   120|        }
   121|      }
   122|
   123|      if (config.tenantId && !config.isPlatform) {
   124|        const hasAccess = memberships.value.some(
   125|          (m: Membership) => m.tenant_id === config.tenantId
   126|        )
   127|        if (!hasAccess) throw new Error('无权限访问此机构')
   128|        currentTenantId.value = config.tenantId
   129|      } else if (!currentTenantId.value && memberships.value.length > 0) {
   130|        currentTenantId.value = memberships.value[0].tenant_id
   131|      } else if (config.tenantId) {
   132|        currentTenantId.value = config.tenantId
   133|      }
   134|
   135|      // Persist to sessionStorage
   136|      saveToStorage(user.value, authToken, memberships.value, currentTenantId.value)
   137|    } finally {
   138|      loading.value = false
   139|    }
   140|  }
   141|
   142|  async function logout() {
   143|    user.value = null
   144|    token.value = null
   145|    memberships.value = []
   146|    currentTenantId.value = null
   147|    clearStorage()
   148|  }
   149|
   150|  async function switchTenant(tenantId: string) {
   151|    if (!memberships.value.some((m) => m.tenant_id === tenantId)) {
   152|      throw new Error('无权限切换到此租户')
   153|    }
   154|    currentTenantId.value = tenantId
   155|    saveToStorage(user.value, token.value, memberships.value, currentTenantId.value)
   156|  }
   157|
   158|  const currentRole = computed(() => {
   159|    const m = memberships.value.find((m) => m.tenant_id === currentTenantId.value)
   160|    return m?.role ?? null
   161|  })
   162|
   163|  const showTenantSwitcher = computed(() => isPlatform.value && memberships.value.length > 1)
   164|
   165|  const isAuthenticated = computed(() => !!user.value)
   166|
   167|  return {
   168|    user, memberships, token, currentTenantId, currentRole,
   169|    showTenantSwitcher, isAuthenticated, loading,
   170|    login, logout, switchTenant,
   171|  }
   172|})
   173|