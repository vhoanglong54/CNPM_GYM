export type DataScope =
  | 'catalog'
  | 'checkins'
  | 'dashboard'
  | 'notifications'
  | 'orders'
  | 'people'
  | 'profile'
  | 'reports'
  | 'reviews'
  | 'schedule'

interface DataChangeMessage {
  scopes: DataScope[]
  changedAt: number
}

const channelName = 'titan-gym-data-changes'
const storageKey = 'titan-gym:last-data-change'
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(channelName)

export function publishDataChange(...scopes: DataScope[]) {
  const message: DataChangeMessage = { scopes: [...new Set(scopes)], changedAt: Date.now() }
  if (channel) channel.postMessage(message)
  else {
    try {
      localStorage.setItem(storageKey, JSON.stringify(message))
      localStorage.removeItem(storageKey)
    } catch {
      // Storage can be unavailable in strict privacy modes; polling remains the fallback.
    }
  }
}

export function subscribeDataChanges(scopes: DataScope[], listener: () => void) {
  const acceptedScopes = new Set(scopes)
  const receive = (message: DataChangeMessage) => {
    if (!message || !Array.isArray(message.scopes)) return
    if (message.scopes.some((scope) => acceptedScopes.has(scope))) listener()
  }
  const receiveBroadcast = (event: MessageEvent<DataChangeMessage>) => receive(event.data)
  const receiveStorage = (event: StorageEvent) => {
    if (event.key !== storageKey || !event.newValue) return
    try {
      receive(JSON.parse(event.newValue) as DataChangeMessage)
    } catch {
      // Ignore malformed data from another application tab.
    }
  }

  channel?.addEventListener('message', receiveBroadcast)
  window.addEventListener('storage', receiveStorage)
  return () => {
    channel?.removeEventListener('message', receiveBroadcast)
    window.removeEventListener('storage', receiveStorage)
  }
}
