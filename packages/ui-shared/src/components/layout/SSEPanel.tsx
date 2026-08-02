import { useState, useRef, useEffect, useCallback } from 'react'
import { useDataStore } from '../../store/useDataStore'
import { Radio, RadioTower, Trash2, Copy } from 'lucide-react'
import { toast } from 'sonner'

interface SseEvent {
  id: string
  event: string
  data: string
  timestamp: Date
  isSystem?: boolean
}

type SseStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

const STATUS_COLOR: Record<SseStatus, string> = {
  disconnected: 'text-muted',
  connecting: 'text-amber-400',
  connected: 'text-emerald-400',
  error: 'text-rose-400',
}

const STATUS_LABEL: Record<SseStatus, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting...',
  connected: 'Connected',
  error: 'Error',
}

function formatTime(d: Date): string {
  return (
    d.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) +
    '.' +
    String(d.getMilliseconds()).padStart(3, '0')
  )
}

export function SSEPanel(): React.JSX.Element {
  const { tabs, activeTabId, environments, activeEnvironmentId } = useDataStore()
  const activeTab = tabs.find((t) => t.requestId === activeTabId)
  const workingRequest = activeTab?.kind === 'request' ? activeTab.workingRequest : undefined

  const [status, setStatus] = useState<SseStatus>('disconnected')
  const [events, setEvents] = useState<SseEvent[]>([])
  const [filterEvent, setFilterEvent] = useState('')

  const esRef = useRef<EventSource | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  useEffect(() => {
    return () => {
      esRef.current?.close()
      esRef.current = null
    }
  }, [])

  const resolveUrl = useCallback((): string => {
    const raw = workingRequest?.url || ''
    const envVars = environments.find((e) => e.id === activeEnvironmentId)?.variables || {}
    return raw.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => envVars[key.trim()] ?? `{{${key}}}`)
  }, [workingRequest?.url, environments, activeEnvironmentId])

  const addSystemEvent = (msg: string): void => {
    setEvents((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        event: 'system',
        data: msg,
        timestamp: new Date(),
        isSystem: true,
      },
    ])
  }

  const connect = useCallback(() => {
    if (esRef.current) return
    const url = resolveUrl()
    if (!url) {
      toast.error('URL is empty')
      return
    }

    setStatus('connecting')
    addSystemEvent(`Connecting to ${url}`)

    const es = new EventSource(url, { withCredentials: false })
    esRef.current = es

    es.onopen = () => {
      setStatus('connected')
      addSystemEvent('Connection established')
    }

    es.onerror = () => {
      setStatus('error')
      addSystemEvent('Connection error or closed by server')
      es.close()
      esRef.current = null
    }

    es.onmessage = (e) => {
      setEvents((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          event: 'message',
          data: e.data,
          timestamp: new Date(),
        },
      ])
    }

    // Also listen for named events commonly used in SSE streams
    const namedEvents = ['update', 'ping', 'error', 'close', 'data', 'event']
    namedEvents.forEach((name) => {
      es.addEventListener(name, (e: MessageEvent) => {
        setEvents((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            event: name,
            data: e.data,
            timestamp: new Date(),
          },
        ])
      })
    })
  }, [resolveUrl])

  const disconnect = (): void => {
    esRef.current?.close()
    esRef.current = null
    setStatus('disconnected')
    addSystemEvent('Disconnected')
  }

  const clearLog = (): void => setEvents([])

  const isConnected = status === 'connected' || status === 'connecting'

  const filteredEvents = filterEvent.trim()
    ? events.filter((e) => e.event.includes(filterEvent.trim()))
    : events

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border bg-surface/30 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <RadioTower size={14} className={STATUS_COLOR[status]} />
          <span className={`text-xs font-bold ${STATUS_COLOR[status]}`}>{STATUS_LABEL[status]}</span>
          <span className="text-[10px] text-muted font-mono truncate max-w-[320px]">
            {workingRequest?.url || '—'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <button
              onClick={disconnect}
              className="px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={connect}
              className="px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5"
            >
              <Radio size={10} />
              Connect
            </button>
          )}
          <button
            onClick={clearLog}
            className="p-1.5 rounded text-muted hover:text-text hover:bg-surface transition-colors"
            title="Clear log"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="shrink-0 px-4 py-2 border-b border-border bg-surface/10 flex items-center gap-3">
        <span className="text-[9px] font-black text-muted uppercase tracking-widest">Event:</span>
        <input
          value={filterEvent}
          onChange={(e) => setFilterEvent(e.target.value)}
          placeholder="filter by event name..."
          className="bg-transparent text-xs text-text placeholder:text-muted focus:outline-none flex-1 font-mono"
        />
        <span className="text-[10px] text-muted">{filteredEvents.length} events</span>
      </div>

      {/* Event log */}
      <div className="flex-1 overflow-auto p-2 space-y-0.5 font-mono text-[11px]">
        {filteredEvents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted opacity-30 italic py-20 gap-2">
            <RadioTower size={28} />
            <p className="text-xs">
              {status === 'disconnected' ? 'Connect to an SSE endpoint to receive events.' : 'Waiting for events...'}
            </p>
          </div>
        ) : (
          filteredEvents.map((ev) => (
            <div
              key={ev.id}
              className={`flex items-start gap-3 px-2 py-1.5 rounded hover:bg-white/5 border-l-2 transition-all group ${
                ev.isSystem
                  ? 'border-muted/30 text-muted italic'
                  : 'border-emerald-500/40 bg-emerald-500/5'
              }`}
            >
              <span className="text-muted shrink-0 w-24 opacity-60 text-[10px] pt-px">
                {formatTime(ev.timestamp)}
              </span>
              {!ev.isSystem && (
                <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-emerald-400 w-16 pt-px">
                  {ev.event}
                </span>
              )}
              <span className="flex-1 break-all whitespace-pre-wrap text-text/90">{ev.data}</span>
              {!ev.isSystem && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(ev.data)
                    toast.success('Copied')
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted hover:text-text"
                >
                  <Copy size={11} />
                </button>
              )}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  )
}
