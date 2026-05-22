import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { tenantConfig } from '@/lib/tenant-config'

interface Membership {
  role: string
  name: string
  tenant_id: string
}

function sdbRestEndpoint(): string {
  const ep = tenantConfig.sdbEndpoint
  if (ep.startsWith('/')) {
    return `${window.location.protocol}//${window.location.host}${ep}`
  }
  return ep.replace(/^ws/, 'http')
}

async function restQuery(sql: string, token?: string): Promise<any> {
  const config = tenantConfig
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Surreal-NS': config.sdbNamespace,
    'Surreal-DB': config.sdbDatabase,
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const resp = await fetch(`${sdbRestEndpoint()}/sql`, {
    method: 'POST',
    headers,
    body: sql,
  })
  if (!resp.ok) throw new Error(`Query failed: ${resp.status}`)
  return resp.json()
}

export { sdbRestEndpoint, restQuery }

const STORAGE_KEY = 'rfzv4-auth'

function saveToStorage(user: any, token: string | null, memberships: Membership[], currentTenantId: string | null) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token, memberships, currentTenantId }))
  } catch {}
}

function loadFromStorage() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

function clearStorage() {
  try { sessionStorage.removeItem(STORAGE_KEY) } catch {}
}

export const useAuthStore = defineStore('auth', () => {
  // Restore from sessionStorage on init
  const saved = loadFromStorage()

  const user = ref<any>(saved?.user ?? null)
  const memberships = ref<Membership[]>(saved?.memberships ?? [])
  const token = ref<string | null>(saved?.token ?? null)
  const currentTenantId = ref<string | null>(saved?.currentTenantId ?? null)
  const loading = ref(false)
  const isPlatform = ref(false)

  async function login(username: string, password: string) {
    const config = tenantConfig
    isPlatform.value = config.isPlatform
    loading.value = true
    try {
      // REST signin
      const resp = await fetch(`${sdbRestEndpoint()}/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Surreal-NS': config.sdbNamespace,
          'Surreal-DB': config.sdbDatabase,
        },
        body: JSON.stringify({
          ns: config.sdbNamespace,
          db: config.sdbDatabase,
          ac: 'agent_session',
          user: username,
          pass: password,
        }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.details || '登录失败')
      }
      const { token: authToken } = await resp.json()

      // Save token for subsequent REST queries
      token.value = authToken

      // Decode JWT for user ID
      const payload = JSON.parse(atob(authToken.split('.')[1]))
      const userId = payload.ID || payload.id || ''
      user.value = { id: userId, username, ns: payload.NS, db: payload.DB }

      // Query user's current role and tenant directly
      if (userId) {
        const result = await restQuery(
          `SELECT current_role, current_tenant FROM ${userId}`,
          authToken
        )
        const data = result[0]?.result?.[0]
        if (data?.current_role) {
          memberships.value = [{
            role: data.current_role,
            name: '',
            tenant_id: data.current_tenant ?? '',
          }]
        }
      }

      if (config.tenantId && !config.isPlatform) {
        const hasAccess = memberships.value.some(
          (m: Membership) => m.tenant_id === config.tenantId
        )
        if (!hasAccess) throw new Error('无权限访问此机构')
        currentTenantId.value = config.tenantId
      } else if (!currentTenantId.value && memberships.value.length > 0) {
        currentTenantId.value = memberships.value[0].tenant_id
      } else if (config.tenantId) {
        currentTenantId.value = config.tenantId
      }

      // Persist to sessionStorage
      saveToStorage(user.value, authToken, memberships.value, currentTenantId.value)
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    user.value = null
    token.value = null
    memberships.value = []
    currentTenantId.value = null
    clearStorage()
  }

  async function switchTenant(tenantId: string) {
    if (!memberships.value.some((m) => m.tenant_id === tenantId)) {
      throw new Error('无权限切换到此租户')
    }
    currentTenantId.value = tenantId
    saveToStorage(user.value, token.value, memberships.value, currentTenantId.value)
  }

  const currentRole = computed(() => {
    const m = memberships.value.find((m) => m.tenant_id === currentTenantId.value)
    return m?.role ?? null
  })

  const showTenantSwitcher = computed(() => isPlatform.value && memberships.value.length > 1)

  const isAuthenticated = computed(() => !!user.value)

  return {
    user, memberships, token, currentTenantId, currentRole,
    showTenantSwitcher, isAuthenticated, loading,
    login, logout, switchTenant,
  }
})
