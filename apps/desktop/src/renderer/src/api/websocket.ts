// websocket.ts
import { useAuthStore } from '../store/useAuthStore'
import { useDataStore } from '../store/useDataStore'
import { getBaseUrl } from './client'

const getWsBaseUrl = () => {
  const baseUrl = getBaseUrl()
  return baseUrl.replace(/^http/, 'ws')
}

export class WebSocketClient {
  public ws: WebSocket | null = null
  private isConnecting = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  public connect(teamId: number, userId: number, userName: string) {
    if (this.ws || this.isConnecting) return

    this.isConnecting = true
    const url = `${getWsBaseUrl()}/ws?team_id=${teamId}&user_id=${userId}&user_name=${encodeURIComponent(userName)}`

    try {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        console.log('[Wapbolt WS] Connected to collaboration server')
        this.isConnecting = false
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer)
          this.reconnectTimer = null
        }

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
          this.handleMessage(data)
        } catch (e) {
          console.error('[Wapbolt WS] Failed to parse message', e)
        }
      }

      this.ws.onclose = () => {
        console.log('[Wapbolt WS] Disconnected')
        this.ws = null
        this.isConnecting = false
        // Clear all presence/locks locally
        useDataStore.getState().clearPresenceAndLocks()
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
    if (this.ws) {
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

  // Listen to auth logout
  useAuthStore.subscribe(
    (state) => state.user,
    (user) => {
      if (!user) {
        console.log('[Wapbolt WS] User logged out, disconnecting...')
        wsClient.disconnect()
      }
    }
  )
}
