import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ProtectedRoute } from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import { LoginPage, RegisterPage, VerifyPage } from './pages/AuthPages'
import { DashboardPage } from './pages/DashboardPage'
import { OrdersPage } from './pages/OrdersPage'
import { PackagesPage } from './pages/PackagesPage'
import { MembersPage, StaffPage } from './pages/PeoplePages'
import { CheckinPage, SchedulePage } from './pages/OperationsPages'
import { ProfilePage } from './pages/ProfilePage'
import { NotificationsPage } from './pages/NotificationsPage'
import { ReportsPage } from './pages/ReportsPage'
import { MonthlyRevenuePage } from './pages/MonthlyRevenuePage'
import { StaffReviewsPage } from './pages/StaffReviewsPage'
import type { Role } from './types'

function RoleRoute({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user } = useAuth()
  return user?.roles.some((role) => roles.includes(role)) ? children : <Navigate to="/" replace />
}

export default function App() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/verify" element={<VerifyPage />} />
    <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
      <Route index element={<DashboardPage />} />
      <Route path="packages" element={<RoleRoute roles={['OWNER','RECEPTIONIST','MEMBER']}><PackagesPage /></RoleRoute>} />
      <Route path="orders" element={<RoleRoute roles={['OWNER','RECEPTIONIST','MEMBER']}><OrdersPage /></RoleRoute>} />
      <Route path="members" element={<RoleRoute roles={['OWNER','RECEPTIONIST']}><MembersPage /></RoleRoute>} />
      <Route path="staff" element={<RoleRoute roles={['OWNER']}><StaffPage /></RoleRoute>} />
      <Route path="staff-reviews" element={<RoleRoute roles={['OWNER','MEMBER']}><StaffReviewsPage /></RoleRoute>} />
      <Route path="reports" element={<RoleRoute roles={['OWNER']}><ReportsPage /></RoleRoute>} />
      <Route path="monthly-revenue" element={<RoleRoute roles={['OWNER']}><MonthlyRevenuePage /></RoleRoute>} />
      <Route path="schedule" element={<RoleRoute roles={['OWNER','TRAINER','MEMBER']}><SchedulePage /></RoleRoute>} />
      <Route path="checkin" element={<RoleRoute roles={['OWNER','RECEPTIONIST','MEMBER']}><CheckinPage /></RoleRoute>} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="profile" element={<ProfilePage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
