import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Titan Gym render error:', error, info)
  }

  private recover = () => {
    localStorage.removeItem('gym_token')
    localStorage.removeItem('gym_user')
    window.location.assign('/login')
  }

  render() {
    if (!this.state.failed) return this.props.children

    return <main className="fatal-error">
      <div className="fatal-error-card">
        <AlertTriangle />
        <span className="eyebrow dark">KHÔNG THỂ HIỂN THỊ TRANG</span>
        <h1>Phiên làm việc gặp lỗi</h1>
        <p>Hãy xóa phiên đăng nhập cũ và quay lại màn hình đăng nhập.</p>
        <button className="btn btn-primary" onClick={this.recover}><RotateCcw /> Khôi phục ứng dụng</button>
      </div>
    </main>
  }
}
