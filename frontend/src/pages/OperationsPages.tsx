import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
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
  RefreshCw,
  ScanLine,
  Star,
  UserRound,
  X,
  XCircle,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import QrScanner from 'qr-scanner'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api, getErrorMessage } from '../lib/api'
import { appDateParts, appDayIsoRange, appTodayKey, formatAppDate, formatAppDateTime, formatAppTime } from '../lib/dateTime'
import type { ApiResponse, Profile } from '../types'

type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCEL_REQUESTED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED' | 'NO_SHOW'
type BookingFilter = 'ACTIVE' | 'ALL' | BookingStatus
type SlotSort = 'SOONEST' | 'RATING' | 'REVIEW_COUNT'

interface Slot {
  id: string
  startsAt: string
  endsAt: string
  bookings: Array<{ id: string; status: BookingStatus }>
  trainer: { id: string; user: { id: string; fullName: string }; rating: { average?: number; count: number } }
}

interface Booking {
  id: string
  status: BookingStatus
  note?: string
  resolutionReason?: string
  cancellationReason?: string
  cancellationRequestedAt?: string
  cancellationRequestedBy?: { fullName: string; email: string }
  slot: {
    startsAt: string
    endsAt: string
    trainer: { user: { id: string; fullName: string } }
  }
  member: { user: { fullName: string; email: string } }
  memberPtPackage: { package: { name: string } }
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
  CANCEL_REQUESTED: 'Chờ duyệt hủy',
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
  { value: 'CANCEL_REQUESTED', label: 'Chờ duyệt hủy' },
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
  const [bookingAction, setBookingAction] = useState<{ booking: Booking; status: BookingStatus; title: string } | null>(null)
  const [actionReason, setActionReason] = useState('')
  const loadRequestRef = useRef(0)
  const lastAppliedRequestRef = useRef(0)
  const dataVersionRef = useRef(0)
  const trainer = user?.roles.includes('TRAINER')
  const member = user?.roles.includes('MEMBER')
  const owner = user?.roles.includes('OWNER')

  const load = useCallback(async (silent = false) => {
    const requestId = ++loadRequestRef.current
    const dataVersion = dataVersionRef.current
    const params = new URLSearchParams({ sort: slotSort })
    if (slotDate) {
      const { from, to } = appDayIsoRange(slotDate)
      params.set('from', from)
      params.set('to', to)
    }
    try {
      const [slotResponse, bookingResponse, profileResponse] = await Promise.all([
        api.get<ApiResponse<Slot[]>>(`/operations/slots?${params.toString()}`),
        api.get<ApiResponse<Booking[]>>('/operations/bookings'),
        api.get<ApiResponse<Profile>>('/users/me/profile'),
      ])
      if (dataVersion !== dataVersionRef.current || requestId < lastAppliedRequestRef.current) return
      lastAppliedRequestRef.current = requestId
      setSlots(slotResponse.data.data)
      setBookings(bookingResponse.data.data)
      setProfile(profileResponse.data.data)
    } catch (error) {
      if (!silent) toast.error(getErrorMessage(error))
    }
  }, [slotDate, slotSort])

  /* oxlint-disable react/set-state-in-effect -- effect loads server state and registers live refresh */
  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(true), 5_000)
    const refreshVisiblePage = () => { if (!document.hidden) void load(true) }
    window.addEventListener('focus', refreshVisiblePage)
    document.addEventListener('visibilitychange', refreshVisiblePage)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshVisiblePage)
      document.removeEventListener('visibilitychange', refreshVisiblePage)
    }
  }, [load])
  /* oxlint-enable react/set-state-in-effect */

  /* oxlint-disable react/purity -- eligibility must be compared with the current browser time */
  const eligiblePackages = useMemo(() => (
    profile?.memberProfile?.ptPackages?.filter((item) => (
      item.sessionsUsed + item.sessionsReserved < item.sessionsTotal &&
      (!item.expiresAt || new Date(item.expiresAt) >= new Date())
    )) ?? []
  ), [profile])
  /* oxlint-enable react/purity */

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
    dataVersionRef.current += 1
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

  const beginBookingAction = (booking: Booking, status: BookingStatus) => {
    const needsReason = status === 'REJECTED' || status === 'NO_SHOW' ||
      (status === 'CANCELLED' && booking.status !== 'CANCEL_REQUESTED') ||
      (status === 'CONFIRMED' && booking.status === 'CANCEL_REQUESTED')
    if (!needsReason) return void updateBooking(booking, status)
    const title = status === 'REJECTED' ? 'Từ chối yêu cầu đặt lịch' : status === 'NO_SHOW' ? 'Ghi nhận Hội viên vắng mặt' : status === 'CONFIRMED' ? 'Từ chối yêu cầu hủy muộn' : member && booking.status === 'CONFIRMED' ? 'Hủy hoặc gửi yêu cầu hủy' : 'Hủy lịch PT'
    setBookingAction({ booking, status, title })
    setActionReason('')
  }

  const updateBooking = async (booking: Booking, status: BookingStatus, reason?: string) => {
    setBusy(booking.id)
    dataVersionRef.current += 1
    try {
      const { data } = await api.patch<ApiResponse<Partial<Booking> & { status: BookingStatus }>>(`/operations/bookings/${booking.id}/status`, { status, reason })
      setBookings((current) => current.map((item) => item.id === booking.id ? { ...item, ...data.data } : item))
      toast.success(data.message)
      setBookingAction(null)
      setActionReason('')
      void load(true)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setBusy('')
    }
  }

  const submitBookingAction = (event: FormEvent) => {
    event.preventDefault()
    if (!bookingAction || actionReason.trim().length < 3) {
      toast.error('Vui lòng nhập lý do rõ ràng, tối thiểu 3 ký tự.')
      return
    }
    void updateBooking(bookingAction.booking, bookingAction.status, actionReason.trim())
  }

  const closeSlot = async (slot: Slot) => {
    if (!window.confirm(`Đóng khung giờ ${formatTime(slot.startsAt)} ngày ${formatDate(slot.startsAt)}?`)) return
    setBusy(slot.id)
    dataVersionRef.current += 1
    try {
      const { data } = await api.patch<ApiResponse<unknown>>(`/operations/slots/${slot.id}/close`)
      setSlots((current) => current.filter((item) => item.id !== slot.id))
      toast.success(data.message)
      void load(true)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setBusy('')
    }
  }

  const activeCount = bookings.filter((item) => ['PENDING', 'CONFIRMED', 'CANCEL_REQUESTED'].includes(item.status)).length
  const completedCount = bookings.filter((item) => item.status === 'COMPLETED').length
  const remainingSessions = eligiblePackages.reduce((total, item) => total + item.sessionsTotal - item.sessionsUsed - item.sessionsReserved, 0)

  return <>
    <section className="hero-row visual-hero schedule-hero">
      <div>
        <span className="eyebrow">LỊCH HUẤN LUYỆN</span>
        <h2>Lịch huấn luyện cá nhân</h2>
        <p>{member ? 'Chọn PT, gửi yêu cầu và theo dõi xác nhận trong cùng một nơi.' : trainer ? 'Quản lý thời gian rảnh và phản hồi lịch hẹn của hội viên.' : 'Theo dõi toàn bộ lịch huấn luyện đang vận hành.'}</p>
      </div>
      <div className="hero-actions">
        <button className="btn btn-ghost" onClick={() => void load()}><RefreshCw /> Làm mới</button>
        {trainer && <button className="btn btn-primary" onClick={() => setShowSlotForm(!showSlotForm)}><Plus /> Mở khung giờ</button>}
      </div>
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
      <label>Ngày muốn tập<input type="date" min={appTodayKey()} value={slotDate} onChange={(event) => setSlotDate(event.target.value)} /></label>
      <label>Sắp xếp PT<select value={slotSort} onChange={(event) => setSlotSort(event.target.value as SlotSort)}><option value="SOONEST">Lịch trống sớm nhất</option><option value="RATING">Đánh giá cao nhất</option><option value="REVIEW_COUNT">Nhiều lượt đánh giá nhất</option></select></label>
      {slotDate && <button type="button" className="btn btn-ghost" onClick={() => setSlotDate('')}>Xóa ngày lọc</button>}
    </div>}

    {visibleSlots.length ? <div className="slot-grid">
      {visibleSlots.map((slot) => { const dateParts = appDateParts(slot.startsAt); return <article className={`slot-card ${slot.bookings.length ? 'booked' : ''}`} key={slot.id}>
        <div className="slot-date"><span>{dateParts.weekday}</span><b>{dateParts.day}</b><small>TH {dateParts.month}</small></div>
        <div className="slot-detail">
          <strong>{formatTime(slot.startsAt)} – {formatTime(slot.endsAt)}</strong>
          {(member || owner) ? <><Link className="trainer-profile-link" to={`/staff-reviews?staff=${slot.trainer.user.id}`}><UserRound /> {slot.trainer.user.fullName}</Link><Link className="trainer-rating" to={`/staff-reviews?staff=${slot.trainer.user.id}`}><Star /> {slot.trainer.rating.count ? `${slot.trainer.rating.average?.toFixed(1)} (${slot.trainer.rating.count} đánh giá)` : 'Chưa có đánh giá · xem hồ sơ'}</Link></> : <><small><UserRound /> {slot.trainer.user.fullName}</small><small className="trainer-rating"><Star /> {slot.trainer.rating.count ? `${slot.trainer.rating.average?.toFixed(1)} (${slot.trainer.rating.count} đánh giá)` : 'Chưa có đánh giá'}</small></>}
          <span>{slot.bookings.length ? 'Đã có hội viên đặt' : 'Sẵn sàng nhận lịch'}</span>
        </div>
        {member && <button className="btn btn-small btn-dark" onClick={() => openBooking(slot)}>Chọn lịch</button>}
        {trainer && !slot.bookings.length && <button className="icon-action bad" disabled={busy === slot.id} title="Đóng khung giờ" onClick={() => void closeSlot(slot)}><XCircle /></button>}
      </article>})}
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
    {bookingAction && <form className="card booking-action-form" onSubmit={submitBookingAction}>
      <div><span className="eyebrow dark">XÁC NHẬN THAO TÁC</span><h3>{bookingAction.title}</h3><p>{member && bookingAction.booking.status === 'CONFIRMED' ? 'Nếu lịch còn dưới 4 giờ, hệ thống sẽ giữ nguyên slot và gửi yêu cầu để PT hoặc Chủ phòng duyệt.' : bookingAction.status === 'CONFIRMED' ? 'Lịch sẽ trở lại trạng thái Đã xác nhận và Hội viên nhận được lý do.' : bookingAction.status === 'NO_SHOW' ? 'Thao tác này sẽ trừ một buổi PT sau khi ca đã kết thúc.' : 'Bên còn lại sẽ nhận được thông báo kèm lý do.'}</p></div>
      <label>Lý do<textarea autoFocus required minLength={3} maxLength={500} value={actionReason} onChange={(event) => setActionReason(event.target.value)} placeholder="Nhập lý do rõ ràng..." /></label>
      <div className="booking-composer-actions"><button type="button" className="btn btn-ghost" onClick={() => setBookingAction(null)}>Quay lại</button><button className="btn btn-primary" disabled={busy === bookingAction.booking.id}><CheckCircle2 /> {busy === bookingAction.booking.id ? 'Đang xử lý...' : 'Xác nhận'}</button></div>
    </form>}
    <div className="booking-filters" role="group" aria-label="Lọc trạng thái lịch">
      {filterLabels.map((item) => <button key={item.value} className={filter === item.value ? 'active' : ''} onClick={() => setFilter(item.value)}>{item.label}<span>{item.value === 'ALL' ? bookings.length : item.value === 'ACTIVE' ? activeCount : bookings.filter((booking) => booking.status === item.value).length}</span></button>)}
    </div>
    <div className="card booking-list">
      {visibleBookings.length ? visibleBookings.map((item) => <div className="booking-row" key={item.id}>
        <div className="calendar-tile"><b>{appDateParts(item.slot.startsAt).day}</b><span>TH {appDateParts(item.slot.startsAt).month}</span></div>
        <div className="grow booking-person"><strong>{member ? item.slot.trainer.user.fullName : item.member.user.fullName}</strong><small>{formatDate(item.slot.startsAt)} · {formatTime(item.slot.startsAt)} – {formatTime(item.slot.endsAt)}</small><small>{item.memberPtPackage.package.name}</small>{item.note && <p><MessageSquareText /> {item.note}</p>}{item.cancellationReason && <p className="cancellation-request-note"><Clock3 /> Yêu cầu hủy: {item.cancellationReason}</p>}{item.resolutionReason && <p className="resolution-reason"><XCircle /> {item.resolutionReason}</p>}</div>
        <span className={`status ${item.status.toLowerCase()}`}>{statusLabels[item.status]}</span>
        <div className="row-actions">
          {trainer && item.status === 'PENDING' && <button className="btn btn-small btn-confirm" disabled={busy === item.id} onClick={() => beginBookingAction(item, 'CONFIRMED')}><CheckCircle2 /> Xác nhận</button>}
          {trainer && item.status === 'PENDING' && <button className="btn btn-small btn-danger" disabled={busy === item.id} onClick={() => beginBookingAction(item, 'REJECTED')}><XCircle /> Từ chối</button>}
          {trainer && item.status === 'CONFIRMED' && <button className="btn btn-small btn-primary" disabled={busy === item.id} onClick={() => beginBookingAction(item, 'COMPLETED')}>Hoàn thành</button>}
          {trainer && item.status === 'CONFIRMED' && <button className="btn btn-small btn-ghost" disabled={busy === item.id} onClick={() => beginBookingAction(item, 'NO_SHOW')}>Vắng mặt</button>}
          {(trainer || owner) && item.status === 'CANCEL_REQUESTED' && <button className="btn btn-small btn-confirm" disabled={busy === item.id} onClick={() => beginBookingAction(item, 'CANCELLED')}><CheckCircle2 /> Chấp nhận hủy</button>}
          {(trainer || owner) && item.status === 'CANCEL_REQUESTED' && <button className="btn btn-small btn-danger" disabled={busy === item.id} onClick={() => beginBookingAction(item, 'CONFIRMED')}><XCircle /> Từ chối hủy</button>}
          {(member || trainer) && ['PENDING', 'CONFIRMED'].includes(item.status) && <button className="btn btn-small btn-danger" disabled={busy === item.id} onClick={() => beginBookingAction(item, 'CANCELLED')}><XCircle /> {member && item.status === 'CONFIRMED' ? 'Hủy / yêu cầu hủy' : 'Hủy lịch'}</button>}
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
  return formatAppTime(value)
}

function formatDate(value: string) {
  return `${appDateParts(value).weekday}, ${formatAppDate(value)}`
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
  const load = useCallback((silent = false) => Promise.all([
    api.get<ApiResponse<Profile>>('/users/me/profile'),
    api.get<ApiResponse<Checkin[]>>('/operations/checkins'),
  ]).then(([profileResponse, historyResponse]) => {
    setProfile(profileResponse.data.data)
    setHistory(historyResponse.data.data)
  }).catch((error) => { if (!silent) toast.error(getErrorMessage(error)) }), [])

  /* oxlint-disable-next-line react/set-state-in-effect -- check-in history stays synchronized across front-desk tabs */
  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(true), 10_000)
    return () => window.clearInterval(timer)
  }, [load])

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
        {eligibility && <div className="eligibility-panel"><div className="eligibility-member"><div><strong>{eligibility.member.fullName}</strong><small>{eligibility.member.memberCode} · {eligibility.member.email}</small></div><span>Đủ điều kiện</span></div><p>Chọn đúng gói sẽ được ghi nhận cho lượt check-in này:</p><div className="membership-choices">{eligibility.memberships.map((membership) => <label className={selectedMembershipId === membership.id ? 'selected' : ''} key={membership.id}><input type="radio" name="checkin-membership" value={membership.id} checked={selectedMembershipId === membership.id} onChange={() => setSelectedMembershipId(membership.id)} /><span><strong>{membership.planName}</strong><small>{membership.type === 'DURATION' ? `Còn ${membership.remainingDays ?? 0} ngày · hết hạn ${membership.endDate ? formatAppDate(membership.endDate) : '—'}` : `Còn ${(membership.visitsTotal ?? 0) - membership.visitsUsed}/${membership.visitsTotal ?? 0} lượt`}</small></span>{membership.id === eligibility.recommendedMembershipId && <em>Đề xuất</em>}</label>)}</div><button type="button" className="btn btn-primary btn-wide" disabled={busy || !selectedMembershipId} onClick={() => void checkin()}><CheckCircle2 /> {busy ? 'Đang ghi nhận...' : `Xác nhận với ${eligibility.memberships.find((item) => item.id === selectedMembershipId)?.planName ?? 'gói đã chọn'}`}</button></div>}
      </div>}
      <div className="card"><div className="card-heading"><div><span className="eyebrow dark">HOẠT ĐỘNG GẦN ĐÂY</span><h3>{isMember ? 'Lịch sử vào tập của tôi' : 'Lịch sử check-in'}</h3></div></div><div className="timeline">{history.length ? history.slice(0, 10).map((item) => <div className="timeline-item" key={item.id}><i /><div><strong>{item.member.user.fullName}</strong><small>{item.memberMembership.plan.name}</small></div><time>{formatAppDateTime(item.checkedInAt)}</time></div>) : <div className="empty-state"><Clock3 /><p>Chưa có lượt check-in.</p></div>}</div></div>
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
