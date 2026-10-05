import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BarChart3, Bell, CalendarDays, ClipboardCheck, Dumbbell, LogOut, Menu, PackageOpen, ReceiptText, ShieldCheck, Star, TrendingUp, UserRound, Users, X, Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getActiveRequestCount } from '../lib/api'
import type { Role } from '../types'

const roleLabels: Record<Role, string> = {
  OWNER: 'Chủ phòng', RECEPTIONIST: 'Lễ tân', TRAINER: 'Huấn luyện viên', MEMBER: 'Hội viên',
}

const nav = [
  { to: '/', label: 'Tổng quan', icon: BarChart3, roles: ['OWNER', 'RECEPTIONIST', 'TRAINER', 'MEMBER'] },
  { to: '/packages', label: 'Gói tập', icon: PackageOpen, roles: ['OWNER', 'MEMBER', 'RECEPTIONIST'] },
  { to: '/orders', label: 'Giao dịch', icon: ReceiptText, roles: ['OWNER', 'RECEPTIONIST', 'MEMBER'] },
  { to: '/members', label: 'Hội viên', icon: Users, roles: ['OWNER', 'RECEPTIONIST'] },
  { to: '/staff', label: 'Nhân sự', icon: ShieldCheck, roles: ['OWNER'] },
  { to: '/staff-reviews', label: 'Đánh giá nhân viên', icon: Star, roles: ['MEMBER'] },
  { to: '/reports', label: 'Báo cáo', icon: BarChart3, roles: ['OWNER'] },
  { to: '/monthly-revenue', label: 'Doanh thu tháng', icon: TrendingUp, roles: ['OWNER'] },
  { to: '/schedule', label: 'Lịch PT', icon: CalendarDays, roles: ['OWNER', 'TRAINER', 'MEMBER'] },
  { to: '/checkin', label: 'Check-in', icon: ClipboardCheck, roles: ['OWNER', 'RECEPTIONIST', 'MEMBER'] },
  { to: '/notifications', label: 'Thông báo', icon: Bell, roles: ['OWNER', 'RECEPTIONIST', 'TRAINER', 'MEMBER'] },
  { to: '/profile', label: 'Hồ sơ', icon: UserRound, roles: ['OWNER', 'RECEPTIONIST', 'TRAINER', 'MEMBER'] },
]

export function AppShell() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [activeRequests, setActiveRequests] = useState(0)
  const [online, setOnline] = useState(navigator.onLine)
  const location = useLocation()
  const items = nav.filter((item) => item.roles.some((role) => user?.roles.includes(role as Role)))
  const current = items.find((item) => item.to === location.pathname)?.label || 'Titan Gym'

  useEffect(() => {
    let mounted = true
    const updateActivity = (event: Event) => setActiveRequests((event as CustomEvent<number>).detail)
    const updateOnline = () => setOnline(navigator.onLine)
    window.addEventListener('gym:network-activity', updateActivity)
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    queueMicrotask(() => { if (mounted) setActiveRequests(getActiveRequestCount()) })
    return () => {
      mounted = false
      window.removeEventListener('gym:network-activity', updateActivity)
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])

  return <div className="app-shell">
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="brand"><span className="brand-mark"><Dumbbell size={20} /></span><div><b>TITAN</b><small>GYM OS</small></div></div>
      <button className="icon-button mobile-close" onClick={() => setOpen(false)}><X /></button>
      <div className="branch-pill"><Zap size={15} /><div><small>CƠ SỞ ĐANG HOẠT ĐỘNG</small><strong>Titan Central</strong></div></div>
      <nav>
        <span className="nav-caption">KHÔNG GIAN LÀM VIỆC</span>
        {items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={19} /><span>{label}</span></NavLink>)}
      </nav>
      <div className="sidebar-user">
        <div className="avatar">{user?.fullName.slice(0, 1).toUpperCase()}</div>
        <div><strong>{user?.fullName}</strong><small>{roleLabels[user?.roles[0] || 'MEMBER']}</small></div>
        <button className="icon-button" title="Đăng xuất" onClick={logout}><LogOut size={18} /></button>
      </div>
    </aside>
    {open && <button className="sidebar-overlay" onClick={() => setOpen(false)} aria-label="Đóng menu" />}
    <main className="main-area">
      <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setOpen(true)}><Menu /></button><div><small>TRUNG TÂM ĐIỀU HÀNH</small><h1>{current}</h1></div><div className={`live ${!online ? 'offline' : activeRequests ? 'syncing' : ''}`} aria-live="polite"><i /> {!online ? 'Mất kết nối' : activeRequests ? 'Đang đồng bộ...' : 'Đã đồng bộ'}</div></header>
      <div className="page"><Outlet /></div>
    </main>
  </div>
}
