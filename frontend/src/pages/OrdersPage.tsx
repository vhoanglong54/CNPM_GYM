import { useEffect, useMemo, useState } from 'react'
import {
  Banknote,
  CheckCircle2,
  Clock3,
  Download,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingBag,
  XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { api, getErrorMessage, money } from '../lib/api'
import type { ApiResponse, Order } from '../types'

type OrderFilter = 'ALL' | Order['status']

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
  const [orders, setOrders] = useState<Order[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<OrderFilter>('ALL')
  const [busy, setBusy] = useState('')
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const isStaff = user?.roles.some((role) => role === 'OWNER' || role === 'RECEPTIONIST')

  const load = (silent = false) => api.get<ApiResponse<Order[]>>('/orders')
    .then(({ data }) => {
      setOrders(data.data)
      setLastSyncedAt(new Date())
    })
    .catch((error) => {
      if (!silent) toast.error(getErrorMessage(error))
    })

  /* oxlint-disable-next-line react-hooks/exhaustive-deps -- polling intentionally reuses load */
  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(true), 5000)
    return () => window.clearInterval(timer)
  }, [])

  const pay = async (order: Order) => {
    const action = isStaff ? 'xác nhận đã thu tiền' : 'xác nhận thanh toán'
    if (!window.confirm(`Bạn muốn ${action} cho đơn ${order.orderNumber}?`)) return
    setBusy(order.id)
    try {
      const { data } = await api.post<ApiResponse<unknown>>(`/orders/${order.id}/pay`, {
        method: isStaff ? 'CASH' : 'TRANSFER_DEMO',
      })
      toast.success(data.message)
      await load(true)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setBusy('')
    }
  }

  const cancel = async (order: Order) => {
    if (!window.confirm(`Hủy đơn ${order.orderNumber}? Thao tác này không thể hoàn tác.`)) return
    setBusy(order.id)
    try {
      const { data } = await api.patch<ApiResponse<unknown>>(`/orders/${order.id}/cancel`)
      toast.success(data.message)
      await load(true)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
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
    paid: orders.filter((order) => order.status === 'PAID').length,
    cancelled: orders.filter((order) => order.status === 'CANCELLED').length,
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
      <Summary icon={Clock3} label="Chờ thanh toán" value={counts.pending} tone="pending" />
      <Summary icon={CheckCircle2} label="Đã thanh toán" value={counts.paid} tone="paid" />
      <Summary icon={XCircle} label="Đã hủy" value={counts.cancelled} tone="cancelled" />
      <Summary icon={Banknote} label="Tổng đã thanh toán" value={money(counts.revenue)} tone="revenue" />
    </section>

    <div className="card process-guide">
      <div><span>1</span><strong>Đăng ký gói</strong><small>Hội viên chọn gói phù hợp</small></div>
      <i />
      <div><span>2</span><strong>Chờ thanh toán</strong><small>Đơn xuất hiện cho hội viên và nhân viên</small></div>
      <i />
      <div><span>3</span><strong>Xác nhận</strong><small>Hội viên chuyển khoản hoặc nhân viên xác nhận thu</small></div>
      <i />
      <div><span>4</span><strong>Kích hoạt quyền lợi</strong><small>Gói tập được cấp tự động</small></div>
    </div>

    <div className="card table-card orders-table-card">
      <div className="table-tools order-tools">
        <div className="search"><Search /><input placeholder="Tìm mã đơn, hội viên hoặc gói..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <div className="order-filter">{filters.map((item) => <button key={item.value} className={filter === item.value ? 'active' : ''} onClick={() => setFilter(item.value)}>{item.label}<span>{item.value === 'ALL' ? orders.length : orders.filter((order) => order.status === item.value).length}</span></button>)}</div>
        <small className="sync-note">Tự đồng bộ mỗi 5 giây{lastSyncedAt ? ` · ${lastSyncedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}</small>
      </div>
      <div className="table-wrap">
        <table className="orders-table"><thead><tr><th>Đơn hàng</th><th>Hội viên</th><th>Gói</th><th>Số tiền</th><th>Tiến trình</th><th>Thao tác</th></tr></thead>
          <tbody>{visible.map((order) => <tr key={order.id}>
            <td><strong>{order.orderNumber}</strong><small>{new Date(order.createdAt).toLocaleString('vi-VN')}</small></td>
            <td><strong>{order.member.fullName}</strong><small>{order.member.email}</small></td>
            <td><strong>{order.items[0]?.productName}</strong><small>{order.items[0]?.productType === 'PT_PACKAGE' ? 'Gói huấn luyện cá nhân' : 'Gói hội viên'}</small></td>
            <td><b>{money(order.totalAmount)}</b></td>
            <td><OrderFlow order={order} /></td>
            <td><div className="row-actions order-actions">
              {order.status === 'PENDING' && <button className="btn btn-small btn-primary" disabled={busy === order.id} onClick={() => void pay(order)}><Banknote /> {isStaff ? 'Xác nhận thu' : 'Thanh toán'}</button>}
              {order.status === 'PENDING' && <button className="icon-action bad" disabled={busy === order.id} title="Hủy đơn" onClick={() => void cancel(order)}><XCircle /></button>}
              {order.status === 'PAID' && <button className="btn btn-small btn-ghost" onClick={() => void receipt(order)}><Download /> Phiếu thu</button>}
            </div></td>
          </tr>)}</tbody>
        </table>
        {!visible.length && <div className="empty-state"><ReceiptText /><h3>Không có giao dịch phù hợp</h3><p>Thử chọn trạng thái khác hoặc xóa nội dung tìm kiếm.</p></div>}
      </div>
    </div>
  </>
}

function Summary({ icon: Icon, label, value, tone }: { icon: typeof Clock3; label: string; value: string | number; tone: string }) {
  return <div className={`order-summary-card ${tone}`}><span><Icon /></span><div><strong>{value}</strong><small>{label}</small></div></div>
}

function OrderFlow({ order }: { order: Order }) {
  const isPaid = order.status === 'PAID'
  const isCancelled = order.status === 'CANCELLED'
  return <div className={`order-flow ${order.status.toLowerCase()}`} title={statusLabel[order.status]}>
    <div className="done"><span><ShoppingBag /></span><small>Đã đăng ký</small></div><i />
    <div className={isCancelled ? 'muted' : 'done'}><span><Clock3 /></span><small>Chờ thanh toán</small></div><i />
    <div className={isPaid ? 'done' : isCancelled ? 'cancelled' : 'current'}><span>{isCancelled ? <XCircle /> : isPaid ? <PackageCheck /> : <Banknote />}</span><small>{isCancelled ? 'Đã hủy' : isPaid ? 'Hoàn tất' : 'Đang chờ'}</small></div>
  </div>
}
