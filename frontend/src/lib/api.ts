import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000/api`,
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gym_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem('gym_token')) {
      localStorage.removeItem('gym_token')
      localStorage.removeItem('gym_user')
      window.dispatchEvent(new Event('gym:unauthorized'))
    }
    return Promise.reject(error)
  },
)

export function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) return error.response?.data?.message || 'Không thể kết nối đến máy chủ.'
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.'
}

export const money = (value: string | number) => `${Number(value).toLocaleString('vi-VN')} ₫`
