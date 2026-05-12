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
  LayoutGrid
} from 'lucide-react'
import { apiClient, getBaseUrl } from '../../api/client'
import type { MockEndpoint } from '../../types'
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

interface StandaloneMockPanelProps {
  teamId: number
  workspaceName: string
  onClose: () => void
}

export const StandaloneMockPanel: React.FC<StandaloneMockPanelProps> = ({
  teamId,
  workspaceName,
  onClose
}) => {
  const [endpoints, setEndpoints] = useState<MockEndpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [managingScenariosEndpoint, setManagingScenariosEndpoint] = useState<MockEndpoint | null>(null)

  const mockBaseUrl = `${getBaseUrl()}/mock/w/${teamId}`

  const fetchEndpoints = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<MockEndpoint[]>(
        `/api/v1/workspaces/${teamId}/mock/endpoints`
      )
      setEndpoints(res.data as MockEndpoint[])
    } catch {
      toast.error('Failed to load standalone mock endpoints')
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => {
    fetchEndpoints()
  }, [fetchEndpoints])

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this mock endpoint?')) return
    try {
      await apiClient.delete(`/api/v1/workspaces/${teamId}/mock/endpoints/${id}`)
      setEndpoints((prev) => prev.filter((e) => e.id !== id))
      toast.success('Standalone mock endpoint deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleToggle = async (ep: MockEndpoint) => {
    try {
      const newActiveStatus = !ep.is_active
      const res = await apiClient.put<MockEndpoint>(
        `/api/v1/workspaces/${teamId}/mock/endpoints/${ep.id}`,
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
        <div className="bg-surface border border-border rounded-xl shadow-2xl w-[95vw] max-w-6xl h-[90vh] flex flex-col overflow-hidden text-text">
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
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-[90vw] max-w-5xl h-[85vh] flex flex-col overflow-hidden text-text">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Server size={18} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text">Standalone Mock Server</h2>
              <p className="text-xs text-muted">
                Workspace: {workspaceName} •{' '}
                <span className="text-emerald-400">{activeCount} active</span> /{' '}
                {endpoints.length} endpoint{endpoints.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-black/30 border border-border text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {mockBaseUrl}
            </div>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
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

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {creating && (
                <StandaloneMockEndpointForm
                  teamId={teamId}
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
                  <p className="text-sm">No standalone mock endpoints yet</p>
                  <button
                    onClick={() => setCreating(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                  >
                    <Plus size={13} />
                    Create Workspace Mock
                  </button>
                </div>
              ) : (
                endpoints.map((ep) =>
                  editingId === ep.id ? (
                    <StandaloneMockEndpointForm
                      key={ep.id}
                      teamId={teamId}
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
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

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
      <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.02]">
        <MethodBadge method={endpoint.method} size="sm" />
        <code className="flex-1 text-xs font-mono text-text/90 truncate">
          {mockBaseUrl}
          <span className="text-emerald-400">{endpoint.path}</span>
        </code>

        <div className="flex items-center gap-1.5 ml-auto">
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

          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold uppercase tracking-tighter ${endpoint.evaluation_mode === 'auto' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' : 'border-amber-500/30 text-amber-400 bg-amber-500/5'}`}>
            {endpoint.evaluation_mode}
          </span>

          {endpoint.delay_ms > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted">
              <Clock size={9} />
              {endpoint.delay_ms}ms
            </span>
          )}

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

          <button
            onClick={onCopyAsCurl}
            className="p-1 rounded text-muted hover:text-text transition-colors flex items-center gap-1 border border-white/5 px-1.5"
            title="Copy as cURL command"
          >
            <Code size={12} className="text-emerald-400" />
            <span className="text-[9px] font-bold uppercase">cURL</span>
          </button>

          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded text-muted hover:text-text transition-colors"
            title="View response body"
          >
            <Code size={12} />
          </button>

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

          <button
            onClick={onEdit}
            className="p-1 rounded text-muted hover:text-text transition-colors text-[10px] font-medium border border-border px-2"
          >
            Edit
          </button>

          <button
            onClick={onManageScenarios}
            className="flex items-center gap-1 p-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-[10px] font-bold border border-emerald-500/20 px-2"
          >
            <LayoutGrid size={11} />
            Scenarios
          </button>

          <button
            onClick={onDelete}
            className="p-1 rounded text-muted hover:text-rose-400 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/5 bg-black/30 p-3">
          <p className="text-[10px] text-muted uppercase tracking-wider mb-1.5">Response Body</p>
          <pre className="text-xs font-mono text-text/80 whitespace-pre-wrap overflow-x-auto">
            {endpoint.response_body || '(empty)'}
          </pre>
        </div>
      )}
    </div>
  )
}

interface StandaloneMockEndpointFormProps {
  teamId: number
  existing?: MockEndpoint
  onSave: (ep: MockEndpoint) => void
  onCancel: () => void
}

const StandaloneMockEndpointForm: React.FC<StandaloneMockEndpointFormProps> = ({
  teamId,
  existing,
  onSave,
  onCancel
}) => {
  const [method, setMethod] = useState(existing?.method ?? 'GET')
  const [path, setPath] = useState(existing?.path ?? '/')
  const [statusCode, setStatusCode] = useState(existing?.status_code ?? 200)
  const [responseBody, setResponseBody] = useState(
    existing?.response_body ?? '{\n  "message": "Hello from Standalone Mock!"\n}'
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
          `/api/v1/workspaces/${teamId}/mock/endpoints/${existing.id}`,
          payload
        )
      } else {
        res = await apiClient.post<MockEndpoint>(
          `/api/v1/workspaces/${teamId}/mock/endpoints`,
          payload
        )
      }
      onSave(res.data as MockEndpoint)
      toast.success(existing ? 'Standalone mock updated' : 'Standalone mock created')
    } catch {
      toast.error('Failed to save standalone mock endpoint')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-emerald-500/20 rounded-xl bg-emerald-500/5 p-4 space-y-3">
      <p className="text-xs font-semibold text-emerald-400">
        {existing ? 'Edit Standalone Endpoint' : 'New Standalone Mock'}
      </p>

      <div className="flex gap-2 text-text">
        <div className="relative">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className={`appearance-none bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono font-bold uppercase ${METHOD_COLOR[method] || 'text-text'} focus:outline-none focus:border-emerald-500/50 pr-7`}
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
          placeholder="/api/mock/path"
          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-text placeholder-muted focus:outline-none focus:border-emerald-500/50"
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-[10px] text-muted mb-1">Status Code</label>
          <input
            type="number"
            value={statusCode}
            onChange={(e) => setStatusCode(Number(e.target.value))}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-text focus:outline-none focus:border-emerald-500/50"
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
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-text focus:outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] text-muted mb-1">Response Body</label>
        <textarea
          value={responseBody}
          onChange={(e) => setResponseBody(e.target.value)}
          rows={5}
          placeholder='{"key": "value"}'
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-text placeholder-muted focus:outline-none focus:border-emerald-500/50 resize-none"
        />
      </div>

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
          className="flex-1 py-2 rounded-lg text-xs font-medium bg-emerald-500/80 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving...' : existing ? 'Update' : 'Create'}
        </button>
      </div>
    </div>
  )
}
