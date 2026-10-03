import { useEffect, useState, type FormEvent } from 'react'
import { BadgeCheck, CalendarDays, Dumbbell, LockKeyhole, Mail, Phone, UserRound } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, getErrorMessage } from '../lib/api'
import { formatAppDate } from '../lib/dateTime'
import type { ApiResponse, Profile } from '../types'

const pageLoadedAt = Date.now()

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  useEffect(() => {
    api.get<ApiResponse<Profile>>('/users/me/profile').then((response) => setProfile(response.data.data)).catch((error) => toast.error(getErrorMessage(error)))
  }, [])
  if (!profile) return <div className="loading-card">Đang tải hồ sơ...</div>
  return <>
    <section className="hero-row"><div><span className="eyebrow dark">TÀI KHOẢN CỦA TÔI</span><h2>Hồ sơ cá nhân</h2><p>Thông tin định danh và quyền lợi gắn với tài khoản của bạn.</p></div></section>
    <div className="profile-grid"><div className="card profile-main"><div className="profile-avatar">{profile.fullName[0]}</div><div><span className="status paid"><BadgeCheck/> {profile.status}</span><h2>{profile.fullName}</h2><p>{profile.memberProfile?.memberCode || profile.trainerProfile?.trainerCode || 'Tài khoản vận hành'}</p></div></div><div className="card info-list"><div><Mail/><span>Email</span><strong>{profile.email}</strong></div><div><Phone/><span>Số điện thoại</span><strong>{profile.phone || 'Chưa cập nhật'}</strong></div><div><UserRound/><span>Loại hồ sơ</span><strong>{profile.memberProfile ? 'Hội viên' : profile.trainerProfile ? 'Huấn luyện viên' : 'Nhân sự'}</strong></div></div></div>
    {profile.memberProfile && <div className="card benefit-card"><div className="card-heading"><div><span className="eyebrow dark">GÓI ĐANG SỬ DỤNG</span><h3>Quyền lợi hiện có</h3></div></div><div className="benefit-grid">{(profile.memberProfile.memberships ?? []).map((item) => <div key={item.id}><Dumbbell/><strong>{item.plan.name}</strong><small>{new Date(item.startDate).getTime() > pageLoadedAt ? `Bắt đầu ${formatAppDate(item.startDate)}` : item.endDate ? `Đến ${formatAppDate(item.endDate)}` : `Còn ${(item.visitsTotal || 0) - item.visitsUsed} lượt`}</small></div>)}{(profile.memberProfile.ptPackages ?? []).map((item) => <div key={item.id}><CalendarDays/><strong>{item.package.name}</strong><small>Khả dụng {item.sessionsTotal-item.sessionsUsed-item.sessionsReserved}/{item.sessionsTotal} buổi · đang giữ {item.sessionsReserved}</small></div>)}</div></div>}
    <PasswordCard />
  </>
}

function PasswordCard() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (form.newPassword !== form.confirmPassword) return toast.error('Mật khẩu xác nhận chưa khớp.')
    setBusy(true)
    try {
      const { data } = await api.post<ApiResponse<unknown>>('/users/me/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword })
      toast.success(data.message)
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) { toast.error(getErrorMessage(error)) }
    finally { setBusy(false) }
  }
  return <div className="card password-card"><div><span className="eyebrow dark">BẢO MẬT TÀI KHOẢN</span><h3>Đổi mật khẩu</h3><p>Mật khẩu mới cần ít nhất 8 ký tự và khác mật khẩu hiện tại.</p></div><form className="password-form" onSubmit={submit}><label>Mật khẩu hiện tại<input type="password" required value={form.currentPassword} onChange={(event) => setForm({...form,currentPassword:event.target.value})}/></label><label>Mật khẩu mới<input type="password" minLength={8} required value={form.newPassword} onChange={(event) => setForm({...form,newPassword:event.target.value})}/></label><label>Xác nhận mật khẩu<input type="password" minLength={8} required value={form.confirmPassword} onChange={(event) => setForm({...form,confirmPassword:event.target.value})}/></label><button className="btn btn-dark" disabled={busy}><LockKeyhole/> {busy ? 'Đang đổi...' : 'Đổi mật khẩu'}</button></form></div>
}
