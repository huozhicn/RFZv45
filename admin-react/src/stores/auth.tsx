import React, { createContext, useContext, useState, useCallback } from 'react'
import { sdbSignin, sdbQuery } from '@/lib/sdb'
import tablePermsData from '@/lib/table-perms.json'

interface UserInfo {
  id: string
  username: string
  ns: string
  db: string
}

interface Membership {
  role: string
  name: string
  tenant_id: string
}

export interface TablePerm {
  canSelect: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

interface AuthState {
  user: UserInfo | null
  token: string | null
  memberships: Membership[]
  currentTenantId: string | null
  currentRole: string | null
  isAuthenticated: boolean
  tablePerms: Record<string, TablePerm>
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>
}

const STORAGE_KEY = 'rfzv4-auth'

function saveToStorage(user: UserInfo, token: string, memberships: Membership[], tenantId: string | null) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token, memberships, currentTenantId: tenantId })) } catch {}
}

function clearStorage() {
  try { sessionStorage.removeItem(STORAGE_KEY) } catch {}
}

function loadFromStorage() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

const AuthContext = createContext<AuthState | null>(null)

/** Resolve static permissions against currentRole */
function resolvePerms(currentRole: string | null): Record<string, TablePerm> {
  const perms: Record<string, TablePerm> = {}
  if (!currentRole) return perms

  for (const [tname, tdef] of Object.entries(tablePermsData)) {
    const hasRole = (roles: string[]) => {
      if (roles.length === 0) return false
      if (roles.includes('*')) return true
      if (roles.length === 1 && roles[0] === '平台管理员' && currentRole === '平台管理员') return true
      return roles.includes(currentRole)
    }
    perms[tname] = {
      canSelect: hasRole((tdef as any).sel || []),
      canCreate: hasRole((tdef as any).cre || []),
      canUpdate: hasRole((tdef as any).upd || []),
      canDelete: hasRole((tdef as any).del || []),
    }
  }

  return perms
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const saved = loadFromStorage()
  const [user, setUser] = useState<UserInfo | null>(saved?.user ?? null)
  const [token, setToken] = useState<string | null>(saved?.token ?? null)
  const [memberships, setMemberships] = useState<Membership[]>(saved?.memberships ?? [])
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(saved?.currentTenantId ?? null)
  const [tablePerms, setTablePerms] = useState<Record<string, TablePerm>>({})

  const currentRole = memberships.find(m => m.tenant_id === currentTenantId)?.role ?? null
  const isAuthenticated = !!user

  const login = useCallback(async (username: string, password: string) => {
    const authToken = await sdbSignin(username, password)
    setToken(authToken)

    // Decode JWT for user ID
    const payload = JSON.parse(atob(authToken.split('.')[1]))
    const userId = payload.ID || payload.id || ''
    const userInfo: UserInfo = { id: userId, username, ns: payload.NS, db: payload.DB }
    setUser(userInfo)

    // Query current role and tenant
    if (userId) {
      const rows = await sdbQuery(`SELECT current_role, current_tenant FROM ${userId}`, undefined, authToken)
      const data = rows?.[0]
      const mems: Membership[] = []
      if (data?.current_role) {
        mems.push({ role: data.current_role, name: '', tenant_id: data.current_tenant ?? '' })
      }
      setMemberships(mems)

      const tid = currentTenantId || mems[0]?.tenant_id || null
      setCurrentTenantId(tid)
      saveToStorage(userInfo, authToken, mems, tid)

      // ── Resolve table permissions from static map ──
      const roleToCheck = data?.current_role ?? null
      setTablePerms(resolvePerms(roleToCheck))
    }
  }, [currentTenantId])

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    setMemberships([])
    setCurrentTenantId(null)
    setTablePerms({})
    clearStorage()
  }, [])

  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    if (!user || !token) throw new Error('未登录')
    await sdbQuery(
      `UPDATE ${user.id} SET password_hash = crypto::argon2::generate($newPass)`,
      { newPass: newPassword },
      token
    )
  }, [user, token])

  return (
    <AuthContext.Provider value={{ user, token, memberships, currentTenantId, currentRole, isAuthenticated, tablePerms, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
