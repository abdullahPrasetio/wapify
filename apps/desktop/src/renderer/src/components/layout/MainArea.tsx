import { useAppStore } from '../../store/useAppStore'
import { useDataStore, AuthConfig } from '../../store/useDataStore'
import { KeyValueEditor } from '../ui/KeyValueEditor'
import { Shield, Eye, EyeOff, X, RefreshCw, Send, Save } from 'lucide-react'
import { ResponseArea } from './ResponseArea'
import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { useState, useRef, useEffect } from 'react'

// Configure Monaco to use the bundled version (OFFLINE)
loader.config({ monaco })

const TABS = ['Params', 'Headers', 'Body', 'Auth'] as const

const METHOD_COLOR: Record<string, string> = {
  GET: 'text-success',
  POST: 'text-warning',
  PUT: 'text-info',
  PATCH: 'text-secondary',
  DELETE: 'text-danger'
}

interface RequestFormProps {
  method: string
  url: string
  onUpdate: (update: { method?: string; url?: string }) => void
}

const RequestForm = ({ method, url, onUpdate }: RequestFormProps): React.JSX.Element => {
  const { environments, activeEnvironmentId } = useDataStore()
  const activeEnv = environments.find((e) => e.id === activeEnvironmentId)
  const envVars = activeEnv?.variables || {}
  
  const [hoverVar, setHoverVar] = useState<{ name: string; value: string; x: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const checkVariable = (e: React.SyntheticEvent<HTMLInputElement>): void => {
    const input = e.currentTarget
    const pos = input.selectionStart || 0
    
    const regex = /\{\{([^}]+)\}\}/g
    let match
    let found = false
    while ((match = regex.exec(url)) !== null) {
      const start = match.index
      const end = start + match[0].length
      if (pos >= start && pos <= end) {
        const varName = match[1].trim()
        const val = envVars[varName]
        if (val !== undefined) {
          // Estimate X position (very rough, but better than nothing)
          // For mono fonts, it's easier.
          const charWidth = 8 // approximate for mono
          const x = 110 + (start * charWidth) // 110 is approx offset of select box
          setHoverVar({ name: varName, value: String(val), x })
          found = true
          break
        }
      }
    }
    if (!found) setHoverVar(null)
  }

  return (
    <div className="flex-1 flex relative items-center">
      <select
        value={method}
        onChange={(e): void => onUpdate({ method: e.target.value })}
        className={`bg-surface font-black text-xs px-4 py-2.5 border-r border-border focus:outline-none shrink-0 ${METHOD_COLOR[method] ?? 'text-muted'}`}
      >
        {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((m) => (
          <option key={m} value={m} className="text-text font-sans">
            {m}
          </option>
        ))}
      </select>
      
      <div className="flex-1 relative group">
        {/* Highlighter Overlay */}
        <div 
          className="absolute inset-0 px-4 py-2.5 pointer-events-none whitespace-pre overflow-hidden font-mono text-sm select-none"
          aria-hidden="true"
        >
          {url.split(/(\{\{[^}]+\}\})/).map((part, i) => {
            if (part.startsWith('{{') && part.endsWith('}}')) {
              const varName = part.slice(2, -2).trim()
              const exists = envVars[varName] !== undefined
              return (
                <span key={i} className={exists ? 'text-orange-400 bg-orange-400/10 rounded-sm' : 'text-red-400 bg-red-400/10 rounded-sm'}>
                  {part}
                </span>
              )
            }
            return <span key={i} className="text-transparent">{part}</span>
          })}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={url}
          onKeyUp={checkVariable}
          onMouseUp={checkVariable}
          onBlur={(): void => setHoverVar(null)}
          onChange={(e): void => onUpdate({ url: e.target.value })}
          className="w-full bg-transparent px-4 py-2.5 text-sm text-text focus:outline-none font-mono placeholder:text-muted/30 relative z-10"
          placeholder="https://api.example.com/v1/resource"
        />
        
        {/* Variable Tooltip */}
        {hoverVar && (
          <div 
            className="absolute -top-10 z-50 bg-popover text-popover-foreground px-2 py-1.5 rounded shadow-lg border border-border text-[10px] animate-in fade-in zoom-in duration-150 pointer-events-none"
            style={{ left: `${Math.min(hoverVar.x, 400)}px` }}
          >
            <div className="font-bold text-primary flex items-center gap-1">
              <span className="opacity-50">{"{{"}</span>
              {hoverVar.name}
              <span className="opacity-50">{"}}"}</span>
            </div>
            <div className="mt-0.5 text-text break-all max-w-[200px]">
              {hoverVar.value}
            </div>
            <div className="text-[8px] text-muted mt-1 italic">
              From: {activeEnv?.name || 'Active Environment'}
            </div>
            <div className="absolute -bottom-1 left-4 w-2 h-2 bg-popover border-r border-b border-border rotate-45" />
          </div>
        )}
      </div>
    </div>
  )
}

interface EditorAreaProps {
  activeTab: (typeof TABS)[number]
  workingRequest: {
    headers: Record<string, string>
    body: string
    auth_config: AuthConfig
  }
  onUpdate: (
    update: Partial<{ headers: Record<string, string>; body: string; auth_config: AuthConfig }>
  ) => void
}

const EditorArea = ({ activeTab, workingRequest, onUpdate }: EditorAreaProps): React.JSX.Element => {
  const [showPassword, setShowPassword] = useState(false)
  const [localBody, setLocalBody] = useState(workingRequest.body)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Sync local body when workingRequest.body changes (e.g. tab switched)
  useEffect(() => {
    setLocalBody(workingRequest.body || '')
  }, [workingRequest.body])

  const handleBodyChange = (value: string | undefined): void => {
    const newVal = value || ''
    setLocalBody(newVal)

    // Debounce store update to keep typing smooth
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onUpdate({ body: newVal })
    }, 300)
  }

  const auth = workingRequest.auth_config || { type: 'No Auth' }

  const { environments, activeEnvironmentId } = useDataStore()
  const activeEnv = environments.find((e) => e.id === activeEnvironmentId)
  const envVars = activeEnv?.variables || {}

  // Use refs so the hover provider always sees latest values without re-registering
  const envVarsRef = useRef(envVars)
  envVarsRef.current = envVars
  const activeEnvNameRef = useRef(activeEnv?.name)
  activeEnvNameRef.current = activeEnv?.name

  const hoverProviderRef = useRef<any>(null)

  useEffect(() => {
    return () => {
      if (hoverProviderRef.current) {
        hoverProviderRef.current.dispose()
      }
    }
  }, [])

  const handleAuthChange = (update: Partial<AuthConfig>): void => {
    onUpdate({ auth_config: { ...auth, ...update } })
  }

  const handleEditorMount = (_editor: any, monaco: any): void => {
    if (hoverProviderRef.current) {
      hoverProviderRef.current.dispose()
    }

    // Register hover provider for environment variables {{variable}}
    const provider = {
      provideHover: (model, position) => {
        const line = model.getLineContent(position.lineNumber)
        const regex = /\{\{([^}]+)\}\}/g
        let match
        while ((match = regex.exec(line)) !== null) {
          const startColumn = match.index + 1
          const endColumn = startColumn + match[0].length
          if (position.column >= startColumn && position.column <= endColumn) {
            const varName = match[1]
            const val = envVarsRef.current[varName]
            if (val !== undefined) {
              return {
                range: new monaco.Range(position.lineNumber, startColumn, position.lineNumber, endColumn),
                contents: [
                  { value: `**Variable:** \`${varName}\`` },
                  { value: `**Current Value:** \`${val}\`` },
                  { value: `*From environment: ${activeEnvNameRef.current || 'Active Environment'}*` }
                ]
              }
            }
          }
        }
        return null
      }
    }

    hoverProviderRef.current = monaco.languages.registerHoverProvider('json', provider)
    // Also register for other potential types
    monaco.languages.registerHoverProvider('plaintext', provider)
    monaco.languages.registerHoverProvider('javascript', provider)
  }

  return (
    <div className="h-full w-full overflow-hidden">
      {activeTab === 'Body' && (
        <div className="h-full w-full py-2 bg-surface/20">
          <Editor
            height="100%"
            defaultLanguage="json"
            theme="vs-dark"
            value={localBody || ''}
            onChange={handleBodyChange}
            onMount={handleEditorMount}
            loading={
              <div className="flex flex-col items-center justify-center h-full text-muted gap-2">
                <RefreshCw size={24} className="animate-spin" />
                <span className="text-xs font-medium uppercase tracking-widest">Initializing Editor...</span>
              </div>
            }
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 10, bottom: 10 },
              formatOnPaste: true,
              formatOnType: true,
              wordWrap: 'on'
            }}
          />
        </div>
      )}

      {activeTab === 'Headers' && (
        <div className="p-4 h-full overflow-auto">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">Request Headers</h3>
            <span className="text-xs text-muted">Manage key-value pairs for headers</span>
          </div>
          <KeyValueEditor
            initialData={workingRequest.headers || {}}
            onChange={(data): void => onUpdate({ headers: data as Record<string, string> })}
          />
        </div>
      )}

      {activeTab === 'Params' && (
        <div className="p-4 h-full overflow-auto">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">Query Parameters</h3>
            <span className="text-xs text-muted">Automatically appended to the URL</span>
          </div>
          <p className="text-xs text-muted italic mb-4">
            Query parameters integration coming soon. For now, add them directly to the URL bar.
          </p>
        </div>
      )}

      {activeTab === 'Auth' && (
        <div className="p-6 h-full overflow-auto">
          <div className="flex gap-6 h-full">
            <div className="w-48 shrink-0 flex flex-col gap-1 border-r border-border pr-4">
              <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 px-2">
                Type
              </label>
              {['No Auth', 'Bearer Token', 'Basic Auth', 'API Key'].map((type) => (
                <div
                  key={type}
                  onClick={(): void => handleAuthChange({ type })}
                  className={`px-3 py-2 rounded text-xs font-medium cursor-pointer transition-colors ${auth.type === type ? 'bg-primary/20 text-primary' : 'text-text hover:bg-surface'}`}
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
                        onChange={(e): void => handleAuthChange({ token: e.target.value })}
                        className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-primary pr-10"
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
                  <p className="text-[10px] text-muted italic">
                    The token will be sent in the <code>Authorization</code> header as{' '}
                    <code>Bearer {'<token>'}</code>.
                  </p>
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
                        onChange={(e): void => handleAuthChange({ username: e.target.value })}
                        className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
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
                          onChange={(e): void => handleAuthChange({ password: e.target.value })}
                          className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-primary pr-10"
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
                  <p className="text-[10px] text-muted italic">
                    Credentials will be base64 encoded and sent in the <code>Authorization</code>{' '}
                    header.
                  </p>
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
                        onChange={(e): void => handleAuthChange({ key: e.target.value })}
                        className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                        placeholder="X-API-Key"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted mb-1.5 block">Value</label>
                      <input
                        type="text"
                        value={auth.value || ''}
                        onChange={(e): void => handleAuthChange({ value: e.target.value })}
                        className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                        placeholder="Value"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted mb-1.5 block">Add to</label>
                    <select
                      value={auth.addTo || 'header'}
                      onChange={(e): void =>
                        handleAuthChange({ addTo: e.target.value as 'header' | 'query' })
                      }
                      className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
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
      )}
    </div>
  )
}

const RequestTabs = (): React.JSX.Element => {
  const { tabs, activeTabId, setActiveTab, closeTab } = useDataStore()

  if (!tabs || tabs.length === 0) return <></>

  return (
    <div className="flex bg-background border-b border-border overflow-x-auto no-scrollbar shrink-0">
      {tabs.map((tab) => (
        <div
          key={tab.requestId}
          onClick={(): void => setActiveTab(tab.requestId)}
          className={`group flex items-center h-10 px-3 border-r border-border cursor-pointer transition-all min-w-[120px] max-w-[200px] relative ${
            activeTabId === tab.requestId
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
      ))}
    </div>
  )
}

export const MainArea = (): React.JSX.Element => {
  const { activeTab, setActiveTab } = useAppStore()
  const { tabs, activeTabId, setWorkingRequest, executeActiveRequest, saveActiveRequest } = useDataStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Ctrl/Cmd + Enter for Send
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        executeActiveRequest()
      }
      // Ctrl/Cmd + S for Save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveActiveRequest()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return (): void => window.removeEventListener('keydown', handleKeyDown)
  }, [executeActiveRequest, saveActiveRequest])

  const activeTabRequest = tabs?.find((t) => t.requestId === activeTabId)

  if (!activeTabRequest) {
    return (
      <div className="flex-1 bg-background flex flex-col overflow-hidden">
        <RequestTabs />
        <div className="flex-1 flex flex-col items-center justify-center text-muted">
          <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center mb-6 border border-border shadow-inner">
            <div className="w-10 h-10 rounded bg-primary flex items-center justify-center text-white font-black text-xl">
              W
            </div>
          </div>
          <h2 className="text-xl font-bold text-text mb-2">Welcome to Wapify</h2>
          <p className="text-sm text-muted max-w-sm text-center">
            Select a request from the sidebar or create a new one to get started with API testing.
          </p>
        </div>
      </div>
    )
  }

  const { workingRequest } = activeTabRequest

  return (
    <div className="flex-1 bg-background flex flex-col overflow-hidden">
      <RequestTabs />

      {/* Top half: Request Builder */}
      <div className="flex-[0.6] flex flex-col min-h-0 border-b border-border">
        {/* URL Bar Area */}
        <div className="p-4 border-b border-border bg-surface/50 shrink-0">
          <div className="flex gap-3">
            <div className="flex-1 flex shadow-sm rounded-md overflow-hidden border border-border focus-within:border-primary transition-colors bg-surface">
              <RequestForm
                method={workingRequest.method}
                url={workingRequest.url}
                onUpdate={(update): void => setWorkingRequest(update)}
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={executeActiveRequest}
                disabled={activeTabRequest.isSending}
                className="bg-primary hover:bg-primary-hover text-white px-6 py-2 rounded text-sm font-bold transition-all shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
              >
                {activeTabRequest.isSending ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                Send
              </button>
              
              <button
                onClick={saveActiveRequest}
                className={`px-4 py-2 rounded text-sm font-bold transition-all border ${
                  activeTabRequest.isDirty 
                    ? 'bg-success/10 border-success/30 text-success hover:bg-success/20' 
                    : 'bg-surface border-border text-muted hover:text-text'
                }`}
                title="Save Request (Cmd+S)"
              >
                <Save size={14} className="inline mr-2" />
                Save
              </button>
            </div>
          </div>
        </div>

        {/* Tabs Area */}
        <div className="flex px-4 border-b border-border bg-surface/30 shrink-0">
          {TABS.map((tab) => (
            <div
              key={tab}
              onClick={(): void => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium cursor-pointer border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-text'
              }`}
            >
              {tab}
            </div>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden relative">
          <EditorArea
            key={`editor-${activeTabRequest.requestId}`}
            activeTab={activeTab}
            workingRequest={workingRequest}
            onUpdate={(update): void => setWorkingRequest(update)}
          />
        </div>
      </div>

      {/* Bottom half: Response Area */}
      <div className="flex-[0.4] flex flex-col min-h-0">
        <ResponseArea />
      </div>
    </div>
  )
}
