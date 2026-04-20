import { useAppStore } from '../../store/useAppStore'
import { useDataStore, AuthConfig } from '../../store/useDataStore'
import { KeyValueEditor } from '../ui/KeyValueEditor'
import { Shield, Eye, EyeOff, X, RefreshCw, Send, Save } from 'lucide-react'
import { ResponseArea } from './ResponseArea'
import { HistoryDetailView } from './HistoryDetailView'
import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { useState, useRef, useEffect } from 'react'

// Configure Monaco to use the bundled version (OFFLINE)
loader.config({ monaco })

// Register Hover Provider for variables
monaco.languages.registerHoverProvider('json', {
  provideHover: (model, position) => {
    const word = model.getWordAtPosition(position)
    if (!word) return null
    
    // Check if current line has {{ }} around the word
    const lineContent = model.getLineContent(position.lineNumber)
    const vars = useDataStore.getState().environments.find(e => e.id === useDataStore.getState().activeEnvironmentId)?.variables || {}
    
    const regex = /\{\{([^}]+)\}\}/g
    let match
    while ((match = regex.exec(lineContent)) !== null) {
      const start = match.index + 1
      const end = start + match[0].length
      if (position.column >= start && position.column <= end) {
        const varName = match[1].trim()
        const value = vars[varName]
        return {
          range: new monaco.Range(position.lineNumber, start, position.lineNumber, end),
          contents: [
            { value: `**Variable:** ${varName}` },
            { value: value !== undefined ? `**Value:** ${value}` : '*Variable not found in active environment*' }
          ]
        }
      }
    }
    return null
  }
})

// Same for javascript (scripts)
monaco.languages.registerHoverProvider('javascript', {
  provideHover: (model, position) => {
    const lineContent = model.getLineContent(position.lineNumber)
    const vars = useDataStore.getState().environments.find(e => e.id === useDataStore.getState().activeEnvironmentId)?.variables || {}
    const regex = /\{\{([^}]+)\}\}/g
    let match
    while ((match = regex.exec(lineContent)) !== null) {
      const start = match.index + 1
      const end = start + match[0].length
      if (position.column >= start && position.column <= end) {
        const varName = match[1].trim()
        const value = vars[varName]
        return {
          range: new monaco.Range(position.lineNumber, start, position.lineNumber, end),
          contents: [
            { value: `**Variable:** ${varName}` },
            { value: value !== undefined ? `**Value:** ${value}` : '*Variable not found in active environment*' }
          ]
        }
      }
    }
    return null
  }
})

const REQUEST_TABS = ['Params', 'Auth', 'Headers', 'Body', 'Pre-request', 'Tests'] as const
type RequestTabType = (typeof REQUEST_TABS)[number]

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
  
  const [hoverVar, setHoverVar] = useState<{ name: string; value: string; x: number; y: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const checkVariableAtPos = (pos: number, x: number, y: number): void => {
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
          setHoverVar({ name: varName, value: String(val), x, y })
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
          onMouseMove={(e): void => {
            const input = e.currentTarget
            const rect = input.getBoundingClientRect()
            const x = e.clientX - rect.left
            
            // Approximate char index (font-mono text-sm is about 8.4px per char)
            const charWidth = 8.4 // mono text-sm
            const padding = 16 // px-4
            const pos = Math.max(0, Math.floor((x - padding) / charWidth))
            
            checkVariableAtPos(pos, e.clientX, e.clientY)
          }}
          onMouseLeave={(): void => setHoverVar(null)}
          onKeyUp={(e): void => {
             const pos = e.currentTarget.selectionStart || 0
             const rect = e.currentTarget.getBoundingClientRect()
             checkVariableAtPos(pos, rect.left + 16 + (pos * 8.4), rect.top + 20)
          }}
          onBlur={(): void => setHoverVar(null)}
          onMouseLeave={(): void => setHoverVar(null)}
          onChange={(e): void => onUpdate({ url: e.target.value })}
          className="w-full bg-transparent px-4 py-2.5 text-sm text-text focus:outline-none font-mono placeholder:text-muted/30 relative z-10 cursor-text"
          placeholder="https://api.example.com/v1/resource"
        />
        
        {/* Variable Tooltip */}
        {hoverVar && (
          <div 
            className="fixed z-[100] bg-surface/95 backdrop-blur-md text-text px-3 py-2 rounded-lg shadow-2xl border border-primary/40 text-[11px] animate-in fade-in zoom-in duration-150 pointer-events-none min-w-[160px]"
            style={{ 
              left: hoverVar.x, 
              top: hoverVar.y - 18, // More space
              transform: 'translate(-50%, -100%)' 
            }}
          >
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between border-b border-border/50 pb-1 mb-1">
                <span className="font-black text-primary uppercase tracking-tighter">
                  {hoverVar.name}
                </span>
                <span className="text-[9px] text-muted opacity-50 font-mono italic">
                  {activeEnv?.name || 'Env'}
                </span>
              </div>
              <div className="font-mono text-text/90 break-all leading-relaxed whitespace-pre-wrap max-h-[150px] overflow-y-auto">
                {hoverVar.value}
              </div>
            </div>
            {/* Pointer Arrow */}
            <div 
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-surface rotate-45 border-r border-b border-primary/40"
            />
          </div>
        )}
      </div>
    </div>
  )
}

interface EditorAreaProps {
  activeTab: string
  workingRequest: {
    headers: Record<string, string>
    body: string
    auth_config: AuthConfig
    pre_request_script?: string
    post_request_script?: string
  }
  onUpdate: (
    update: Partial<{ headers: Record<string, string>; body: string; auth_config: AuthConfig; pre_request_script: string; post_request_script: string }>
  ) => void
}

const EditorArea = ({ activeTab, workingRequest, onUpdate }: EditorAreaProps): React.JSX.Element => {
  const [activeScriptTab, setActiveScriptTab] = useState<'Pre-request' | 'Post-request'>('Pre-request')
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

      {activeTab === 'Pre-request' && (
        <div className="h-full flex flex-col">
          <div className="p-2 bg-background/50 border-b border-border">
            <span className="text-[10px] text-muted font-mono uppercase tracking-wider">
              Execution: Before request is sent
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              defaultLanguage="javascript"
              theme="vs-dark"
              value={workingRequest.pre_request_script || ''}
              onChange={(val) => onUpdate({ pre_request_script: val || '' })}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                scrollBeyondLastLine: false,
                padding: { top: 10 }
              }}
            />
          </div>
        </div>
      )}

      {activeTab === 'Tests' && (
        <div className="h-full flex flex-col">
          <div className="p-2 bg-background/50 border-b border-border">
            <span className="text-[10px] text-muted font-mono uppercase tracking-wider">
              Execution: After response is received
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              defaultLanguage="javascript"
              theme="vs-dark"
              value={workingRequest.post_request_script || ''}
              onChange={(val) => onUpdate({ post_request_script: val || '' })}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                scrollBeyondLastLine: false,
                padding: { top: 10 }
              }}
            />
          </div>
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
  const { activeView, activeTab, setActiveTab } = useAppStore()
  const { 
    tabs, 
    activeTabId, 
    setWorkingRequest, 
    executeActiveRequest, 
    saveActiveRequest,
    activeEnvironmentId,
    environments 
  } = useDataStore()

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

  if (activeView === 'history-detail') {
    return <HistoryDetailView />
  }

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
          {REQUEST_TABS.map((tab) => (
            <div
              key={tab}
              onClick={(): void => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium cursor-pointer border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-text'
              }`}
            >
              {tab}
              {((tab === 'Body' && workingRequest.body && workingRequest.body !== '{}' && workingRequest.body !== '') ||
                (tab === 'Pre-request' && workingRequest.pre_request_script) ||
                (tab === 'Tests' && workingRequest.post_request_script) ||
                (tab === 'Headers' && Object.keys(workingRequest.headers || {}).length > 0) ||
                (tab === 'Auth' && workingRequest.auth_config?.type !== 'No Auth')) && (
                <div className="w-1 h-1 rounded-full bg-success shadow-[0_0_5px_rgba(34,197,94,0.8)]" />
              )}
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
