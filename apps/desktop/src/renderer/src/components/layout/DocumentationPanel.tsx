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
  PlusCircle,
  Play,
  Trash2,
  Cloud,
  Loader2
} from 'lucide-react'
import { apiClient } from '../../api/client'
import type { CollectionDocs, DocRequest } from '../../types'
import { MethodBadge } from '../ui/MethodBadge'
import { toast } from 'sonner'
import { useDataStore } from '../../store/useDataStore'
import { useAppStore } from '../../store/useAppStore'

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

// (Legacy annotation parsing removed, now handled by field_validations metadata)

// ─── Validation Badge Colors ──────────────────────────────────────────────────

const RULE_STYLES: Record<string, string> = {
  required: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  nullable: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  email: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  url: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  unique: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  boolean: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  numeric: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  integer: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  string: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  array: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  object: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

function getRuleStyle(rule: string): string {
  const base = rule.split(':')[0].toLowerCase()
  return RULE_STYLES[base] ?? 'bg-primary/10 text-primary border-primary/20'
}

// ─── Validation Badges Component ─────────────────────────────────────────────

import type { FieldValidationRule } from '../../types'

interface ValidationBadgesProps {
  rule?: FieldValidationRule | null
}

const ValidationBadges: React.FC<ValidationBadgesProps> = ({ rule }) => {
  if (!rule || (rule.rules.length === 0 && !rule.description && rule.min === 0 && rule.max === 0)) return null

  return (
    <span className="inline-flex flex-wrap items-center gap-1 ml-2">
      {rule.rules.map((r) => (
        <span
          key={r}
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${getRuleStyle(r)
            }`}
        >
          {r}
        </span>
      ))}

      {rule.min > 0 && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border bg-slate-500/10 text-slate-400 border-slate-500/20">
          Min: {rule.min}
        </span>
      )}

      {rule.max > 0 && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border bg-slate-500/10 text-slate-400 border-slate-500/20">
          Max: {rule.max}
        </span>
      )}

    </span>
  )
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
    } catch { }
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
    ? 'text-success bg-emerald-400/5 border-b border-emerald-400/30'
    : 'text-warning bg-amber-400/10 border rounded px-1 py-0.5 border-amber-400/30'

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
      className="absolute bottom-full left-0 mb-2 z-50 w-64 rounded-xl bg-surface border border-border/50 shadow-2xl p-4 backdrop-blur-xl animate-in fade-in zoom-in duration-100"
      style={{ minWidth: '220px' }}
    >
      {/* Arrow */}
      <div className="absolute -bottom-1.5 left-4 w-3 h-3 bg-surface border-r border-b border-border/50 rotate-45" />

      <div className="flex items-center gap-2 mb-3">
        {isSet ? (
          <Check size={12} className="text-success flex-shrink-0" />
        ) : (
          <AlertCircle size={12} className="text-warning flex-shrink-0" />
        )}
        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${isSet ? 'bg-emerald-500/10 text-success' : 'bg-amber-500/10 text-warning'
          }`}>
          {`{{${varName}}}`}
        </span>
      </div>

      <div className="space-y-3">
        {isSet && (
          <div>
            <p className="text-[10px] text-muted mb-1">Current value:</p>
            <div className="bg-background/80 shadow-inner border border-border rounded px-2.5 py-1.5">
              <code className="text-xs text-emerald-300 font-mono break-all leading-relaxed">{value}</code>
            </div>
          </div>
        )}

        {!isSet && (
          <p className="text-[10px] text-warning/80 leading-relaxed">
            This variable is not set in the active environment.
          </p>
        )}

        <button
          onClick={() => onSetVar(varName)}
          className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${isSet
            ? 'bg-white/5 text-muted hover:bg-white/10 border-border'
            : 'bg-amber-500/10 text-warning border-amber-500/20 hover:bg-amber-500/20'
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
  const { environments, activeEnvironmentId, updateEnvironment, openExample, deleteExample, confluenceEnabled } = useDataStore()
  const { setActiveView } = useAppStore()
  const activeEnv = environments.find((e) => e.id === activeEnvironmentId) ?? null
  const envVars: Record<string, string> = activeEnv?.variables ?? {}

  const [docs, setDocs] = useState<CollectionDocs | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<DocRequest | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set())
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [settingVar, setSettingVar] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showSyncOptions, setShowSyncOptions] = useState(false)

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

  const handleSyncToConfluence = async (syncContent: SyncContent = 'documentation', syncOrder: SyncOrder = 'doc_first') => {
    setShowSyncOptions(false)
    setIsSyncing(true)
    try {
      // 1. Get Confluence Config from Backend
      const configRes = await apiClient.get('/api/v1/confluence/config')
      const configData = configRes.data as any
      if (configRes.status !== 200 || !configData.enabled) {
        toast.error('Confluence integration is disabled by admin')
        return
      }

      const { base_url, confluence_email, confluence_pat, confluence_api_token, auth_method } = configData

      // 2. Get Collection details (for confluence_page_id)
      const collRes = await apiClient.get(`/api/v1/collections/${collectionId}`)
      const collection = (collRes.data as any).collection
      const pageId = collection.confluence_page_id

      if (!pageId) {
        toast.error('Confluence Page ID not set for this collection. Set it in Collection Settings.')
        return
      }

      // 3. Get Current Page to get version
      if (!window.api) { toast.error('Confluence sync requires the Electron desktop app.'); return }
      const pageData = await window.api.getConfluencePage({
        baseUrl: base_url,
        email: confluence_email,
        pat: confluence_pat,
        apiToken: confluence_api_token,
        authMethod: auth_method,
        pageId
      })
      if (!pageData.success) {
        toast.error(`Failed to fetch Confluence page: ${pageData.error}`)
        return
      }

      const currentVersion = pageData.data?.version?.number || 0
      const nextVersion = currentVersion + 1

      // Helper to resolve variables {{var}} -> value
      const resolveText = (text: string): string => {
        if (!text) return ''
        return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
          const k = key.trim()
          return envVars[k] ?? envVars[k.toLowerCase()] ?? `{{${k}}}`
        })
      }

      // 4. Generate Content (Storage Format)
      const generateContent = () => {
        if (!docs) return ''

        let html = `<h1>${docs.collection_name || collectionName || 'API Documentation'}</h1>`
        if (docs.description) html += `<p>${resolveText(docs.description)}</p>`

        // Add Table of Contents Macro
        html += `<ac:structured-macro ac:name="toc" ac:schema-version="1">`
        html += `<ac:parameter ac:name="outline">true</ac:parameter>`
        html += `<ac:parameter ac:name="maxLevel">3</ac:parameter>`
        html += `</ac:structured-macro>`

        const renderValidation = (rule: any) => {
          if (!rule) return ''
          const badges: string[] = []

          if (rule.rules && Array.isArray(rule.rules)) {
            rule.rules.forEach((r: string) => {
              const color = '#42526e' // neutral slate for all rules
              badges.push(`<strong><span style="color: ${color};">[${r.toUpperCase()}]</span></strong>`)
            })
          }

          if (rule.min && rule.min > 0) badges.push(`<strong><span style="color: #42526e;">[MIN:${rule.min}]</span></strong>`)
          if (rule.max && rule.max > 0) badges.push(`<strong><span style="color: #42526e;">[MAX:${rule.max}]</span></strong>`)

          return badges.join(' ')
        }

        const renderRequest = (req: DocRequest) => {
          if (!req) return ''

          const getMethodColor = (m: string) => {
            switch ((m || 'GET').toUpperCase()) {
              case 'GET': return '#10b981' // emerald-500
              case 'POST': return '#f59e0b' // amber-500
              case 'PUT': return '#3b82f6' // blue-500
              case 'PATCH': return '#0ea5e9' // sky-500
              case 'DELETE': return '#f43f5e' // rose-500
              case 'HEAD': return '#a855f7' // purple-500
              case 'OPTIONS': return '#64748b' // slate-500
              default: return '#64748b'
            }
          }
          const methodColor = getMethodColor(req.method)

          let reqHtml = `<hr/>`
          reqHtml += `<h2><strong><span style="color: ${methodColor};">${req.method || 'GET'}</span></strong> ${req.name || 'Untitled Request'}</h2>`
          reqHtml += `<p><code>${resolveText(req.url || '')}</code></p>`

          if (req.description) reqHtml += `<p><em>${resolveText(req.description)}</em></p>`

          // Generate cURL Example
          const generateCurl = (r: DocRequest) => {
            let curl = `curl -X ${r.method || 'GET'} "${resolveText(r.url || '')}"`
            if (r.headers && Object.keys(r.headers).length > 0) {
              Object.entries(r.headers).forEach(([k, v]) => {
                curl += ` \\\n  -H "${k}: ${resolveText(String(v))}"`
              })
            }
            if (r.body && Object.keys(r.body).length > 0) {
              let bodyStr = JSON.stringify(r.body)
              bodyStr = resolveText(bodyStr)
              curl += ` \\\n  -d '${bodyStr}'`
            }
            return curl
          }

          // Render cURL
          reqHtml += '<h4>cURL Example</h4>'
          reqHtml += `<ac:structured-macro ac:name="code" ac:schema-version="1">`
          reqHtml += `<ac:parameter ac:name="language">bash</ac:parameter>`
          reqHtml += `<ac:parameter ac:name="theme">Emacs</ac:parameter>`
          reqHtml += `<ac:plain-text-body><![CDATA[\n${generateCurl(req)}\n]]></ac:plain-text-body>`
          reqHtml += `</ac:structured-macro>`

          // Headers Table
          if (req.headers && Object.keys(req.headers).length > 0) {
            reqHtml += '<h3>Headers</h3>'
            reqHtml += '<table><tbody><tr><th>Key</th><th>Value</th><th>Validation</th><th>Description</th></tr>'
            Object.entries(req.headers).forEach(([k, v]) => {
              const rule = req.field_validations?.headers?.[k]
              reqHtml += `<tr><td><strong>${k}</strong></td><td><code>${resolveText(String(v))}</code></td><td>${renderValidation(rule)}</td><td>${rule?.description || ''}</td></tr>`
            })
            reqHtml += '</tbody></table>'
          }

          // Body Table
          if (req.body && Object.keys(req.body).length > 0) {
            reqHtml += '<h3>Request Body</h3>'
            reqHtml += '<table><tbody><tr><th>Field</th><th>Value</th><th>Validation</th><th>Description</th></tr>'
            Object.entries(req.body).forEach(([k, v]) => {
              const rule = req.field_validations?.body?.[k]
              const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v)
              reqHtml += `<tr><td><strong>${k}</strong></td><td><code>${resolveText(valStr)}</code></td><td>${renderValidation(rule)}</td><td>${rule?.description || ''}</td></tr>`
            })
            reqHtml += '</tbody></table>'
          }

          // Examples
          if (req.examples && req.examples.length > 0) {
            reqHtml += '<h3>Responses &amp; Examples</h3>'
            req.examples.forEach(ex => {
              reqHtml += `<h4>${ex.response_status || 200} - ${ex.name || 'Example'}</h4>`

              // Format JSON string to be pretty printed
              let formattedJson = ex.response_body || ''
              try {
                if (formattedJson && typeof formattedJson === 'string') {
                  const parsed = JSON.parse(formattedJson)
                  formattedJson = JSON.stringify(parsed, null, 2)
                }
              } catch (e) {
                // If not valid JSON, leave it as is
              }

              // Confluence Native Code Block Macro
              reqHtml += `<ac:structured-macro ac:name="code" ac:schema-version="1">`
              reqHtml += `<ac:parameter ac:name="language">json</ac:parameter>`
              reqHtml += `<ac:parameter ac:name="theme">Emacs</ac:parameter>` // Adds a nice dark theme
              reqHtml += `<ac:parameter ac:name="collapse">true</ac:parameter>` // Collapses long responses
              reqHtml += `<ac:plain-text-body><![CDATA[\n${formattedJson}\n]]></ac:plain-text-body>`
              reqHtml += `</ac:structured-macro>`
            })
          }

          return reqHtml
        }

        // Root Requests
        docs.root_requests?.forEach(req => {
          html += renderRequest(req)
        })

        // Folder Requests
        docs.folders?.forEach(folder => {
          if (!folder.name) return
          html += `<br/>`
          html += `<ac:structured-macro ac:name="info" ac:schema-version="1">`
          html += `<ac:rich-text-body><p><strong>Folder: ${folder.name}</strong></p></ac:rich-text-body>`
          html += `</ac:structured-macro>`

          folder.requests?.forEach(req => {
            html += renderRequest(req)
          })
        })

        return html
      }

      const generateFooter = () => {
        const now = new Date().toLocaleString('id-ID', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short'
        })
        let html = `<hr/>`
        html += `<p style="text-align: center; color: #6b7280; font-size: 11px;">`
        html += `<i>Generated using <strong>aplikasi wapbolt by temancode</strong> pada tanggal: ${now}</i>`
        html += `<br/>`
        html += `Landing Page: <a href="https://wapbolt.temancode.my.id">https://wapbolt.temancode.my.id</a> | `
        html += `Support: <a href="https://github.com/abdullahPrasetio">https://github.com/abdullahPrasetio</a>`
        html += `</p>`
        return html
      }

      // Fetch & cache OpenAPI spec (used by multiple modes)
      let swaggerJson = ''
      const fetchSwaggerSpec = async (): Promise<string> => {
        if (swaggerJson) return swaggerJson
        const swaggerRes = await apiClient.get<unknown>(`/api/v1/collections/${collectionId}/docs/swagger`)
        swaggerJson = JSON.stringify(swaggerRes.data, null, 2)
        return swaggerJson
      }

      // Generate OpenAPI section as Confluence code block (raw JSON)
      const generateOpenAPIContent = async (): Promise<string> => {
        const spec = await fetchSwaggerSpec()
        let html = `<h1>OpenAPI 3.0 Specification</h1>`
        html += `<p>API specification for <strong>${docs?.collection_name || collectionName}</strong> in OpenAPI 3.0 format.</p>`
        html += `<ac:structured-macro ac:name="code" ac:schema-version="1">`
        html += `<ac:parameter ac:name="language">json</ac:parameter>`
        html += `<ac:parameter ac:name="theme">Emacs</ac:parameter>`
        html += `<ac:parameter ac:name="title">openapi.json</ac:parameter>`
        html += `<ac:plain-text-body><![CDATA[\n${spec}\n]]></ac:plain-text-body>`
        html += `</ac:structured-macro>`
        return html
      }

      // Generate Swagger UI using "Open API (Swagger) Integration for Confluence" macro
      // Spec is embedded directly — no attachment upload needed
      const generateSwaggerUIContent = async (): Promise<string> => {
        const spec = await fetchSwaggerSpec()
        let html = `<h1>Swagger UI - ${docs?.collection_name || collectionName}</h1>`
        html += `<ac:structured-macro ac:name="swagger-open-api" ac:schema-version="1">`
        html += `<ac:plain-text-body><![CDATA[${spec}]]></ac:plain-text-body>`
        html += `</ac:structured-macro>`
        return html
      }

      let content = ''
      if (syncContent === 'documentation') {
        content = generateContent()
      } else if (syncContent === 'openapi') {
        content = await generateOpenAPIContent()
      } else if (syncContent === 'swagger') {
        content = await generateSwaggerUIContent()
      } else {
        // both — documentation + swagger-open-api macro
        const docContent = generateContent()
        const swaggerContent = await generateSwaggerUIContent()
        const divider = `<hr/><p style="text-align:center;color:#6b7280;font-size:11px;"><em>— Section break —</em></p><hr/>`
        content = syncOrder === 'doc_first'
          ? docContent + divider + swaggerContent
          : swaggerContent + divider + docContent
      }
      content += generateFooter()

      // 5. Update Page
      const updateRes = await window.api!.updateConfluencePage({
        baseUrl: base_url,
        email: confluence_email,
        pat: confluence_pat,
        apiToken: confluence_api_token,
        authMethod: auth_method,
        pageId,
        title: docs?.collection_name || collectionName,
        content,
        version: nextVersion
      })

      if (updateRes.success) {
        toast.success('Documentation synced to Confluence successfully!')
      } else {
        toast.error(`Failed to sync to Confluence: ${updateRes.error}`)
      }
    } catch (err: any) {
      toast.error('An error occurred during Confluence sync')
      console.error(err)
    } finally {
      setIsSyncing(false)
    }
  }

  const onCopy = useCallback(async (text: string, field: string) => {
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
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-[90vw] max-w-6xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <BookOpen size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text">{collectionName}</h2>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted">
                  {totalEndpoints} endpoint{totalEndpoints !== 1 ? 's' : ''}
                </p>
                {unresolvedVars.length > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-warning bg-warning/10 border-warning/20 rounded px-1.5 py-0.5">
                    <AlertCircle size={9} />
                    {unresolvedVars.length} unresolved var{unresolvedVars.length > 1 ? 's' : ''}
                  </span>
                )}
                {activeEnv && (
                  <span className="text-[10px] text-success bg-success/10 border-success/20 rounded px-1.5 py-0.5">
                    {activeEnv.name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportMarkdown}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-text border border-border hover:border-white/20 hover:bg-white/5 transition-all"
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
            {confluenceEnabled && (
              <button
                onClick={() => setShowSyncOptions(true)}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all disabled:opacity-50"
              >
                {isSyncing ? <Loader2 size={13} className="animate-spin" /> : <Cloud size={13} />}
                {isSyncing ? 'Syncing...' : 'Sync to Confluence'}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-white/5 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0 border-r border-border overflow-y-auto py-3 px-2 bg-background/50">
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
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-muted hover:text-text hover:bg-white/5 transition-colors"
                    >
                      {expandedFolders.has(folder.id) ? (
                        <>
                          <ChevronDown size={12} className="flex-shrink-0" />
                          <FolderOpen size={13} className="flex-shrink-0 text-warning" />
                        </>
                      ) : (
                        <>
                          <ChevronRight size={12} className="flex-shrink-0" />
                          <FolderIcon size={13} className="flex-shrink-0 text-warning/60" />
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
                onCopy={onCopy}
                onSetVar={(key) => setSettingVar(key)}
                openExample={openExample}
                deleteExample={deleteExample}
                setActiveView={setActiveView}
                onClose={onClose}
                refreshDocs={async () => {
                  const res = await apiClient.get<CollectionDocs>(`/api/v1/collections/${collectionId}/docs`)
                  if (res.status === 200) {
                    setDocs(res.data)
                    // Also update selectedRequest if it was the one modified
                    if (selectedRequest) {
                      const updatedReq = [...(res.data.root_requests || []), ...res.data.folders.flatMap(f => f.requests || [])].find(r => r.id === selectedRequest.id)
                      if (updatedReq) setSelectedRequest(updatedReq)
                    }
                  }
                }}
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

      {showSyncOptions && (
        <ConfluenceSyncOptionsModal
          onSync={handleSyncToConfluence}
          onClose={() => setShowSyncOptions(false)}
        />
      )}
    </div>
  )
}

// ─── Confluence Sync Options Modal ────────────────────────────────────────────

type SyncContent = 'documentation' | 'openapi' | 'swagger' | 'both'
type SyncOrder = 'doc_first' | 'api_first'

const ConfluenceSyncOptionsModal: React.FC<{
  onSync: (content: SyncContent, order: SyncOrder) => void
  onClose: () => void
}> = ({ onSync, onClose }) => {
  const [content, setContent] = useState<SyncContent>('documentation')
  const [order, setOrder] = useState<SyncOrder>('doc_first')

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5 text-text">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud size={16} className="text-blue-400" />
            <h3 className="text-sm font-semibold">Opsi Sync ke Confluence</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-muted hover:text-text transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Content Type */}
        <div className="space-y-2">
          <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider">
            Yang akan di-sync
          </label>
          <div className="space-y-2">
            {([
              {
                value: 'documentation',
                label: 'Documentation Only',
                desc: 'Halaman berisi dokumentasi API lengkap (headers, body, examples, cURL)',
                badge: null
              },
              {
                value: 'openapi',
                label: 'OpenAPI 3.0 (Raw JSON)',
                desc: 'Halaman berisi raw OpenAPI/Swagger JSON spec dalam code block',
                badge: null
              },
              {
                value: 'swagger',
                label: 'Swagger UI (Interactive)',
                desc: 'Embed OpenAPI spec dengan macro "Open API (Swagger) Integration for Confluence".',
                badge: 'Requires App'
              },
              {
                value: 'both',
                label: 'Documentation + Swagger UI',
                desc: 'Documentation lengkap + Swagger UI interaktif dalam satu halaman, bisa pilih urutan.',
                badge: 'Requires App'
              },
            ] as { value: SyncContent; label: string; desc: string; badge: string | null }[]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setContent(opt.value)}
                className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                  content === opt.value
                    ? 'bg-blue-500/10 border-blue-500/40 text-blue-300'
                    : 'border-border text-muted hover:bg-white/5 hover:text-text'
                }`}
              >
                <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 shrink-0 ${content === opt.value ? 'border-blue-400 bg-blue-400' : 'border-border'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium">{opt.label}</p>
                    {opt.badge && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium shrink-0">
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] opacity-60 mt-0.5">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Order (only when 'both') */}
        {content === 'both' && (
          <div className="space-y-2">
            <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider">
              Urutan konten
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setOrder('doc_first')}
                className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-lg border text-xs font-medium transition-all ${
                  order === 'doc_first'
                    ? 'bg-violet-500/10 border-violet-500/40 text-violet-300'
                    : 'border-border text-muted hover:bg-white/5'
                }`}
              >
                <span className="text-[10px] opacity-70">1</span>
                <span>Documentation</span>
                <span className="text-[9px] opacity-50">↓</span>
                <span className="text-[10px] opacity-70">2</span>
                <span>OpenAPI</span>
              </button>
              <button
                onClick={() => setOrder('api_first')}
                className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-lg border text-xs font-medium transition-all ${
                  order === 'api_first'
                    ? 'bg-violet-500/10 border-violet-500/40 text-violet-300'
                    : 'border-border text-muted hover:bg-white/5'
                }`}
              >
                <span className="text-[10px] opacity-70">1</span>
                <span>OpenAPI</span>
                <span className="text-[9px] opacity-50">↓</span>
                <span className="text-[10px] opacity-70">2</span>
                <span>Documentation</span>
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-xs text-muted border border-border hover:bg-white/5 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={() => onSync(content, order)}
            className="flex-1 py-2 rounded-lg text-xs font-bold bg-blue-500/80 hover:bg-blue-500 text-white transition-colors flex items-center justify-center gap-1.5"
          >
            <Cloud size={13} />
            Sync Sekarang
          </button>
        </div>
      </div>
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
    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all ${isSelected
      ? 'bg-primary/15 text-text'
      : 'text-muted hover:text-text hover:bg-white/5'
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
  openExample: (example: any) => void
  deleteExample: (id: number) => Promise<void>
  setActiveView: (view: any) => void
  onClose: () => void
  refreshDocs: () => Promise<void>
}> = ({
  request,
  envVars,
  copiedField,
  onCopy,
  onSetVar,
  openExample,
  deleteExample,
  setActiveView,
  onClose,
  refreshDocs
}) => {
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

    const generateCurl = () => {
      let curl = `curl -X ${request.method || 'GET'} "${resolveText(request.url || '')}"`
      if (request.headers && Object.keys(request.headers).length > 0) {
        Object.entries(request.headers).forEach(([k, v]) => {
          curl += ` \\\n  -H "${k}: ${resolveText(String(v))}"`
        })
      }
      if (request.body && Object.keys(request.body).length > 0) {
        let bodyStr = JSON.stringify(request.body)
        bodyStr = resolveText(bodyStr)
        curl += ` \\\n  -d '${bodyStr}'`
      }
      return curl
    }

    return (
      <div className="p-8 max-w-3xl">
        {/* Method + URL */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <MethodBadge method={request.method} size="md" />
            <h1 className="text-xl font-semibold text-text">{request.name}</h1>
          </div>
          <div className="flex items-center gap-2 bg-background/30 border border-border rounded-lg px-4 py-2.5">
            <code className="flex-1 text-sm text-text/90 font-mono break-all leading-relaxed">
              <VarHighlight text={request.url} envVars={envVars} onSetVar={onSetVar} />
            </code>
            <button
              onClick={() => onCopy(resolveText(request.url), 'url')}
              className="flex-shrink-0 p-1 rounded text-muted hover:text-text transition-colors"
            >
              {copiedField === 'url' ? (
                <Check size={14} className="text-success" />
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
            <p className="text-sm text-text/80 leading-relaxed">{request.description}</p>
          </div>
        )}

        {/* cURL Example */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-widest">
              cURL Example
            </h3>
            <button
              onClick={() => onCopy(generateCurl(), 'curl')}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted hover:text-text border border-border hover:border-white/20 transition-all"
            >
              {copiedField === 'curl' ? (
                <>
                  <Check size={11} className="text-success" />
                  <span className="text-success">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={11} />
                  Copy
                </>
              )}
            </button>
          </div>
          <div className="bg-background/80 shadow-inner border border-border rounded-lg p-4 overflow-x-auto custom-scrollbar">
            <pre className="text-xs text-text/90 font-mono whitespace-pre-wrap leading-relaxed">
              {generateCurl()}
            </pre>
          </div>
        </div>

        {/* Headers */}
        {hasHeaders && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
              Headers
            </h3>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/5 border-b border-border">
                    <th className="text-left px-4 py-2.5 font-medium text-muted w-[20%]">Key</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted w-[25%]">Value</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted w-[20%]">Validation</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted w-[35%]">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(request.headers).map(([k, v]) => {
                    const rule = request.field_validations?.headers?.[k]
                    return (
                      <tr key={k} className="border-b border-white/5 last:border-0">
                        <td className="px-4 py-2.5 font-mono text-text/90">{k}</td>
                        <td className="px-4 py-2.5 font-mono">
                          <VarHighlight
                            text={String(v)}
                            envVars={envVars}
                            onSetVar={onSetVar}
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <ValidationBadges rule={rule} />
                        </td>
                        <td className="px-4 py-2.5 text-sm text-text/90 leading-relaxed">
                          {rule?.description || <span className="text-muted/30 text-xs italic">—</span>}
                        </td>
                      </tr>
                    )
                  })}
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
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted hover:text-text border border-border hover:border-white/20 transition-all"
              >
                {copiedField === 'body' ? (
                  <>
                    <Check size={11} className="text-success" />
                    <span className="text-success">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} />
                    Copy
                  </>
                )}
              </button>
            </div>
            {/* Render body as annotated field table */}
            {request.body && typeof request.body === 'object' && !Array.isArray(request.body) ? (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-white/5 border-b border-border">
                      <th className="text-left px-4 py-2.5 font-medium text-muted w-[20%]">Field</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted w-[25%]">Value</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted w-[20%]">Validation</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted w-[35%]">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(request.body).map(([field, val]) => {
                      const rawStr = typeof val === 'string' ? val : JSON.stringify(val)
                      const rule = request.field_validations?.body?.[field]
                      const hasAnnotations = rule && (rule.rules.length > 0 || rule.description || rule.min > 0 || rule.max > 0)

                      return (
                        <tr key={field} className="border-b border-white/5 last:border-0">
                          <td className="px-4 py-2.5 font-mono text-text/90 font-medium">{field}</td>
                          <td className="px-4 py-2.5 font-mono text-text/70">
                            <VarHighlight
                              text={rawStr}
                              envVars={envVars}
                              onSetVar={onSetVar}
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            {hasAnnotations ? (
                              <ValidationBadges rule={rule} />
                            ) : (
                              <span className="text-muted/40 text-[10px] italic">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-sm text-text/90 leading-relaxed">
                            {rule?.description || <span className="text-muted/30 text-xs italic">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              // Fallback: raw JSON view (for arrays or primitive bodies)
              <div className="bg-background/80 shadow-inner border border-border rounded-lg p-4 overflow-x-auto">
                <pre className="text-xs text-text/90 font-mono whitespace-pre-wrap leading-relaxed">
                  <VarHighlight
                    text={JSON.stringify(request.body, null, 2)}
                    envVars={envVars}
                    onSetVar={onSetVar}
                  />
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Responses & Examples */}
        <div>
          <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
            Responses & Examples
          </h3>

          {request.examples && request.examples.length > 0 ? (
            <div className="space-y-4">
              {request.examples.map((ex) => (
                <div key={ex.id} className="border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-mono font-bold ${ex.response_status >= 200 && ex.response_status < 300 ? 'text-success' : 'text-warning'}`}>{ex.response_status}</span>
                      <span className="text-xs text-text font-medium">{ex.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          openExample(ex)
                          setActiveView('request-builder')
                          onClose()
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-success hover:text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/10 transition-all"
                      >
                        <Play size={11} fill="currentColor" />
                        Try
                      </button>
                      <button
                        onClick={() => onCopy(JSON.stringify(ex.response_body, null, 2), `example-${ex.id}`)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted hover:text-text border border-border hover:border-white/20 transition-all"
                      >
                        {copiedField === `example-${ex.id}` ? (
                          <>
                            <Check size={11} className="text-success" />
                            <span className="text-success">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={11} />
                            Copy
                          </>
                        )}
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm('Are you sure you want to delete this example?')) {
                            await deleteExample(ex.id)
                            await refreshDocs()
                          }
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:bg-rose-500/10 transition-all"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                  {Boolean(ex.response_body) && (
                    <div className="bg-background/80 shadow-inner p-4 overflow-auto max-h-96 custom-scrollbar">
                      <pre className="text-[11px] text-text/80 font-mono whitespace-pre-wrap leading-relaxed">
                        {(() => {
                          try {
                            return JSON.stringify(JSON.parse(ex.response_body), null, 2)
                          } catch {
                            return ex.response_body
                          }
                        })()}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/5 border-b border-white/5">
                <span className="text-xs font-mono font-bold text-success">200</span>
                <span className="text-xs text-muted">Success (Default Placeholder)</span>
              </div>
              <div className="p-4 text-xs text-muted italic bg-background/50">
                No saved examples available for this request.
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }
