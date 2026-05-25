import { useAppStore } from '../../store/useAppStore'
import { useDataStore, AuthConfig, WorkingRequest } from '../../store/useDataStore'
import { useAuthStore } from '../../store/useAuthStore'
import { KeyValueEditor } from '../ui/KeyValueEditor'
import { VariableOverlayInput } from '../ui/VariableOverlayInput'
import { SetVarModal } from '../modals/SetVarModal'
import { Shield, Eye, EyeOff, X, RefreshCw, Save, Lock, Users, ChevronDown, FileCode2, Terminal as TerminalIcon, Code, Box, Globe, Link as LinkIcon, BookOpen, Zap, ShieldCheck, FileText, Copy, XCircle, Minus, Plus } from 'lucide-react'
import * as ContextMenu from '@radix-ui/react-context-menu'
import { ResponseArea } from './ResponseArea'
import { HistoryDetailView } from './HistoryDetailView'
import { CollaborationPanel } from './CollaborationPanel'
import { SaveRequestLocationModal } from '../modals/SaveRequestLocationModal'
import { ImportCurlModal } from '../modals/ImportCurlModal'
import { ExportCodeModal } from '../modals/ExportCodeModal'
import { ComingSoonModal } from '../modals/ComingSoonModal'
import { parseCurlCommand } from '../../utils/curlParser'
import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { useState, useEffect, useMemo, useCallback } from 'react'
import type { FieldValidationRule, FieldValidations } from '../../types'
import { toast } from 'sonner'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

// Configure Monaco to use the bundled version (OFFLINE)
loader.config({ monaco })

// Register Hover Provider for variables
const createVarHoverProvider = (_language?: string) => ({
  provideHover: (model: monaco.editor.ITextModel, position: monaco.IPosition) => {
    const lineContent = model.getLineContent(position.lineNumber)
    const vars = useDataStore.getState().environments.find(
      (e) => e.id === useDataStore.getState().activeEnvironmentId
    )?.variables || {}

    const regex = /\{\{([^}]+)\}\}/g
    let match
    while ((match = regex.exec(lineContent)) !== null) {
      const start = match.index + 1
      const end = start + match[0].length
      if (position.column >= start && position.column <= end) {
        const varName = match[1].trim()
        const value = vars[varName] || vars[varName.toLowerCase()]
        const isSet = value !== undefined

        return {
          range: new monaco.Range(position.lineNumber, start, position.lineNumber, end),
          contents: [
            { value: `**Variable:** \`{{${varName}}}\`` },
            { value: isSet ? `**Value:** \`${value}\`` : '*Variable not set in active environment*' },
            { value: isSet ? '*Click to change value*' : '*Click to set value*' }
          ]
        }
      }
    }
    return null
  }
})

monaco.languages.registerHoverProvider('json', createVarHoverProvider('json'))
monaco.languages.registerHoverProvider('javascript', createVarHoverProvider('javascript'))
monaco.languages.registerHoverProvider('xml', createVarHoverProvider('xml'))
monaco.languages.registerHoverProvider('html', createVarHoverProvider('html'))


const REQUEST_TABS = ['Params', 'Auth', 'Headers', 'Body', 'Pre-request', 'Tests', 'Validation'] as const

const METHOD_COLOR: Record<string, string> = {
  GET: 'text-emerald-400',
  POST: 'text-amber-400',
  PUT: 'text-blue-400',
  PATCH: 'text-sky-400',
  DELETE: 'text-rose-400',
  HEAD: 'text-purple-400',
  OPTIONS: 'text-slate-400'
}

interface RequestFormProps {
  method: string
  url: string
  isLocked: boolean
  onUpdate: (update: { method?: string; url?: string }) => void
}

const RequestForm = ({ method, url, isLocked, onUpdate }: RequestFormProps): React.JSX.Element => {
  return (
    <div className="flex-1 flex relative items-center">
      <div className="relative flex items-center shrink-0">
        <select
          value={method}
          disabled={isLocked}
          onChange={(e): void => onUpdate({ method: e.target.value })}
          className={`bg-surface font-black text-xs pl-4 pr-8 py-2.5 border-r border-border focus:outline-none appearance-none cursor-pointer ${METHOD_COLOR[method] ?? 'text-muted'} ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((m) => (
            <option key={m} value={m} className="text-text font-sans">
              {m}
            </option>
          ))}
        </select>
        <ChevronDown size={12} className="absolute right-3 text-muted pointer-events-none" />
      </div>

      <div className="flex-1 relative flex items-center h-full">
        <VariableOverlayInput
          value={url}
          disabled={isLocked}
          onChange={(e): void => onUpdate({ url: (e.target as any).value })}
          multiline={true}
          placeholder="https://api.example.com/v1/resource"
          className="bg-transparent border-none px-4 py-2.5"
        />
      </div>
    </div>
  )
}

interface EditorAreaProps {
  activeTab: string
  requestId: string | number
  workingRequest: WorkingRequest
  onUpdate: (update: Partial<WorkingRequest>) => void
  isLocked?: boolean
}

const EditorArea = ({
  activeTab,
  requestId,
  workingRequest,
  isLocked,
  onUpdate
}: EditorAreaProps): React.JSX.Element => {
  const { fontSize, theme } = useAppStore()
  const monacoTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs')
    : (theme === 'dark' ? 'vs-dark' : 'vs')
  const [showPassword, setShowPassword] = useState(false)
  const [isHeaderBulk, setIsHeaderBulk] = useState(false)
  const [headerBulkLocal, setHeaderBulkLocal] = useState('')

  const auth = workingRequest.auth_config || { type: 'No Auth' }
  const handleAuthChange = (update: Partial<AuthConfig>): void => {
    onUpdate({ auth_config: { ...auth, ...update } as AuthConfig })
  }

  // --- Header Bulk Logic ---
  const headerBulkValue = useMemo(() => {
    return Object.entries(workingRequest.headers || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n')
  }, [workingRequest.headers])

  // Inisialisasi local state saat masuk mode bulk
  useEffect(() => {
    if (isHeaderBulk) {
      setHeaderBulkLocal(headerBulkValue)
    }
  }, [isHeaderBulk])

  const applyHeaderBulk = (): void => {
    const lines = headerBulkLocal.split('\n')
    const newHeaders: Record<string, string> = {}
    lines.forEach(line => {
      const parts = line.split(':')
      if (parts.length >= 2) {
        const key = parts[0].trim()
        const value = parts.slice(1).join(':').trim()
        if (key) newHeaders[key] = value
      }
    })
    onUpdate({ headers: newHeaders })
    setIsHeaderBulk(false)
  }

  const handleBodyTypeChange = (type: string): void => {
    onUpdate({ body_type: type })
  }

  const getMonacoLang = (type: string) => {
    if (type === 'raw-json') return 'json'
    if (type === 'raw-xml') return 'xml'
    if (type === 'raw-html') return 'html'
    return 'text'
  }

  return (
    <div className="h-full w-full overflow-hidden flex flex-col">
      {/* 
        OPTIMASI MONACO: Gunakan display: none agar editor tidak unmount 
        saat ganti tab. Ini mencegah re-initialization yang lambat.
      */}

      {/* --- BODY TAB --- */}
      <div className={`flex-1 flex flex-col ${activeTab === 'Body' ? 'block' : 'hidden'}`}>
        <div className="px-4 py-2 border-b border-border bg-background/50 flex items-center gap-4">
          <div className="flex items-center gap-1">
            {[
              { id: 'none', label: 'none' },
              { id: 'form-data', label: 'form-data' },
              { id: 'x-www-form-urlencoded', label: 'urlencoded' },
              { id: 'raw-json', label: 'raw' },
              { id: 'binary', label: 'binary' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => handleBodyTypeChange(t.id === 'raw-json' ? 'raw-json' : t.id)}
                className={`px-2 py-1 text-[10px] font-bold uppercase rounded transition-colors ${(workingRequest.body_type === t.id || (t.id === 'raw-json' && workingRequest.body_type?.startsWith('raw-')))
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted hover:text-text'
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {workingRequest.body_type?.startsWith('raw-') && (
            <div className="h-4 w-px bg-border mx-1" />
          )}

          {workingRequest.body_type?.startsWith('raw-') && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-1 text-[10px] font-bold text-primary uppercase">
                  {workingRequest.body_type.split('-')[1]} <ChevronDown size={10} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="bg-surface border border-border rounded shadow-xl p-1 z-[110] min-w-[80px]">
                  {['json', 'xml', 'html', 'text'].map(lang => (
                    <DropdownMenu.Item
                      key={lang}
                      onClick={() => handleBodyTypeChange(`raw-${lang}`)}
                      className="px-2 py-1.5 text-[10px] font-bold uppercase text-muted hover:text-white hover:bg-primary/20 rounded cursor-pointer outline-none"
                    >
                      {lang}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}

          {workingRequest.body_type === 'raw-json' && (
            <div className="flex items-center gap-2 ml-4 border-l border-border pl-4">
              <button
                onClick={() => {
                  try {
                    const json = JSON.parse(workingRequest.body as string)
                    onUpdate({ body: JSON.stringify(json, null, 2) })
                    toast.success('JSON Beautified')
                  } catch (e) {
                    toast.error('Invalid JSON: Cannot beautify')
                  }
                }}
                className="text-[9px] font-black uppercase tracking-widest text-muted hover:text-primary transition-colors"
              >
                Beautify
              </button>
              <button
                onClick={() => {
                  try {
                    const json = JSON.parse(workingRequest.body as string)
                    onUpdate({ body: JSON.stringify(json) })
                    toast.success('JSON Minified')
                  } catch (e) {
                    toast.error('Invalid JSON: Cannot minify')
                  }
                }}
                className="text-[9px] font-black uppercase tracking-widest text-muted hover:text-primary transition-colors"
              >
                Unbeautify
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 relative">
          {workingRequest.body_type === 'none' && (
            <div className="h-full flex flex-col items-center justify-center opacity-30">
              <Box size={48} className="mb-4" />
              <span className="text-xs font-bold uppercase tracking-widest">This request has no body</span>
            </div>
          )}

          {workingRequest.body_type?.startsWith('raw-') && (
            <Editor
              height="100%"
              language={getMonacoLang(workingRequest.body_type)}
              theme={monacoTheme}
              value={typeof workingRequest.body === 'string' ? workingRequest.body : JSON.stringify(workingRequest.body, null, 2)}
              onChange={(val) => onUpdate({ body: val || '' })}
              options={{
                minimap: { enabled: false },
                fontSize: fontSize,
                automaticLayout: true,
                padding: { top: 10 },
                readOnly: isLocked
              }}
            />
          )}

          {(workingRequest.body_type === 'form-data' || workingRequest.body_type === 'x-www-form-urlencoded') && (
            <div className="absolute inset-0 overflow-auto p-4">
              <KeyValueEditor
                key={`body-${requestId}-${workingRequest.body_type}`}
                initialData={Array.isArray(workingRequest.body) ?
                  workingRequest.body.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}) :
                  {}
                }
                disabled={isLocked}
                onChange={(data) => {
                  const bodyArray = Object.entries(data).map(([key, value]) => ({ key, value, enabled: true, type: 'text' }))
                  onUpdate({ body: bodyArray })
                }}
              />
            </div>
          )}

          {workingRequest.body_type === 'binary' && (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center text-muted">
                <FileCode2 size={32} />
              </div>
              <button className="px-4 py-2 bg-surface border border-border rounded-lg text-xs font-bold hover:border-primary transition-colors">
                Select File
              </button>
              <span className="text-[10px] text-muted uppercase tracking-widest">Feature coming soon</span>
            </div>
          )}
        </div>
      </div>

      {/* --- HEADERS TAB --- */}
      <div className={`flex-1 flex flex-col p-4 overflow-auto ${activeTab === 'Headers' ? 'block' : 'hidden'}`}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="text-sm font-semibold text-text uppercase tracking-tight">Request Headers</h3>
            <span className="text-[10px] text-muted font-bold uppercase tracking-widest">Metadata for your request</span>
          </div>
          <button
            onClick={() => isHeaderBulk ? applyHeaderBulk() : setIsHeaderBulk(true)}
            className={`px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all ${isHeaderBulk ? 'bg-success text-white shadow-lg shadow-success/20' : 'bg-surface text-muted hover:text-text border border-border'
              }`}
          >
            {isHeaderBulk ? 'Apply Changes' : 'Bulk Edit'}
          </button>
        </div>

        {isHeaderBulk ? (
          <div className="flex-1 border border-border rounded-md overflow-hidden min-h-[200px]">
            <Editor
              height="100%"
              defaultLanguage="text"
              theme={monacoTheme}
              value={headerBulkLocal}
              onChange={(val) => setHeaderBulkLocal(val || '')}
              options={{
                minimap: { enabled: false },
                fontSize: fontSize,
                lineNumbers: 'off',
                scrollBeyondLastLine: false,
                padding: { top: 10 },
                readOnly: isLocked
              }}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <KeyValueEditor
              key={`headers-${requestId}`}
              initialData={workingRequest.headers || {}}
              disabled={isLocked}
              onChange={(data): void => onUpdate({ headers: data as Record<string, string> })}
            />
          </div>
        )}
      </div>

      {/* --- PARAMS TAB --- */}
      <div className={`p-4 h-full overflow-auto ${activeTab === 'Params' ? 'block' : 'hidden'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text uppercase tracking-tight">Query Parameters</h3>
          <span className="text-[10px] text-muted font-bold uppercase tracking-widest">Appended to the URL</span>
        </div>
        <p className="text-xs text-muted italic mb-4">
          Query parameters integration coming soon. For now, add them directly to the URL bar.
        </p>
      </div>

      {/* --- PRE-REQUEST TAB --- */}
      <div className={`h-full flex flex-col ${activeTab === 'Pre-request' ? 'block' : 'hidden'}`}>
        <div className="p-2 bg-background/50 border-b border-border flex items-center justify-between">
          <span className="text-[9px] text-muted font-black uppercase tracking-[0.2em] flex items-center gap-2">
            <TerminalIcon size={12} className="text-primary" /> Script: Before execution
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          <Editor
            height="100%"
            defaultLanguage="javascript"
            theme={monacoTheme}
            value={workingRequest.pre_request_script || ''}
            onChange={(val) => onUpdate({ pre_request_script: val || '' })}
            options={{
              minimap: { enabled: false },
              fontSize: fontSize,
              scrollBeyondLastLine: false,
              padding: { top: 10 },
              readOnly: isLocked
            }}
          />
        </div>
      </div>

      {/* --- TESTS TAB --- */}
      <div className={`h-full flex flex-col ${activeTab === 'Tests' ? 'block' : 'hidden'}`}>
        <div className="p-2 bg-background/50 border-b border-border flex items-center justify-between">
          <span className="text-[9px] text-muted font-black uppercase tracking-[0.2em] flex items-center gap-2">
            <RefreshCw size={12} className="text-primary" /> Script: After response
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          <Editor
            height="100%"
            defaultLanguage="javascript"
            theme={monacoTheme}
            value={workingRequest.post_request_script || ''}
            onChange={(val) => onUpdate({ post_request_script: val || '' })}
            options={{
              minimap: { enabled: false },
              fontSize: fontSize,
              scrollBeyondLastLine: false,
              padding: { top: 10 },
              readOnly: isLocked
            }}
          />
        </div>
      </div>

      {/* --- AUTH TAB --- */}
      <div className={`p-6 h-full overflow-auto ${activeTab === 'Auth' ? 'block' : 'hidden'}`}>
        <div className="flex gap-6 h-full">
          <div className="w-48 shrink-0 flex flex-col gap-1 border-r border-border pr-4">
            <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 px-2">
              Type
            </label>
            {['No Auth', 'Bearer Token', 'Basic Auth', 'API Key'].map((type) => (
              <div
                key={type}
                onClick={(): void => {
                  if (!isLocked) handleAuthChange({ type })
                }}
                className={`px-3 py-2 rounded text-xs font-medium transition-colors ${auth.type === type ? 'bg-primary/20 text-primary' : 'text-text hover:bg-surface'} ${isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
              >
                {type}
              </div>
            ))}
          </div>

          <div className="flex-1 max-w-xl animate-in fade-in slide-in-from-left-2 duration-300">
            {auth.type === 'No Auth' && (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                <Shield size={48} className="text-muted mb-4" />
                <p className="text-sm text-muted">
                  This request does not use any authentication.
                </p>
              </div>
            )}

            {auth.type === 'Bearer Token' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted mb-1.5 block">Token</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={auth.token || ''}
                      disabled={isLocked}
                      onChange={(e): void => handleAuthChange({ token: e.target.value })}
                      className={`w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-primary pr-10 ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                      placeholder="Enter bearer token"
                    />
                    <button
                      onClick={(): void => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-muted hover:text-text transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {auth.type === 'Basic Auth' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted mb-1.5 block">
                      Username
                    </label>
                    <input
                      type="text"
                      value={auth.username || ''}
                      disabled={isLocked}
                      onChange={(e): void => handleAuthChange({ username: e.target.value })}
                      className={`w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-primary ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                      placeholder="Username"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted mb-1.5 block">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={auth.password || ''}
                        disabled={isLocked}
                        onChange={(e): void => handleAuthChange({ password: e.target.value })}
                        className={`w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-primary pr-10 ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                        placeholder="Password"
                      />
                      <button
                        onClick={(): void => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-muted hover:text-text transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {auth.type === 'API Key' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted mb-1.5 block">Key</label>
                    <input
                      type="text"
                      value={auth.key || ''}
                      disabled={isLocked}
                      onChange={(e): void => handleAuthChange({ key: e.target.value })}
                      className={`w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-primary ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                      placeholder="X-API-Key"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted mb-1.5 block">Value</label>
                    <input
                      type="text"
                      value={auth.value || ''}
                      disabled={isLocked}
                      onChange={(e): void => handleAuthChange({ value: e.target.value })}
                      className={`w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-primary ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                      placeholder="Value"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted mb-1.5 block">Add to</label>
                  <select
                    value={auth.addTo || 'header'}
                    disabled={isLocked}
                    onChange={(e): void =>
                      handleAuthChange({ addTo: e.target.value as 'header' | 'query' })
                    }
                    className={`w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-primary ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <option value="header">Header</option>
                    <option value="query">Query Params</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- VALIDATION TAB --- rendered by ValidationEditorTab below, included here to follow the same tab pattern */}
      <ValidationEditorTab
        activeTab={activeTab}
        workingRequest={workingRequest}
        onUpdate={onUpdate}
        isLocked={isLocked}
      />
    </div>
  )
}

// ─── Validation Tab ───────────────────────────────────────────────────────────

const AVAILABLE_RULES = [
  'required', 'nullable', 'string', 'integer', 'numeric',
  'boolean', 'email', 'url', 'array', 'object', 'unique'
]

const EMPTY_RULE: FieldValidationRule = { rules: [], min: 0, max: 0, description: '' }

const RULE_BADGE_STYLE: Record<string, string> = {
  required: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  nullable: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  email: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  url: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  unique: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
}

interface ValidationFieldRowProps {
  section: 'headers' | 'body'
  fieldName: string
  rule: FieldValidationRule
  onChange: (section: 'headers' | 'body', field: string, rule: FieldValidationRule) => void
  isLocked?: boolean
}

const ValidationFieldRow: React.FC<ValidationFieldRowProps> = ({
  section, fieldName, rule, onChange, isLocked
}) => {
  const toggleRule = (r: string): void => {
    const existing = rule.rules.includes(r)
    const newRules = existing ? rule.rules.filter((x) => x !== r) : [...rule.rules, r]
    onChange(section, fieldName, { ...rule, rules: newRules })
  }

  return (
    <div className="border border-border rounded-lg p-3 bg-surface/40 hover:bg-surface/70 transition-colors">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted px-1.5 py-0.5 rounded bg-white/5 border border-border">
          {section === 'headers' ? 'HDR' : 'BODY'}
        </span>
        <span className="text-xs font-mono font-semibold text-text flex-1 truncate">{fieldName}</span>
        {rule.rules.length > 0 && (
          <span className="text-[9px] text-primary font-bold">{rule.rules.length} rules</span>
        )}
      </div>

      {/* Rule badges toggle */}
      <div className="flex flex-wrap gap-1 mb-3">
        {AVAILABLE_RULES.map((r) => {
          const active = rule.rules.includes(r)
          const badgeStyle = RULE_BADGE_STYLE[r] ?? 'bg-primary/10 text-primary border-primary/20'
          return (
            <button
              key={r}
              disabled={isLocked}
              onClick={() => toggleRule(r)}
              className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border transition-all ${
                active ? badgeStyle : 'bg-transparent text-muted border-border hover:border-white/20 hover:text-text'
              } ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {r}
            </button>
          )
        })}
      </div>

      {/* Min / Max */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="text-[9px] font-bold text-muted uppercase tracking-widest block mb-1">Min Length</label>
          <input
            type="number"
            min={0}
            disabled={isLocked}
            value={rule.min}
            onChange={(e) => onChange(section, fieldName, { ...rule, min: parseInt(e.target.value) || 0 })}
            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-primary"
            placeholder="0 = no limit"
          />
        </div>
        <div>
          <label className="text-[9px] font-bold text-muted uppercase tracking-widest block mb-1">Max Length</label>
          <input
            type="number"
            min={0}
            disabled={isLocked}
            value={rule.max}
            onChange={(e) => onChange(section, fieldName, { ...rule, max: parseInt(e.target.value) || 0 })}
            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-primary"
            placeholder="0 = no limit"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-[9px] font-bold text-muted uppercase tracking-widest block mb-1">Description</label>
        <input
          type="text"
          disabled={isLocked}
          value={rule.description}
          onChange={(e) => onChange(section, fieldName, { ...rule, description: e.target.value })}
          className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-primary"
          placeholder="Optional description or custom error message..."
        />
      </div>
    </div>
  )
}

interface ValidationEditorTabProps {
  activeTab: string
  workingRequest: WorkingRequest
  onUpdate: (update: Partial<WorkingRequest>) => void
  isLocked?: boolean
}

const ValidationEditorTab: React.FC<ValidationEditorTabProps> = ({
  activeTab, workingRequest, onUpdate, isLocked
}) => {
  const fv: FieldValidations = workingRequest.field_validations ?? { headers: {}, body: {} }

  const headerKeys = useMemo(() => Object.keys(workingRequest.headers || {}), [workingRequest.headers])

  const bodyKeys = useMemo(() => {
    const body = workingRequest.body
    const bt = workingRequest.body_type
    if (bt === 'form-data' || bt === 'x-www-form-urlencoded') {
      if (Array.isArray(body)) return body.map((item: any) => item.key).filter(Boolean)
    }
    if (bt?.startsWith('raw-')) {
      try {
        const parsed = JSON.parse(body as string)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return Object.keys(parsed)
        }
      } catch {
        // not JSON
      }
    }
    return []
  }, [workingRequest.body, workingRequest.body_type])

  const handleChange = useCallback((
    section: 'headers' | 'body',
    field: string,
    rule: FieldValidationRule
  ) => {
    const newFv: FieldValidations = {
      headers: { ...fv.headers },
      body: { ...fv.body },
    }
    newFv[section] = { ...newFv[section], [field]: rule }
    onUpdate({ field_validations: newFv })
  }, [fv, onUpdate])

  const hasNoFields = headerKeys.length === 0 && bodyKeys.length === 0

  return (
    <div className={`h-full flex flex-col ${activeTab === 'Validation' ? 'flex' : 'hidden'}`}>
      <div className="px-4 py-2.5 bg-background/50 border-b border-border flex items-center gap-2 shrink-0">
        <ShieldCheck size={12} className="text-primary" />
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">
          Field Validation — Auto-generated from headers &amp; body
        </span>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {hasNoFields ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
            <FileText size={40} className="mb-3 text-muted" />
            <p className="text-xs text-muted font-bold uppercase tracking-widest">
              No fields found
            </p>
            <p className="text-[10px] text-muted mt-1">
              Add headers or a JSON/form body first, then return here to set validation rules.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {headerKeys.length > 0 && (
              <div>
                <h4 className="text-[9px] font-black uppercase tracking-widest text-muted mb-2 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-info inline-block"></span> Headers ({headerKeys.length})
                </h4>
                <div className="space-y-2">
                  {headerKeys.map((key) => (
                    <ValidationFieldRow
                      key={`h-${key}`}
                      section="headers"
                      fieldName={key}
                      rule={fv.headers?.[key] ?? { ...EMPTY_RULE }}
                      onChange={handleChange}
                      isLocked={isLocked}
                    />
                  ))}
                </div>
              </div>
            )}

            {bodyKeys.length > 0 && (
              <div className={headerKeys.length > 0 ? 'mt-4' : ''}>
                <h4 className="text-[9px] font-black uppercase tracking-widest text-muted mb-2 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-warning inline-block"></span> Body Fields ({bodyKeys.length})
                </h4>
                <div className="space-y-2">
                  {bodyKeys.map((key) => (
                    <ValidationFieldRow
                      key={`b-${key}`}
                      section="body"
                      fieldName={key}
                      rule={fv.body?.[key] ?? { ...EMPTY_RULE }}
                      onChange={handleChange}
                      isLocked={isLocked}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const ctxMenuItemCls = 'flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium text-text hover:bg-primary/15 hover:text-primary rounded cursor-pointer outline-none transition-colors select-none'
const ctxMenuSeparatorCls = 'my-1 h-px bg-border mx-2'
const ctxMenuShortcutCls = 'ml-auto text-[10px] text-muted font-mono'

const RequestTabs = (): React.JSX.Element => {
  const { tabs, activeTabId, setActiveTab, closeTab, forceCloseTab, closeOtherTabs, closeAllTabs, forceCloseAllTabs, duplicateTab, openDraftRequest } = useDataStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const mod = isMac ? e.metaKey : e.ctrlKey

      // ⌘T / Ctrl+T — New Request
      if (mod && e.key === 't') {
        e.preventDefault()
        openDraftRequest({})
        return
      }

      // ⌘W / Ctrl+W — Close active tab
      if (mod && !e.altKey && e.key === 'w') {
        e.preventDefault()
        const { activeTabId: currentId } = useDataStore.getState()
        if (currentId) closeTab(currentId)
        return
      }

      // ⌥⌘W / Ctrl+Alt+W — Force close active tab
      if (mod && e.altKey && e.key === 'w') {
        e.preventDefault()
        const { activeTabId: currentId } = useDataStore.getState()
        if (currentId) forceCloseTab(currentId)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeTab, forceCloseTab, openDraftRequest])

  if (!tabs || tabs.length === 0) return <></>

  return (
    <div className="flex bg-background border-b border-border overflow-x-auto no-scrollbar shrink-0">
      {tabs.map((tab) => (
        <ContextMenu.Root key={tab.requestId}>
          <ContextMenu.Trigger asChild>
            <div
              onClick={(): void => setActiveTab(tab.requestId)}
              className={`group flex items-center h-10 px-3 border-r border-border cursor-pointer transition-all min-w-[120px] max-w-[200px] relative ${activeTabId === tab.requestId
                ? 'bg-surface border-t-2 border-t-primary'
                : 'hover:bg-surface/50'
                }`}
            >
              <span
                className={`text-[9px] font-black mr-2 shrink-0 ${METHOD_COLOR[tab.method] ?? 'text-muted'}`}
              >
                {tab.method}
              </span>
              <span
                className={`text-xs truncate flex-1 ${activeTabId === tab.requestId ? 'text-text font-medium' : 'text-muted'}`}
              >
                {tab.name}
                {tab.isDirty && <span className="ml-1 text-primary">•</span>}
              </span>
              <button
                onClick={(e): void => {
                  e.stopPropagation()
                  closeTab(tab.requestId)
                }}
                className="ml-2 p-0.5 rounded-full hover:bg-border transition-colors opacity-0 group-hover:opacity-100"
              >
                <X size={10} />
              </button>
            </div>
          </ContextMenu.Trigger>

          <ContextMenu.Portal>
            <ContextMenu.Content className="bg-surface border border-border rounded-lg shadow-2xl p-1 z-[200] min-w-[200px] animate-in fade-in-0 zoom-in-95">
              <ContextMenu.Item
                className={ctxMenuItemCls}
                onSelect={() => openDraftRequest({})}
              >
                <Plus size={13} className="text-muted" />
                New Request
                <span className={ctxMenuShortcutCls}>⌘T</span>
              </ContextMenu.Item>

              <ContextMenu.Item
                className={ctxMenuItemCls}
                onSelect={() => duplicateTab(tab.requestId)}
              >
                <Copy size={13} className="text-muted" />
                Duplicate Tab
              </ContextMenu.Item>

              <div className={ctxMenuSeparatorCls} />

              <ContextMenu.Item
                className={ctxMenuItemCls}
                onSelect={() => closeTab(tab.requestId)}
              >
                <X size={13} className="text-muted" />
                Close Tab
                <span className={ctxMenuShortcutCls}>⌘W</span>
              </ContextMenu.Item>

              <ContextMenu.Item
                className={ctxMenuItemCls}
                onSelect={() => forceCloseTab(tab.requestId)}
              >
                <XCircle size={13} className="text-muted" />
                Force Close Tab
                <span className={ctxMenuShortcutCls}>⌥⌘W</span>
              </ContextMenu.Item>

              <ContextMenu.Item
                className={ctxMenuItemCls}
                onSelect={() => closeOtherTabs(tab.requestId)}
              >
                <Minus size={13} className="text-muted" />
                Close Other Tabs
              </ContextMenu.Item>

              <div className={ctxMenuSeparatorCls} />

              <ContextMenu.Item
                className={ctxMenuItemCls}
                onSelect={() => closeAllTabs()}
              >
                <X size={13} className="text-muted" />
                Close All Tabs
              </ContextMenu.Item>

              <ContextMenu.Item
                className={`${ctxMenuItemCls} text-rose-400 hover:text-rose-400 hover:bg-rose-500/10`}
                onSelect={() => forceCloseAllTabs()}
              >
                <XCircle size={13} />
                Force Close All Tabs
              </ContextMenu.Item>
            </ContextMenu.Content>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ))}
    </div>
  )
}

export const MainArea = (): React.JSX.Element => {
  const { activeView, activeTab, setActiveTab } = useAppStore()
  const {
    tabs,
    activeTabId,
    setWorkingRequest,
    executeActiveRequest,
    saveActiveRequest,
    activeEnvironmentId,
    environments,
    updateEnvironment,
    presenceByRequest,
    locksByRequest,
    collections,
    requests,
    duplicateRequest
  } = useDataStore()

  const { user } = useAuthStore()
  const [showCollabPanel, setShowCollabPanel] = useState(false)
  const [settingVar, setSettingVar] = useState<string | null>(null)
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
  const [isImportCurlOpen, setIsImportCurlOpen] = useState(false)
  const [isExportCodeOpen, setIsExportCodeOpen] = useState(false)
  const [comingSoon, setComingSoon] = useState<{ isOpen: boolean; feature: string }>({
    isOpen: false,
    feature: ''
  })
  const [builderHeight, setBuilderHeight] = useState(60) // in percentage
  const [isResizing, setIsResizing] = useState(false)

  const activeEnv = environments.find((e) => e.id === activeEnvironmentId) ?? null

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      const height = (e.clientY / window.innerHeight) * 100

      // Batasi agar bagian bawah (Response Area) minimal punya tinggi 80px 
      // agar tab (Body, Headers, dll) tetap terlihat
      const minBottomHeightPx = 80
      const maxTopHeightPct = ((window.innerHeight - minBottomHeightPx) / window.innerHeight) * 100

      if (height > 15 && height < maxTopHeightPct) {
        setBuilderHeight(height)
      }
    }
    const handleMouseUp = () => setIsResizing(false)

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  // Handle auto-detect cURL on URL change
  const handleUrlChange = async (newUrl: string) => {
    if (newUrl.trim().startsWith('curl ')) {
      const parsed = await parseCurlCommand(newUrl)
      if (parsed) {
        setWorkingRequest({
          method: parsed.method,
          url: parsed.url,
          headers: parsed.headers,
          body: parsed.body,
          body_type: parsed.bodyType
        })
        toast.success('cURL command imported and parsed')
        return
      }
    }
    setWorkingRequest({ url: newUrl })
  }

  const handleSetVar = async (key: string, val: string) => {
    if (!activeEnv) return
    const newVars = { ...activeEnv.variables, [key]: val }
    await updateEnvironment(activeEnv.id, activeEnv.name, newVars)
    toast.success(`Variable "${key}" updated`)
  }

  useEffect(() => {
    const handleTriggerSaveModal = () => setIsSaveModalOpen(true)
    window.addEventListener('wapbolt:trigger-save-modal', handleTriggerSaveModal)

    const handleKeyDown = (e: KeyboardEvent): void => {
      // Ctrl/Cmd + Enter for Send
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        executeActiveRequest()
      }
      // Ctrl/Cmd + S for Save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        const { activeTabId } = useDataStore.getState()
        if (typeof activeTabId === 'string' && (activeTabId.startsWith('draft-') || activeTabId.startsWith('example-'))) {
          setIsSaveModalOpen(true)
        } else {
          saveActiveRequest()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return (): void => {
      window.removeEventListener('wapbolt:trigger-save-modal', handleTriggerSaveModal)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [executeActiveRequest, saveActiveRequest])

  if (activeView === 'history-detail') {
    return <HistoryDetailView />
  }

  const activeTabRequest = tabs?.find((t) => t.requestId === activeTabId)

  if (!activeTabRequest) {
    return (
      <div className="flex-1 bg-background flex flex-col overflow-hidden text-slate-900 dark:text-slate-100">
        <RequestTabs />
        <div className="flex-1 flex flex-col items-center justify-center text-muted">
          <div className="w-24 h-24 rounded-[2rem] bg-surface flex items-center justify-center mb-8 border border-border shadow-2xl shadow-black/20 group">
            <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/40 group-hover:scale-110 transition-transform">
              <Zap size={32} fill="currentColor" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-text mb-3 italic uppercase tracking-tighter">Welcome to Wapbolt</h2>
          <p className="text-sm text-muted max-w-sm text-center">
            Select a request from the sidebar or create a new one to get started with API testing.
          </p>
        </div>
      </div>
    )
  }

  const { workingRequest } = activeTabRequest

  const activeRequestDetails = typeof activeTabRequest.requestId === 'number'
    ? requests.find((r) => r.id === activeTabRequest.requestId)
    : null

  const parentCollection = activeRequestDetails && activeTabRequest.requestId
    ? collections.find((c) => {
      const isDraft = activeTabRequest.requestId.toString().startsWith('draft')
      return c.id === (isDraft ? -1 : activeRequestDetails.collection_id)
    })
    : null

  const collectionName = parentCollection?.name || 'My Collection'
  const requestName = activeTabRequest.name

  const currentPresence = presenceByRequest[activeTabRequest.requestId] || []
  const currentLock = locksByRequest[activeTabRequest.requestId]
  const isLockedByOthers = currentLock && user ? currentLock.user_id !== user.id : false

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 bg-background flex flex-col overflow-hidden">
        <RequestTabs />

        {/* Top half: Request Builder */}
        <div
          className="flex flex-col min-h-0 border-b border-border bg-background relative shrink-0"
          style={{ height: `${builderHeight}%` }}
        >
          {/* New Request Header: Path & Name */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-border/50">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex items-center justify-center w-6 h-6 rounded bg-surface border border-border shrink-0">
                <Globe size={12} className="text-info" />
              </div>
              <div className="flex items-center gap-1.5 text-xs overflow-hidden">
                <span className="text-muted truncate max-w-[200px]">{collectionName}</span>
                <span className="text-muted/50">/</span>
                <span className="text-text font-bold truncate">{requestName}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-surface border border-border rounded divide-x divide-border">
                <button
                  onClick={() => {
                    if (typeof activeTabRequest.requestId === 'string' && (activeTabRequest.requestId.startsWith('draft-') || activeTabRequest.requestId.startsWith('example-'))) {
                      setIsSaveModalOpen(true)
                    } else {
                      saveActiveRequest()
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-border/30 transition-colors text-xs font-medium text-text"
                >
                  <Save size={14} className="text-muted" />
                  <span>Save</span>
                </button>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button className="px-2 py-1.5 hover:bg-border/30 transition-colors focus:outline-none">
                      <ChevronDown size={14} className="text-muted" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      className="bg-surface border border-border rounded-lg shadow-xl p-1 z-110 min-w-40 text-xs"
                      sideOffset={4}
                      align="end"
                    >
                      <DropdownMenu.Item
                        onClick={() => setIsSaveModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer text-text hover:bg-background outline-none data-highlighted:bg-background"
                      >
                        <Save size={13} className="text-muted" />
                        Save As...
                      </DropdownMenu.Item>
                      {typeof activeTabRequest.requestId === 'number' && (
                        <DropdownMenu.Item
                          onClick={() => duplicateRequest(activeTabRequest.requestId as number)}
                          className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer text-text hover:bg-background outline-none data-highlighted:bg-background"
                        >
                          <Copy size={13} className="text-muted" />
                          Duplicate
                        </DropdownMenu.Item>
                      )}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>

              <div className="flex items-center bg-surface border border-border rounded divide-x divide-border">
                <button
                  onClick={() => setComingSoon({ isOpen: true, feature: 'Request Sharing' })}
                  className="px-4 py-1.5 hover:bg-border/30 transition-colors text-xs font-medium text-text"
                >
                  Share
                </button>
                <button
                  onClick={() => setComingSoon({ isOpen: true, feature: 'Request Sharing' })}
                  className="px-2 py-1.5 hover:bg-border/30 transition-colors"
                >
                  <LinkIcon size={14} className="text-muted" />
                </button>
              </div>
            </div>
          </div>

          {/* URL Bar Area */}
          <div className="p-4 flex flex-col gap-3">
            <div className="flex gap-2">
              <div className="flex-1 flex shadow-sm rounded border border-border focus-within:border-primary transition-colors bg-surface overflow-hidden">
                <RequestForm
                  method={workingRequest.method}
                  url={workingRequest.url}
                  isLocked={isLockedByOthers}
                  onUpdate={(update): void => {
                    if (update.url !== undefined) {
                      handleUrlChange(update.url)
                    } else {
                      setWorkingRequest(update)
                    }
                  }}
                />

                {/* Navbar Environment Selector */}
                <div className="border-l border-border flex items-center bg-surface/50 px-2 group">
                  <select
                    value={activeEnvironmentId ?? ''}
                    onChange={(e): void => {
                      const val = e.target.value
                      useDataStore.getState().setActiveEnvironment(val === '' ? null : Number(val))
                    }}
                    className="bg-transparent text-[10px] font-bold text-muted group-hover:text-primary transition-colors focus:outline-none cursor-pointer max-w-[100px] truncate uppercase tracking-widest"
                  >
                    <option value="">No Env</option>
                    {environments.map((env) => (
                      <option key={env.id} value={env.id}>
                        {env.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex shadow-sm rounded overflow-hidden">
                <button
                  onClick={executeActiveRequest}
                  disabled={activeTabRequest.isSending}
                  className="bg-primary hover:bg-primary-hover text-white px-6 py-2 text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50 rounded"
                >
                  {activeTabRequest.isSending ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <span>Send</span>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Actions (Moved below URL Bar) */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsImportCurlOpen(true)}
                  className="px-2 py-1 text-muted hover:text-text rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                >
                  <TerminalIcon size={12} />
                  Import cURL
                </button>
                <button
                  onClick={() => setIsExportCodeOpen(true)}
                  className="px-2 py-1 text-muted hover:text-text rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                >
                  <Code size={12} />
                  Export
                </button>
                <button
                  onClick={() => setShowCollabPanel(!showCollabPanel)}
                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${showCollabPanel ? 'text-primary bg-primary/10' : 'text-muted hover:text-text'
                    }`}
                >
                  <Users size={12} />
                  Collab
                </button>
              </div>

              {/* Presence & Locking Status */}
              {(currentPresence.length > 0 || currentLock) && (
                <div className="flex items-center gap-3 bg-surface/30 px-2 py-1 rounded-full border border-border/30">
                  <div className="flex items-center gap-1.5">
                    <div className="flex -space-x-1.5 mr-1">
                      {currentPresence.map((p) => (
                        <div
                          key={p.user_id}
                          title={`${p.user_name} is viewing this request`}
                          className={`w-5 h-5 rounded-full border border-background flex items-center justify-center font-bold text-[8px] text-white shadow-sm cursor-pointer ${[
                            'bg-blue-500',
                            'bg-purple-500',
                            'bg-pink-500',
                            'bg-indigo-500',
                            'bg-orange-500',
                            'bg-cyan-500'
                          ][p.user_id % 6]
                            }`}
                        >
                          {p.user_name.charAt(0).toUpperCase()}
                        </div>
                      ))}
                    </div>
                    {currentPresence.length === 1 && (
                      <span className="text-[10px] text-muted font-medium pr-1">
                        {currentPresence[0].user_id === user?.id ? 'You' : currentPresence[0].user_name} is viewing
                      </span>
                    )}
                    {currentPresence.length > 1 && (
                      <span className="text-[10px] text-muted font-medium pr-1">
                        {currentPresence.length} users viewing
                      </span>
                    )}
                  </div>
                  {currentLock && (
                    <div
                      title={isLockedByOthers ? `${currentLock.user_name} is currently editing` : 'You have the edit lock'}
                      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-wider ${isLockedByOthers
                        ? 'bg-warning/20 border-warning/40 text-warning shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                        : 'bg-success/20 border-success/40 text-success shadow-[0_0_8px_rgba(34,197,94,0.2)]'
                        }`}
                    >
                      <Lock size={8} className={isLockedByOthers ? 'animate-pulse' : ''} />
                      {isLockedByOthers ? `Locked by ${currentLock.user_name}` : 'Editing'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tabs Area */}
          <div className="flex px-4 border-b border-border bg-background shrink-0 items-center justify-between">
            <div className="flex items-center">
              <div
                className={`px-3 py-2 text-xs font-medium cursor-pointer border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'Docs' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'
                  }`}
                onClick={() => setComingSoon({ isOpen: true, feature: 'Documentation' })}
              >
                <BookOpen size={14} />
                Docs
              </div>

              {REQUEST_TABS.map((tab) => (
                <div
                  key={tab}
                  onClick={(): void => setActiveTab(tab)}
                  className={`px-3 py-2 text-xs font-medium cursor-pointer border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted hover:text-text'
                    }`}
                >
                  {tab}
                  {((tab === 'Body' &&
                    workingRequest.body_type !== 'none') ||
                    (tab === 'Pre-request' && workingRequest.pre_request_script) ||
                    (tab === 'Tests' && workingRequest.post_request_script) ||
                    (tab === 'Headers' && Object.keys(workingRequest.headers || {}).length > 0) ||
                    (tab === 'Auth' && workingRequest.auth_config?.type !== 'No Auth')) && (
                      <div className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_4px_rgba(34,197,94,0.6)]" />
                    )}
                  {tab === 'Headers' && Object.keys(workingRequest.headers || {}).length > 0 && (
                    <span className="text-[10px] text-muted-foreground opacity-70">
                      ({Object.keys(workingRequest.headers).length})
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4 pr-2">
              <button
                onClick={() => setComingSoon({ isOpen: true, feature: 'Cookies Management' })}
                className="text-[11px] font-bold text-primary hover:underline"
              >
                Cookies
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden relative">
            <EditorArea
              key={`editor-${activeTabRequest.requestId}`}
              activeTab={activeTab}
              requestId={activeTabRequest.requestId}
              workingRequest={workingRequest}
              isLocked={isLockedByOthers}
              onUpdate={(update): void => setWorkingRequest(update)}
            />
          </div>
        </div>

        {/* Resizer Bar */}
        <div
          className={`h-1.5 w-full cursor-row-resize hover:bg-primary/40 transition-colors z-20 shrink-0 ${isResizing ? 'bg-primary/60' : 'bg-transparent'}`}
          onMouseDown={() => setIsResizing(true)}
        />

        {/* Bottom half: Response Area */}
        <div className="flex-1 flex flex-col min-h-0">
          <ResponseArea />
        </div>
      </div>

      {/* Right Sidebar: Collaboration Panel */}
      {typeof activeTabRequest.requestId === 'number' && showCollabPanel && <CollaborationPanel requestId={activeTabRequest.requestId} />}

      {/* Modals */}
      <ImportCurlModal
        isOpen={isImportCurlOpen}
        onClose={() => setIsImportCurlOpen(false)}
        onImport={async (data) => {
          setWorkingRequest({
            method: data.method,
            url: data.url,
            headers: data.headers,
            body: data.body,
            body_type: data.bodyType
          })
        }}
      />

      <ExportCodeModal
        isOpen={isExportCodeOpen}
        onClose={() => setIsExportCodeOpen(false)}
        requestData={{
          method: workingRequest.method,
          url: workingRequest.url,
          headers: workingRequest.headers,
          body: workingRequest.body,
          body_type: workingRequest.body_type
        }}
      />

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

      {/* Save / Save As Modal */}
      <SaveRequestLocationModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        draftRequest={{
          name: activeTabRequest.name,
          method: activeTabRequest.workingRequest.method as any,
          url: activeTabRequest.workingRequest.url,
          headers: activeTabRequest.workingRequest.headers,
          body: activeTabRequest.workingRequest.body,
          body_type: activeTabRequest.workingRequest.body_type,
          auth_config: activeTabRequest.workingRequest.auth_config,
          pre_request_script: activeTabRequest.workingRequest.pre_request_script,
          post_request_script: activeTabRequest.workingRequest.post_request_script
        }}
        draftId={typeof activeTabRequest.requestId === 'string' ? activeTabRequest.requestId : `saved-${activeTabRequest.requestId}`}
      />

      <ComingSoonModal
        isOpen={comingSoon.isOpen}
        featureName={comingSoon.feature}
        onClose={() => setComingSoon({ isOpen: false, feature: '' })}
      />
    </div>
  )
}
