// websocket.ts
import { toast } from 'sonner'
import { useAuthStore } from '../store/useAuthStore'
import { useDataStore } from '../store/useDataStore'
import { useAppStore } from '../store/useAppStore'
import { useNotificationStore } from '../store/useNotificationStore'
import { getBaseUrl } from './client'

const getWsBaseUrl = () => {
  const baseUrl = getBaseUrl()
  return baseUrl.replace(/^http/, 'ws')
}

// How long to wait after a disconnect before telling the user — most drops
// (brief network blip, laptop sleep/resume, backend redeploy) recover within
// a few seconds via the reconnect loop, and surfacing every one of those as
// an error toast is just noise. Only tell the user if it stays down.
const DISCONNECT_TOAST_GRACE_MS = 4000

export class WebSocketClient {
  public ws: WebSocket | null = null
  private isConnecting = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private disconnectToastTimer: ReturnType<typeof setTimeout> | null = null
  private disconnectToastShown = false
  private _wasConnected = false

  public connect(teamId: number, userId: number, userName: string) {
    if (this.ws || this.isConnecting) return

    this.isConnecting = true
    const url = `${getWsBaseUrl()}/ws?team_id=${teamId}&user_id=${userId}&user_name=${encodeURIComponent(userName)}`

    try {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        console.log('[Wapbolt WS] Connected to collaboration server')
        const isReconnect = this._wasConnected
        this._wasConnected = true

        if (this.disconnectToastTimer) {
          // Reconnected within the grace period — the user never saw a
          // disconnect toast, so skip the "reconnected" one too (silent recovery).
          clearTimeout(this.disconnectToastTimer)
          this.disconnectToastTimer = null
        } else if (!isReconnect || this.disconnectToastShown) {
          toast.success(isReconnect ? 'Reconnected to collaboration server' : 'Connected to collaboration server', { id: 'ws-status' })
          useNotificationStore.getState().addLocalNotification(
            isReconnect ? 'Collaboration Reconnected' : 'Collaboration Connected',
            isReconnect ? 'You have rejoined the collaboration server.' : 'You have joined the collaboration server.',
            'collaboration'
          )
        }
        this.disconnectToastShown = false
        this.isConnecting = false
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer)
          this.reconnectTimer = null
        }

        // Start heartbeat
        this.startHeartbeat()

        // When connected, send current active request if any
        const state = useDataStore.getState()
        if (state.activeTabId) {
          const tab = state.tabs.find((t) => t.requestId === state.activeTabId)
          if (tab && typeof tab.requestId === 'number') {
            this.send({ type: 'JOIN_REQUEST', request_id: tab.requestId })
          }
        }
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('[Wapbolt WS] Received message:', data)
          this.handleMessage(data)
        } catch (e) {
          console.error('[Wapbolt WS] Failed to parse message', e)
        }
      }

      this.ws.onclose = () => {
        console.log('[Wapbolt WS] Disconnected')
        this.ws = null
        this.isConnecting = false
        this.stopHeartbeat()
        // Clear all presence/locks locally
        useDataStore.getState().clearPresenceAndLocks()

        if (!this.disconnectToastTimer) {
          this.disconnectToastTimer = setTimeout(() => {
            this.disconnectToastTimer = null
            this.disconnectToastShown = true
            toast.error('Disconnected from collaboration server', { id: 'ws-status' })
          }, DISCONNECT_TOAST_GRACE_MS)
        }

        this.scheduleReconnect(teamId, userId, userName)
      }

      this.ws.onerror = (err) => {
        console.error('[Wapbolt WS] Error:', err)
        // onclose will be called
      }
    } catch (e) {
      console.error('[Wapbolt WS] Connection error:', e)
      this.isConnecting = false
      this.scheduleReconnect(teamId, userId, userName)
    }
  }

  private heartbeatTimer: any = null
  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'PING' })
    }, 30000)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private scheduleReconnect(teamId: number, userId: number, userName: string) {
    if (this.reconnectTimer) return
    console.log('[Wapbolt WS] Reconnecting in 5 seconds...')
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect(teamId, userId, userName)
    }, 5000)
  }

  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.disconnectToastTimer) {
      clearTimeout(this.disconnectToastTimer)
      this.disconnectToastTimer = null
    }
    if (this.ws) {
      // Explicitly leave active request so server removes presence immediately
      const activeTabId = useDataStore.getState().activeTabId
      if (activeTabId) {
        this.send({ type: 'LEAVE_REQUEST', request_id: activeTabId })
      }
      this.ws.close()
      this.ws = null
    }
  }

  public send(event: { type: string; request_id?: number | string; payload?: any }) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event))
    }
  }

  private handleMessage(message: any) {
    const store = useDataStore.getState()
    switch (message.type) {
      case 'PRESENCE_UPDATE':
        store.setPresence(message.request_id, message.payload || [])
        break
      case 'LOCK_UPDATE':
        store.setLock(message.request_id, message.payload)
        break
      case 'ENTITY_UPDATED':
        // Jika entity yang diupdate adalah request yang sedang kita buka, fetch ulang
        if (message.payload?.entity_type === 'REQUEST') {
          const reqId = message.payload.entity_id
          const collectionId = store.requests.find(r => r.id === reqId)?.collection_id
          if (collectionId) {
            store.fetchCollectionContents(collectionId)
          }
        } else if (message.payload?.entity_type === 'FOLDER') {
          // Find collection id for this folder
          const colId = Object.entries(store.foldersByCollection).find(([_, folders]) => 
            folders.some(f => f.id === message.payload.entity_id)
          )?.[0]
          if (colId) {
            store.fetchCollectionContents(Number(colId))
          }
        } else if (message.payload?.entity_type === 'COLLECTION') {
          store.fetchCollectionContents(message.payload.entity_id)
        } else if (message.payload?.entity_type === 'TEAM') {
          if (store.activeTeamId) {
            store.fetchCollections(store.activeTeamId)
          }
        } else if (message.payload?.entity_type === 'HISTORY') {
          store.fetchHistory()
        }

        window.dispatchEvent(
          new CustomEvent('wapbolt:entity-updated', { detail: message.payload })
        )
        break
      case 'DONATION_PROMPT':
        {
          const appStore = useAppStore.getState()
          appStore.setDonationMessage(message.payload?.message || '')
          appStore.setDonationModalOpen(true)
        }
        break
      case 'NOTIFICATION_NEW':
        if (message.payload) {
          useNotificationStore.getState().addNotification(message.payload)
          toast(message.payload.title, {
            description: message.payload.message,
            duration: 5000,
          })
        }
        break
    }
  }
}

export const wsClient = new WebSocketClient()

// Auto-connect hook
export function initWebSocketIntegration() {
  console.log('[Wapbolt WS] Initializing WebSocket integration...')

  // Listen to store changes to connect/disconnect or join/leave requests
  useDataStore.subscribe(
    (state) => ({ activeTeamId: state.activeTeamId, activeTabId: state.activeTabId }),
    (currentState, previousState) => {
      const auth = useAuthStore.getState()
      console.log('[Wapbolt WS] Data store change detected:', { 
        activeTeamId: currentState.activeTeamId, 
        hasUser: !!auth.user 
      })

      // If team changed, reconnect
      if (currentState.activeTeamId !== previousState.activeTeamId || (currentState.activeTeamId && !wsClient.ws)) {
        console.log('[Wapbolt WS] Team changed or missing connection, reconnecting...')
        wsClient.disconnect()
        if (currentState.activeTeamId && auth.user) {
          wsClient.connect(currentState.activeTeamId, auth.user.id, auth.user.name)
        } else {
          console.log('[Wapbolt WS] Missing teamId or user, skipping connection')
        }
      }

      // If active tab changed, send JOIN/LEAVE
      if (currentState.activeTabId !== previousState.activeTabId) {
        console.log('[Wapbolt WS] Active tab changed:', currentState.activeTabId)
        if (previousState.activeTabId) {
          const prevTab = useDataStore
            .getState()
            .tabs.find((t) => t.requestId === previousState.activeTabId)
          if (prevTab && typeof prevTab.requestId === 'number') {
            wsClient.send({ type: 'LEAVE_REQUEST', request_id: prevTab.requestId })
          }
        }
        if (currentState.activeTabId) {
          const currentTab = useDataStore
            .getState()
            .tabs.find((t) => t.requestId === currentState.activeTabId)
          if (currentTab && typeof currentTab.requestId === 'number') {
            wsClient.send({ type: 'JOIN_REQUEST', request_id: currentTab.requestId })
          }
        }
      }
    }
  )

  // Check initial state (in case it's already hydrated)
  const initialData = useDataStore.getState()
  const initialAuth = useAuthStore.getState()
  if (initialData.activeTeamId && initialAuth.user) {
    console.log('[Wapbolt WS] Attempting initial connection...')
    wsClient.connect(initialData.activeTeamId, initialAuth.user.id, initialAuth.user.name)
  }

  // Listen to auth changes (logout or user switch)
  useAuthStore.subscribe(
    (state) => state.user,
    (user, prevUser) => {
      if (!user) {
        console.log('[Wapbolt WS] User logged out, disconnecting...')
        wsClient.disconnect()
      } else if (prevUser && user.id !== prevUser.id) {
        // User switched account — reconnect with new identity
        console.log('[Wapbolt WS] User changed, reconnecting with new identity...')
        wsClient.disconnect()
        const activeTeamId = useDataStore.getState().activeTeamId
        if (activeTeamId) {
          wsClient.connect(activeTeamId, user.id, user.name)
        }
      }
    }
  )
}
