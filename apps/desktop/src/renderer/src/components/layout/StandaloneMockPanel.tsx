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
  LayoutGrid,
  ArrowRight,
  FolderInput,
  MoveRight
} from 'lucide-react'
import { apiClient, getBaseUrl } from '../../api/client'
import type { MockEndpoint, Collection, Team } from '../../types'
import { MethodBadge } from '../ui/MethodBadge'
import { toast } from 'sonner'
import { ScenariosPanel } from './ScenariosPanel'
import { useDataStore } from '../../store/useDataStore'

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
  const [transferringEndpoint, setTransferringEndpoint] = useState<MockEndpoint | null>(null)
  const [bulkTransferOpen, setBulkTransferOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [managingScenariosEndpoint, setManagingScenariosEndpoint] = useState<MockEndpoint | null>(null)
  const listBottomRef = useRef<HTMLDivElement>(null)

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

  const handleTransfer = async (
    ep: MockEndpoint,
    targetType: 'collection' | 'standalone',
    targetId: number,
    mode: 'copy' | 'move'
  ) => {
    try {
      await apiClient.post(`/api/v1/mock/endpoints/${ep.id}/transfer`, {
        target_type: targetType,
        target_id: targetId,
        mode
      })
      if (mode === 'move') {
        setEndpoints((prev) => prev.filter((e) => e.id !== ep.id))
        toast.success(targetType === 'collection' ? 'Endpoint dipindahkan ke collection mock' : 'Endpoint dipindahkan ke workspace lain')
      } else {
        toast.success(targetType === 'collection' ? 'Endpoint disalin ke collection mock' : 'Endpoint disalin ke workspace lain')
      }
      setTransferringEndpoint(null)
    } catch {
      toast.error('Gagal transfer endpoint')
    }
  }

  const handleBulkTransfer = async (
    targetType: 'collection' | 'standalone',
    targetId: number,
    mode: 'copy' | 'move'
  ) => {
    try {
      const res = await apiClient.post<{ message: string; count: number }>(
        `/api/v1/workspaces/${teamId}/mock/endpoints/transfer-bulk`,
        { target_type: targetType, target_id: targetId, mode }
      )
      if (mode === 'move') {
        setEndpoints([])
      }
      toast.success((res.data as { message: string; count: number }).message)
      setBulkTransferOpen(false)
    } catch {
      toast.error('Gagal bulk transfer endpoint')
    }
  }

  const activeCount = endpoints.filter((e) => e.is_active).length

  if (bulkTransferOpen) {
    return (
      <BulkTransferModal
        teamId={teamId}
        endpointCount={endpoints.length}
        onTransfer={handleBulkTransfer}
        onClose={() => setBulkTransferOpen(false)}
      />
    )
  }

  if (transferringEndpoint) {
    return (
      <TransferMockModal
        endpoint={transferringEndpoint}
        currentTeamId={teamId}
        onTransfer={handleTransfer}
        onClose={() => setTransferringEndpoint(null)}
      />
    )
  }

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
            {endpoints.length > 0 && (
              <button
                onClick={() => setBulkTransferOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all"
                title="Transfer semua endpoint ke collection atau workspace lain"
              >
                <MoveRight size={13} />
                Transfer All
              </button>
            )}
            <button
              onClick={() => {
                setCreating(true)
                setTimeout(() => listBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
              }}
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
              {endpoints.length === 0 && !creating ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted">
                  <Server size={32} className="opacity-20" />
                  <p className="text-sm">No standalone mock endpoints yet</p>
                  <button
                    onClick={() => {
                      setCreating(true)
                      setTimeout(() => listBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                  >
                    <Plus size={13} />
                    Create Workspace Mock
                  </button>
                </div>
              ) : (
                <>
                  {endpoints.map((ep) =>
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
                        onTransfer={() => setTransferringEndpoint(ep)}
                      />
                    )
                  )}
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
                  <div ref={listBottomRef} />
                </>
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
  onTransfer: () => void
}> = ({ endpoint, mockBaseUrl, copiedId, onEdit, onDelete, onToggle, onCopy, onCopyAsCurl, onManageScenarios, onTransfer }) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`border rounded-xl overflow-hidden transition-all ${
        endpoint.is_active ? 'border-border' : 'border-white/5 opacity-60'
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.02]">
        <MethodBadge method={endpoint.method} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-text truncate">
              {endpoint.name || 'Untitled Endpoint'}
            </span>
            {!endpoint.name && (
              <span className="text-[10px] text-muted font-mono truncate opacity-50 italic">
                (no name set)
              </span>
            )}
          </div>
          <code className="text-[10px] font-mono text-emerald-400/70 truncate block">
            <span className="opacity-50">{mockBaseUrl}</span>{endpoint.path}
          </code>
        </div>

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
            onClick={onTransfer}
            className="flex items-center gap-1 p-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors text-[10px] font-bold border border-blue-500/20 px-2"
            title="Transfer ke Collection Mock"
          >
            <FolderInput size={11} />
            Transfer
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
  const [name, setName] = useState(existing?.name ?? '')
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
      const payload = {
        name,
        method,
        path,
        status_code: statusCode,
        response_body: responseBody,
        delay_ms: delayMs,
      }
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
      toast.success(existing ? 'Mock updated' : 'Mock created')
    } catch {
      toast.error('Failed to save mock endpoint')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-emerald-500/20 rounded-xl bg-emerald-500/5 p-4 space-y-3 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-emerald-400">
          {existing ? 'Edit Endpoint' : 'New Mock Endpoint'}
        </p>
      </div>

      <div className="space-y-2 text-text">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Endpoint Name (e.g. Get User Profile)"
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-medium text-text placeholder-muted focus:outline-none focus:border-emerald-500/50"
        />

        <div className="flex gap-2">
          <div className="relative">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className={`appearance-none bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono font-bold uppercase cursor-pointer ${METHOD_COLOR[method] || 'text-text'} focus:outline-none focus:border-emerald-500/50 pr-7`}
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

const TransferMockModal: React.FC<{
  endpoint: MockEndpoint
  currentTeamId: number
  onTransfer: (ep: MockEndpoint, targetType: 'collection' | 'standalone', targetId: number, mode: 'copy' | 'move') => Promise<void>
  onClose: () => void
}> = ({ endpoint, currentTeamId, onTransfer, onClose }) => {
  const { collections, teams } = useDataStore() as { collections: Collection[]; teams: Team[] }
  const [targetType, setTargetType] = useState<'collection' | 'standalone'>('collection')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [mode, setMode] = useState<'copy' | 'move'>('copy')
  const [loading, setLoading] = useState(false)

  const otherTeams = teams.filter((t) => t.id !== currentTeamId)

  const handleSubmit = async () => {
    if (!selectedId) return
    setLoading(true)
    await onTransfer(endpoint, targetType, selectedId, mode)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5 text-text">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderInput size={16} className="text-blue-400" />
            <h3 className="text-sm font-semibold">Transfer Endpoint</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-muted hover:text-text transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="bg-white/5 border border-border rounded-lg px-3 py-2 text-xs">
          <span className="text-muted">Endpoint: </span>
          <span className="font-mono text-emerald-400">{endpoint.method}</span>
          <span className="text-muted ml-1">{endpoint.path}</span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-muted mb-1.5 uppercase tracking-wider">Tujuan Transfer</label>
            <div className="flex gap-2">
              <button
                onClick={() => { setTargetType('collection'); setSelectedId(null) }}
                className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${targetType === 'collection' ? 'bg-violet-500/15 border-violet-500/40 text-violet-400' : 'border-border text-muted hover:bg-white/5'}`}
              >
                Collection Mock
              </button>
              <button
                onClick={() => { setTargetType('standalone'); setSelectedId(null) }}
                className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${targetType === 'standalone' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' : 'border-border text-muted hover:bg-white/5'}`}
              >
                Workspace Lain
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-muted mb-1.5 uppercase tracking-wider">
              {targetType === 'collection' ? 'Pilih Collection' : 'Pilih Workspace'}
            </label>
            <select
              value={selectedId || ''}
              onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-text focus:outline-none focus:border-blue-500/50 cursor-pointer"
            >
              <option value="">-- {targetType === 'collection' ? 'Pilih collection' : 'Pilih workspace'} --</option>
              {targetType === 'collection'
                ? collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
                : otherTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)
              }
            </select>
            {targetType === 'standalone' && otherTeams.length === 0 && (
              <p className="text-[10px] text-muted mt-1">Tidak ada workspace lain yang bisa dipilih.</p>
            )}
          </div>

          <div>
            <label className="block text-[10px] text-muted mb-1.5 uppercase tracking-wider">Mode Transfer</label>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('copy')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-all ${mode === 'copy' ? 'bg-blue-500/15 border-blue-500/40 text-blue-400' : 'border-border text-muted hover:bg-white/5'}`}
              >
                <Copy size={12} />
                Copy
                <span className="text-[10px] opacity-60">(tetap di sini)</span>
              </button>
              <button
                onClick={() => setMode('move')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-all ${mode === 'move' ? 'bg-amber-500/15 border-amber-500/40 text-amber-400' : 'border-border text-muted hover:bg-white/5'}`}
              >
                <ArrowRight size={12} />
                Move
                <span className="text-[10px] opacity-60">(hapus dari sini)</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-xs text-muted border border-border hover:bg-white/5 transition-colors">
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedId || loading}
            className="flex-1 py-2 rounded-lg text-xs font-medium bg-blue-500/80 hover:bg-blue-500 text-white transition-colors disabled:opacity-40"
          >
            {loading ? 'Memproses...' : mode === 'copy' ? 'Copy' : 'Pindahkan'}
          </button>
        </div>
      </div>
    </div>
  )
}

const BulkTransferModal: React.FC<{
  teamId: number
  endpointCount: number
  onTransfer: (targetType: 'collection' | 'standalone', targetId: number, mode: 'copy' | 'move') => Promise<void>
  onClose: () => void
}> = ({ teamId, endpointCount, onTransfer, onClose }) => {
  const { collections, teams } = useDataStore() as { collections: Collection[]; teams: Team[] }
  const [targetType, setTargetType] = useState<'collection' | 'standalone'>('collection')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [mode, setMode] = useState<'copy' | 'move'>('copy')
  const [loading, setLoading] = useState(false)

  const otherTeams = teams.filter((t) => t.id !== teamId)

  const handleSubmit = async () => {
    if (!selectedId) return
    setLoading(true)
    await onTransfer(targetType, selectedId, mode)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5 text-text">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MoveRight size={16} className="text-blue-400" />
            <h3 className="text-sm font-semibold">Transfer Semua Endpoint</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-muted hover:text-text transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg px-3 py-2 text-xs text-blue-300">
          Akan mentransfer <span className="font-bold">{endpointCount} endpoint</span> sekaligus beserta semua scenarionya.
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-muted mb-1.5 uppercase tracking-wider">Tujuan Transfer</label>
            <div className="flex gap-2">
              <button
                onClick={() => { setTargetType('collection'); setSelectedId(null) }}
                className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${targetType === 'collection' ? 'bg-violet-500/15 border-violet-500/40 text-violet-400' : 'border-border text-muted hover:bg-white/5'}`}
              >
                Collection Mock
              </button>
              <button
                onClick={() => { setTargetType('standalone'); setSelectedId(null) }}
                className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${targetType === 'standalone' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' : 'border-border text-muted hover:bg-white/5'}`}
              >
                Workspace Lain
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-muted mb-1.5 uppercase tracking-wider">
              {targetType === 'collection' ? 'Pilih Collection' : 'Pilih Workspace'}
            </label>
            <select
              value={selectedId || ''}
              onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-text focus:outline-none focus:border-blue-500/50 cursor-pointer"
            >
              <option value="">-- {targetType === 'collection' ? 'Pilih collection' : 'Pilih workspace'} --</option>
              {targetType === 'collection'
                ? collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
                : otherTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)
              }
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-muted mb-1.5 uppercase tracking-wider">Mode Transfer</label>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('copy')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-all ${mode === 'copy' ? 'bg-blue-500/15 border-blue-500/40 text-blue-400' : 'border-border text-muted hover:bg-white/5'}`}
              >
                <Copy size={12} />
                Copy
                <span className="text-[10px] opacity-60">(tetap di sini)</span>
              </button>
              <button
                onClick={() => setMode('move')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-all ${mode === 'move' ? 'bg-rose-500/15 border-rose-500/40 text-rose-400' : 'border-border text-muted hover:bg-white/5'}`}
              >
                <ArrowRight size={12} />
                Move
                <span className="text-[10px] opacity-60">(hapus semua dari sini)</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-xs text-muted border border-border hover:bg-white/5 transition-colors">
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedId || loading}
            className="flex-1 py-2 rounded-lg text-xs font-medium bg-blue-500/80 hover:bg-blue-500 text-white transition-colors disabled:opacity-40"
          >
            {loading ? 'Memproses...' : mode === 'copy' ? `Copy ${endpointCount} Endpoint` : `Pindahkan ${endpointCount} Endpoint`}
          </button>
        </div>
      </div>
    </div>
  )
}
