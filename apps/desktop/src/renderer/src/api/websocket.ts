// websocket.ts
import { useAuthStore } from '../store/useAuthStore'
import { useDataStore } from '../store/useDataStore'

const WS_BASE_URL = 'ws://localhost:8000'

class WebSocketClient {
  private ws: WebSocket | null = null
  private isConnecting = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  public connect(teamId: number, userId: number, userName: string) {
    if (this.ws || this.isConnecting) return

    this.isConnecting = true
    const url = `${WS_BASE_URL}/api/v1/ws?team_id=${teamId}&user_id=${userId}&user_name=${encodeURIComponent(userName)}`

    try {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        console.log('[Wapify WS] Connected to collaboration server')
        this.isConnecting = false
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer)
          this.reconnectTimer = null
        }

        // When connected, send current active request if any
        const state = useDataStore.getState()
        if (state.activeTabId) {
          const tab = state.tabs.find((t) => t.id === state.activeTabId)
          if (tab && tab.type === 'request') {
            this.send({ type: 'JOIN_REQUEST', request_id: tab.id })
          }
        }
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.handleMessage(data)
        } catch (e) {
          console.error('[Wapify WS] Failed to parse message', e)
        }
      }

      this.ws.onclose = () => {
        console.log('[Wapify WS] Disconnected')
        this.ws = null
        this.isConnecting = false
        // Clear all presence/locks locally
        useDataStore.getState().clearPresenceAndLocks()
        this.scheduleReconnect(teamId, userId, userName)
      }

      this.ws.onerror = (err) => {
        console.error('[Wapify WS] Error:', err)
        // onclose will be called
      }
    } catch (e) {
      console.error('[Wapify WS] Connection error:', e)
      this.isConnecting = false
      this.scheduleReconnect(teamId, userId, userName)
    }
  }

  private scheduleReconnect(teamId: number, userId: number, userName: string) {
    if (this.reconnectTimer) return
    console.log('[Wapify WS] Reconnecting in 5 seconds...')
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
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  public send(event: { type: string; request_id?: number; payload?: any }) {
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
          // Optionally, we could show a toast or auto-fetch
          // store.fetchCollectionContents(...)
          window.dispatchEvent(
            new CustomEvent('wapify:entity-updated', { detail: message.payload })
          )
        }
        break
    }
  }
}

export const wsClient = new WebSocketClient()

// Auto-connect hook
export function initWebSocketIntegration() {
  // Listen to store changes to connect/disconnect or join/leave requests
  useDataStore.subscribe(
    (state) => ({ activeTeamId: state.activeTeamId, activeTabId: state.activeTabId }),
    (currentState, previousState) => {
      const auth = useAuthStore.getState()

      // If team changed, reconnect
      if (currentState.activeTeamId !== previousState.activeTeamId) {
        wsClient.disconnect()
        if (currentState.activeTeamId && auth.user) {
          wsClient.connect(currentState.activeTeamId, auth.user.id, auth.user.name)
        }
      }

      // If active tab changed, send JOIN/LEAVE
      if (currentState.activeTabId !== previousState.activeTabId) {
        if (previousState.activeTabId) {
          const prevTab = useDataStore
            .getState()
            .tabs.find((t) => t.requestId === previousState.activeTabId)
          if (prevTab) {
            wsClient.send({ type: 'LEAVE_REQUEST', request_id: prevTab.requestId })
          }
        }
        if (currentState.activeTabId) {
          const currentTab = useDataStore
            .getState()
            .tabs.find((t) => t.requestId === currentState.activeTabId)
          if (currentTab) {
            wsClient.send({ type: 'JOIN_REQUEST', request_id: currentTab.requestId })
          }
        }
      }
    }
  )

  // Listen to auth logout
  useAuthStore.subscribe(
    (state) => state.user,
    (user) => {
      if (!user) {
        wsClient.disconnect()
      }
    }
  )
}
