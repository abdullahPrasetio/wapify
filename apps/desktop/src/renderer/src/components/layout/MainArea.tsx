import { useAppStore } from '../../store/useAppStore'
import { useDataStore, AuthConfig } from '../../store/useDataStore'
import { useAuthStore } from '../../store/useAuthStore'
import { KeyValueEditor } from '../ui/KeyValueEditor'
import { VariableOverlayInput } from '../ui/VariableOverlayInput'
import { SetVarModal } from '../modals/SetVarModal'
import { Shield, Eye, EyeOff, X, RefreshCw, Send, Save, Lock, Users } from 'lucide-react'
import { ResponseArea } from './ResponseArea'
import { HistoryDetailView } from './HistoryDetailView'
import { CollaborationPanel } from './CollaborationPanel'
import { SaveRequestLocationModal } from '../modals/SaveRequestLocationModal'
import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'

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
            { value: isSet ? '*Click to change value (Coming soon)*' : '*Click to set value*' }
          ]
        }
      }
    }
    return null
  }
})

monaco.languages.registerHoverProvider('json', createVarHoverProvider('json'))
monaco.languages.registerHoverProvider('javascript', createVarHoverProvider('javascript'))


const REQUEST_TABS = ['Params', 'Auth', 'Headers', 'Body', 'Pre-request', 'Tests'] as const

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
  isLocked: boolean
  onUpdate: (update: { method?: string; url?: string }) => void
}

const RequestForm = ({ method, url, isLocked, onUpdate }: RequestFormProps): React.JSX.Element => {
  return (
    <div className="flex-1 flex relative items-center">
      <select
        value={method}
        disabled={isLocked}
        onChange={(e): void => onUpdate({ method: e.target.value })}
        className={`bg-surface font-black text-xs px-4 py-2.5 border-r border-border focus:outline-none shrink-0 ${METHOD_COLOR[method] ?? 'text-muted'} ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((m) => (
          <option key={m} value={m} className="text-text font-sans">
            {m}
          </option>
        ))}
      </select>

      <div className="flex-1 relative flex items-center h-full">
        <VariableOverlayInput
          value={url}
          disabled={isLocked}
          onChange={(e): void => onUpdate({ url: e.target.value })}

          placeholder="https://api.example.com/v1/resource"
          className="bg-transparent border-none px-4 py-2.5"
        />
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
    update: Partial<{
      headers: Record<string, string>
      body: string
      auth_config: AuthConfig
      pre_request_script: string
      post_request_script: string
    }>
  ) => void
  onSetVar: (key: string) => void
  isLocked?: boolean
}

const EditorArea = ({
  activeTab,
  workingRequest,
  isLocked,
  onUpdate,
  onSetVar
}: EditorAreaProps): React.JSX.Element => {

  const [showPassword, setShowPassword] = useState(false)
  const [localBody, setLocalBody] = useState(workingRequest.body)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  
  const auth = workingRequest.auth_config || { type: 'No Auth' }
  const handleAuthChange = (update: Partial<AuthConfig>): void => {
    onUpdate({ auth_config: { ...auth, ...update } as AuthConfig })
  }

  const handleBodyChange = (value: string | undefined): void => {
    const newVal = value || ''
    setLocalBody(newVal)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onUpdate({ body: newVal })
    }, 300)
  }

  const handleEditorMount = (editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: any): void => {
    editor.onDidChangeModelContent(() => {
      handleBodyChange(editor.getValue())
    })

    editor.onMouseDown((e) => {
      if (e.target.type !== monacoInstance.editor.MouseTargetType.CONTENT_TEXT) return
      const position = e.target.position
      if (!position) return
      const model = editor.getModel()
      if (!model) return
      const lineContent = model.getLineContent(position.lineNumber)
      const regex = /\{\{([^}]+)\}\}/g
      let match
      while ((match = regex.exec(lineContent)) !== null) {
        const start = match.index + 1
        const end = start + match[0].length
        if (position.column >= start && position.column <= end) {
          onSetVar(match[1].trim())
          break
        }
      }
    })
  }

  useEffect(() => {
    setLocalBody(workingRequest.body || '')
  }, [workingRequest.body])

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
                <span className="text-xs font-medium uppercase tracking-widest">
                  Initializing Editor...
                </span>
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
              wordWrap: 'on',
              readOnly: isLocked
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
            disabled={isLocked}
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
                padding: { top: 10 },
                readOnly: isLocked
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
                padding: { top: 10 },
                readOnly: isLocked
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
    environments,
    updateEnvironment,
    presenceByRequest,
    locksByRequest
  } = useDataStore()

  const { user } = useAuthStore()
  const [showCollabPanel, setShowCollabPanel] = useState(false)
  const [settingVar, setSettingVar] = useState<string | null>(null)
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
  
  const activeEnv = environments.find((e) => e.id === activeEnvironmentId) ?? null

  const handleSetVar = async (key: string, val: string) => {
    if (!activeEnv) return
    const newVars = { ...activeEnv.variables, [key]: val }
    await updateEnvironment(activeEnv.id, activeEnv.name, newVars)
    toast.success(`Variable "${key}" updated`)
  }

  useEffect(() => {
    const handleTriggerSaveModal = () => setIsSaveModalOpen(true)
    window.addEventListener('wapify:trigger-save-modal', handleTriggerSaveModal)
    
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
      window.removeEventListener('wapify:trigger-save-modal', handleTriggerSaveModal)
      window.removeEventListener('keydown', handleKeyDown)
    }
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

  const currentPresence = presenceByRequest[activeTabRequest.requestId] || []
  const currentLock = locksByRequest[activeTabRequest.requestId]
  const isLockedByOthers = currentLock && user ? currentLock.user_id !== user.id : false

  return (
    <div className="flex-1 flex overflow-hidden">
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
                  isLocked={isLockedByOthers}
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
                  onClick={() => {
                     if (typeof activeTabRequest.requestId === 'string' && activeTabRequest.requestId.startsWith('draft-')) {
                        setIsSaveModalOpen(true)
                     } else {
                        saveActiveRequest()
                     }
                  }}
                  className={`px-4 py-2 rounded text-sm font-bold transition-all border ${
                    activeTabRequest.isDirty || (typeof activeTabRequest.requestId === 'string' && activeTabRequest.requestId.startsWith('draft-'))
                      ? 'bg-success/10 border-success/30 text-success hover:bg-success/20'
                      : 'bg-surface border-border text-muted hover:text-text'
                  }`}
                  title="Save Request (Cmd+S)"
                >
                  {(activeTabRequest.isDirty || (typeof activeTabRequest.requestId === 'string' && activeTabRequest.requestId.startsWith('draft-'))) && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}
                  <Save size={14} className="inline mr-2" />
                  Save
                </button>

                <button
                  onClick={() => setShowCollabPanel(!showCollabPanel)}
                  className={`px-4 py-2 rounded text-sm font-bold transition-all border ${
                    showCollabPanel
                      ? 'bg-primary/20 border-primary/50 text-primary'
                      : 'bg-surface border-border text-muted hover:text-text'
                  }`}
                  title="Versions & Comments"
                >
                  <Users size={14} className="inline mr-2" />
                  Collab
                </button>
              </div>
            </div>

            {/* Presence & Locking Status Bar */}
            {(currentPresence.length > 0 || currentLock) && (
              <div className="flex items-center justify-between px-4 py-2 bg-background/50 border-t border-border text-[10px]">
                <div className="flex items-center gap-3">
                  {/* Visual Avatars */}
                  <div className="flex -space-x-2">
                    {currentPresence.map((p) => (
                      <div
                        key={p.user_id}
                        title={p.user_name}
                        className={`w-6 h-6 rounded-full border-2 border-background flex items-center justify-center font-bold text-[10px] text-white shadow-sm ring-1 ring-border transition-transform hover:scale-110 hover:z-10 cursor-help ${
                          [
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
                  {currentPresence.length > 0 && (
                    <span className="text-muted font-medium ml-1">
                      {currentPresence.length} {currentPresence.length === 1 ? 'person' : 'people'} viewing
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {currentLock && (
                    <div
                      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${
                        isLockedByOthers
                          ? 'bg-warning/10 border-warning/30 text-warning'
                          : 'bg-success/10 border-success/30 text-success'
                      }`}
                    >
                      <Lock size={10} className={isLockedByOthers ? 'animate-pulse' : ''} />
                      <span className="font-bold uppercase tracking-wider text-[9px]">
                        {isLockedByOthers ? `Locked by ${currentLock.user_name}` : 'Locked by you'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
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
                {((tab === 'Body' &&
                  workingRequest.body &&
                  workingRequest.body !== '{}' &&
                  workingRequest.body !== '') ||
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
              isLocked={isLockedByOthers}
              onUpdate={(update): void => setWorkingRequest(update)}
              onSetVar={setSettingVar}
            />
          </div>
        </div>

        {/* Bottom half: Response Area */}
        <div className="flex-[0.4] flex flex-col min-h-0">
          <ResponseArea />
        </div>
      </div>

      {/* Right Sidebar: Collaboration Panel */}
      {typeof activeTabRequest.requestId === 'number' && showCollabPanel && <CollaborationPanel requestId={activeTabRequest.requestId} />}

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

      {/* Save Draft Location Modal */}
      {typeof activeTabRequest.requestId === 'string' && (activeTabRequest.requestId.startsWith('draft-') || activeTabRequest.requestId.startsWith('example-')) && (
        <SaveRequestLocationModal
          isOpen={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          draftRequest={{
            method: activeTabRequest.workingRequest.method as any,
            url: activeTabRequest.workingRequest.url,
            headers: activeTabRequest.workingRequest.headers,
            body: (() => {
              try {
                return activeTabRequest.workingRequest.body ? JSON.parse(activeTabRequest.workingRequest.body) : {}
              } catch {
                return { raw: activeTabRequest.workingRequest.body }
              }
            })(),
            auth_config: activeTabRequest.workingRequest.auth_config,
            pre_request_script: activeTabRequest.workingRequest.pre_request_script,
            post_request_script: activeTabRequest.workingRequest.post_request_script
          }}
          draftId={activeTabRequest.requestId}
        />
      )}
    </div>
  )
}
