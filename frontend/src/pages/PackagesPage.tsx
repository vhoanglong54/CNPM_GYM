import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Check, Dumbbell, Plus, ShieldCheck, ShoppingBag, Sparkles, UsersRound, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api, getErrorMessage, money } from '../lib/api'
import { publishDataChange, subscribeDataChanges } from '../lib/liveUpdates'
import { createRequestGate } from '../lib/requestGate'
import type { ApiResponse, MembershipPlan, Order, PtPackage } from '../types'

type PurchaseSelection = {
  productType: 'MEMBERSHIP' | 'PT_PACKAGE'
  productId: string
  name: string
  description?: string
  price: string | number
  detail: string
  idempotencyKey: string
}

export function PackagesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const owner = user?.roles.includes('OWNER')
  const member = user?.roles.includes('MEMBER')
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [pts, setPts] = useState<PtPackage[]>([])
  const [show, setShow] = useState(false)
  const [selection, setSelection] = useState<PurchaseSelection | null>(null)
  const [buying, setBuying] = useState(false)
  const buyingRef = useRef(false)
  const [requestGate] = useState(createRequestGate)

  /* oxlint-disable react/set-state-in-effect -- catalog is loaded and synchronized from the server */
  const load = useCallback(async (silent = false) => {
    const token = requestGate.begin()
    try {
      const [membershipResponse, ptResponse] = await Promise.all([
        api.get<ApiResponse<MembershipPlan[]>>(`/catalog/memberships${owner ? '?all=true' : ''}`),
        api.get<ApiResponse<PtPackage[]>>(`/catalog/pt-packages${owner ? '?all=true' : ''}`),
      ])
      if (!requestGate.canApply(token)) return
      setPlans(membershipResponse.data.data)
      setPts(ptResponse.data.data)
    } catch (error) {
      if (!silent) toast.error(getErrorMessage(error))
    }
  }, [owner, requestGate])

  useEffect(() => {
    void load()
    const refresh = () => { if (!document.hidden) void load(true) }
    const unsubscribe = subscribeDataChanges(['catalog'], refresh)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      unsubscribe()
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [load])
  /* oxlint-enable react/set-state-in-effect */

  useEffect(() => {
    if (!selection) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !buyingRef.current) setSelection(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selection])

  const selectMembership = (plan: MembershipPlan) => setSelection({
    productType: 'MEMBERSHIP',
    productId: plan.id,
    name: plan.name,
    description: plan.description,
    price: plan.price,
    detail: plan.type === 'DURATION'
      ? `${Math.round((plan.durationDays ?? 0) / 30)} tháng tập không giới hạn`
      : `${plan.visitLimit ?? 0} lượt tập`,
    idempotencyKey: crypto.randomUUID(),
  })

  const selectPtPackage = (pkg: PtPackage) => setSelection({
    productType: 'PT_PACKAGE',
    productId: pkg.id,
    name: pkg.name,
    description: pkg.description,
    price: pkg.price,
    detail: `${pkg.sessionCount} buổi tập cá nhân 1:1`,
    idempotencyKey: crypto.randomUUID(),
  })

  const confirmPurchase = async () => {
    if (!selection || buyingRef.current) return
    buyingRef.current = true
    setBuying(true)
    try {
      const { data } = await api.post<ApiResponse<Order>>('/orders', {
        productType: selection.productType,
        productId: selection.productId,
        idempotencyKey: selection.idempotencyKey,
      })
      toast.success(data.message || 'Đã tạo đơn chờ thanh toán.')
      publishDataChange('orders', 'dashboard')
      setSelection(null)
      navigate('/orders', { state: { createdOrderId: data.data.id } })
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      buyingRef.current = false
      setBuying(false)
    }
  }

  return <>
    <PageHead eyebrow="DANH MỤC DỊCH VỤ" title="Đầu tư cho phiên bản tốt hơn" text="Gói Gym tính theo tháng; gói PT tính theo số buổi hoàn thành.">
      {owner && <button className="btn btn-primary" onClick={() => setShow(!show)}><Plus /> Tạo gói mới</button>}
    </PageHead>
    {show && <CreatePlan onDone={() => { requestGate.invalidate(); setShow(false); void load() }} />}
    <div className="section-heading"><div><span className="eyebrow dark">GÓI HỘI VIÊN</span><h3>Quyền truy cập phòng tập</h3></div><span>{plans.length} lựa chọn</span></div>
    <div className="pricing-grid">{plans.map((plan, index) => <article className={`price-card ${index === 1 ? 'featured' : ''} ${!plan.isActive ? 'disabled-card' : ''}`} key={plan.id}>
      {index === 1 && <span className="popular"><Sparkles /> PHỔ BIẾN</span>}
      <div className="price-icon"><Dumbbell /></div><h3>{plan.name}</h3><p>{plan.description}</p><strong className="price">{money(plan.price)}</strong>
      <div className="benefits"><span><Check /> {plan.type === 'DURATION' ? `${Math.round((plan.durationDays || 0) / 30)} tháng không giới hạn` : `${plan.visitLimit} lượt tập`}</span><span><Check /> Gia hạn nối tiếp, không chồng ngày</span><span><Check /> Theo dõi lịch sử check-in</span></div>
      {member && <button className="btn btn-dark btn-wide" onClick={() => selectMembership(plan)} disabled={!plan.isActive || buying}>Chọn gói này</button>}
      {owner && <span className={`status ${plan.isActive ? 'paid' : 'cancelled'}`}>{plan.isActive ? 'Đang kinh doanh' : 'Đã ngừng'}</span>}
    </article>)}</div>
    <div className="section-heading spaced"><div><span className="eyebrow dark">HUẤN LUYỆN CÁ NHÂN</span><h3>Gói tập cùng PT</h3></div></div>
    <div className="pricing-grid compact">{pts.map((pkg) => <article className="price-card pt-card" key={pkg.id}>
      <div className="price-icon"><UsersRound /></div><h3>{pkg.name}</h3><p>{pkg.description}</p><strong className="price">{money(pkg.price)}</strong><div className="session-count"><b>{pkg.sessionCount}</b><span>buổi 1:1</span></div>
      {member && <button className="btn btn-dark btn-wide" onClick={() => selectPtPackage(pkg)} disabled={!pkg.isActive || buying}>Chọn gói PT</button>}
    </article>)}</div>
    {selection && <div className="purchase-modal-backdrop" onMouseDown={() => { if (!buying) setSelection(null) }}>
      <section className="purchase-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button purchase-modal-close" type="button" disabled={buying} onClick={() => setSelection(null)} aria-label="Đóng xác nhận mua gói"><X /></button>
        <div className="purchase-modal-icon"><ShoppingBag /></div><span className="eyebrow dark">XÁC NHẬN ĐĂNG KÝ</span><h2 id="purchase-title">{selection.name}</h2><p>{selection.description}</p>
        <div className="purchase-summary"><div><span>Quyền lợi</span><strong>{selection.detail}</strong></div><div><span>Số tiền</span><strong>{money(selection.price)}</strong></div></div>
        <div className="purchase-note"><ShieldCheck /><span>Bước này chỉ tạo đơn chờ thanh toán. Gói được kích hoạt sau khi Lễ tân hoặc Chủ phòng xác nhận thanh toán.</span></div>
        <div className="purchase-actions"><button type="button" className="btn btn-ghost" disabled={buying} onClick={() => setSelection(null)}>Chọn lại</button><button type="button" className="btn btn-primary" disabled={buying} onClick={() => void confirmPurchase()}>{buying ? 'Đang tạo đơn...' : 'Xác nhận mua gói'}</button></div>
      </section>
    </div>}
  </>
}

function PageHead({ eyebrow, title, text, children }: { eyebrow: string; title: string; text: string; children?: React.ReactNode }) {
  return <section className="hero-row"><div><span className="eyebrow dark">{eyebrow}</span><h2>{title}</h2><p>{text}</p></div><div className="hero-actions">{children}</div></section>
}

function CreatePlan({ onDone }: { onDone: () => void }) {
  const [type, setType] = useState<'MEMBERSHIP' | 'PT_PACKAGE'>('MEMBERSHIP')
  const [form, setForm] = useState({ name: '', description: '', price: '', duration: '1' })
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      const url = type === 'MEMBERSHIP' ? '/catalog/memberships' : '/catalog/pt-packages'
      const payload = type === 'MEMBERSHIP'
        ? { name: form.name, description: form.description, price: Number(form.price), type: 'DURATION', durationDays: Number(form.duration) * 30 }
        : { name: form.name, description: form.description, price: Number(form.price), sessionCount: Number(form.duration) }
      const { data } = await api.post<ApiResponse<unknown>>(url, payload)
      toast.success(data.message)
      publishDataChange('catalog')
      onDone()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }
  return <form className="card inline-form" onSubmit={submit}><label>Loại<select value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="MEMBERSHIP">Gói Gym theo tháng</option><option value="PT_PACKAGE">Gói PT theo buổi</option></select></label><label>Tên gói<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><label>Giá (VND)<input type="number" min="1" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required /></label>{type === 'MEMBERSHIP' ? <label>Thời hạn<select value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })}><option value="1">1 tháng</option><option value="2">2 tháng</option><option value="3">3 tháng</option></select></label> : <label>Số buổi<input type="number" min="1" value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} required /></label>}<button className="btn btn-primary" disabled={busy}><Plus /> {busy ? 'Đang lưu...' : 'Lưu gói'}</button></form>
}
