import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Banknote,
  CheckCircle2,
  Clock3,
  Download,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  X,
  XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api, getErrorMessage, money } from '../lib/api'
import { formatAppDateTime, formatAppTime } from '../lib/dateTime'
import { publishDataChange, subscribeDataChanges } from '../lib/liveUpdates'
import type { ApiResponse, Order, OrderPayment } from '../types'

type OrderFilter = 'ALL' | Order['status']
type PaymentActionResult = { orderId: string; status: Order['status']; payment: OrderPayment }

const statusLabel: Record<Order['status'], string> = {
  PENDING: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  CANCELLED: 'Đã hủy',
}

const filters: Array<{ value: OrderFilter; label: string }> = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'PENDING', label: 'Chờ thanh toán' },
  { value: 'PAID', label: 'Đã thanh toán' },
  { value: 'CANCELLED', label: 'Đã hủy' },
]

export function OrdersPage() {
  const { user } = useAuth()
  const location = useLocation()
  const [orders, setOrders] = useState<Order[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<OrderFilter>('ALL')
  const [busy, setBusy] = useState('')
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null)
  const busyRef = useRef('')
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const loadRequestRef = useRef(0)
  const lastAppliedRequestRef = useRef(0)
  const dataVersionRef = useRef(0)
  const isStaff = user?.roles.some((role) => role === 'OWNER' || role === 'RECEPTIONIST')
  const createdOrderId = (location.state as { createdOrderId?: string } | null)?.createdOrderId

  const load = useCallback(async (silent = false) => {
    const requestId = ++loadRequestRef.current
    const dataVersion = dataVersionRef.current
    try {
      const { data } = await api.get<ApiResponse<Order[]>>('/orders')
      if (dataVersion !== dataVersionRef.current || requestId < lastAppliedRequestRef.current) return
      lastAppliedRequestRef.current = requestId
      setOrders(data.data)
      setLastSyncedAt(new Date())
    } catch (error) {
      if (!silent) toast.error(getErrorMessage(error))
    }
  }, [])

  const applyPayment = (orderId: string, payment: OrderPayment, status?: Order['status']) => {
    setOrders((current) => current.map((order) => order.id === orderId ? {
      ...order,
      status: status ?? order.status,
      payments: [payment, ...order.payments.filter((item) => item.id !== payment.id)],
    } : order))
  }

  /* oxlint-disable react/set-state-in-effect -- effect loads server state and registers live refresh */
  useEffect(() => {
    void load()
    const timer = window.setInterval(() => { if (!document.hidden) void load(true) }, 30_000)
    const refreshVisiblePage = () => { if (!document.hidden) void load(true) }
    const unsubscribe = subscribeDataChanges(['orders'], refreshVisiblePage)
    window.addEventListener('focus', refreshVisiblePage)
    document.addEventListener('visibilitychange', refreshVisiblePage)
    return () => {
      window.clearInterval(timer)
      unsubscribe()
      window.removeEventListener('focus', refreshVisiblePage)
      document.removeEventListener('visibilitychange', refreshVisiblePage)
    }
  }, [load])
  /* oxlint-enable react/set-state-in-effect */

  const pay = async (order: Order, method: OrderPayment['method']) => {
    if (busyRef.current) return
    busyRef.current = order.id
    setBusy(order.id)
    dataVersionRef.current += 1
    try {
      const { data } = await api.post<ApiResponse<PaymentActionResult>>(`/orders/${order.id}/pay`, {
        method,
      })
      dataVersionRef.current += 1
      applyPayment(order.id, data.data.payment, data.data.status)
      setPaymentOrder(null)
      toast.success(data.message)
      publishDataChange('orders', 'profile', 'dashboard', 'reports', 'notifications')
      void load(true)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      busyRef.current = ''
      setBusy('')
    }
  }

  const confirmPayment = async (order: Order, payment: OrderPayment) => {
    const methodLabel = payment.method === 'CASH' ? 'đã thu tiền mặt' : 'đã nhận chuyển khoản'
    if (!window.confirm(`Xác nhận ${methodLabel} cho đơn ${order.orderNumber}? Quyền lợi sẽ được kích hoạt ngay.`)) return
    if (busyRef.current) return
    busyRef.current = order.id
    setBusy(order.id)
    dataVersionRef.current += 1
    try {
      const { data } = await api.patch<ApiResponse<PaymentActionResult>>(`/orders/${order.id}/payments/${payment.id}/confirm`)
      dataVersionRef.current += 1
      applyPayment(order.id, data.data.payment, data.data.status)
      toast.success(data.message)
      publishDataChange('orders', 'profile', 'dashboard', 'reports', 'notifications')
      void load(true)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      busyRef.current = ''
      setBusy('')
    }
  }

  const rejectPayment = async (order: Order, payment: OrderPayment) => {
    const methodLabel = payment.method === 'CASH' ? 'thanh toán tiền mặt' : 'chuyển khoản'
    const reason = window.prompt(`Lý do từ chối ${methodLabel} của đơn ${order.orderNumber}:`)
    if (reason === null) return
    if (reason.trim().length < 3) {
      toast.error('Vui lòng nhập lý do từ chối rõ ràng.')
      return
    }
    if (busyRef.current) return
    busyRef.current = order.id
    setBusy(order.id)
    dataVersionRef.current += 1
    try {
      const { data } = await api.patch<ApiResponse<OrderPayment>>(`/orders/${order.id}/payments/${payment.id}/reject`, { reason: reason.trim() })
      dataVersionRef.current += 1
      applyPayment(order.id, data.data)
      toast.success(data.message)
      publishDataChange('orders', 'dashboard', 'reports', 'notifications')
      void load(true)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      busyRef.current = ''
      setBusy('')
    }
  }

  const cancel = async (order: Order) => {
    if (!window.confirm(`Hủy đơn ${order.orderNumber}? Thao tác này không thể hoàn tác.`)) return
    if (busyRef.current) return
    busyRef.current = order.id
    setBusy(order.id)
    dataVersionRef.current += 1
    setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: 'CANCELLED' } : item))
    try {
      const { data } = await api.patch<ApiResponse<{ status: Order['status'] }>>(`/orders/${order.id}/cancel`)
      dataVersionRef.current += 1
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: data.data.status } : item))
      toast.success(data.message)
      publishDataChange('orders', 'dashboard', 'reports')
      void load(true)
    } catch (error) {
      dataVersionRef.current += 1
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: order.status } : item))
      toast.error(getErrorMessage(error))
      void load(true)
    } finally {
      busyRef.current = ''
      setBusy('')
    }
  }

  const receipt = async (order: Order) => {
    try {
      const { data } = await api.get(`/orders/${order.id}/receipt`, { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      window.open(url, '_blank')
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const counts = useMemo(() => ({
    pending: orders.filter((order) => order.status === 'PENDING').length,
    awaiting: orders.filter((order) => order.payments.some((payment) => payment.status === 'AWAITING_CONFIRMATION')).length,
    paid: orders.filter((order) => order.status === 'PAID').length,
    revenue: orders.filter((order) => order.status === 'PAID').reduce((sum, order) => sum + Number(order.totalAmount), 0),
  }), [orders])

  const visible = useMemo(() => orders.filter((order) => {
    const matchesFilter = filter === 'ALL' || order.status === filter
    const searchValue = `${order.orderNumber} ${order.member.fullName} ${order.member.email} ${order.items[0]?.productName}`.toLowerCase()
    return matchesFilter && searchValue.includes(query.toLowerCase())
  }), [filter, orders, query])

  return <>
    <section className="hero-row orders-hero">
      <div><span className="eyebrow dark">THEO DÕI ĐƠN HÀNG</span><h2>Giao dịch & phiếu thu</h2><p>{isStaff ? 'Theo dõi đơn mới và xác nhận thanh toán của toàn bộ hội viên.' : 'Theo dõi từ lúc đăng ký gói đến khi quyền lợi được kích hoạt.'}</p></div>
      <button className="btn btn-ghost" onClick={() => void load()}><RefreshCw /> Làm mới</button>
    </section>

    <section className="order-summary" aria-label="Tổng quan giao dịch">
      <Summary icon={Clock3} label="Đơn đang chờ xử lý" value={counts.pending} tone="pending" />
      <Summary icon={ShieldCheck} label="Thanh toán chờ duyệt" value={counts.awaiting} tone="awaiting" />
      <Summary icon={CheckCircle2} label="Đã thanh toán" value={counts.paid} tone="paid" />
      <Summary icon={Banknote} label="Tổng đã thanh toán" value={money(counts.revenue)} tone="revenue" />
    </section>

    <div className="card process-guide">
      <div><span>1</span><strong>Đăng ký gói</strong><small>Hội viên chọn gói phù hợp</small></div>
      <i />
      <div><span>2</span><strong>Hội viên xác nhận</strong><small>Chọn chuyển khoản hoặc tiền mặt tại quầy</small></div>
      <i />
      <div><span>3</span><strong>Nhân viên xác nhận thu</strong><small>Chỉ xử lý yêu cầu Hội viên đã gửi</small></div>
      <i />
      <div><span>4</span><strong>Kích hoạt quyền lợi</strong><small>Gói tập được cấp tự động</small></div>
    </div>

    <div className="card table-card orders-table-card">
      <div className="table-tools order-tools">
        <div className="search"><Search /><input placeholder="Tìm mã đơn, hội viên hoặc gói..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <div className="order-filter">{filters.map((item) => <button key={item.value} className={filter === item.value ? 'active' : ''} onClick={() => setFilter(item.value)}>{item.label}<span>{item.value === 'ALL' ? orders.length : orders.filter((order) => order.status === item.value).length}</span></button>)}</div>
        <small className="sync-note">Tự đồng bộ mỗi 5 giây{lastSyncedAt ? ` · ${formatAppTime(lastSyncedAt, true)}` : ''}</small>
      </div>
      <div className="table-wrap">
        <table className="orders-table"><thead><tr><th>Đơn hàng</th><th>Hội viên</th><th>Gói</th><th>Số tiền</th><th>Tiến trình</th><th>Thao tác</th></tr></thead>
          <tbody>{visible.map((order) => {
            const awaitingPayment = order.payments.find((payment) => payment.status === 'AWAITING_CONFIRMATION')
            const latestPayment = order.payments[0]
            return <tr key={order.id} className={order.id === createdOrderId ? 'new-order' : undefined}>
            <td><strong>{order.orderNumber}</strong><small>{formatAppDateTime(order.createdAt)}</small></td>
            <td><strong>{order.member.fullName}</strong><small>{order.member.email}</small></td>
            <td><strong>{order.items[0]?.productName}</strong><small>{order.items[0]?.productType === 'PT_PACKAGE' ? 'Gói huấn luyện cá nhân' : 'Gói hội viên'}</small></td>
            <td><b>{money(order.totalAmount)}</b></td>
            <td><OrderFlow order={order} />{latestPayment?.status === 'REJECTED' && <small className="payment-reason">Bị từ chối: {latestPayment.rejectionReason}</small>}{latestPayment?.status === 'EXPIRED' && <small className="payment-reason">Yêu cầu cũ đã hết hạn</small>}</td>
            <td><div className="row-actions order-actions">
              {order.status === 'PENDING' && isStaff && awaitingPayment && <><button className="btn btn-small btn-confirm" disabled={busy === order.id} onClick={() => void confirmPayment(order, awaitingPayment)}><CheckCircle2 /> {busy === order.id ? 'Đang xác nhận...' : awaitingPayment.method === 'CASH' ? 'Xác nhận đã thu' : 'Xác nhận đã nhận CK'}</button><button className="btn btn-small btn-danger" disabled={busy === order.id} onClick={() => void rejectPayment(order, awaitingPayment)}><XCircle /> Từ chối</button></>}
              {order.status === 'PENDING' && isStaff && !awaitingPayment && <span className="status pending"><Clock3 /> Chờ Hội viên xác nhận</span>}
              {order.status === 'PENDING' && !isStaff && !awaitingPayment && <button className="btn btn-small btn-primary" disabled={busy === order.id} onClick={() => setPaymentOrder(order)}><Banknote /> Xác nhận thanh toán</button>}
              {order.status === 'PENDING' && !isStaff && awaitingPayment && <span className="status pending"><Clock3 /> Chờ Lễ tân/Chủ phòng</span>}
              {order.status === 'PENDING' && <button className="icon-action bad" disabled={busy === order.id} title="Hủy đơn" onClick={() => void cancel(order)}><XCircle /></button>}
              {order.status === 'PAID' && <button className="btn btn-small btn-ghost" onClick={() => void receipt(order)}><Download /> Phiếu thu</button>}
            </div></td>
          </tr>})}</tbody>
        </table>
        {!visible.length && <div className="empty-state"><ReceiptText /><h3>Không có giao dịch phù hợp</h3><p>Thử chọn trạng thái khác hoặc xóa nội dung tìm kiếm.</p></div>}
      </div>
    </div>
    {paymentOrder && <div className="purchase-modal-backdrop" onMouseDown={() => { if (!busy) setPaymentOrder(null) }}>
      <section className="purchase-modal payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button purchase-modal-close" type="button" disabled={busy === paymentOrder.id} onClick={() => setPaymentOrder(null)} aria-label="Đóng xác nhận thanh toán"><X /></button>
        <div className="purchase-modal-icon"><Banknote /></div><span className="eyebrow dark">XÁC NHẬN THANH TOÁN</span><h2 id="payment-title">{paymentOrder.orderNumber}</h2><p>Hãy chọn đúng phương thức bạn đã dùng. Lễ tân hoặc Chủ phòng chỉ có thể xác nhận thu sau bước này.</p>
        <div className="purchase-summary"><div><span>Gói đăng ký</span><strong>{paymentOrder.items[0]?.productName}</strong></div><div><span>Số tiền</span><strong>{money(paymentOrder.totalAmount)}</strong></div></div>
        <div className="payment-method-actions">
          <button className="payment-method-option" type="button" disabled={busy === paymentOrder.id} onClick={() => void pay(paymentOrder, 'TRANSFER_DEMO')}><ShieldCheck /><span><strong>Tôi đã chuyển khoản</strong><small>Gửi yêu cầu để nhân viên đối chiếu và xác nhận.</small></span></button>
          <button className="payment-method-option" type="button" disabled={busy === paymentOrder.id} onClick={() => void pay(paymentOrder, 'CASH')}><Banknote /><span><strong>Tôi đã trả tiền mặt</strong><small>Chỉ chọn sau khi đã giao tiền tại quầy.</small></span></button>
        </div>
        <div className="purchase-note"><ShieldCheck /><span>Đơn vẫn ở trạng thái chờ và chưa kích hoạt gói cho đến khi Lễ tân/Chủ phòng xác nhận đã thu.</span></div>
      </section>
    </div>}
  </>
}

function Summary({ icon: Icon, label, value, tone }: { icon: typeof Clock3; label: string; value: string | number; tone: string }) {
  return <div className={`order-summary-card ${tone}`}><span><Icon /></span><div><strong>{value}</strong><small>{label}</small></div></div>
}

function OrderFlow({ order }: { order: Order }) {
  const isPaid = order.status === 'PAID'
  const isCancelled = order.status === 'CANCELLED'
  const payment = order.payments[0]
  const awaiting = payment?.status === 'AWAITING_CONFIRMATION'
  const needsRetry = payment?.status === 'REJECTED' || payment?.status === 'EXPIRED'
  return <div className={`order-flow ${order.status.toLowerCase()}`} title={statusLabel[order.status]}>
    <div className="done"><span><ShoppingBag /></span><small>Đã đăng ký</small></div><i />
    <div className={isCancelled ? 'muted' : 'done'}><span><Clock3 /></span><small>Chờ thanh toán</small></div><i />
    <div className={isPaid ? 'done' : isCancelled ? 'cancelled' : 'current'}><span>{isCancelled ? <XCircle /> : isPaid ? <PackageCheck /> : awaiting ? <ShieldCheck /> : <Banknote />}</span><small>{isCancelled ? 'Đã hủy' : isPaid ? 'Hoàn tất' : awaiting ? 'Chờ nhân viên' : needsRetry ? 'Cần gửi lại' : 'Chưa thanh toán'}</small></div>
  </div>
}
