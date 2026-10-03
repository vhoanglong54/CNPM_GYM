/* oxlint-disable react/only-export-components -- provider and its hook intentionally share one module */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import {
  clearAuthSession,
  clearLegacySharedAuth,
  getAuthToken,
  getStoredUser,
  saveAuthSession,
  saveStoredUser,
} from '../lib/authSession'
import type { ApiResponse, User } from '../types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadStoredUser(): User | null {
  clearLegacySharedAuth()
  const saved = getStoredUser()
  if (!saved) return null

  try {
    const value = JSON.parse(saved) as Partial<User>
    const isValid =
      typeof value.id === 'string' &&
      typeof value.email === 'string' &&
      typeof value.fullName === 'string' &&
      Array.isArray(value.roles)

    if (!isValid) throw new Error('Invalid stored user')
    return value as User
  } catch {
    clearAuthSession()
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadStoredUser)
  const [loading, setLoading] = useState(Boolean(getAuthToken()))

  const logout = () => {
    clearAuthSession()
    setUser(null)
  }

  useEffect(() => {
    const token = getAuthToken()
    if (!token) return
    api.get<ApiResponse<User>>('/auth/me')
      .then(({ data }) => {
        setUser(data.data)
        saveStoredUser(data.data)
      })
      .catch(logout)
      .finally(() => setLoading(false))
    window.addEventListener('gym:unauthorized', logout)
    return () => window.removeEventListener('gym:unauthorized', logout)
  }, [])

  const login = async (email: string, password: string) => {
    const { data } = await api.post<ApiResponse<{ accessToken: string; user: User }>>('/auth/login', { email, password })
    saveAuthSession(data.data.accessToken, data.data.user)
    setUser(data.data.user)
    return data.data.user
  }

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth phải nằm trong AuthProvider')
  return context
}
