import axios, { type InternalAxiosRequestConfig } from 'axios'
import { clearAuthSession, getAuthToken } from './authSession'

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retried?: boolean
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000/api`,
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && getAuthToken()) {
      clearAuthSession()
      window.dispatchEvent(new Event('gym:unauthorized'))
    }
    const config = error.config as RetryableRequestConfig | undefined
    const shouldRetry =
      config?.method?.toLowerCase() === 'get' &&
      !config._retried &&
      (!error.response || error.response.status >= 500)
    if (shouldRetry) {
      config._retried = true
      await new Promise((resolve) => window.setTimeout(resolve, 600))
      return api.request(config)
    }
    return Promise.reject(error)
  },
)

export function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') return 'Máy chủ phản hồi chậm. Vui lòng thử lại thao tác.'
    return error.response?.data?.message || 'Không thể kết nối đến máy chủ.'
  }
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.'
}

export const money = (value: string | number) => `${Number(value).toLocaleString('vi-VN')} ₫`
