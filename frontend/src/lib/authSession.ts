const TOKEN_KEY = 'gym_token'
const USER_KEY = 'gym_user'

export function clearLegacySharedAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getAuthToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function getStoredUser() {
  return sessionStorage.getItem(USER_KEY)
}

export function saveAuthSession(token: string, user: unknown) {
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function saveStoredUser(user: unknown) {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearAuthSession() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
}
