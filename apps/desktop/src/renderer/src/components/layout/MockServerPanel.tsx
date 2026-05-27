import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  Server,
  Plus,
  Trash2,
  Copy,
  Check,
  X,
  ToggleLeft,
  ToggleRight,
  Clock,
  Code,
  ChevronDown,
  Zap,
  LayoutGrid,
  Flame,
  ScrollText,
  AlertTriangle
} from 'lucide-react'
import { apiClient, getBaseUrl } from '../../api/client'
import type { MockEndpoint, MockRequestLog, ApiRequest } from '../../types'
import { MethodBadge } from '../ui/MethodBadge'
import { toast } from 'sonner'
import { ScenariosPanel } from './ScenariosPanel'

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

const METHOD_COLOR: Record<string, string> = {
  GET: 'text-emerald-400',
  POST: 'text-amber-400',
  PUT: 'text-blue-400',
  PATCH: 'text-sky-400',
  DELETE: 'text-rose-400',
  HEAD: 'text-purple-400',
  OPTIONS: 'text-slate-400'
}

interface MockServerPanelProps {
  collectionId: number
  collectionName: string
  requests: ApiRequest[]
  onClose: () => void
}

export const MockServerPanel: React.FC<MockServerPanelProps> = ({
  collectionId,
  collectionName,
  requests,
  onClose
}) => {
  const [endpoints, setEndpoints] = useState<MockEndpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [managingScenariosEndpoint, setManagingScenariosEndpoint] = useState<MockEndpoint | null>(null)
  const [chaosMode, setChaosMode] = useState(false)
  const [togglingChaos, setTogglingChaos] = useState(false)
  const [activeTab, setActiveTab] = useState<'endpoints' | 'logs'>('endpoints')
  const [logs, setLogs] = useState<MockRequestLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const listBottomRef = useRef<HTMLDivElement>(null)

  const mockBaseUrl = `${getBaseUrl()}/mock/${collectionId}`

  const fetchEndpoints = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<MockEndpoint[]>(
        `/api/v1/collections/${collectionId}/mock/endpoints`
      )
      setEndpoints(res.data as MockEndpoint[])
    } catch {
      toast.error('Failed to load mock endpoints')
    } finally {
      setLoading(false)
    }
  }, [collectionId])

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const res = await apiClient.get<MockRequestLog[]>(
        `/api/v1/collections/${collectionId}/mock/logs`
      )
      setLogs(res.data as MockRequestLog[])
    } catch {
      toast.error('Failed to load request logs')
    } finally {
      setLogsLoading(false)
    }
  }, [collectionId])

  const fetchChaosMode = useCallback(async () => {
    try {
      const res = await apiClient.get<{ id: number; chaos_mode: boolean }>(
        `/api/v1/collections/${collectionId}`
      )
      const col = res.data as { id: number; chaos_mode: boolean }
      setChaosMode(col.chaos_mode ?? false)
    } catch {
      // silently ignore
    }
  }, [collectionId])

  const toggleChaosMode = async () => {
    setTogglingChaos(true)
    try {
      const newMode = !chaosMode
      await apiClient.patch(`/api/v1/collections/${collectionId}/mock/chaos`, {
        chaos_mode: newMode
      })
      setChaosMode(newMode)
      toast.success(newMode ? '🔥 Chaos Mode ON — errors will be injected!' : 'Chaos Mode disabled')
    } catch {
      toast.error('Failed to toggle chaos mode')
    } finally {
      setTogglingChaos(false)
    }
  }

  useEffect(() => {
    fetchEndpoints()
    fetchChaosMode()
  }, [fetchEndpoints, fetchChaosMode])

  useEffect(() => {
    if (activeTab === 'logs') fetchLogs()
  }, [activeTab, fetchLogs])

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this mock endpoint?')) return
    try {
      await apiClient.delete(`/api/v1/collections/${collectionId}/mock/endpoints/${id}`)
      setEndpoints((prev) => prev.filter((e) => e.id !== id))
      toast.success('Mock endpoint deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleToggle = async (ep: MockEndpoint) => {
    try {
      const newActiveStatus = !ep.is_active
      const res = await apiClient.put<MockEndpoint>(
        `/api/v1/collections/${collectionId}/mock/endpoints/${ep.id}`,
        {
          method: ep.method,
          path: ep.path,
          status_code: ep.status_code,
          response_headers: ep.response_headers,
          response_body: ep.response_body,
          delay_ms: ep.delay_ms,
          is_active: newActiveStatus
        }
      )
      setEndpoints((prev) => prev.map((e) => (e.id === ep.id ? (res.data as MockEndpoint) : e)))
      toast.success(newActiveStatus ? 'Mock endpoint enabled' : 'Mock endpoint disabled')
    } catch {
      toast.error('Failed to toggle')
    }
  }

  const handleQuickMock = async (request: ApiRequest) => {
    try {
      const res = await apiClient.post<MockEndpoint>(
        `/api/v1/collections/${collectionId}/mock/endpoints/from-request/${request.id}`,
        {}
      )
      setEndpoints((prev) => [...prev, res.data as MockEndpoint])
      toast.success(`Mock created from "${request.name}"`)
    } catch {
      toast.error('Failed to create mock from request')
    }
  }

  const copyMockUrl = async (ep: MockEndpoint) => {
    const url = `${mockBaseUrl}${ep.path}`
    await navigator.clipboard.writeText(url)
    setCopiedId(ep.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const copyAsCurl = async (ep: MockEndpoint) => {
    const url = `${mockBaseUrl}${ep.path}`
    const isInsecure = url.startsWith('https')
    const curl = `curl ${isInsecure ? '-k ' : ''}-X ${ep.method} "${url}" \\
     -H "Content-Type: application/json"`
    await navigator.clipboard.writeText(curl)
    toast.success('cURL command copied to clipboard')
  }

  const activeCount = endpoints.filter((e) => e.is_active).length

  if (managingScenariosEndpoint) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-surface border border-border rounded-xl shadow-2xl w-[95vw] max-w-6xl h-[90vh] flex flex-col overflow-hidden">
          <ScenariosPanel 
            endpoint={managingScenariosEndpoint} 
            onBack={() => setManagingScenariosEndpoint(null)}
            onUpdateEndpoint={(updated) => {
              setEndpoints(prev => prev.map(e => e.id === updated.id ? updated : e))
              setManagingScenariosEndpoint(updated)
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-[90vw] max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg border transition-colors ${chaosMode ? 'bg-rose-500/10 border-rose-500/30' : 'bg-violet-500/10 border-violet-500/20'}`}>
              <Server size={18} className={chaosMode ? 'text-rose-400' : 'text-violet-400'} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text">Mock Server</h2>
              <p className="text-xs text-muted">
                {collectionName} •{' '}
                <span className="text-violet-400">{activeCount} active</span> /{' '}
                {endpoints.length} endpoint{endpoints.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Chaos Mode toggle */}
            <button
              onClick={toggleChaosMode}
              disabled={togglingChaos}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                chaosMode
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-white/5 text-muted border-border hover:bg-white/10'
              }`}
              title="Toggle chaos mode — injects random errors across all endpoints"
            >
              <Flame size={13} className={chaosMode ? 'animate-pulse' : ''} />
              {chaosMode ? 'Chaos ON' : 'Chaos OFF'}
            </button>

            <button
              onClick={async () => {
                if (!window.confirm('Generate mock endpoints and scenarios from all requests and examples in this collection?')) return
                try {
                  const res = await apiClient.post<{ message: string, count: number }>(`/api/v1/collections/${collectionId}/mock/generate-from-collection`, {})
                  toast.success(res.data.message)
                  fetchEndpoints()
                } catch {
                  toast.error('Failed to generate mocks')
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
              title="Generate mocks from collection requests and examples"
            >
              <Zap size={13} />
              Auto-Generate
            </button>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-black/30 border border-border text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {mockBaseUrl}
            </div>
            <button
              onClick={() => {
                setActiveTab('endpoints')
                setCreating(true)
                setTimeout(() => listBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-all"
            >
              <Plus size={13} />
              New Endpoint
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-white/5 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 pt-2 pb-0 border-b border-border bg-surface/40 flex-shrink-0">
          <button
            onClick={() => setActiveTab('endpoints')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === 'endpoints'
                ? 'border-violet-400 text-violet-400'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            <Server size={12} />
            Endpoints
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === 'logs'
                ? 'border-violet-400 text-violet-400'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            <ScrollText size={12} />
            Request Logs
          </button>
        </div>

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted uppercase tracking-widest">Last 200 Requests</p>
              <button
                onClick={fetchLogs}
                className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
              >
                Refresh
              </button>
            </div>
            {logsLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-5 h-5 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted">
                <ScrollText size={28} className="opacity-20" />
                <p className="text-sm">No requests logged yet</p>
                <p className="text-xs opacity-60">Logs appear after hitting mock endpoints</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-xs ${
                      log.injected_error
                        ? 'border-rose-500/20 bg-rose-500/5'
                        : log.matched
                          ? 'border-border bg-white/[0.02]'
                          : 'border-amber-500/20 bg-amber-500/5'
                    }`}
                  >
                    <MethodBadge method={log.method} size="sm" />
                    <code className="flex-1 truncate font-mono text-[10px] text-text/80">{log.path}</code>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        log.status_code < 300
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : log.status_code < 400
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      {log.status_code}
                    </span>
                    {log.injected_error && (
                      <span className="flex items-center gap-0.5 text-[9px] text-rose-400 font-bold">
                        <AlertTriangle size={9} />
                        chaos
                      </span>
                    )}
                    {!log.matched && (
                      <span className="text-[9px] text-amber-400 font-bold">unmatched</span>
                    )}
                    <span className="flex items-center gap-0.5 text-[10px] text-muted">
                      <Clock size={9} />
                      {log.latency_ms}ms
                    </span>
                    <span className="text-[10px] text-muted/60 shrink-0">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'endpoints' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Quick Mock from Requests */}
          <div className="w-60 shrink-0 border-r border-border overflow-y-auto py-3 px-2 bg-background/20 shadow-inner">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-widest px-2 mb-2">
              Quick Mock from Request
            </p>
            {requests.length === 0 ? (
              <p className="text-xs text-muted px-2">No requests in collection</p>
            ) : (
              requests.map((req) => (
                <button
                  key={req.id}
                  onClick={() => handleQuickMock(req)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-muted hover:text-text hover:bg-white/5 transition-colors"
                  title={`Create mock from ${req.name}`}
                >
                  <MethodBadge method={req.method} size="sm" />
                  <span className="truncate text-left">{req.name}</span>
                  <Zap size={11} className="ml-auto shrink-0 opacity-40" />
                </button>
              ))
            )}
          </div>

          {/* Endpoint List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {endpoints.length === 0 && !creating ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted">
                    <Server size={32} className="opacity-20" />
                    <p className="text-sm">No mock endpoints yet</p>
                    <button
                      onClick={() => {
                        setCreating(true)
                        setTimeout(() => listBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-all"
                    >
                      <Plus size={13} />
                      Create First Endpoint
                    </button>
                  </div>
                ) : (
                  <>
                    {endpoints.map((ep) =>
                      editingId === ep.id ? (
                        <MockEndpointForm
                          key={ep.id}
                          collectionId={collectionId}
                          existing={ep}
                          onSave={(updated) => {
                            setEndpoints((prev) =>
                              prev.map((e) => (e.id === updated.id ? updated : e))
                            )
                            setEditingId(null)
                          }}
                          onCancel={() => setEditingId(null)}
                        />
                      ) : (
                        <MockEndpointCard
                          key={ep.id}
                          endpoint={ep}
                          mockBaseUrl={mockBaseUrl}
                          copiedId={copiedId}
                          onEdit={() => setEditingId(ep.id)}
                          onDelete={() => handleDelete(ep.id)}
                          onToggle={() => handleToggle(ep)}
                          onCopy={() => copyMockUrl(ep)}
                          onCopyAsCurl={() => copyAsCurl(ep)}
                          onManageScenarios={() => setManagingScenariosEndpoint(ep)}
                        />
                      )
                    )}
                    {creating && (
                      <MockEndpointForm
                        collectionId={collectionId}
                        onSave={(ep) => {
                          setEndpoints((prev) => [...prev, ep])
                          setCreating(false)
                        }}
                        onCancel={() => setCreating(false)}
                      />
                    )}
                    <div ref={listBottomRef} />
                  </>
                )}
              </>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  )
}

// ─── Endpoint Card ─────────────────────────────────────────────────────────────

const MockEndpointCard: React.FC<{
  endpoint: MockEndpoint
  mockBaseUrl: string
  copiedId: number | null
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  onCopy: () => void
  onCopyAsCurl: () => void
  onManageScenarios: () => void
}> = ({ endpoint, mockBaseUrl, copiedId, onEdit, onDelete, onToggle, onCopy, onCopyAsCurl, onManageScenarios }) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`border rounded-xl overflow-hidden transition-all ${
        endpoint.is_active ? 'border-border' : 'border-white/5 opacity-60'
      }`}
    >
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white/2">
        <MethodBadge method={endpoint.method} size="sm" />
        <div className="flex-1 min-w-0">
          {endpoint.name && (
            <span className="block text-xs font-bold text-text truncate">{endpoint.name}</span>
          )}
          <code className="text-[10px] font-mono text-violet-400/80 truncate block">
            {mockBaseUrl}<span className="text-violet-400">{endpoint.path}</span>
          </code>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {/* Status badge */}
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              endpoint.status_code < 300
                ? 'bg-emerald-500/10 text-emerald-400'
                : endpoint.status_code < 400
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-rose-500/10 text-rose-400'
            }`}
          >
            {endpoint.status_code}
          </span>

          {/* Evaluation Mode badge */}
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold uppercase tracking-tighter ${endpoint.evaluation_mode === 'auto' ? 'border-violet-500/30 text-violet-400 bg-violet-500/5' : 'border-amber-500/30 text-amber-400 bg-amber-500/5'}`}>
            {endpoint.evaluation_mode}
          </span>

          {/* Delay badge */}
          {endpoint.delay_ms > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted">
              <Clock size={9} />
              {endpoint.delay_ms}{endpoint.delay_max_ms > endpoint.delay_ms ? `–${endpoint.delay_max_ms}` : ''}ms
            </span>
          )}

          {/* Error rate badge */}
          {endpoint.error_rate > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-rose-400 font-bold">
              <AlertTriangle size={9} />
              {endpoint.error_rate}%
            </span>
          )}

          {/* Copy URL */}
          <button
            onClick={onCopy}
            className="p-1 rounded text-muted hover:text-text transition-colors"
            title="Copy mock URL"
          >
            {copiedId === endpoint.id ? (
              <Check size={12} className="text-emerald-400" />
            ) : (
              <Copy size={12} />
            )}
          </button>

          {/* Copy as cURL */}
          <button
            onClick={onCopyAsCurl}
            className="p-1 rounded text-muted hover:text-text transition-colors flex items-center gap-1 border border-white/5 px-1.5"
            title="Copy as cURL command"
          >
            <Code size={12} className="text-violet-400" />
            <span className="text-[9px] font-bold uppercase">cURL</span>
          </button>

          {/* Expand body */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded text-muted hover:text-text transition-colors"
            title="View response body"
          >
            <Code size={12} />
          </button>

          {/* Toggle active */}
          <button
            onClick={onToggle}
            className={`p-1 rounded transition-colors ${
              endpoint.is_active
                ? 'text-emerald-400 hover:text-emerald-300'
                : 'text-muted hover:text-text'
            }`}
            title={endpoint.is_active ? 'Disable' : 'Enable'}
          >
            {endpoint.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
          </button>

          {/* Edit */}
          <button
            onClick={onEdit}
            className="p-1 rounded text-muted hover:text-text transition-colors text-[10px] font-medium border border-border px-2"
          >
            Edit
          </button>

          {/* Scenarios */}
          <button
            onClick={onManageScenarios}
            className="flex items-center gap-1 p-1 rounded bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors text-[10px] font-bold border border-violet-500/20 px-2"
          >
            <LayoutGrid size={11} />
            Scenarios
          </button>

          {/* Delete */}
          <button
            onClick={onDelete}
            className="p-1 rounded text-muted hover:text-rose-400 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Expandable body */}
      {expanded && (
        <div className="border-t border-white/5 bg-background/30 shadow-inner rounded-lg p-3">
          <p className="text-[10px] text-muted uppercase tracking-wider mb-1.5">Response Body</p>
          <pre className="text-xs font-mono text-text/80 whitespace-pre-wrap overflow-x-auto">
            {endpoint.response_body || '(empty)'}
          </pre>
        </div>
      )}
    </div>
  )
}

// ─── Endpoint Form ─────────────────────────────────────────────────────────────

interface MockEndpointFormProps {
  collectionId: number
  existing?: MockEndpoint
  onSave: (ep: MockEndpoint) => void
  onCancel: () => void
}

const MockEndpointForm: React.FC<MockEndpointFormProps> = ({
  collectionId,
  existing,
  onSave,
  onCancel
}) => {
  const [name, setName] = useState(existing?.name ?? '')
  const [method, setMethod] = useState(existing?.method ?? 'GET')
  const [path, setPath] = useState(existing?.path ?? '/')
  const [statusCode, setStatusCode] = useState(existing?.status_code ?? 200)
  const [responseBody, setResponseBody] = useState(
    existing?.response_body ?? '{\n  "message": "Hello from Wapbolt Mock!"\n}'
  )
  const [delayMs, setDelayMs] = useState(existing?.delay_ms ?? 0)
  const [delayMaxMs, setDelayMaxMs] = useState(existing?.delay_max_ms ?? 0)
  const [errorRate, setErrorRate] = useState(existing?.error_rate ?? 0)
  const [errorStatusCode, setErrorStatusCode] = useState(existing?.error_status_code ?? 500)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        name, method, path,
        status_code: statusCode,
        response_body: responseBody,
        delay_ms: delayMs,
        delay_max_ms: delayMaxMs,
        error_rate: errorRate,
        error_status_code: errorStatusCode
      }
      let res
      if (existing) {
        res = await apiClient.put<MockEndpoint>(
          `/api/v1/collections/${collectionId}/mock/endpoints/${existing.id}`,
          payload
        )
      } else {
        res = await apiClient.post<MockEndpoint>(
          `/api/v1/collections/${collectionId}/mock/endpoints`,
          payload
        )
      }
      onSave(res.data as MockEndpoint)
      toast.success(existing ? 'Mock endpoint updated' : 'Mock endpoint created')
    } catch {
      toast.error('Failed to save mock endpoint')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-violet-500/20 rounded-xl bg-violet-500/5 p-4 space-y-3">
      <p className="text-xs font-semibold text-violet-400">
        {existing ? 'Edit Endpoint' : 'New Mock Endpoint'}
      </p>

      {/* Name */}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Endpoint Name (e.g. Get User Profile)"
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-medium text-text placeholder-muted focus:outline-none focus:border-violet-500/50"
      />

      {/* Method + Path */}
      <div className="flex gap-2">
        <div className="relative">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className={`appearance-none bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono font-bold uppercase cursor-pointer ${METHOD_COLOR[method] || 'text-text'} focus:outline-none focus:border-violet-500/50 pr-7`}
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m} className="text-text font-sans">
                {m}
              </option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        </div>
        <input
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="/path/to/endpoint"
          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-text placeholder-muted focus:outline-none focus:border-violet-500/50"
        />
      </div>

      {/* Status code */}
      <div>
        <label className="block text-[10px] text-muted mb-1">Status Code</label>
        <input
          type="number"
          value={statusCode}
          onChange={(e) => setStatusCode(Number(e.target.value))}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-text focus:outline-none focus:border-violet-500/50"
        />
      </div>

      {/* Delay range */}
      <div>
        <label className="block text-[10px] text-muted mb-1">
          Delay — <span className="text-text/60">min / max (ms). Set max &gt; min for random range.</span>
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            value={delayMs}
            min={0}
            max={30000}
            placeholder="Min ms"
            onChange={(e) => setDelayMs(Number(e.target.value))}
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-text focus:outline-none focus:border-violet-500/50"
          />
          <input
            type="number"
            value={delayMaxMs}
            min={0}
            max={30000}
            placeholder="Max ms (0 = fixed)"
            onChange={(e) => setDelayMaxMs(Number(e.target.value))}
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-text focus:outline-none focus:border-violet-500/50"
          />
        </div>
      </div>

      {/* Error injection */}
      <div>
        <label className="block text-[10px] text-muted mb-1">
          Error Injection — <span className="text-text/60">rate (0–100%) and status code to return</span>
        </label>
        <div className="flex gap-2 items-center">
          <div className="flex-1 flex items-center gap-2">
            <input
              type="range"
              value={errorRate}
              min={0}
              max={100}
              onChange={(e) => setErrorRate(Number(e.target.value))}
              className="flex-1 accent-rose-400"
            />
            <span className={`text-xs font-mono w-8 text-right ${errorRate > 0 ? 'text-rose-400' : 'text-muted'}`}>
              {errorRate}%
            </span>
          </div>
          <input
            type="number"
            value={errorStatusCode}
            min={100}
            max={599}
            placeholder="500"
            onChange={(e) => setErrorStatusCode(Number(e.target.value))}
            className="w-20 bg-background border border-border rounded-lg px-2 py-2 text-xs font-mono text-text focus:outline-none focus:border-rose-500/50"
            title="Error status code"
          />
        </div>
        {errorRate > 0 && (
          <p className="text-[10px] text-rose-400/70 mt-1">
            ~{errorRate}% of requests will return {errorStatusCode}
          </p>
        )}
      </div>

      {/* Response body */}
      <div>
        <label className="block text-[10px] text-muted mb-1">Response Body</label>
        <textarea
          value={responseBody}
          onChange={(e) => setResponseBody(e.target.value)}
          rows={5}
          placeholder='{"key": "value"}'
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-text placeholder-muted focus:outline-none focus:border-violet-500/50 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg text-xs text-muted border border-border hover:bg-white/5 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2 rounded-lg text-xs font-medium bg-violet-500/80 hover:bg-violet-500 text-white transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving...' : existing ? 'Update' : 'Create'}
        </button>
      </div>
    </div>
  )
}
