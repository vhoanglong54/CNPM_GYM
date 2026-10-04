import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck, Circle } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, getErrorMessage } from '../lib/api'
import { formatAppDateTime } from '../lib/dateTime'
import { publishDataChange, subscribeDataChanges } from '../lib/liveUpdates'
import { createRequestGate } from '../lib/requestGate'
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
  const busyRef = useRef(false)
  const [requestGate] = useState(createRequestGate)

  const load = useCallback(async (silent = false) => {
    const token = requestGate.begin()
    try {
      const { data } = await api.get<ApiResponse<NotificationResult>>('/notifications')
      if (requestGate.canApply(token)) setResult(data.data)
    } catch (error) {
      if (!silent) toast.error(getErrorMessage(error))
    }
  }, [requestGate])

  /* oxlint-disable-next-line react-hooks/exhaustive-deps -- polling intentionally reuses load */
  useEffect(() => {
    void load()
    const refresh = () => { if (!document.hidden) void load(true) }
    const timer = window.setInterval(refresh, 30_000)
    const unsubscribe = subscribeDataChanges(['notifications'], refresh)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      unsubscribe()
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [load])

  const read = async (item: NotificationItem) => {
    if (item.readAt || busyRef.current) return
    busyRef.current = true
    setBusy(item.id)
    requestGate.invalidate()
    setResult((current) => ({
      unreadCount: Math.max(0, current.unreadCount - 1),
      items: current.items.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry),
    }))
    try {
      await api.patch(`/notifications/${item.id}/read`)
      requestGate.invalidate()
      publishDataChange('notifications')
    } catch (error) {
      toast.error(getErrorMessage(error))
      void load(true)
    } finally {
      busyRef.current = false
      setBusy('')
    }
  }

  const readAll = async () => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy('all')
    requestGate.invalidate()
    setResult((current) => ({ unreadCount: 0, items: current.items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })) }))
    try {
      const { data } = await api.patch<ApiResponse<unknown>>('/notifications/read-all')
      requestGate.invalidate()
      toast.success(data.message)
      publishDataChange('notifications')
    } catch (error) {
      toast.error(getErrorMessage(error))
      void load(true)
    } finally {
      busyRef.current = false
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
