export const APP_TIME_ZONE = 'Asia/Ho_Chi_Minh'

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: APP_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function formatAppDate(value: string | number | Date) {
  return dateFormatter.format(new Date(value))
}

export function formatAppDateTime(value: string | number | Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: APP_TIME_ZONE,
    dateStyle: 'short',
    timeStyle: 'medium',
    hour12: false,
  }).format(new Date(value))
}

export function formatAppTime(value: string | number | Date, includeSeconds = false) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: APP_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' as const } : {}),
    hour12: false,
  }).format(new Date(value))
}

export function formatAppLongDate(value: string | number | Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: APP_TIME_ZONE,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

export function appDateParts(value: string | number | Date) {
  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: APP_TIME_ZONE,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).formatToParts(new Date(value))
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return { weekday: get('weekday'), day: get('day'), month: get('month') }
}

export function appDayIsoRange(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00+07:00`)
  return {
    from: start.toISOString(),
    to: new Date(start.getTime() + 86_400_000).toISOString(),
  }
}

export function appTodayKey() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}
