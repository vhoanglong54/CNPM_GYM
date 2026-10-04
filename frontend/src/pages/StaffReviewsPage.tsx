import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, BriefcaseBusiness, MessageSquareText, Search, ShieldCheck, Star, UserRound } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { api, getErrorMessage } from '../lib/api'
import { formatAppDate } from '../lib/dateTime'
import { publishDataChange, subscribeDataChanges } from '../lib/liveUpdates'
import { createRequestGate } from '../lib/requestGate'
import type { ApiResponse, ReviewableStaff, StaffReviewDetail } from '../types'

type StaffFilter = 'ALL' | 'TRAINER' | 'RECEPTIONIST'
type StaffSort = 'RATING' | 'REVIEWS' | 'NAME'

export function StaffReviewsPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [staff, setStaff] = useState<ReviewableStaff[]>([])
  const [detail, setDetail] = useState<StaffReviewDetail | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StaffFilter>('ALL')
  const [sort, setSort] = useState<StaffSort>('RATING')
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [staffRequestGate] = useState(createRequestGate)
  const [detailRequestGate] = useState(createRequestGate)
  const member = user?.roles.includes('MEMBER')
  const selectedId = searchParams.get('staff')

  const loadStaff = useCallback(async (silent = false) => {
    const token = staffRequestGate.begin()
    try {
      const { data } = await api.get<ApiResponse<ReviewableStaff[]>>('/reviews/staff')
      if (staffRequestGate.canApply(token)) setStaff(data.data)
    } catch (error) {
      if (!silent) toast.error(getErrorMessage(error))
    }
  }, [staffRequestGate])

  const loadDetail = useCallback(async (id: string, silent = false, syncForm = false) => {
    const token = detailRequestGate.begin()
    try {
      const { data } = await api.get<ApiResponse<StaffReviewDetail>>(`/reviews/staff/${id}`)
      if (!detailRequestGate.canApply(token)) return
      setDetail(data.data)
      if (syncForm) {
        setRating(data.data.myReview?.rating ?? 5)
        setComment(data.data.myReview?.comment ?? '')
      }
    } catch (error) {
      if (!silent) toast.error(getErrorMessage(error))
      if (!silent) setDetail(null)
    }
  }, [detailRequestGate])

  /* oxlint-disable react/set-state-in-effect -- page state follows the staff id in the URL */
  useEffect(() => {
    void loadStaff()
    const refresh = () => { if (!document.hidden) void loadStaff(true) }
    const timer = window.setInterval(refresh, 30_000)
    const unsubscribe = subscribeDataChanges(['reviews', 'people'], refresh)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      unsubscribe()
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [loadStaff])
  useEffect(() => {
    detailRequestGate.invalidate()
    if (selectedId) {
      setDetail(null)
      void loadDetail(selectedId, false, true)
    } else setDetail(null)
  }, [detailRequestGate, loadDetail, selectedId])
  useEffect(() => {
    if (!selectedId) return
    const refresh = () => { if (!document.hidden) void loadDetail(selectedId, true) }
    const timer = window.setInterval(refresh, 30_000)
    const unsubscribe = subscribeDataChanges(['reviews', 'people'], refresh)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      unsubscribe()
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [loadDetail, member, selectedId])
  /* oxlint-enable react/set-state-in-effect */

  const visible = useMemo(() => staff
    .filter((item) => filter === 'ALL' || item.roles.some(({ role }) => role.code === filter))
    .filter((item) => `${item.fullName} ${item.trainerProfile?.specialties ?? ''}`.toLowerCase().includes(query.toLowerCase()))
    .sort((first, second) => {
      if (sort === 'NAME') return first.fullName.localeCompare(second.fullName, 'vi')
      if (sort === 'REVIEWS') return second.rating.count - first.rating.count
      return (second.rating.average ?? -1) - (first.rating.average ?? -1) || second.rating.count - first.rating.count
    }), [filter, query, sort, staff])

  const selectStaff = (id: string) => setSearchParams({ staff: id })
  const closeDetail = () => setSearchParams({})

  const saveReview = async (event: FormEvent) => {
    event.preventDefault()
    if (!detail) return
    if (comment.trim().length < 3) {
      toast.error('Vui lòng nhập nhận xét có ít nhất 3 ký tự.')
      return
    }
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    detailRequestGate.invalidate()
    staffRequestGate.invalidate()
    try {
      const { data } = await api.post<ApiResponse<unknown>>(`/reviews/staff/${detail.id}`, { rating, comment: comment.trim() })
      detailRequestGate.invalidate()
      staffRequestGate.invalidate()
      toast.success(data.message)
      publishDataChange('reviews', 'people', 'reports', 'notifications')
      await Promise.all([loadStaff(true), loadDetail(detail.id, true, true)])
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return <>
    <section className="hero-row review-directory-hero"><div><span className="eyebrow dark">GÓC NHÌN HỘI VIÊN</span><h2>Đánh giá nhân viên</h2><p>{member ? 'Xem hồ sơ, tham khảo trải nghiệm cộng đồng và chia sẻ đánh giá của bạn về PT hoặc Lễ tân.' : 'Theo dõi phản hồi của Hội viên dành cho đội ngũ đang vận hành phòng tập.'}</p></div></section>

    {!detail && <>
      <div className="card review-directory-tools">
        <div className="search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên hoặc chuyên môn..." /></div>
        <select value={filter} onChange={(event) => setFilter(event.target.value as StaffFilter)} aria-label="Lọc vai trò"><option value="ALL">Tất cả nhân viên</option><option value="TRAINER">Huấn luyện viên</option><option value="RECEPTIONIST">Lễ tân</option></select>
        <select value={sort} onChange={(event) => setSort(event.target.value as StaffSort)} aria-label="Sắp xếp"><option value="RATING">Sao cao nhất</option><option value="REVIEWS">Nhiều đánh giá nhất</option><option value="NAME">Tên A–Z</option></select>
      </div>
      <div className="review-staff-grid">{visible.map((item) => <button className="review-staff-card" key={item.id} onClick={() => selectStaff(item.id)}>
        <span className="review-staff-avatar">{item.fullName.slice(0, 1)}</span>
        <span className="status paid">{item.roles.some(({ role }) => role.code === 'TRAINER') ? 'Huấn luyện viên' : 'Lễ tân'}</span>
        <strong>{item.fullName}</strong>
        {item.trainerProfile?.specialties && <small>{item.trainerProfile.specialties}</small>}
        <span className="rating-summary"><Star /> <b>{item.rating.count ? item.rating.average?.toFixed(1) : '—'}</b><small>{item.rating.count} đánh giá</small></span>
        <em>{item.reviewedByCurrentMember ? 'Bạn đã đánh giá · Xem hoặc cập nhật' : member ? 'Xem hồ sơ · Viết đánh giá' : 'Xem tất cả đánh giá'}</em>
      </button>)}</div>
      {!visible.length && <div className="card compact-empty"><UserRound /><div><strong>Không tìm thấy nhân viên phù hợp</strong><p>Thử thay đổi từ khóa hoặc bộ lọc vai trò.</p></div></div>}
    </>}

    {detail && <section className="staff-review-detail">
      <button className="btn btn-ghost" onClick={closeDetail}><ArrowLeft /> Quay lại danh sách</button>
      <div className="card staff-profile-card">
        <div className="review-staff-avatar large">{detail.fullName.slice(0, 1)}</div>
        <div className="staff-profile-copy"><span className="eyebrow dark">HỒ SƠ NHÂN VIÊN</span><h3>{detail.fullName}</h3><p><ShieldCheck /> {detail.roles.map(({ role }) => role.name).join(', ')}</p>{detail.trainerProfile?.specialties && <p><BriefcaseBusiness /> {detail.trainerProfile.specialties}</p>}{detail.trainerProfile?.bio && <small>{detail.trainerProfile.bio}</small>}{member && detail.trainerProfile && <Link className="btn btn-primary profile-schedule-link" to="/schedule">Xem lịch trống và chọn tập</Link>}</div>
        <div className="profile-rating"><Star /><strong>{detail.rating.count ? detail.rating.average?.toFixed(1) : '—'}</strong><span>{detail.rating.count} đánh giá</span></div>
      </div>

      {member && <form className="card staff-review-form" onSubmit={saveReview}>
        <div><span className="eyebrow dark">{detail.myReview ? 'CẬP NHẬT ĐÁNH GIÁ' : 'CHIA SẺ ĐÁNH GIÁ'}</span><h3>Trải nghiệm của bạn với {detail.fullName}</h3><p>Mỗi Hội viên có một đánh giá cho mỗi nhân viên và có thể cập nhật khi cần.</p></div>
        <fieldset className="star-picker"><legend>Mức độ hài lòng</legend>{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} className={value <= rating ? 'selected' : ''} aria-label={`${value} sao`} onClick={() => setRating(value)}><Star /></button>)}<strong>{rating}/5 sao</strong></fieldset>
        <label>Nhận xét<textarea required minLength={3} maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Chia sẻ thái độ phục vụ, chuyên môn hoặc trải nghiệm của bạn..." /></label>
        <button className="btn btn-primary" disabled={busy}><MessageSquareText /> {busy ? 'Đang lưu...' : detail.myReview ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}</button>
      </form>}

      <div className="section-heading"><div><span className="eyebrow dark">PHẢN HỒI CỘNG ĐỒNG</span><h3>Các bài đánh giá</h3></div><span>{detail.reviews.length} bài</span></div>
      <div className="staff-review-list">{detail.reviews.map((review) => <article className="card staff-review-item" key={review.id}><div><span className="reviewer-avatar">{review.member.fullName.slice(0, 1)}</span><span><strong>{review.member.fullName}</strong><small>{formatAppDate(review.updatedAt)}</small></span><span className="review-stars"><Star /> {review.rating}/5</span></div><p>{review.comment}</p></article>)}</div>
      {!detail.reviews.length && <div className="card compact-empty"><MessageSquareText /><div><strong>Chưa có bài đánh giá</strong><p>{member ? 'Bạn có thể là người đầu tiên chia sẻ trải nghiệm.' : 'Đánh giá của Hội viên sẽ xuất hiện tại đây.'}</p></div></div>}
    </section>}
  </>
}
