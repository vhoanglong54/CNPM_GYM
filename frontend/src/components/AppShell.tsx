import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BarChart3, CalendarDays, ClipboardCheck, Dumbbell, LogOut, Menu, PackageOpen, ReceiptText, ShieldCheck, UserRound, Users, X, Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
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
  { to: '/schedule', label: 'Lịch PT', icon: CalendarDays, roles: ['OWNER', 'TRAINER', 'MEMBER'] },
  { to: '/checkin', label: 'Check-in', icon: ClipboardCheck, roles: ['OWNER', 'RECEPTIONIST', 'MEMBER'] },
  { to: '/profile', label: 'Hồ sơ', icon: UserRound, roles: ['OWNER', 'RECEPTIONIST', 'TRAINER', 'MEMBER'] },
]

export function AppShell() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const items = nav.filter((item) => item.roles.some((role) => user?.roles.includes(role as Role)))
  const current = items.find((item) => item.to === location.pathname)?.label || 'Titan Gym'

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
      <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setOpen(true)}><Menu /></button><div><small>TRUNG TÂM ĐIỀU HÀNH</small><h1>{current}</h1></div><div className="live"><i /> Hệ thống ổn định</div></header>
      <div className="page"><Outlet /></div>
    </main>
  </div>
}
