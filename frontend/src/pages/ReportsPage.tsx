import { useCallback, useEffect, useState } from 'react'
import { Banknote, BarChart3, Clock3, Dumbbell, RefreshCw, ShieldCheck, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, getErrorMessage, money } from '../lib/api'
import { formatAppDateTime } from '../lib/dateTime'
import { subscribeDataChanges } from '../lib/liveUpdates'
import { createRequestGate } from '../lib/requestGate'
import type { ApiResponse } from '../types'

interface OperationsReport {
  awaitingPayments: number
  totalRevenue: number
  revenueByMethod: Record<string, number>
  revenueByConfirmer: Array<{ id: string; fullName: string; email: string; amount: number; count: number }>
  todayCash: {
    amount: number
    count: number
    transactions: Array<{
      id: string
      amount: string | number
      paidAt: string
      transactionCode: string
      confirmedBy?: { fullName: string; email: string }
      order: { orderNumber: string; member: { fullName: string } }
    }>
  }
  bookingStatusCounts: Record<string, number>
  trainerPerformance: Array<{
    id: string
    trainerCode: string
    fullName: string
    email: string
    ratingAverage?: number
    ratingCount: number
    completed: number
    cancelled: number
    rejected: number
    noShow: number
  }>
  recentAuditLogs: Array<{
    id: string
    action: string
    entityType: string
    entityId?: string
    createdAt: string
    actor?: { fullName: string; email: string }
  }>
}

export function ReportsPage() {
  const [report, setReport] = useState<OperationsReport | null>(null)
  const [requestGate] = useState(createRequestGate)
  const load = useCallback(async (silent = false) => {
    const token = requestGate.begin()
    try {
      const { data } = await api.get<ApiResponse<OperationsReport>>('/reports/operations')
      if (requestGate.canApply(token)) setReport(data.data)
    } catch (error) {
      if (!silent) toast.error(getErrorMessage(error))
    }
  }, [requestGate])
  /* oxlint-disable react/set-state-in-effect -- reports stay synchronized with transactions and PT actions */
  useEffect(() => {
    void load()
    const refresh = () => { if (!document.hidden) void load(true) }
    const timer = window.setInterval(refresh, 30_000)
    const unsubscribe = subscribeDataChanges(['reports', 'orders', 'schedule', 'checkins', 'reviews'], refresh)
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
  if (!report) return <div className="loading-card">Đang tổng hợp báo cáo...</div>

  return <>
    <section className="hero-row"><div><span className="eyebrow dark">KIỂM SOÁT VẬN HÀNH</span><h2>Báo cáo & đối soát</h2><p>Doanh thu, tiền mặt trong ngày, hiệu suất PT và nhật ký thao tác.</p></div><button className="btn btn-ghost" onClick={() => void load()}><RefreshCw /> Làm mới</button></section>
    <section className="metric-grid report-metrics">
      <ReportMetric icon={Banknote} label="Tổng doanh thu" value={money(report.totalRevenue)} />
      <ReportMetric icon={Clock3} label="Chuyển khoản chờ duyệt" value={report.awaitingPayments} />
      <ReportMetric icon={ShieldCheck} label="Tiền mặt hôm nay" value={money(report.todayCash.amount)} />
      <ReportMetric icon={Dumbbell} label="Buổi PT hoàn thành" value={report.bookingStatusCounts.COMPLETED ?? 0} />
    </section>

    <section className="report-grid">
      <div className="card table-card"><div className="card-heading report-heading"><div><span className="eyebrow dark">ĐỐI SOÁT CA</span><h3>Tiền mặt hôm nay</h3></div><b>{report.todayCash.count} giao dịch</b></div><div className="table-wrap"><table><thead><tr><th>Đơn hàng</th><th>Hội viên</th><th>Người thu</th><th>Thời gian</th><th>Số tiền</th></tr></thead><tbody>{report.todayCash.transactions.map((item) => <tr key={item.id}><td>{item.order.orderNumber}<small>{item.transactionCode}</small></td><td>{item.order.member.fullName}</td><td>{item.confirmedBy?.fullName ?? '—'}<small>{item.confirmedBy?.email}</small></td><td>{formatAppDateTime(item.paidAt)}</td><td><strong>{money(item.amount)}</strong></td></tr>)}</tbody></table>{!report.todayCash.transactions.length && <div className="mini-empty">Chưa có giao dịch tiền mặt hôm nay.</div>}</div></div>

      <div className="card table-card"><div className="card-heading report-heading"><div><span className="eyebrow dark">TRÁCH NHIỆM XÁC NHẬN</span><h3>Doanh thu theo nhân viên</h3></div></div><div className="table-wrap"><table><thead><tr><th>Nhân viên</th><th>Số giao dịch</th><th>Tổng xác nhận</th></tr></thead><tbody>{report.revenueByConfirmer.map((item) => <tr key={item.id}><td><strong>{item.fullName}</strong><small>{item.email}</small></td><td>{item.count}</td><td><strong>{money(item.amount)}</strong></td></tr>)}</tbody></table></div></div>
    </section>

    <div className="card table-card"><div className="card-heading report-heading"><div><span className="eyebrow dark">CHẤT LƯỢNG HUẤN LUYỆN</span><h3>Hiệu suất PT</h3></div></div><div className="table-wrap"><table><thead><tr><th>PT</th><th>Đánh giá</th><th>Hoàn thành</th><th>Hủy</th><th>Từ chối</th><th>Vắng mặt</th></tr></thead><tbody>{report.trainerPerformance.map((item) => <tr key={item.id}><td><strong>{item.fullName}</strong><small>{item.trainerCode} · {item.email}</small></td><td><span className="report-rating"><Star /> {item.ratingCount ? `${item.ratingAverage?.toFixed(1)} (${item.ratingCount})` : 'Chưa có'}</span></td><td>{item.completed}</td><td>{item.cancelled}</td><td>{item.rejected}</td><td>{item.noShow}</td></tr>)}</tbody></table></div></div>

    <div className="card audit-list"><div className="card-heading"><div><span className="eyebrow dark">TRUY VẾT THAO TÁC</span><h3>Nhật ký gần đây</h3></div></div>{report.recentAuditLogs.map((item) => <div className="audit-row" key={item.id}><BarChart3 /><div><strong>{item.action}</strong><small>{item.actor?.fullName ?? 'Hệ thống'} · {item.entityType}{item.entityId ? ` #${item.entityId.slice(0, 8)}` : ''}</small></div><time>{formatAppDateTime(item.createdAt)}</time></div>)}</div>
  </>
}

function ReportMetric({ icon: Icon, label, value }: { icon: typeof Banknote; label: string; value: string | number }) {
  return <div className="metric-card"><div className="metric-icon"><Icon /></div><span>{label}</span><strong>{value}</strong></div>
}
