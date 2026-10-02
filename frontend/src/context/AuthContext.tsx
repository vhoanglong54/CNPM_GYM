/* oxlint-disable react/only-export-components -- provider and its hook intentionally share one module */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import type { ApiResponse, User } from '../types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadStoredUser(): User | null {
  const saved = localStorage.getItem('gym_user')
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
    localStorage.removeItem('gym_user')
    localStorage.removeItem('gym_token')
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadStoredUser)
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('gym_token')))

  const logout = () => {
    localStorage.removeItem('gym_token')
    localStorage.removeItem('gym_user')
    setUser(null)
  }

  useEffect(() => {
    const token = localStorage.getItem('gym_token')
    if (!token) return
    api.get<ApiResponse<User>>('/auth/me')
      .then(({ data }) => {
        setUser(data.data)
        localStorage.setItem('gym_user', JSON.stringify(data.data))
      })
      .catch(logout)
      .finally(() => setLoading(false))
    window.addEventListener('gym:unauthorized', logout)
    return () => window.removeEventListener('gym:unauthorized', logout)
  }, [])

  const login = async (email: string, password: string) => {
    const { data } = await api.post<ApiResponse<{ accessToken: string; user: User }>>('/auth/login', { email, password })
    localStorage.setItem('gym_token', data.data.accessToken)
    localStorage.setItem('gym_user', JSON.stringify(data.data.user))
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
