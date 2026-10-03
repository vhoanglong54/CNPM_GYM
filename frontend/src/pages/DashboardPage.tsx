import { useEffect, useState } from 'react'
import { Activity, ArrowUpRight, CalendarCheck, CircleDollarSign, Clock3, Dumbbell, ScanLine, UserCheck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api, getErrorMessage, money } from '../lib/api'
import { formatAppDate, formatAppDateTime, formatAppLongDate } from '../lib/dateTime'
import type { ApiResponse, Profile } from '../types'

interface DashboardData {
  totalRevenue: number
  activeMembers: number
  activeMemberships: number
  totalCheckins: number
  activeBookings: number
  expiringMemberships: number
  pendingOrders: number
  recentTransactions: Array<{ id:string; amount:string; method:string; paidAt:string; order:{member:{fullName:string}} }>
}

const date = formatAppLongDate(new Date())

export function DashboardPage() {
  const { user } = useAuth(); const isOwner=user?.roles.includes('OWNER');const isMember=user?.roles.includes('MEMBER');const isTrainer=user?.roles.includes('TRAINER')
  const [data,setData]=useState<DashboardData|null>(null);const [profile,setProfile]=useState<Profile|null>(null);const [error,setError]=useState('')
  useEffect(()=>{const url=isOwner?'/reports/dashboard':'/users/me/profile';api.get<ApiResponse<DashboardData|Profile>>(url).then(({data})=>isOwner?setData(data.data as DashboardData):setProfile(data.data as Profile)).catch(e=>setError(getErrorMessage(e)))},[isOwner])
  if(error)return <div className="empty-state"><Activity/><h3>Chưa thể tải tổng quan</h3><p>{error}</p></div>
  if((isOwner&&!data)||(!isOwner&&!profile))return <div className="loading-card">Đang tải tổng quan...</div>
  return <>
    <section className="hero-row visual-hero dashboard-hero"><div><span className="eyebrow">{date.toUpperCase()}</span><h2>{isOwner?'Nhịp vận hành hôm nay':`Xin chào, ${user?.fullName.split(' ').slice(-1)[0]}`}</h2><p>{isOwner?'Theo dõi sức khỏe phòng tập từ một màn hình.':'Sẵn sàng cho một buổi tập tốt hơn hôm qua?'}</p></div><div className="hero-actions"><Link to={user?.roles.includes('TRAINER')?'/schedule':user?.roles.includes('MEMBER')?'/packages':'/checkin'} className="btn btn-primary">Thao tác nhanh <ArrowUpRight size={18}/></Link></div></section>
    {isOwner&&data?<><section className="metric-grid"><Metric icon={CircleDollarSign} label="Tổng doanh thu" value={money(data.totalRevenue)} accent/><Metric icon={Users} label="Hội viên hoạt động" value={data.activeMembers}/><Metric icon={ScanLine} label="Tổng lượt check-in" value={data.totalCheckins}/><Metric icon={CalendarCheck} label="Lịch PT đang mở" value={data.activeBookings}/></section><section className="content-grid"><div className="card span-2"><div className="card-heading"><div><span className="eyebrow dark">GIAO DỊCH GẦN ĐÂY</span><h3>Thanh toán mới nhất</h3></div><Link to="/orders" className="text-link">Xem tất cả →</Link></div><div className="list">{data.recentTransactions.length?data.recentTransactions.map(item=><div className="list-row" key={item.id}><div className="list-icon"><CircleDollarSign/></div><div className="grow"><strong>{item.order.member.fullName}</strong><small>{formatAppDateTime(item.paidAt)} · {item.method==='CASH'?'Tiền mặt':'Chuyển khoản'}</small></div><b>{money(item.amount)}</b></div>):<Empty text="Chưa có giao dịch hoàn tất."/>}</div></div><div className="card"><div className="card-heading"><div><span className="eyebrow dark">CẦN CHÚ Ý</span><h3>Tín hiệu vận hành</h3></div></div><div className="signal-list"><Signal label="Gói sắp hết hạn" value={data.expiringMemberships} tone="warn"/><Signal label="Đơn chờ thanh toán" value={data.pendingOrders} tone="info"/><Signal label="Quyền lợi đang hoạt động" value={data.activeMemberships} tone="good"/></div></div></section></>:isMember?<MemberOverview profile={profile}/>:<StaffOverview profile={profile} trainer={Boolean(isTrainer)}/>}
  </>
}

function Metric({icon:Icon,label,value,accent}:{icon:typeof Users;label:string;value:string|number;accent?:boolean}){return <div className={`metric-card ${accent?'metric-accent':''}`}><div className="metric-icon"><Icon/></div><span>{label}</span><strong>{value}</strong></div>}
function Signal({label,value,tone}:{label:string;value:number;tone:string}){return <div className="signal"><i className={tone}/><span>{label}</span><b>{String(value).padStart(2,'0')}</b></div>}
function Empty({text}:{text:string}){return <div className="mini-empty"><Clock3/>{text}</div>}
function MemberOverview({profile}:{profile:Profile|null}){if(!profile)return <div className="loading-card">Đang tải dữ liệu cá nhân...</div>;const member=profile.memberProfile;const memberships=member?.memberships??[];const ptPackages=member?.ptPackages??[];return <><section className="metric-grid"><Metric icon={Dumbbell} label="Gói Gym đang có" value={memberships.length} accent/><Metric icon={CalendarCheck} label="Gói PT đang có" value={ptPackages.length}/><Metric icon={UserCheck} label="Trạng thái" value={profile.status==='ACTIVE'?'Hoạt động':'Tạm khóa'}/></section><section className="content-grid"><div className="card span-2"><div className="card-heading"><div><span className="eyebrow dark">QUYỀN LỢI CỦA TÔI</span><h3>Gói đang sở hữu</h3></div><Link to="/packages" className="text-link">Mua thêm →</Link></div><div className="plan-strip">{memberships.length?memberships.map(item=><div className="owned-plan" key={item.id}><Dumbbell/><div><strong>{item.plan.name}</strong><small>{membershipSummary(item)}</small></div></div>):<Empty text="Bạn chưa có gói Gym. Hãy chọn một gói để bắt đầu."/>}</div></div><div className="card member-code"><span className="eyebrow dark">MÃ HỘI VIÊN</span><strong>{member?.memberCode||'—'}</strong><p>Đưa mã QR cho Lễ tân khi đến tập.</p><Link to="/checkin" className="btn btn-dark">Mở mã QR</Link></div></section></>}

function StaffOverview({profile,trainer}:{profile:Profile|null;trainer:boolean}){if(!profile)return null;return <><section className="metric-grid staff-metrics"><Metric icon={UserCheck} label="Vai trò" value={trainer?'PT':'Lễ tân'} accent/><Metric icon={Activity} label="Trạng thái tài khoản" value={profile.status==='ACTIVE'?'Hoạt động':'Tạm khóa'}/>{trainer&&<Metric icon={CalendarCheck} label="Mã huấn luyện viên" value={profile.trainerProfile?.trainerCode||'—'}/>}</section><section className="content-grid"><div className="card role-overview"><span className="eyebrow dark">{trainer?'CÔNG VIỆC HUẤN LUYỆN':'VẬN HÀNH TẠI QUẦY'}</span><h3>{trainer?'Quản lý lịch và yêu cầu từ hội viên':'Tiếp nhận hội viên và xử lý giao dịch'}</h3><p>{trainer?(profile.trainerProfile?.specialties||'Mở lịch nhận khách và cập nhật tiến trình từng buổi tập.'):'Quét QR check-in, theo dõi đơn hàng và hỗ trợ hội viên tại quầy.'}</p><Link to={trainer?'/schedule':'/checkin'} className="btn btn-primary">{trainer?'Mở lịch PT':'Mở quét check-in'} <ArrowUpRight/></Link></div><div className="card role-links"><span className="eyebrow dark">THAO TÁC PHÙ HỢP</span>{trainer?<Link to="/schedule"><CalendarCheck/> Lịch huấn luyện</Link>:<><Link to="/checkin"><ScanLine/> Quét mã hội viên</Link><Link to="/orders"><CircleDollarSign/> Theo dõi giao dịch</Link><Link to="/members"><Users/> Tra cứu hội viên</Link></>}</div></section></>}

function membershipSummary(item: NonNullable<Profile['memberProfile']>['memberships'][number]){if(new Date(item.startDate)>new Date())return `Sắp có hiệu lực từ ${formatAppDate(item.startDate)}`;if(item.endDate){const days=Math.max(0,Math.ceil((new Date(item.endDate).getTime()-Date.now())/86_400_000));return `Còn ${days} ngày · hết hạn ${formatAppDate(item.endDate)}`}return `Còn ${(item.visitsTotal||0)-item.visitsUsed}/${item.visitsTotal||0} lượt`}
