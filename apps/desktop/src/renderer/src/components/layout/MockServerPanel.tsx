import React, { useEffect, useState, useCallback } from 'react'
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
  Zap
} from 'lucide-react'
import { apiClient } from '../../api/client'
import type { MockEndpoint, ApiRequest } from '../../types'
import { MethodBadge } from '../ui/MethodBadge'
import { toast } from 'sonner'

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

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

  const mockBaseUrl = `http://localhost:8000/mock/${collectionId}`

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

  useEffect(() => {
    fetchEndpoints()
  }, [fetchEndpoints])

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
      const res = await apiClient.put<MockEndpoint>(
        `/api/v1/collections/${collectionId}/mock/endpoints/${ep.id}`,
        {
          method: ep.method,
          path: ep.path,
          status_code: ep.status_code,
          response_headers: ep.response_headers,
          response_body: ep.response_body,
          delay_ms: ep.delay_ms,
          is_active: !ep.is_active
        }
      )
      setEndpoints((prev) => prev.map((e) => (e.id === ep.id ? (res.data as MockEndpoint) : e)))
      toast.success(ep.is_active ? 'Mock endpoint disabled' : 'Mock endpoint enabled')
    } catch {
      toast.error('Failed to toggle')
    }
  }

  const handleQuickMock = async (request: ApiRequest) => {
    try {
      const res = await apiClient.post<MockEndpoint>(
        `/api/v1/collections/${collectionId}/mock/endpoints/0/from-request/${request.id}`
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

  const activeCount = endpoints.filter((e) => e.is_active).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-white/10 rounded-xl shadow-2xl w-[90vw] max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-surface/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <Server size={18} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Mock Server</h2>
              <p className="text-xs text-muted">
                {collectionName} •{' '}
                <span className="text-violet-400">{activeCount} active</span> /{' '}
                {endpoints.length} endpoint{endpoints.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-black/30 border border-white/10 text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {mockBaseUrl}
            </div>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-all"
            >
              <Plus size={13} />
              New Endpoint
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Quick Mock from Requests */}
          <div className="w-60 flex-shrink-0 border-r border-white/10 overflow-y-auto py-3 px-2 bg-black/20">
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
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-muted hover:text-foreground hover:bg-white/5 transition-colors"
                  title={`Create mock from ${req.name}`}
                >
                  <MethodBadge method={req.method} size="sm" />
                  <span className="truncate text-left">{req.name}</span>
                  <Zap size={11} className="ml-auto flex-shrink-0 opacity-40" />
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

                {endpoints.length === 0 && !creating ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted">
                    <Server size={32} className="opacity-20" />
                    <p className="text-sm">No mock endpoints yet</p>
                    <button
                      onClick={() => setCreating(true)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-all"
                    >
                      <Plus size={13} />
                      Create First Endpoint
                    </button>
                  </div>
                ) : (
                  endpoints.map((ep) =>
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
                      />
                    )
                  )
                )}
              </>
            )}
          </div>
        </div>
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
}> = ({ endpoint, mockBaseUrl, copiedId, onEdit, onDelete, onToggle, onCopy }) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`border rounded-xl overflow-hidden transition-all ${
        endpoint.is_active ? 'border-white/10' : 'border-white/5 opacity-60'
      }`}
    >
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.02]">
        <MethodBadge method={endpoint.method} size="sm" />
        <code className="flex-1 text-xs font-mono text-foreground/90 truncate">
          {mockBaseUrl}
          <span className="text-violet-400">{endpoint.path}</span>
        </code>

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

          {/* Delay badge */}
          {endpoint.delay_ms > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted">
              <Clock size={9} />
              {endpoint.delay_ms}ms
            </span>
          )}

          {/* Copy URL */}
          <button
            onClick={onCopy}
            className="p-1 rounded text-muted hover:text-foreground transition-colors"
            title="Copy mock URL"
          >
            {copiedId === endpoint.id ? (
              <Check size={12} className="text-emerald-400" />
            ) : (
              <Copy size={12} />
            )}
          </button>

          {/* Expand body */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded text-muted hover:text-foreground transition-colors"
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
                : 'text-muted hover:text-foreground'
            }`}
            title={endpoint.is_active ? 'Disable' : 'Enable'}
          >
            {endpoint.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
          </button>

          {/* Edit */}
          <button
            onClick={onEdit}
            className="p-1 rounded text-muted hover:text-foreground transition-colors text-[10px] font-medium border border-white/10 px-2"
          >
            Edit
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
        <div className="border-t border-white/5 bg-black/30 p-3">
          <p className="text-[10px] text-muted uppercase tracking-wider mb-1.5">Response Body</p>
          <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap overflow-x-auto">
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
  const [method, setMethod] = useState(existing?.method ?? 'GET')
  const [path, setPath] = useState(existing?.path ?? '/')
  const [statusCode, setStatusCode] = useState(existing?.status_code ?? 200)
  const [responseBody, setResponseBody] = useState(
    existing?.response_body ?? '{\n  "message": "Hello from Wapify Mock!"\n}'
  )
  const [delayMs, setDelayMs] = useState(existing?.delay_ms ?? 0)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { method, path, status_code: statusCode, response_body: responseBody, delay_ms: delayMs }
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

      {/* Method + Path */}
      <div className="flex gap-2">
        <div className="relative">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="appearance-none bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-violet-500/50 pr-7"
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>
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
          className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-foreground placeholder-muted focus:outline-none focus:border-violet-500/50"
        />
      </div>

      {/* Status code + Delay */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-[10px] text-muted mb-1">Status Code</label>
          <input
            type="number"
            value={statusCode}
            onChange={(e) => setStatusCode(Number(e.target.value))}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-violet-500/50"
          />
        </div>
        <div className="flex-1">
          <label className="block text-[10px] text-muted mb-1">Delay (ms)</label>
          <input
            type="number"
            value={delayMs}
            min={0}
            max={10000}
            onChange={(e) => setDelayMs(Number(e.target.value))}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-violet-500/50"
          />
        </div>
      </div>

      {/* Response body */}
      <div>
        <label className="block text-[10px] text-muted mb-1">Response Body</label>
        <textarea
          value={responseBody}
          onChange={(e) => setResponseBody(e.target.value)}
          rows={5}
          placeholder='{"key": "value"}'
          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-foreground placeholder-muted focus:outline-none focus:border-violet-500/50 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg text-xs text-muted border border-white/10 hover:bg-white/5 transition-colors"
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
