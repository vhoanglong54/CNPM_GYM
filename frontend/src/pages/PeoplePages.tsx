import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Plus, Search, ShieldCheck, Star, Trash2, UserCheck, UserX } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api, getErrorMessage } from '../lib/api'
import { formatAppDate } from '../lib/dateTime'
import { publishDataChange, subscribeDataChanges } from '../lib/liveUpdates'
import { createRequestGate } from '../lib/requestGate'
import type { ApiResponse, Role } from '../types'

interface MemberRow {
  id: string
  email: string
  fullName: string
  phone?: string
  status: string
  createdAt: string
  memberProfile?: { memberCode: string; memberships: unknown[]; ptPackages: unknown[] }
}

interface StaffRow {
  id: string
  email: string
  fullName: string
  status: 'ACTIVE' | 'INACTIVE' | 'UNVERIFIED'
  roles: Array<{ role: { code: Role; name: string } }>
  rating: { average?: number | null; count: number }
}

export function MembersPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<MemberRow[]>([])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState('')
  const busyRef = useRef(false)
  const [requestGate] = useState(createRequestGate)
  const owner = user?.roles.includes('OWNER')

  const load = useCallback(async (silent = false) => {
    const token = requestGate.begin()
    try {
      const { data } = await api.get<ApiResponse<MemberRow[]>>('/users/members')
      if (requestGate.canApply(token)) setRows(data.data)
    } catch (error) {
      if (!silent) toast.error(getErrorMessage(error))
    }
  }, [requestGate])

  /* oxlint-disable react/set-state-in-effect -- member list is synchronized from the server */
  useEffect(() => {
    void load()
    const timer = window.setInterval(() => { if (!document.hidden) void load(true) }, 30_000)
    const refresh = () => { if (!document.hidden) void load(true) }
    const unsubscribe = subscribeDataChanges(['people', 'profile'], refresh)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      unsubscribe()
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [load])
  /* oxlint-enable react/set-state-in-effect */

  const remove = async (member: MemberRow) => {
    if (!window.confirm(`Xóa tài khoản ${member.fullName} (${member.email})? Hành động này không thể hoàn tác.`)) return
    if (busyRef.current) return
    busyRef.current = true
    setBusy(member.id)
    requestGate.invalidate()
    setRows((current) => current.filter((item) => item.id !== member.id))
    try {
      const { data } = await api.delete<ApiResponse<unknown>>(`/users/members/${member.id}`)
      requestGate.invalidate()
      toast.success(data.message)
      publishDataChange('people', 'dashboard')
    } catch (error) {
      toast.error(getErrorMessage(error))
      void load(true)
    } finally {
      busyRef.current = false
      setBusy('')
    }
  }

  const visible = rows.filter((item) => (
    `${item.fullName} ${item.email} ${item.memberProfile?.memberCode}`.toLowerCase().includes(query.toLowerCase())
  ))

  return <>
    <Header eyebrow="DANH SÁCH HỘI VIÊN" title="Hội viên" text="Hồ sơ, trạng thái và quyền lợi được quản lý tập trung." />
    <div className="card table-card">
      <div className="table-tools">
        <div className="search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, email hoặc mã hội viên..." /></div>
        <span>{visible.length} hội viên</span>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Hội viên</th><th>Mã</th><th>Liên hệ</th><th>Quyền lợi</th><th>Trạng thái</th>{owner && <th>Thao tác</th>}</tr></thead><tbody>
        {visible.map((item) => <tr key={item.id}>
          <td><div className="person"><span>{item.fullName[0]}</span><div><strong>{item.fullName}</strong><small>Tham gia {formatAppDate(item.createdAt)}</small></div></div></td>
          <td><code>{item.memberProfile?.memberCode}</code></td>
          <td>{item.email}<small>{item.phone || 'Chưa có số điện thoại'}</small></td>
          <td>{item.memberProfile?.memberships?.length || 0} Gym · {item.memberProfile?.ptPackages?.length || 0} PT</td>
          <td><span className={`status ${item.status === 'ACTIVE' ? 'paid' : 'cancelled'}`}>{item.status === 'ACTIVE' ? 'Hoạt động' : item.status === 'UNVERIFIED' ? 'Chưa xác thực' : 'Tạm khóa'}</span></td>
          {owner && <td><button className="icon-action bad" disabled={busy === item.id} title="Xóa tài khoản" aria-label={`Xóa tài khoản ${item.fullName}`} onClick={() => void remove(item)}><Trash2 /></button></td>}
        </tr>)}
      </tbody></table></div>
    </div>
  </>
}

export function StaffPage() {
  const [rows, setRows] = useState<StaffRow[]>([])
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState('')
  const busyRef = useRef(false)
  const [requestGate] = useState(createRequestGate)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ACTIVE')
  const [sort, setSort] = useState<'NAME' | 'RATING' | 'REVIEWS'>('NAME')

  const load = useCallback(async (silent = false) => {
    const token = requestGate.begin()
    try {
      const { data } = await api.get<ApiResponse<StaffRow[]>>('/users/staff')
      if (requestGate.canApply(token)) setRows(data.data)
    } catch (error) {
      if (!silent) toast.error(getErrorMessage(error))
    }
  }, [requestGate])

  /* oxlint-disable react/set-state-in-effect -- staff list is synchronized from the server */
  useEffect(() => {
    void load()
    const timer = window.setInterval(() => { if (!document.hidden) void load(true) }, 30_000)
    const refresh = () => { if (!document.hidden) void load(true) }
    const unsubscribe = subscribeDataChanges(['people', 'reviews'], refresh)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      unsubscribe()
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [load])
  /* oxlint-enable react/set-state-in-effect */

  const visible = useMemo(() => rows
    .filter((staff) => statusFilter === 'ALL' || staff.status === statusFilter)
    .sort((first, second) => {
      if (sort === 'RATING') return (second.rating.average ?? -1) - (first.rating.average ?? -1) || second.rating.count - first.rating.count
      if (sort === 'REVIEWS') return second.rating.count - first.rating.count
      return first.fullName.localeCompare(second.fullName, 'vi')
    }), [rows, sort, statusFilter])

  const changeSort = (value: 'NAME' | 'RATING' | 'REVIEWS') => {
    setSort(value)
    if (value !== 'NAME') setStatusFilter('ACTIVE')
  }

  const changeStatus = async (staff: StaffRow) => {
    const nextStatus = staff.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    const action = nextStatus === 'INACTIVE' ? 'cho nghỉ việc' : 'khôi phục tài khoản'
    if (!window.confirm(`Bạn muốn ${action} cho ${staff.fullName}?`)) return
    if (busyRef.current) return
    busyRef.current = true
    setBusy(staff.id)
    requestGate.invalidate()
    try {
      const { data } = await api.patch<ApiResponse<{ status: StaffRow['status'] }>>(`/users/${staff.id}/status`, { status: nextStatus })
      requestGate.invalidate()
      setRows((current) => current.map((item) => item.id === staff.id ? { ...item, status: data.data.status } : item))
      toast.success(nextStatus === 'INACTIVE' ? 'Đã cho nhân viên nghỉ việc và khóa quyền đăng nhập.' : 'Đã khôi phục tài khoản nhân viên.')
      publishDataChange('people', 'reviews', 'schedule', 'dashboard')
    } catch (error) {
      toast.error(getErrorMessage(error))
      void load(true)
    } finally {
      busyRef.current = false
      setBusy('')
    }
  }

  return <>
    <Header eyebrow="ĐỘI NGŨ VẬN HÀNH" title="Nhân sự" text="Cho nghỉ việc sẽ khóa đăng nhập nhưng vẫn giữ lịch sử giao dịch và lịch PT.">
      <button className="btn btn-primary" onClick={() => setShow(!show)}><Plus /> Thêm nhân sự</button>
    </Header>
    {show && <StaffForm onDone={() => { requestGate.invalidate(); setShow(false); void load() }} />}
    <div className="card staff-directory-tools">
      <div className="booking-filters" role="group" aria-label="Lọc trạng thái nhân viên">
        <button className={statusFilter === 'ACTIVE' ? 'active' : ''} onClick={() => setStatusFilter('ACTIVE')}>Còn làm việc<span>{rows.filter((item) => item.status === 'ACTIVE').length}</span></button>
        <button className={statusFilter === 'INACTIVE' ? 'active' : ''} onClick={() => { setStatusFilter('INACTIVE'); setSort('NAME') }}>Đã nghỉ việc<span>{rows.filter((item) => item.status === 'INACTIVE').length}</span></button>
        <button className={statusFilter === 'ALL' ? 'active' : ''} onClick={() => { setStatusFilter('ALL'); setSort('NAME') }}>Tất cả<span>{rows.length}</span></button>
      </div>
      <label>Sắp xếp<select value={sort} onChange={(event) => changeSort(event.target.value as 'NAME' | 'RATING' | 'REVIEWS')}><option value="NAME">Tên A–Z</option><option value="RATING">Đánh giá cao nhất · đang làm</option><option value="REVIEWS">Nhiều đánh giá nhất · đang làm</option></select></label>
    </div>
    <div className="people-grid">{visible.map((staff) => {
      const canManage = staff.roles.some(({ role }) => role.code === 'RECEPTIONIST' || role.code === 'TRAINER')
      return <article className={`person-card ${staff.status !== 'ACTIVE' ? 'staff-inactive' : ''}`} key={staff.id}>
        <div className="person-avatar">{staff.fullName[0]}</div>
        <span className={`status ${staff.status === 'ACTIVE' ? 'paid' : 'cancelled'}`}>{staff.status === 'ACTIVE' ? 'Đang làm việc' : 'Đã nghỉ việc'}</span>
        <h3>{staff.fullName}</h3>
        <p>{staff.email}</p>
        <div className="role-line"><ShieldCheck />{staff.roles.map(({ role }) => role.name).join(', ')}</div>
        {canManage && <div className="staff-rating-line"><Star /><strong>{staff.rating.count ? staff.rating.average?.toFixed(1) : '—'}</strong><span>{staff.rating.count} đánh giá</span></div>}
        {canManage && <Link className="btn btn-wide btn-ghost" to={`/staff-reviews?staff=${staff.id}`}><Star /> Xem đánh giá</Link>}
        {canManage && <button className={`btn btn-wide staff-status-action ${staff.status === 'ACTIVE' ? 'btn-danger' : 'btn-confirm'}`} disabled={busy === staff.id} onClick={() => void changeStatus(staff)}>
          {staff.status === 'ACTIVE' ? <><UserX /> Cho nghỉ việc</> : <><UserCheck /> Khôi phục tài khoản</>}
        </button>}
      </article>
    })}</div>
  </>
}

function StaffForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'RECEPTIONIST', specialties: '' })
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      const { data } = await api.post<ApiResponse<unknown>>('/users/staff', form)
      toast.success(data.message)
      publishDataChange('people', 'reviews')
      onDone()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }
  return <form className="card inline-form" onSubmit={submit}>
    <label>Họ tên<input required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label>
    <label>Email<input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
    <label>Mật khẩu khởi tạo<input type="password" minLength={8} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
    <label>Vai trò<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="RECEPTIONIST">Lễ tân</option><option value="TRAINER">Huấn luyện viên (PT)</option></select></label>
    <button className="btn btn-primary" disabled={busy}><Plus /> {busy ? 'Đang tạo...' : 'Tạo tài khoản'}</button>
  </form>
}

function Header({ eyebrow, title, text, children }: { eyebrow: string; title: string; text: string; children?: React.ReactNode }) {
  return <section className="hero-row"><div><span className="eyebrow dark">{eyebrow}</span><h2>{title}</h2><p>{text}</p></div><div>{children}</div></section>
}
