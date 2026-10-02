import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="screen-loader"><span className="spinner" /> Đang tải hệ thống...</div>
  return user ? children : <Navigate to="/login" replace />
}
