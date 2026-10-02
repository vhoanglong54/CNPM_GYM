import { useState, type FormEvent } from 'react'
import { ArrowRight, Dumbbell, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { api, getErrorMessage } from '../lib/api'
import type { ApiResponse } from '../types'

function AuthBrand() {
  return <div className="auth-visual"><div className="auth-brand"><span className="brand-mark"><Dumbbell /></span><b>TITAN<span>GYM</span></b></div></div>
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ email: 'vhoanglong54@gmail.com', password: '' })
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true)
    try { await login(form.email, form.password); toast.success('Đăng nhập thành công.'); navigate('/') }
    catch (error) { toast.error(getErrorMessage(error)) }
    finally { setBusy(false) }
  }
  return <div className="auth-layout"><AuthBrand/><section className="auth-form-panel"><div className="auth-form-wrap"><span className="eyebrow dark">CHÀO MỪNG TRỞ LẠI</span><h2>Đăng nhập hệ thống</h2><form onSubmit={submit} className="form-stack"><label>Email<div className="input-icon"><Mail/><input type="email" value={form.email} onChange={(e) => setForm({...form, email:e.target.value})} placeholder="you@example.com" required/></div></label><label>Mật khẩu<div className="input-icon"><LockKeyhole/><input type={show ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({...form, password:e.target.value})} placeholder="••••••••" required/><button type="button" onClick={() => setShow(!show)}>{show ? <EyeOff/> : <Eye/>}</button></div></label><button className="btn btn-primary btn-wide" disabled={busy}>{busy ? <span className="spinner"/> : <>Đăng nhập <ArrowRight size={19}/></>}</button></form><div className="auth-divider"><span>Hội viên mới?</span></div><Link className="btn btn-ghost btn-wide" to="/register">Tạo tài khoản hội viên</Link><div className="security-note"><ShieldCheck/><span>Dữ liệu được bảo vệ bằng phân quyền và xác thực ở máy chủ.</span></div></div></section></div>
}

export function RegisterPage() {
  const navigate = useNavigate(); const [busy,setBusy]=useState(false)
  const [form,setForm]=useState({fullName:'',email:'',phone:'',password:''})
  const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);try{const {data}=await api.post<ApiResponse<{email:string}>>('/auth/register',form);toast.success(data.message);navigate(`/verify?email=${encodeURIComponent(form.email)}`)}catch(error){toast.error(getErrorMessage(error))}finally{setBusy(false)}}
  return <div className="auth-layout"><AuthBrand/><section className="auth-form-panel"><div className="auth-form-wrap"><span className="eyebrow dark">BẮT ĐẦU HÀNH TRÌNH</span><h2>Tạo tài khoản hội viên</h2><p>Điền thông tin để nhận mã xác thực qua email.</p><form onSubmit={submit} className="form-stack"><label>Họ và tên<input value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})} required minLength={2}/></label><label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></label><label>Số điện thoại <small>(không bắt buộc)</small><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label>Mật khẩu<input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required minLength={8}/></label><button className="btn btn-primary btn-wide" disabled={busy}>{busy?'Đang tạo...':<>Đăng ký <ArrowRight size={19}/></>}</button></form><Link className="text-link" to="/login">← Quay lại đăng nhập</Link></div></section></div>
}

export function VerifyPage() {
  const [params]=useSearchParams();const navigate=useNavigate();const email=params.get('email')||'';const [otp,setOtp]=useState('');const [busy,setBusy]=useState(false)
  const verify=async(e:FormEvent)=>{e.preventDefault();setBusy(true);try{const {data}=await api.post<ApiResponse<unknown>>('/auth/verify-email',{email,otp});toast.success(data.message);navigate('/login')}catch(error){toast.error(getErrorMessage(error))}finally{setBusy(false)}}
  const resend=async()=>{try{const {data}=await api.post<ApiResponse<unknown>>('/auth/resend-otp',{email});toast.success(data.message)}catch(error){toast.error(getErrorMessage(error))}}
  return <div className="auth-layout"><AuthBrand/><section className="auth-form-panel"><div className="auth-form-wrap"><span className="eyebrow dark">XÁC THỰC EMAIL</span><h2>Nhập mã gồm 6 chữ số</h2><p>Mã xác thực đã được gửi tới <b>{email}</b>.</p><form onSubmit={verify} className="form-stack"><label>Mã OTP<input className="otp-input" inputMode="numeric" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,''))} placeholder="000000" required/></label><button className="btn btn-primary btn-wide" disabled={busy||otp.length!==6}>{busy?'Đang xác thực...':'Xác thực tài khoản'}</button></form><button className="text-link link-button" onClick={resend}>Gửi lại mã xác thực</button></div></section></div>
}
