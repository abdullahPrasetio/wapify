import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  FileText,
  Download,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder as FolderIcon,
  X,
  Copy,
  Check,
  BookOpen,
  Code,
  AlertCircle,
  PlusCircle
} from 'lucide-react'
import { apiClient } from '../../api/client'
import type { CollectionDocs, DocRequest, Environment } from '../../types'
import { MethodBadge } from '../ui/MethodBadge'
import { toast } from 'sonner'
import { useDataStore } from '../../store/useDataStore'

interface DocumentationPanelProps {
  collectionId: number
  collectionName: string
  onClose: () => void
}

// ─── Variable parsing util ────────────────────────────────────────────────────

function parseVariables(text: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g
  const found: string[] = []
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    if (!found.includes(m[1].trim())) found.push(m[1].trim())
  }
  return found
}

function collectAllVariables(doc: CollectionDocs): string[] {
  const vars = new Set<string>()
  const collectFromRequest = (req: DocRequest) => {
    parseVariables(req.url).forEach((v) => vars.add(v))
    Object.keys(req.headers).forEach((k) => {
      parseVariables(String(req.headers[k] ?? '')).forEach((v) => vars.add(v))
    })
    try {
      parseVariables(JSON.stringify(req.body)).forEach((v) => vars.add(v))
    } catch {}
  }
  doc.root_requests?.forEach(collectFromRequest)
  doc.folders?.forEach((f) => f.requests?.forEach(collectFromRequest))
  return Array.from(vars)
}

// ─── Highlighted text component ───────────────────────────────────────────────

interface VarHighlightProps {
  text: string
  envVars: Record<string, string>
  onSetVar: (key: string) => void
}

const VarHighlight: React.FC<VarHighlightProps> = ({ text, envVars, onSetVar }) => {
  const parts: React.ReactNode[] = []
  const regex = /\{\{([^}]+)\}\}/g
  let last = 0
  let m: RegExpExecArray | null
  let idx = 0

  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(<span key={`t-${idx++}`}>{text.slice(last, m.index)}</span>)
    }
    const varName = m[1].trim()
    const resolved = envVars[varName.toLowerCase()] ?? envVars[varName]
    const isSet = resolved !== undefined
    parts.push(
      <VarToken
        key={`v-${idx++}`}
        varName={varName}
        value={resolved}
        isSet={isSet}
        onSetVar={onSetVar}
      />
    )
    last = m.index + m[0].length
  }

  if (last < text.length) {
    parts.push(<span key={`t-end`}>{text.slice(last)}</span>)
  }

  return <>{parts}</>
}

// ─── Variable token with click popup ─────────────────────────────────────────

interface VarTokenProps {
  varName: string
  value: string | undefined
  isSet: boolean
  onSetVar: (key: string) => void
}

const VarToken: React.FC<VarTokenProps> = ({ varName, value, isSet, onSetVar }) => {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const colorClass = isSet
    ? 'text-emerald-400 bg-emerald-400/5 border-b border-emerald-400/30'
    : 'text-amber-400 bg-amber-400/10 border rounded px-1 py-0.5 border-amber-400/30'

  return (
    <span className="relative inline-block" ref={ref}>
      <span
        onClick={() => setIsOpen(!isOpen)}
        className={`font-mono text-[11px] cursor-pointer transition-all hover:opacity-80 ${colorClass}`}
        title={isSet ? `Variable: {{${varName}}}` : `Missing variable: {{${varName}}}`}
      >
        {isSet ? value : `{{${varName}}}`}
      </span>
      {isOpen && (
        <VarPopup
          varName={varName}
          value={value}
          isSet={isSet}
          onSetVar={() => {
            setIsOpen(false)
            onSetVar(varName)
          }}
        />
      )}
    </span>
  )
}

// ─── Variable popup ───────────────────────────────────────────────────────────

interface VarPopupProps {
  varName: string
  value: string | undefined
  isSet: boolean
  onSetVar: (key: string) => void
}

import { SetVarModal } from '../modals/SetVarModal'

// ... existing code ...

const VarPopup: React.FC<VarPopupProps> = ({ varName, value, isSet, onSetVar }) => {
  return (
    <div
      className="absolute bottom-full left-0 mb-2 z-50 w-64 rounded-xl bg-[#0d1117] border border-white/10 shadow-2xl p-4 backdrop-blur-xl animate-in fade-in zoom-in duration-100"
      style={{ minWidth: '220px' }}
    >
      {/* Arrow */}
      <div className="absolute -bottom-1.5 left-4 w-3 h-3 bg-[#0d1117] border-r border-b border-white/10 rotate-45" />

      <div className="flex items-center gap-2 mb-3">
        {isSet ? (
          <Check size={12} className="text-emerald-400 flex-shrink-0" />
        ) : (
          <AlertCircle size={12} className="text-amber-400 flex-shrink-0" />
        )}
        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
          isSet ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
        }`}>
          {`{{${varName}}}`}
        </span>
      </div>

      <div className="space-y-3">
        {isSet && (
          <div>
            <p className="text-[10px] text-muted mb-1">Current value:</p>
            <div className="bg-black/40 border border-white/10 rounded px-2.5 py-1.5">
              <code className="text-xs text-emerald-300 font-mono break-all leading-relaxed">{value}</code>
            </div>
          </div>
        )}
        
        {!isSet && (
          <p className="text-[10px] text-amber-400/80 leading-relaxed">
            This variable is not set in the active environment.
          </p>
        )}

        <button
          onClick={onSetVar}
          className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
            isSet 
              ? 'bg-white/5 text-muted hover:bg-white/10 border-white/10' 
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
          }`}
        >
          {isSet ? <PlusCircle size={12} /> : <AlertCircle size={12} />}
          {isSet ? 'Change Value' : `Set "${varName}"`}
        </button>
      </div>
    </div>
  )
}



// ─── Main Documentation Panel ─────────────────────────────────────────────────

export const DocumentationPanel: React.FC<DocumentationPanelProps> = ({
  collectionId,
  collectionName,
  onClose
}) => {
  const { environments, activeEnvironmentId, updateEnvironment } = useDataStore()
  const activeEnv = environments.find((e) => e.id === activeEnvironmentId) ?? null
  const envVars: Record<string, string> = activeEnv?.variables ?? {}

  const [docs, setDocs] = useState<CollectionDocs | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<DocRequest | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set())
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [settingVar, setSettingVar] = useState<string | null>(null)

  useEffect(() => {
    const fetchDocs = async () => {
      setLoading(true)
      try {
        const res = await apiClient.get<CollectionDocs>(`/api/v1/collections/${collectionId}/docs`)
        const data = res.data as CollectionDocs
        setDocs(data)
        const allFolderIds = new Set(data.folders?.map((f) => f.id) ?? [])
        setExpandedFolders(allFolderIds)
        const firstReq =
          data.root_requests?.[0] ?? data.folders?.[0]?.requests?.[0] ?? null
        setSelectedRequest(firstReq)
      } catch {
        toast.error('Failed to load documentation')
      } finally {
        setLoading(false)
      }
    }
    fetchDocs()
  }, [collectionId])

  const toggleFolder = (folderId: number) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      next.has(folderId) ? next.delete(folderId) : next.add(folderId)
      return next
    })
  }

  const handleExportMarkdown = async () => {
    try {
      const res = await apiClient.get(`/api/v1/collections/${collectionId}/docs/markdown`, {
        responseType: 'text'
      })
      const blob = new Blob([res.data as string], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${collectionName.replace(/\s+/g, '_')}.md`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Markdown exported successfully')
    } catch {
      toast.error('Failed to export Markdown')
    }
  }

  const handleExportSwagger = async () => {
    try {
      const res = await apiClient.get<unknown>(`/api/v1/collections/${collectionId}/docs/swagger`)
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${collectionName.replace(/\s+/g, '_')}_openapi.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('OpenAPI 3.0 exported successfully')
    } catch {
      toast.error('Failed to export Swagger')
    }
  }

  const copyToClipboard = useCallback(async (text: string, field: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }, [])

  const handleSetVar = useCallback(
    async (key: string, val: string) => {
      if (!activeEnv) {
        toast.error('No active environment selected')
        return
      }
      const newVars = { ...activeEnv.variables, [key]: val }
      await updateEnvironment(activeEnv.id, activeEnv.name, newVars)
      toast.success(`Variable "${key}" set to "${val}"`)
    },
    [activeEnv, updateEnvironment]
  )

  const unresolvedVars = docs ? collectAllVariables(docs).filter((v) => !envVars[v] && !envVars[v.toLowerCase()]) : []

  const totalEndpoints =
    (docs?.root_requests?.length ?? 0) +
    (docs?.folders?.reduce((acc, f) => acc + (f.requests?.length ?? 0), 0) ?? 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-white/10 rounded-xl shadow-2xl w-[90vw] max-w-6xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-surface/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <BookOpen size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">{collectionName}</h2>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted">
                  {totalEndpoints} endpoint{totalEndpoints !== 1 ? 's' : ''}
                </p>
                {unresolvedVars.length > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded px-1.5 py-0.5">
                    <AlertCircle size={9} />
                    {unresolvedVars.length} unresolved var{unresolvedVars.length > 1 ? 's' : ''}
                  </span>
                )}
                {activeEnv && (
                  <span className="text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded px-1.5 py-0.5">
                    {activeEnv.name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportMarkdown}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-foreground border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all"
            >
              <Download size={13} />
              Markdown
            </button>
            <button
              onClick={handleExportSwagger}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all"
            >
              <Code size={13} />
              OpenAPI 3.0
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
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0 border-r border-white/10 overflow-y-auto py-3 px-2 bg-black/20">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {docs?.root_requests?.map((req) => (
                  <SidebarRequestItem
                    key={req.id}
                    request={req}
                    isSelected={selectedRequest?.id === req.id}
                    onClick={() => setSelectedRequest(req)}
                  />
                ))}
                {docs?.folders?.map((folder) => (
                  <div key={folder.id} className="mb-1">
                    <button
                      onClick={() => toggleFolder(folder.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-muted hover:text-foreground hover:bg-white/5 transition-colors"
                    >
                      {expandedFolders.has(folder.id) ? (
                        <>
                          <ChevronDown size={12} className="flex-shrink-0" />
                          <FolderOpen size={13} className="flex-shrink-0 text-amber-400" />
                        </>
                      ) : (
                        <>
                          <ChevronRight size={12} className="flex-shrink-0" />
                          <FolderIcon size={13} className="flex-shrink-0 text-amber-400/60" />
                        </>
                      )}
                      <span className="truncate font-medium">{folder.name}</span>
                      <span className="ml-auto text-[10px] text-muted/60 flex-shrink-0">
                        {folder.requests?.length ?? 0}
                      </span>
                    </button>
                    {expandedFolders.has(folder.id) && folder.requests?.length > 0 && (
                      <div className="ml-4">
                        {folder.requests.map((req) => (
                          <SidebarRequestItem
                            key={req.id}
                            request={req}
                            isSelected={selectedRequest?.id === req.id}
                            onClick={() => setSelectedRequest(req)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {!docs?.folders?.length && !docs?.root_requests?.length && (
                  <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted">
                    <FileText size={20} />
                    <p className="text-xs">No endpoints found</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : selectedRequest ? (
              <RequestDetail
                request={selectedRequest}
                envVars={envVars}
                copiedField={copiedField}
                onCopy={copyToClipboard}
                onSetVar={(key) => setSettingVar(key)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted">
                <BookOpen size={32} className="opacity-30" />
                <p className="text-sm">Select an endpoint to view documentation</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Set Variable Modal */}
      {settingVar && (
        <SetVarModal
          varName={settingVar}
          initialValue={String(activeEnv?.variables[settingVar] || '')}
          activeEnv={activeEnv}
          onSave={handleSetVar}
          onClose={() => setSettingVar(null)}
        />
      )}
    </div>
  )
}

// ─── Sidebar Request Item ──────────────────────────────────────────────────────

const SidebarRequestItem: React.FC<{
  request: DocRequest
  isSelected: boolean
  onClick: () => void
}> = ({ request, isSelected, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all ${
      isSelected
        ? 'bg-primary/15 text-foreground'
        : 'text-muted hover:text-foreground hover:bg-white/5'
    }`}
  >
    <MethodBadge method={request.method} size="sm" />
    <span className="truncate text-left">{request.name}</span>
  </button>
)

// ─── Request Detail ────────────────────────────────────────────────────────────

const RequestDetail: React.FC<{
  request: DocRequest
  envVars: Record<string, string>
  copiedField: string | null
  onCopy: (text: string, field: string) => void
  onSetVar: (key: string) => void
}> = ({ request, envVars, copiedField, onCopy, onSetVar }) => {
  const hasHeaders = request.headers && Object.keys(request.headers).length > 0
  const hasBody =
    request.body &&
    Object.keys(request.body).length > 0 &&
    !Object.values(request.body).every((v) => v === '' || v === null || v === undefined)

  // Resolve a string: replace {{var}} with value if available
  const resolveText = (text: string): string => {
    return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const k = key.trim()
      return envVars[k] ?? envVars[k.toLowerCase()] ?? `{{${k}}}`
    })
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* Method + URL */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <MethodBadge method={request.method} size="md" />
          <h1 className="text-xl font-semibold text-foreground">{request.name}</h1>
        </div>
        <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-lg px-4 py-2.5">
          <code className="flex-1 text-sm text-foreground/90 font-mono break-all leading-relaxed">
            <VarHighlight text={request.url} envVars={envVars} onSetVar={onSetVar} />
          </code>
          <button
            onClick={() => onCopy(resolveText(request.url), 'url')}
            className="flex-shrink-0 p-1 rounded text-muted hover:text-foreground transition-colors"
          >
            {copiedField === 'url' ? (
              <Check size={14} className="text-emerald-400" />
            ) : (
              <Copy size={14} />
            )}
          </button>
        </div>
      </div>

      {/* Description */}
      {request.description && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">
            Description
          </h3>
          <p className="text-sm text-foreground/80 leading-relaxed">{request.description}</p>
        </div>
      )}

      {/* Headers */}
      {hasHeaders && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
            Headers
          </h3>
          <div className="border border-white/10 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left px-4 py-2.5 font-medium text-muted">Key</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted">Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(request.headers).map(([k, v]) => (
                  <tr key={k} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-foreground/90">{k}</td>
                    <td className="px-4 py-2.5 font-mono">
                      <VarHighlight
                        text={String(v)}
                        envVars={envVars}
                        onSetVar={onSetVar}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Body */}
      {hasBody && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-widest">
              Request Body
            </h3>
            <button
              onClick={() => onCopy(JSON.stringify(request.body, null, 2), 'body')}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted hover:text-foreground border border-white/10 hover:border-white/20 transition-all"
            >
              {copiedField === 'body' ? (
                <>
                  <Check size={11} className="text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={11} />
                  Copy
                </>
              )}
            </button>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-lg p-4 overflow-x-auto">
            <pre className="text-xs text-foreground/90 font-mono whitespace-pre-wrap leading-relaxed">
              <VarHighlight
                text={JSON.stringify(request.body, null, 2)}
                envVars={envVars}
                onSetVar={onSetVar}
              />
            </pre>
          </div>
        </div>
      )}

      {/* Response placeholder */}
      <div>
        <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
          Responses
        </h3>
        <div className="border border-white/10 rounded-lg overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/5 border-b border-white/5">
            <span className="text-xs font-mono font-bold text-emerald-400">200</span>
            <span className="text-xs text-muted">Success</span>
          </div>
        </div>
      </div>
    </div>
  )
}
