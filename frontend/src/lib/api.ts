import axios, { type InternalAxiosRequestConfig } from 'axios'
import { clearAuthSession, getAuthToken } from './authSession'

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retried?: boolean
  _activityTracked?: boolean
}

let activeRequests = 0

export function getActiveRequestCount() {
  return activeRequests
}

function updateNetworkActivity(delta: number) {
  activeRequests = Math.max(0, activeRequests + delta)
  window.dispatchEvent(new CustomEvent('gym:network-activity', { detail: activeRequests }))
}

function finishNetworkActivity(config?: RetryableRequestConfig) {
  if (!config?._activityTracked) return
  config._activityTracked = false
  updateNetworkActivity(-1)
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000/api`,
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const trackedConfig = config as RetryableRequestConfig
  if (!trackedConfig._activityTracked) {
    trackedConfig._activityTracked = true
    updateNetworkActivity(1)
  }
  const token = getAuthToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => {
    finishNetworkActivity(response.config as RetryableRequestConfig)
    return response
  },
  async (error) => {
    const config = error.config as RetryableRequestConfig | undefined
    finishNetworkActivity(config)
    if (error.response?.status === 401 && getAuthToken()) {
      clearAuthSession()
      window.dispatchEvent(new Event('gym:unauthorized'))
    }
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
