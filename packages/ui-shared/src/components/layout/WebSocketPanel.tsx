import { useState, useRef, useEffect, useCallback } from 'react'
import { useDataStore } from '../../store/useDataStore'
import { KeyValueEditor } from '../ui/KeyValueEditor'
import { Wifi, WifiOff, Send, Trash2, ArrowUp, ArrowDown, Copy } from 'lucide-react'
import { toast } from 'sonner'

interface WsMessage {
  id: string
  direction: 'sent' | 'received'
  payload: string
  size: number
  timestamp: Date
  type: 'text' | 'binary'
  isSystem?: boolean
}

type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

const STATUS_COLOR: Record<WsStatus, string> = {
  disconnected: 'text-muted',
  connecting: 'text-amber-400',
  connected: 'text-emerald-400',
  error: 'text-rose-400'
}

const STATUS_LABEL: Record<WsStatus, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting...',
  connected: 'Connected',
  error: 'Error'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
    '.' + String(d.getMilliseconds()).padStart(3, '0')
}

export function WebSocketPanel(): React.JSX.Element {
  const { tabs, activeTabId, setWorkingRequest, environments, activeEnvironmentId } = useDataStore()
  const activeTab = tabs.find((t) => t.requestId === activeTabId)
  const workingRequest = activeTab?.kind === 'request' ? activeTab.workingRequest : undefined

  const [status, setStatus] = useState<WsStatus>('disconnected')
  const [messages, setMessages] = useState<WsMessage[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [messageFormat, setMessageFormat] = useState<'text' | 'json'>('text')
  const [subprotocol, setSubprotocol] = useState('')
  const [showHeaders, setShowHeaders] = useState(false)
  const [filterDir, setFilterDir] = useState<'all' | 'sent' | 'received'>('all')

  const wsRef = useRef<WebSocket | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])

  const resolveUrl = useCallback((): string => {
    const raw = workingRequest?.url || ''
    const envVars = environments.find((e) => e.id === activeEnvironmentId)?.variables || {}
    return raw.replace(/\{\{([^}]+)\}\}/g, (_, key) => envVars[key.trim()] ?? `{{${key}}}`)
  }, [workingRequest?.url, environments, activeEnvironmentId])

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    const url = resolveUrl()
    if (!url) {
      toast.error('Please enter a WebSocket URL')
      return
    }
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      toast.error('URL must start with ws:// or wss://')
      return
    }

    setStatus('connecting')

    try {
      const protocols = subprotocol.trim() ? subprotocol.split(',').map((s) => s.trim()).filter(Boolean) : undefined
      const ws = new WebSocket(url, protocols)
      wsRef.current = ws

      ws.onopen = () => {
        setStatus('connected')
        addSystemMessage(`Connected to ${url}`)
        // Send custom headers note (browsers don't support custom headers on WS handshake natively)
      }

      ws.onmessage = (event) => {
        const isBinary = event.data instanceof ArrayBuffer || event.data instanceof Blob
        let payload: string
        let size: number

        if (isBinary) {
          payload = '[Binary data]'
          size = event.data instanceof Blob ? event.data.size : 0
        } else {
          payload = String(event.data)
          size = new TextEncoder().encode(payload).length
        }

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            direction: 'received',
            payload,
            size,
            timestamp: new Date(),
            type: isBinary ? 'binary' : 'text'
          }
        ])
      }

      ws.onerror = () => {
        setStatus('error')
        addSystemMessage('Connection error')
      }

      ws.onclose = (event) => {
        setStatus('disconnected')
        addSystemMessage(`Disconnected (code: ${event.code}${event.reason ? `, reason: ${event.reason}` : ''})`)
        wsRef.current = null
      }
    } catch (err) {
      setStatus('error')
      toast.error(`Failed to connect: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }, [resolveUrl, subprotocol])

  const disconnect = useCallback(() => {
    wsRef.current?.close(1000, 'Manual disconnect')
  }, [])

  const addSystemMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        direction: 'received',
        payload: text,
        size: 0,
        timestamp: new Date(),
        type: 'text',
        isSystem: true
      }
    ])
  }

  const sendMessage = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast.error('Not connected')
      return
    }
    let payload = messageInput.trim()
    if (!payload) return

    if (messageFormat === 'json') {
      try {
        payload = JSON.stringify(JSON.parse(payload))
      } catch {
        toast.error('Invalid JSON')
        return
      }
    }

    wsRef.current.send(payload)
    const size = new TextEncoder().encode(payload).length
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        direction: 'sent',
        payload,
        size,
        timestamp: new Date(),
        type: 'text'
      }
    ])
    setMessageInput('')
  }, [messageInput, messageFormat])

  const filteredMessages = messages.filter((m) => {
    if (filterDir === 'all') return true
    if (filterDir === 'sent') return m.direction === 'sent'
    return m.direction === 'received'
  })

  const isConnected = status === 'connected'
  const isConnecting = status === 'connecting'

  if (!workingRequest) return <div />

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* URL Bar */}
      <div className="px-4 py-3 border-b border-border flex gap-2 items-center">
        <div className="flex-1 flex items-center border border-border rounded bg-surface focus-within:border-primary overflow-hidden">
          <span className="px-3 text-[10px] font-black text-cyan-400 uppercase tracking-wider shrink-0 border-r border-border bg-cyan-400/5">
            WS
          </span>
          <input
            type="text"
            value={workingRequest.url}
            onChange={(e) => setWorkingRequest({ url: e.target.value })}
            placeholder="wss://echo.websocket.org"
            disabled={isConnected || isConnecting}
            className="flex-1 bg-transparent px-4 py-2.5 text-sm text-text focus:outline-none placeholder:text-muted/40 font-mono disabled:opacity-50"
          />
          <div className="px-3 shrink-0 flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse' : isConnecting ? 'bg-amber-400 animate-pulse' : status === 'error' ? 'bg-rose-400' : 'bg-muted/30'}`} />
            <span className={`text-[10px] font-bold uppercase ${STATUS_COLOR[status]}`}>{STATUS_LABEL[status]}</span>
          </div>
        </div>

        {isConnected || isConnecting ? (
          <button
            onClick={disconnect}
            className="px-5 py-2.5 rounded bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold flex items-center gap-2 transition-colors"
          >
            <WifiOff size={14} />
            Disconnect
          </button>
        ) : (
          <button
            onClick={connect}
            className="px-5 py-2.5 rounded bg-primary hover:bg-primary-hover text-white text-sm font-bold flex items-center gap-2 transition-colors"
          >
            <Wifi size={14} />
            Connect
          </button>
        )}
      </div>

      {/* Sub-protocol & Headers */}
      <div className="border-b border-border">
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider shrink-0">Sub-protocol</label>
            <input
              type="text"
              value={subprotocol}
              onChange={(e) => setSubprotocol(e.target.value)}
              disabled={isConnected || isConnecting}
              placeholder="e.g. graphql-ws, chat"
              className="bg-surface border border-border rounded px-3 py-1 text-xs text-text focus:outline-none focus:border-primary placeholder:text-muted/40 w-52 disabled:opacity-50"
            />
          </div>
          <button
            onClick={() => setShowHeaders(!showHeaders)}
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors ${showHeaders ? 'text-primary bg-primary/10' : 'text-muted hover:text-text'}`}
          >
            Handshake Headers {Object.keys(workingRequest.headers || {}).length > 0 ? `(${Object.keys(workingRequest.headers).length})` : ''}
          </button>
          <span className="text-[9px] text-muted/50 italic">* Headers not sent in browser WebSocket handshake</span>
        </div>

        {showHeaders && (
          <div className="px-4 pb-3">
            <KeyValueEditor
              initialData={workingRequest.headers || {}}
              onChange={(data: Record<string, string>) => {
                setWorkingRequest({ headers: data })
              }}
              disabled={isConnected || isConnecting}
            />
          </div>
        )}
      </div>

      {/* Main area: message log + send input */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Log toolbar */}
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-border bg-surface/30">
          <div className="flex items-center gap-1">
            {(['all', 'sent', 'received'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterDir(f)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide transition-colors ${filterDir === f ? 'bg-primary/20 text-primary' : 'text-muted hover:text-text'}`}
              >
                {f === 'all' ? 'All' : f === 'sent' ? '↑ Sent' : '↓ Received'}
              </button>
            ))}
            <span className="ml-2 text-[10px] text-muted/50">{filteredMessages.length} messages</span>
          </div>
          <button
            onClick={() => setMessages([])}
            className="text-[10px] font-bold text-muted hover:text-rose-400 flex items-center gap-1 transition-colors"
          >
            <Trash2 size={11} />
            Clear
          </button>
        </div>

        {/* Event log */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-xs">
          {filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted/40 gap-2">
              <Wifi size={32} className="opacity-30" />
              <span className="text-sm">Connect to start receiving messages</span>
            </div>
          ) : (
            filteredMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 items-start p-2 rounded group hover:bg-white/3 transition-colors ${msg.isSystem ? 'opacity-50' : ''}`}
              >
                <span className="text-muted/40 shrink-0 text-[10px] mt-0.5 w-24">{formatTime(msg.timestamp)}</span>
                {!msg.isSystem && (
                  <span className={`shrink-0 flex items-center gap-0.5 ${msg.direction === 'sent' ? 'text-cyan-400' : 'text-emerald-400'}`}>
                    {msg.direction === 'sent' ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                  </span>
                )}
                <span className={`flex-1 break-all whitespace-pre-wrap text-[11px] leading-relaxed ${msg.isSystem ? 'text-muted italic' : 'text-text'}`}>
                  {msg.isSystem ? `⚙ ${msg.payload}` : msg.payload}
                </span>
                {!msg.isSystem && msg.size > 0 && (
                  <span className="text-[9px] text-muted/40 shrink-0 mt-0.5">{formatBytes(msg.size)}</span>
                )}
                {!msg.isSystem && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(msg.payload)
                      toast.success('Copied')
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  >
                    <Copy size={11} className="text-muted hover:text-text" />
                  </button>
                )}
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>

        {/* Send area */}
        <div className="border-t border-border p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Format</span>
            {(['text', 'json'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setMessageFormat(f)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide transition-colors ${messageFormat === f ? 'bg-primary/20 text-primary' : 'text-muted hover:text-text'}`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <textarea
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder={messageFormat === 'json' ? '{"key": "value"}' : 'Message to send... (Cmd+Enter to send)'}
              rows={3}
              className="flex-1 bg-surface border border-border rounded px-3 py-2 text-xs text-text font-mono focus:outline-none focus:border-primary placeholder:text-muted/40 resize-none"
            />
            <button
              onClick={sendMessage}
              disabled={!isConnected || !messageInput.trim()}
              className="px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed self-end"
            >
              <Send size={14} />
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
