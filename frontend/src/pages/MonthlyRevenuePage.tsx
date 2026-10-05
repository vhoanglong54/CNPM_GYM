import { useCallback, useEffect, useMemo, useState } from 'react'
import { Banknote, BarChart3, CalendarDays, Hash, RefreshCw, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, getErrorMessage, money } from '../lib/api'
import { appTodayKey } from '../lib/dateTime'
import { subscribeDataChanges } from '../lib/liveUpdates'
import { createRequestGate } from '../lib/requestGate'
import type { ApiResponse } from '../types'

interface MonthlyRevenue {
  year: number
  totalRevenue: number
  totalTransactions: number
  averageMonthlyRevenue: number
  bestMonth: { month: number; amount: number } | null
  months: Array<{
    month: number
    label: string
    amount: number
    count: number
    cash: number
    transfer: number
  }>
}

const currentYear = Number(appTodayKey().slice(0, 4))
const availableYears = Array.from({ length: 7 }, (_, index) => currentYear - index)

export function MonthlyRevenuePage() {
  const [year, setYear] = useState(currentYear)
  const [report, setReport] = useState<MonthlyRevenue | null>(null)
  const [loading, setLoading] = useState(true)
  const [requestGate] = useState(createRequestGate)

  const load = useCallback(async (silent = false) => {
    const token = requestGate.begin()
    if (!silent) setLoading(true)
    try {
      const { data } = await api.get<ApiResponse<MonthlyRevenue>>(`/reports/monthly-revenue?year=${year}`)
      if (requestGate.canApply(token)) setReport(data.data)
    } catch (error) {
      if (!silent) toast.error(getErrorMessage(error))
    } finally {
      if (requestGate.canApply(token)) setLoading(false)
    }
  }, [requestGate, year])

  /* oxlint-disable react/set-state-in-effect -- revenue stays synchronized with confirmed payments */
  useEffect(() => {
    void load()
    const refresh = () => { if (!document.hidden) void load(true) }
    const timer = window.setInterval(refresh, 30_000)
    const unsubscribe = subscribeDataChanges(['reports', 'orders'], refresh)
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

  const maxRevenue = useMemo(() => Math.max(...(report?.months.map((month) => month.amount) ?? [0]), 1), [report])

  if (loading && !report) return <div className="loading-card">Đang tổng hợp doanh thu theo tháng...</div>
  if (!report) return <div className="loading-card">Chưa thể tải báo cáo doanh thu.</div>

  return <>
    <section className="hero-row monthly-revenue-hero">
      <div><span className="eyebrow dark">TÀI CHÍNH CHỦ PHÒNG</span><h2>Doanh thu theo tháng</h2><p>Chỉ tổng hợp các khoản thanh toán đã xác nhận thu, dựa trên thời điểm thanh toán thực tế.</p></div>
      <div className="monthly-revenue-actions"><label>Năm báo cáo<select value={year} onChange={(event) => { setReport(null); setYear(Number(event.target.value)) }}>{availableYears.map((item) => <option value={item} key={item}>{item}</option>)}</select></label><button className="btn btn-ghost" disabled={loading} onClick={() => void load()}><RefreshCw /> {loading ? 'Đang tải...' : 'Làm mới'}</button></div>
    </section>

    <section className="metric-grid report-metrics">
      <RevenueMetric icon={Banknote} label={`Tổng doanh thu ${report.year}`} value={money(report.totalRevenue)} />
      <RevenueMetric icon={Hash} label="Giao dịch đã thu" value={report.totalTransactions} />
      <RevenueMetric icon={BarChart3} label="Trung bình mỗi tháng" value={money(report.averageMonthlyRevenue)} />
      <RevenueMetric icon={TrendingUp} label="Tháng cao nhất" value={report.bestMonth ? `Tháng ${report.bestMonth.month} · ${money(report.bestMonth.amount)}` : 'Chưa có dữ liệu'} />
    </section>

    <section className="card monthly-revenue-chart-card">
      <div className="card-heading"><div><span className="eyebrow dark">BIỂU ĐỒ 12 THÁNG</span><h3>Doanh thu năm {report.year}</h3></div><small>Đơn vị: VNĐ</small></div>
      <div className="monthly-revenue-chart" role="img" aria-label={`Biểu đồ doanh thu 12 tháng năm ${report.year}`}>
        {report.months.map((month) => <div className="monthly-revenue-column" key={month.month} title={`${month.label}: ${money(month.amount)}`}><strong>{month.amount ? money(month.amount) : '0 ₫'}</strong><div className="monthly-revenue-track"><i style={{ height: `${Math.max(month.amount ? 7 : 0, (month.amount / maxRevenue) * 100)}%` }} /></div><span>T{month.month}</span></div>)}
      </div>
    </section>

    <section className="card table-card monthly-revenue-table">
      <div className="card-heading report-heading"><div><span className="eyebrow dark">CHI TIẾT DOANH THU</span><h3>Đối chiếu theo phương thức</h3></div><CalendarDays /></div>
      <div className="table-wrap"><table><thead><tr><th>Tháng</th><th>Giao dịch</th><th>Tiền mặt</th><th>Chuyển khoản</th><th>Tổng doanh thu</th></tr></thead><tbody>{report.months.map((month) => <tr key={month.month}><td><strong>{month.label}</strong></td><td>{month.count}</td><td>{money(month.cash)}</td><td>{money(month.transfer)}</td><td><strong>{money(month.amount)}</strong></td></tr>)}</tbody></table></div>
    </section>
  </>
}

function RevenueMetric({ icon: Icon, label, value }: { icon: typeof Banknote; label: string; value: string | number }) {
  return <div className="metric-card"><div className="metric-icon"><Icon /></div><span>{label}</span><strong>{value}</strong></div>
}
