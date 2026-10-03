import { useEffect, useState } from 'react'
import { Bell, CheckCheck, Circle } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, getErrorMessage } from '../lib/api'
import { formatAppDateTime } from '../lib/dateTime'
import type { ApiResponse } from '../types'

interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  readAt?: string
  createdAt: string
}

interface NotificationResult {
  items: NotificationItem[]
  unreadCount: number
}

export function NotificationsPage() {
  const [result, setResult] = useState<NotificationResult>({ items: [], unreadCount: 0 })
  const [busy, setBusy] = useState('')

  const load = (silent = false) => api.get<ApiResponse<NotificationResult>>('/notifications')
    .then(({ data }) => setResult(data.data))
    .catch((error) => { if (!silent) toast.error(getErrorMessage(error)) })

  /* oxlint-disable-next-line react-hooks/exhaustive-deps -- polling intentionally reuses load */
  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(true), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  const read = async (item: NotificationItem) => {
    if (item.readAt) return
    setBusy(item.id)
    try {
      await api.patch(`/notifications/${item.id}/read`)
      await load(true)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setBusy('')
    }
  }

  const readAll = async () => {
    setBusy('all')
    try {
      const { data } = await api.patch<ApiResponse<unknown>>('/notifications/read-all')
      toast.success(data.message)
      await load(true)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setBusy('')
    }
  }

  return <>
    <section className="hero-row">
      <div><span className="eyebrow dark">TRUNG TÂM THÔNG BÁO</span><h2>Thông báo công việc</h2><p>Theo dõi xác nhận thanh toán, thay đổi lịch PT và đánh giá mới.</p></div>
      <button className="btn btn-ghost" disabled={!result.unreadCount || busy === 'all'} onClick={() => void readAll()}><CheckCheck /> Đánh dấu đã đọc tất cả</button>
    </section>
    <div className="notification-summary"><Bell /><strong>{result.unreadCount}</strong><span>thông báo chưa đọc</span></div>
    <div className="card notification-list">
      {result.items.length ? result.items.map((item) => <button type="button" className={`notification-row ${item.readAt ? 'read' : 'unread'}`} key={item.id} disabled={busy === item.id} onClick={() => void read(item)}>
        <span className="notification-dot">{item.readAt ? <CheckCheck /> : <Circle />}</span>
        <span className="notification-content"><strong>{item.title}</strong><span>{item.message}</span><small>{formatAppDateTime(item.createdAt)}</small></span>
      </button>) : <div className="empty-state"><Bell /><h3>Chưa có thông báo</h3><p>Các thay đổi cần chú ý sẽ xuất hiện tại đây.</p></div>}
    </div>
  </>
}
