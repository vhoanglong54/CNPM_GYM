import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  Camera,
  CameraOff,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Dumbbell,
  MessageSquareText,
  Plus,
  ScanLine,
  Star,
  UserRound,
  X,
  XCircle,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import QrScanner from 'qr-scanner'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { api, getErrorMessage } from '../lib/api'
import type { ApiResponse, Profile } from '../types'

type BookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED' | 'NO_SHOW'
type BookingFilter = 'ACTIVE' | 'ALL' | BookingStatus
type SlotSort = 'SOONEST' | 'RATING' | 'REVIEW_COUNT'

interface Slot {
  id: string
  startsAt: string
  endsAt: string
  bookings: Array<{ id: string; status: BookingStatus }>
  trainer: { id: string; user: { fullName: string }; rating: { average?: number; count: number } }
}

interface Booking {
  id: string
  status: BookingStatus
  note?: string
  resolutionReason?: string
  slot: {
    startsAt: string
    endsAt: string
    trainer: { user: { fullName: string } }
  }
  member: { user: { fullName: string; email: string } }
  memberPtPackage: { package: { name: string } }
  review?: { rating: number; comment?: string }
}

interface Checkin {
  id: string
  checkedInAt: string
  member: { user: { fullName: string } }
  memberMembership: { plan: { name: string } }
}

interface CheckinEligibility {
  member: { fullName: string; email: string; memberCode: string }
  memberships: Array<{
    id: string
    planName: string
    type: 'DURATION' | 'VISITS'
    startDate: string
    endDate?: string
    visitsTotal?: number
    visitsUsed: number
    remainingDays?: number
  }>
  recommendedMembershipId: string
}

const statusLabels: Record<BookingStatus, string> = {
  PENDING: 'Chờ PT xác nhận',
  CONFIRMED: 'Đã xác nhận',
  COMPLETED: 'Đã hoàn thành',
  REJECTED: 'Bị từ chối',
  CANCELLED: 'Đã hủy',
  NO_SHOW: 'Vắng mặt',
}

const filterLabels: Array<{ value: BookingFilter; label: string }> = [
  { value: 'ACTIVE', label: 'Đang diễn ra' },
  { value: 'ALL', label: 'Tất cả' },
  { value: 'PENDING', label: 'Chờ xác nhận' },
  { value: 'CONFIRMED', label: 'Đã xác nhận' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'REJECTED', label: 'Bị từ chối' },
  { value: 'CANCELLED', label: 'Đã hủy' },
  { value: 'NO_SHOW', label: 'Vắng mặt' },
]

export function SchedulePage() {
  const { user } = useAuth()
  const [slots, setSlots] = useState<Slot[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [showSlotForm, setShowSlotForm] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [bookingNote, setBookingNote] = useState('')
  const [filter, setFilter] = useState<BookingFilter>('ACTIVE')
  const [slotDate, setSlotDate] = useState('')
  const [slotSort, setSlotSort] = useState<SlotSort>('SOONEST')
  const [busy, setBusy] = useState('')
  const trainer = user?.roles.includes('TRAINER')
  const member = user?.roles.includes('MEMBER')

  const load = () => {
    const params = new URLSearchParams({ sort: slotSort })
    if (slotDate) {
      const from = new Date(`${slotDate}T00:00:00`)
      const to = new Date(from)
      to.setDate(to.getDate() + 1)
      params.set('from', from.toISOString())
      params.set('to', to.toISOString())
    }
    return Promise.all([
      api.get<ApiResponse<Slot[]>>(`/operations/slots?${params.toString()}`),
      api.get<ApiResponse<Booking[]>>('/operations/bookings'),
      api.get<ApiResponse<Profile>>('/users/me/profile'),
    ]).then(([slotResponse, bookingResponse, profileResponse]) => {
      setSlots(slotResponse.data.data)
      setBookings(bookingResponse.data.data)
      setProfile(profileResponse.data.data)
    }).catch((error) => toast.error(getErrorMessage(error)))
  }

  /* oxlint-disable-next-line react-hooks/exhaustive-deps -- filters intentionally trigger a fresh server query */
  useEffect(() => { void load() }, [slotDate, slotSort])

  const eligiblePackages = useMemo(() => (
    profile?.memberProfile?.ptPackages?.filter((item) => (
      item.sessionsUsed + item.sessionsReserved < item.sessionsTotal &&
      (!item.expiresAt || new Date(item.expiresAt) >= new Date())
    )) ?? []
  ), [profile])

  const visibleSlots = useMemo(() => {
    if (member) return slots.filter((slot) => slot.bookings.length === 0)
    if (trainer) return slots.filter((slot) => slot.trainer.id === profile?.trainerProfile?.id)
    return slots
  }, [member, profile, slots, trainer])

  const visibleBookings = useMemo(() => bookings.filter((booking) => {
    if (filter === 'ALL') return true
    if (filter === 'ACTIVE') return booking.status === 'PENDING' || booking.status === 'CONFIRMED'
    return booking.status === filter
  }), [bookings, filter])

  const openBooking = (slot: Slot) => {
    if (!eligiblePackages.length) {
      toast.error('Bạn chưa có gói PT còn lượt. Hãy mua và thanh toán gói PT trước.')
      return
    }
    setSelectedSlot(slot)
    setSelectedPackageId(eligiblePackages[0].id)
    setBookingNote('')
  }

  const book = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedSlot || !selectedPackageId) return
    setBusy('booking')
    try {
      const { data } = await api.post<ApiResponse<unknown>>('/operations/bookings', {
        slotId: selectedSlot.id,
        memberPtPackageId: selectedPackageId,
        note: bookingNote.trim() || undefined,
      })
      toast.success(data.message)
      setSelectedSlot(null)
      await load()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setBusy('')
    }
  }

  const updateBooking = async (id: string, status: BookingStatus) => {
    let reason: string | undefined
    if (status === 'CANCELLED' || status === 'REJECTED' || status === 'NO_SHOW') {
      const label = status === 'REJECTED' ? 'từ chối' : status === 'NO_SHOW' ? 'đánh dấu vắng mặt' : 'hủy'
      const input = window.prompt(`Nhập lý do ${label} lịch PT:`)
      if (input === null) return
      if (input.trim().length < 3) {
        toast.error('Vui lòng nhập lý do rõ ràng.')
        return
      }
      reason = input.trim()
    }
    setBusy(id)
    try {
      const { data } = await api.patch<ApiResponse<unknown>>(`/operations/bookings/${id}/status`, { status, reason })
      toast.success(data.message)
      await load()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setBusy('')
    }
  }

  const reviewBooking = async (booking: Booking) => {
    const ratingInput = window.prompt('Chấm điểm PT từ 1 đến 5 sao:')
    if (ratingInput === null) return
    const rating = Number(ratingInput)
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      toast.error('Điểm đánh giá phải là số nguyên từ 1 đến 5.')
      return
    }
    const comment = window.prompt('Nhận xét về PT (có thể để trống):')
    if (comment === null) return
    setBusy(booking.id)
    try {
      const { data } = await api.post<ApiResponse<unknown>>(`/operations/bookings/${booking.id}/review`, { rating, comment: comment.trim() || undefined })
      toast.success(data.message)
      await load()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setBusy('')
    }
  }

  const closeSlot = async (slot: Slot) => {
    if (!window.confirm(`Đóng khung giờ ${formatTime(slot.startsAt)} ngày ${formatDate(slot.startsAt)}?`)) return
    setBusy(slot.id)
    try {
      const { data } = await api.patch<ApiResponse<unknown>>(`/operations/slots/${slot.id}/close`)
      toast.success(data.message)
      await load()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setBusy('')
    }
  }

  const activeCount = bookings.filter((item) => ['PENDING', 'CONFIRMED'].includes(item.status)).length
  const completedCount = bookings.filter((item) => item.status === 'COMPLETED').length
  const remainingSessions = eligiblePackages.reduce((total, item) => total + item.sessionsTotal - item.sessionsUsed - item.sessionsReserved, 0)

  return <>
    <section className="hero-row visual-hero schedule-hero">
      <div>
        <span className="eyebrow">LỊCH HUẤN LUYỆN</span>
        <h2>Lịch huấn luyện cá nhân</h2>
        <p>{member ? 'Chọn PT, gửi yêu cầu và theo dõi xác nhận trong cùng một nơi.' : trainer ? 'Quản lý thời gian rảnh và phản hồi lịch hẹn của hội viên.' : 'Theo dõi toàn bộ lịch huấn luyện đang vận hành.'}</p>
      </div>
      {trainer && <button className="btn btn-primary" onClick={() => setShowSlotForm(!showSlotForm)}><Plus /> Mở khung giờ</button>}
    </section>

    <section className="schedule-stats" aria-label="Tổng quan lịch PT">
      <ScheduleStat icon={CalendarClock} label={member ? 'Khung giờ có thể đặt' : 'Khung giờ đang mở'} value={visibleSlots.length} />
      <ScheduleStat icon={Clock3} label="Lịch đang diễn ra" value={activeCount} />
      <ScheduleStat icon={CheckCircle2} label="Buổi đã hoàn thành" value={completedCount} />
      <ScheduleStat icon={Dumbbell} label={member ? 'Số buổi PT còn lại' : 'Tổng lịch được quản lý'} value={member ? remainingSessions : bookings.length} />
    </section>

    {showSlotForm && <SlotForm onDone={() => { setShowSlotForm(false); void load() }} />}

    <div className="section-heading schedule-section-heading">
      <div>
        <span className="eyebrow dark">{member ? 'CHỌN THỜI GIAN' : trainer ? 'LỊCH RẢNH CỦA TÔI' : 'KHUNG GIỜ ĐANG MỞ'}</span>
        <h3>{member ? 'Khung giờ có thể đặt' : 'Lịch PT sắp tới'}</h3>
      </div>
      <span>{visibleSlots.length} khung giờ</span>
    </div>
    {member && <div className="slot-discovery-controls card">
      <label>Ngày muốn tập<input type="date" min={new Date().toISOString().slice(0, 10)} value={slotDate} onChange={(event) => setSlotDate(event.target.value)} /></label>
      <label>Sắp xếp PT<select value={slotSort} onChange={(event) => setSlotSort(event.target.value as SlotSort)}><option value="SOONEST">Lịch trống sớm nhất</option><option value="RATING">Đánh giá cao nhất</option><option value="REVIEW_COUNT">Nhiều lượt đánh giá nhất</option></select></label>
      {slotDate && <button type="button" className="btn btn-ghost" onClick={() => setSlotDate('')}>Xóa ngày lọc</button>}
    </div>}

    {visibleSlots.length ? <div className="slot-grid">
      {visibleSlots.map((slot) => <article className={`slot-card ${slot.bookings.length ? 'booked' : ''}`} key={slot.id}>
        <div className="slot-date"><span>{new Date(slot.startsAt).toLocaleDateString('vi-VN', { weekday: 'short' })}</span><b>{new Date(slot.startsAt).getDate()}</b><small>TH {new Date(slot.startsAt).getMonth() + 1}</small></div>
        <div className="slot-detail">
          <strong>{formatTime(slot.startsAt)} – {formatTime(slot.endsAt)}</strong>
          <small><UserRound /> {slot.trainer.user.fullName}</small>
          <small className="trainer-rating"><Star /> {slot.trainer.rating.count ? `${slot.trainer.rating.average?.toFixed(1)} (${slot.trainer.rating.count} đánh giá)` : 'Chưa có đánh giá'}</small>
          <span>{slot.bookings.length ? 'Đã có hội viên đặt' : 'Sẵn sàng nhận lịch'}</span>
        </div>
        {member && <button className="btn btn-small btn-dark" onClick={() => openBooking(slot)}>Chọn lịch</button>}
        {trainer && !slot.bookings.length && <button className="icon-action bad" disabled={busy === slot.id} title="Đóng khung giờ" onClick={() => void closeSlot(slot)}><XCircle /></button>}
      </article>)}
    </div> : <div className="card compact-empty"><CalendarClock /><div><strong>Chưa có khung giờ phù hợp</strong><p>{member ? 'PT sẽ sớm mở thêm lịch mới.' : 'Hãy mở một khung giờ để hội viên có thể đặt lịch.'}</p></div></div>}

    {selectedSlot && <form className="card booking-composer" onSubmit={book}>
      <div className="booking-composer-head">
        <div><span className="eyebrow dark">XÁC NHẬN YÊU CẦU</span><h3>Đặt lịch với {selectedSlot.trainer.user.fullName}</h3></div>
        <button type="button" className="icon-button" aria-label="Đóng" onClick={() => setSelectedSlot(null)}><X /></button>
      </div>
      <div className="selected-slot-summary"><CalendarCheck /><div><strong>{formatDate(selectedSlot.startsAt)} · {formatTime(selectedSlot.startsAt)} – {formatTime(selectedSlot.endsAt)}</strong><small>PT sẽ nhận được yêu cầu và xác nhận lịch với bạn.</small></div></div>
      <div className="booking-fields">
        <label>Gói PT sử dụng<select required value={selectedPackageId} onChange={(event) => setSelectedPackageId(event.target.value)}>{eligiblePackages.map((item) => <option value={item.id} key={item.id}>{item.package.name} · khả dụng {item.sessionsTotal - item.sessionsUsed - item.sessionsReserved} buổi · đang giữ {item.sessionsReserved}</option>)}</select></label>
        <label>Lời nhắn cho PT <small>(không bắt buộc)</small><textarea maxLength={500} value={bookingNote} onChange={(event) => setBookingNote(event.target.value)} placeholder="Ví dụ: Mình muốn tập trung vào kỹ thuật squat..." /></label>
      </div>
      <div className="booking-composer-actions"><button type="button" className="btn btn-ghost" onClick={() => setSelectedSlot(null)}>Chọn giờ khác</button><button className="btn btn-primary" disabled={busy === 'booking'}><CalendarCheck /> {busy === 'booking' ? 'Đang gửi...' : 'Gửi yêu cầu đặt lịch'}</button></div>
    </form>}

    <div className="section-heading spaced booking-heading">
      <div><span className="eyebrow dark">TIẾN TRÌNH LỊCH HẸN</span><h3>{member ? 'Lịch của tôi' : trainer ? 'Yêu cầu từ hội viên' : 'Danh sách buổi tập'}</h3></div>
    </div>
    <div className="booking-filters" role="group" aria-label="Lọc trạng thái lịch">
      {filterLabels.map((item) => <button key={item.value} className={filter === item.value ? 'active' : ''} onClick={() => setFilter(item.value)}>{item.label}<span>{item.value === 'ALL' ? bookings.length : item.value === 'ACTIVE' ? activeCount : bookings.filter((booking) => booking.status === item.value).length}</span></button>)}
    </div>
    <div className="card booking-list">
      {visibleBookings.length ? visibleBookings.map((item) => <div className="booking-row" key={item.id}>
        <div className="calendar-tile"><b>{new Date(item.slot.startsAt).getDate()}</b><span>TH {new Date(item.slot.startsAt).getMonth() + 1}</span></div>
        <div className="grow booking-person"><strong>{member ? item.slot.trainer.user.fullName : item.member.user.fullName}</strong><small>{formatDate(item.slot.startsAt)} · {formatTime(item.slot.startsAt)} – {formatTime(item.slot.endsAt)}</small><small>{item.memberPtPackage.package.name}</small>{item.note && <p><MessageSquareText /> {item.note}</p>}{item.resolutionReason && <p className="resolution-reason"><XCircle /> {item.resolutionReason}</p>}{item.review && <p className="booking-review"><Star /> {item.review.rating}/5{item.review.comment ? ` · ${item.review.comment}` : ''}</p>}</div>
        <span className={`status ${item.status.toLowerCase()}`}>{statusLabels[item.status]}</span>
        <div className="row-actions">
          {trainer && item.status === 'PENDING' && <button className="btn btn-small btn-confirm" disabled={busy === item.id} onClick={() => void updateBooking(item.id, 'CONFIRMED')}><CheckCircle2 /> Xác nhận</button>}
          {trainer && item.status === 'PENDING' && <button className="btn btn-small btn-danger" disabled={busy === item.id} onClick={() => void updateBooking(item.id, 'REJECTED')}><XCircle /> Từ chối</button>}
          {trainer && item.status === 'CONFIRMED' && <button className="btn btn-small btn-primary" disabled={busy === item.id} onClick={() => void updateBooking(item.id, 'COMPLETED')}>Hoàn thành</button>}
          {trainer && item.status === 'CONFIRMED' && <button className="btn btn-small btn-ghost" disabled={busy === item.id} onClick={() => void updateBooking(item.id, 'NO_SHOW')}>Vắng mặt</button>}
          {member && item.status === 'COMPLETED' && !item.review && <button className="btn btn-small btn-ghost" disabled={busy === item.id} onClick={() => void reviewBooking(item)}><Star /> Đánh giá</button>}
          {(member || trainer) && ['PENDING', 'CONFIRMED'].includes(item.status) && <button className="icon-action bad" disabled={busy === item.id} title="Hủy lịch" onClick={() => void updateBooking(item.id, 'CANCELLED')}><XCircle /></button>}
        </div>
      </div>) : <div className="empty-state"><CalendarCheck /><h3>Không có lịch trong bộ lọc này</h3><p>Lịch mới và thay đổi trạng thái sẽ xuất hiện tại đây.</p></div>}
    </div>
  </>
}

function ScheduleStat({ icon: Icon, label, value }: { icon: typeof CalendarClock; label: string; value: number }) {
  return <div className="schedule-stat"><span><Icon /></span><div><strong>{value}</strong><small>{label}</small></div></div>
}

function SlotForm({ onDone }: { onDone: () => void }) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const { data } = await api.post<ApiResponse<unknown>>('/operations/slots', { startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() })
      toast.success(data.message)
      onDone()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  return <form className="card slot-form" onSubmit={submit}><div><span className="eyebrow dark">THỜI GIAN NHẬN LỊCH</span><h3>Mở khung giờ mới</h3><p>Hội viên sẽ nhìn thấy khung giờ ngay sau khi bạn lưu.</p></div><label>Bắt đầu<input type="datetime-local" required value={start} onChange={(event) => setStart(event.target.value)} /></label><label>Kết thúc<input type="datetime-local" required value={end} onChange={(event) => setEnd(event.target.value)} /></label><button className="btn btn-primary" disabled={busy}><Plus /> {busy ? 'Đang mở...' : 'Mở lịch'}</button></form>
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function CheckinPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [history, setHistory] = useState<Checkin[]>([])
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [eligibility, setEligibility] = useState<CheckinEligibility | null>(null)
  const [selectedMembershipId, setSelectedMembershipId] = useState('')
  const isMember = user?.roles.includes('MEMBER')
  const load = () => Promise.all([
    api.get<ApiResponse<Profile>>('/users/me/profile'),
    api.get<ApiResponse<Checkin[]>>('/operations/checkins'),
  ]).then(([profileResponse, historyResponse]) => {
    setProfile(profileResponse.data.data)
    setHistory(historyResponse.data.data)
  }).catch((error) => toast.error(getErrorMessage(error)))

  /* oxlint-disable-next-line react-hooks/exhaustive-deps -- load is reused after mutations */
  useEffect(() => { void load() }, [])

  const inspectMemberships = async (memberCode: string) => {
    if (!memberCode.trim()) return
    setBusy(true)
    setEligibility(null)
    try {
      const { data } = await api.get<ApiResponse<CheckinEligibility>>(`/operations/checkins/eligibility/${encodeURIComponent(memberCode.trim().toUpperCase())}`)
      setEligibility(data.data)
      setSelectedMembershipId(data.data.recommendedMembershipId)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const lookup = (event: FormEvent) => {
    event.preventDefault()
    void inspectMemberships(code)
  }

  const checkin = async () => {
    if (!code.trim() || !selectedMembershipId) return
    setBusy(true)
    try {
      const { data } = await api.post<ApiResponse<unknown>>('/operations/checkins', { memberCode: code.trim().toUpperCase(), memberMembershipId: selectedMembershipId, idempotencyKey: crypto.randomUUID() })
      toast.success(data.message)
      setCode('')
      setEligibility(null)
      setSelectedMembershipId('')
      await load()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const memberCode = profile?.memberProfile?.memberCode || ''
  const acceptScan = (value: string) => {
    setCode(value)
    setCameraOpen(false)
    void inspectMemberships(value)
  }

  return <>
    <section className="hero-row"><div><span className="eyebrow dark">KIỂM SOÁT VÀO TẬP</span><h2>{isMember ? 'Mã check-in của tôi' : 'Check-in phòng tập'}</h2><p>{isMember ? 'Xuất trình mã QR này để Lễ tân ghi nhận lượt vào tập.' : 'Quét QR hội viên hoặc nhập mã thủ công để kiểm tra quyền lợi.'}</p></div></section>
    <div className="checkin-grid">
      {isMember ? <div className="card member-qr-card">
        <span className="eyebrow dark">THẺ HỘI VIÊN</span>
        <h3>Đưa mã này cho Lễ tân</h3>
        <div className="member-qr-frame">{memberCode ? <QRCodeSVG value={`TITAN_GYM_MEMBER:${memberCode}`} size={196} level="H" marginSize={2} title={`Mã hội viên ${memberCode}`} /> : <div className="qr-loading">Đang tải mã...</div>}</div>
        <strong className="big-code">{memberCode || '—'}</strong>
        <p className="qr-help">Lễ tân sẽ quét mã, kiểm tra gói còn hiệu lực và xác nhận lượt vào tập.</p>
      </div> : <div className="card scanner-card staff-scanner">
        <div className="scanner-heading"><div><span className="eyebrow dark">QUÉT MÃ HỘI VIÊN</span><h3>Camera quét QR</h3></div><button type="button" className={`btn ${cameraOpen ? 'btn-ghost' : 'btn-dark'}`} onClick={() => setCameraOpen(!cameraOpen)}>{cameraOpen ? <><CameraOff /> Đóng camera</> : <><Camera /> Mở camera</>}</button></div>
        {cameraOpen && <CameraScanner onDetected={acceptScan} onClose={() => setCameraOpen(false)} />}
        {!cameraOpen && <div className="camera-placeholder"><ScanLine /><strong>Quét QR trên điện thoại hội viên</strong><small>Nếu thiết bị không hỗ trợ camera, hãy nhập mã ở bên dưới.</small></div>}
        <form onSubmit={lookup} className="checkin-form"><label>Mã hội viên<input value={code} onChange={(event) => { setCode(event.target.value.toUpperCase()); setEligibility(null); setSelectedMembershipId('') }} placeholder="Ví dụ: MB-000101" required /><small>Nhập đúng mã đang hiển thị trên tài khoản Hội viên.</small></label><button className="btn btn-dark btn-wide" disabled={busy || !code.trim()}><ScanLine /> {busy ? 'Đang kiểm tra...' : 'Kiểm tra quyền lợi'}</button></form>
        {eligibility && <div className="eligibility-panel"><div className="eligibility-member"><div><strong>{eligibility.member.fullName}</strong><small>{eligibility.member.memberCode} · {eligibility.member.email}</small></div><span>Đủ điều kiện</span></div><p>Chọn đúng gói sẽ được ghi nhận cho lượt check-in này:</p><div className="membership-choices">{eligibility.memberships.map((membership) => <label className={selectedMembershipId === membership.id ? 'selected' : ''} key={membership.id}><input type="radio" name="checkin-membership" value={membership.id} checked={selectedMembershipId === membership.id} onChange={() => setSelectedMembershipId(membership.id)} /><span><strong>{membership.planName}</strong><small>{membership.type === 'DURATION' ? `Còn ${membership.remainingDays ?? 0} ngày · hết hạn ${membership.endDate ? new Date(membership.endDate).toLocaleDateString('vi-VN') : '—'}` : `Còn ${(membership.visitsTotal ?? 0) - membership.visitsUsed}/${membership.visitsTotal ?? 0} lượt`}</small></span>{membership.id === eligibility.recommendedMembershipId && <em>Đề xuất</em>}</label>)}</div><button type="button" className="btn btn-primary btn-wide" disabled={busy || !selectedMembershipId} onClick={() => void checkin()}><CheckCircle2 /> {busy ? 'Đang ghi nhận...' : `Xác nhận với ${eligibility.memberships.find((item) => item.id === selectedMembershipId)?.planName ?? 'gói đã chọn'}`}</button></div>}
      </div>}
      <div className="card"><div className="card-heading"><div><span className="eyebrow dark">HOẠT ĐỘNG GẦN ĐÂY</span><h3>{isMember ? 'Lịch sử vào tập của tôi' : 'Lịch sử check-in'}</h3></div></div><div className="timeline">{history.length ? history.slice(0, 10).map((item) => <div className="timeline-item" key={item.id}><i /><div><strong>{item.member.user.fullName}</strong><small>{item.memberMembership.plan.name}</small></div><time>{new Date(item.checkedInAt).toLocaleString('vi-VN')}</time></div>) : <div className="empty-state"><Clock3 /><p>Chưa có lượt check-in.</p></div>}</div></div>
    </div>
  </>
}

function CameraScanner({ onDetected, onClose }: { onDetected: (value: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const detectedRef = useRef(onDetected)
  const [message, setMessage] = useState('Đang khởi động camera...')
  const [cameras, setCameras] = useState<QrScanner.Camera[]>([])
  const [selectedCamera, setSelectedCamera] = useState('')

  useEffect(() => { detectedRef.current = onDetected }, [onDetected])

  useEffect(() => {
    let active = true

    const start = async () => {
      if (!window.isSecureContext) {
        setMessage('Camera yêu cầu HTTPS hoặc localhost. Hãy nhập mã thủ công trên kết nối LAN HTTP.')
        return
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setMessage('Thiết bị không cung cấp quyền truy cập camera.')
        return
      }
      if (!videoRef.current) return
      try {
        videoRef.current.autoplay = true
        videoRef.current.muted = true
        videoRef.current.defaultMuted = true
        videoRef.current.setAttribute('playsinline', '')
        const scanner = new QrScanner(
          videoRef.current,
          (result) => {
            const memberCode = parseMemberQr(result.data)
            if (!memberCode) {
              if (active) setMessage('QR không phải mã hội viên Titan Gym.')
              return
            }
            scanner.stop()
            if (active) detectedRef.current(memberCode)
          },
          {
            preferredCamera: 'environment',
            maxScansPerSecond: 8,
            returnDetailedScanResult: true,
          },
        )
        scannerRef.current = scanner
        await scanner.start()
        if (!active) {
          scanner.destroy()
          return
        }
        const availableCameras = await QrScanner.listCameras()
        const activeTrack = videoRef.current.srcObject instanceof MediaStream
          ? videoRef.current.srcObject.getVideoTracks()[0]
          : undefined
        const activeCameraId = activeTrack?.getSettings().deviceId
        const activeCamera = availableCameras.find((camera) => camera.id === activeCameraId)
        setCameras(availableCameras)
        if (activeCamera) setSelectedCamera(activeCamera.id)
        const trackName = activeTrack?.label || activeCamera?.label || 'webcam mặc định'
        if (active) setMessage(`Đang dùng ${trackName}. Đưa mã QR vào khung hình.`)
        return () => scanner.destroy()
      } catch (error) {
        const denied = error instanceof DOMException && error.name === 'NotAllowedError'
        const unavailable = error instanceof DOMException && error.name === 'NotFoundError'
        const busy = error instanceof DOMException && error.name === 'NotReadableError'
        if (active) setMessage(
          denied
            ? 'Bạn chưa cấp quyền camera. Hãy cho phép camera rồi mở lại.'
            : unavailable
              ? 'Không tìm thấy camera trên máy này.'
              : busy
                ? 'Camera đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng đó rồi thử lại.'
                : 'Không thể mở camera. Hãy kiểm tra thiết bị và thử lại.',
        )
      }
    }

    let destroyScanner: (() => void) | undefined
    void start().then((cleanup) => { destroyScanner = cleanup })
    return () => {
      active = false
      destroyScanner?.()
      scannerRef.current = null
    }
  }, [])

  const changeCamera = async (cameraId: string) => {
    const camera = cameras.find((item) => item.id === cameraId)
    setSelectedCamera(cameraId)
    try {
      const scanner = scannerRef.current
      if (!scanner || !videoRef.current) return
      await scanner.setCamera(cameraId)
      await scanner.start()
      const activeTrack = videoRef.current.srcObject instanceof MediaStream
        ? videoRef.current.srcObject.getVideoTracks()[0]
        : undefined
      const trackName = activeTrack?.label || camera?.label || 'camera đã chọn'
      setMessage(`Đang dùng ${trackName}. Đưa mã QR vào khung hình.`)
    } catch {
      setMessage('Không thể chuyển camera. Hãy đóng camera và thử lại.')
    }
  }

  return <><div className="camera-scanner"><video ref={videoRef} autoPlay playsInline muted /><div className="camera-target"><i /><i /><i /><i /></div><div className="camera-status"><span>{message}</span><button type="button" onClick={onClose}>Đóng</button></div></div>{cameras.length > 1 && <label className="camera-selector">Thiết bị camera<select value={selectedCamera} onChange={(event) => void changeCamera(event.target.value)}>{cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.label}</option>)}</select></label>}</>
}

function parseMemberQr(rawValue: string) {
  const normalized = rawValue.trim().toUpperCase()
  const value = normalized.startsWith('TITAN_GYM_MEMBER:') ? normalized.slice('TITAN_GYM_MEMBER:'.length) : normalized
  return /^MB-[A-Z0-9-]+$/.test(value) ? value : ''
}
