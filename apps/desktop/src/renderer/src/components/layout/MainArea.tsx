import { useAppStore } from '../../store/useAppStore'
import { useDataStore, AuthConfig, WorkingRequest } from '../../store/useDataStore'
import { apiClient } from '../../api/client'
import { useAuthStore } from '../../store/useAuthStore'
import { KeyValueEditor } from '../ui/KeyValueEditor'
import { VariableOverlayInput } from '../ui/VariableOverlayInput'
import { SetVarModal } from '../modals/SetVarModal'
import { Shield, Eye, EyeOff, X, RefreshCw, Save, Lock, Users, ChevronDown, ChevronRight, FileCode2, Terminal as TerminalIcon, Code, Box, Globe, Link as LinkIcon, BookOpen, Zap, ShieldCheck, FileText, Copy, XCircle, Minus, Plus } from 'lucide-react'
import * as ContextMenu from '@radix-ui/react-context-menu'
import { ResponseArea } from './ResponseArea'
import { HistoryDetailView } from './HistoryDetailView'
import { CollaborationPanel } from './CollaborationPanel'
import { SaveRequestLocationModal } from '../modals/SaveRequestLocationModal'
import { ImportCurlModal } from '../modals/ImportCurlModal'
import { ExportCodeModal } from '../modals/ExportCodeModal'
import { ComingSoonModal } from '../modals/ComingSoonModal'
import { KeyboardShortcutsModal } from '../modals/KeyboardShortcutsModal'
import { WebSocketPanel } from './WebSocketPanel'
import { SSEPanel } from './SSEPanel'
import { parseCurlCommand, generateCurl } from '../../utils/curlParser'
import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import ReactDOM from 'react-dom'
import type { FieldValidationRule, FieldValidations, ExtractionRule, SchemaAssertion } from '../../types'
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

// Register wap API type definitions for IntelliSense in script editors
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _tsLang = (monaco.languages as any).typescript
_tsLang.javascriptDefaults.addExtraLib(`
declare const wap: {
  /** Set a temporary local variable (not persisted to DB) */
  set(key: string, value: unknown): void;
  environment: {
    /** Set an environment variable and persist to the active environment */
    set(key: string, value: unknown): void;
    /** Get an environment variable by key */
    get(key: string): string | undefined;
  };
  collectionVariables: {
    set(key: string, value: unknown): void;
    get(key: string): string | undefined;
  };
  /** The current request object */
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: unknown;
    body_type: string;
  };
  /** Run a named test assertion. Only available in post-request scripts. */
  test(name: string, fn: () => void): void;
  /** Create an assertion chain */
  expect(value: unknown): {
    to: {
      equal(expected: unknown): void;
      include(substring: string): void;
      be: { a(type: string): void };
      have: { status(code: number): void };
    };
    not: { to: { be: { null(): void } } };
  };
  /** Response data. Only available in post-request scripts. */
  response: {
    /** HTTP status code */
    status: number;
    /** Parsed response body */
    json(): any;
    /** Raw response data */
    data: any;
    headers: {
      get(key: string): string | undefined;
    };
    to: { have: { status(code: number): void } };
  };
};
declare const pm: typeof wap;
declare const moment: any;
declare const _: any;
`, 'wap-api.d.ts')

_tsLang.javascriptDefaults.setCompilerOptions({
  allowNonTsExtensions: true,
  noLib: false,
  target: _tsLang.ScriptTarget.ESNext,
})

// ─── Script Snippets ──────────────────────────────────────────────────────────

interface Snippet {
  label: string
  code: string
  description: string
}

const PRE_REQUEST_SNIPPETS: { category: string; items: Snippet[] }[] = [
  {
    category: 'Environment',
    items: [
      { label: 'Set variable', description: 'Persist a value to active env', code: "wap.environment.set('variableName', 'value')" },
      { label: 'Get variable', description: 'Read from active env', code: "const value = wap.environment.get('token')" },
      { label: 'Timestamp', description: 'Set current Unix timestamp', code: "wap.environment.set('timestamp', Date.now().toString())" },
    ]
  },
  {
    category: 'Auth',
    items: [
      { label: 'Bearer token header', description: 'Inject token into request header', code: "wap.request.headers['Authorization'] = 'Bearer ' + wap.environment.get('token')" },
    ]
  },
  {
    category: 'Logging',
    items: [
      { label: 'Log variable', description: 'Print env variable to console', code: "console.log('token:', wap.environment.get('token'))" },
    ]
  },
]

const TESTS_SNIPPETS: { category: string; items: Snippet[] }[] = [
  {
    category: 'Status',
    items: [
      { label: 'Status is 200', description: 'Assert HTTP 200', code: "wap.test('Status is 200', () => {\n  wap.expect(wap.response.status).to.equal(200)\n})" },
      { label: 'Status is 201', description: 'Assert HTTP 201 Created', code: "wap.test('Status is 201', () => {\n  wap.expect(wap.response.status).to.equal(201)\n})" },
      { label: 'Status 2xx', description: 'Assert success range', code: "wap.test('Status is success', () => {\n  const s = wap.response.status\n  if (s < 200 || s >= 300) throw new Error('Expected 2xx, got ' + s)\n})" },
    ]
  },
  {
    category: 'Save from Response',
    items: [
      { label: 'Save token', description: 'Extract & save token from response', code: "const json = wap.response.json()\nconst token = json?.data?.token || json?.token\nif (token) {\n  wap.environment.set('token', token)\n  console.log('Token saved:', token)\n}" },
      { label: 'Save any field', description: 'Extract a field and save to env', code: "const value = wap.response.json()?.data?.id\nwap.environment.set('savedId', String(value))" },
    ]
  },
  {
    category: 'Assertions',
    items: [
      { label: 'Response has field', description: 'Check JSON field exists', code: "wap.test('Response has data', () => {\n  const json = wap.response.json()\n  wap.expect(json).to.have.status // replace with your field check\n  if (!json?.data) throw new Error('Missing data field')\n})" },
      { label: 'Response time < 1s', description: 'Performance assertion', code: "// Note: timing available in console log\nconsole.log('Response received')" },
      { label: 'Log response', description: 'Print response to console', code: "console.log(JSON.stringify(wap.response.json(), null, 2))" },
    ]
  },
]

interface ScriptSnippetsPanelProps {
  mode: 'pre' | 'tests'
  onInsert: (code: string) => void
}

const ScriptSnippetsPanel = ({ mode, onInsert }: ScriptSnippetsPanelProps): React.JSX.Element => {
  const snippets = mode === 'pre' ? PRE_REQUEST_SNIPPETS : TESTS_SNIPPETS

  return (
    <div className="w-52 shrink-0 border-l border-border bg-background/50 flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-border">
        <span className="text-[9px] font-black text-muted uppercase tracking-[0.2em]">Snippets</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {snippets.map((group) => (
          <div key={group.category}>
            <div className="text-[9px] font-black text-muted/60 uppercase tracking-widest px-1 mb-1">
              {group.category}
            </div>
            <div className="space-y-0.5">
              {group.items.map((snippet) => (
                <button
                  key={snippet.label}
                  onClick={() => onInsert(snippet.code)}
                  title={snippet.description}
                  className="w-full text-left px-2 py-1.5 rounded text-[11px] text-text hover:bg-primary/10 hover:text-primary transition-colors group flex items-start gap-1.5"
                >
                  <span className="mt-0.5 text-primary/40 group-hover:text-primary transition-colors shrink-0">›</span>
                  <div>
                    <div className="font-medium leading-tight">{snippet.label}</div>
                    <div className="text-[9px] text-muted leading-tight">{snippet.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

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
  onSetVar?: (varName: string) => void
  onSend?: () => void
}

const EditorArea = ({
  activeTab,
  requestId,
  workingRequest,
  isLocked,
  onUpdate,
  onSetVar,
  onSend
}: EditorAreaProps): React.JSX.Element => {
  const { fontSize, theme } = useAppStore()
  const monacoTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs')
    : (theme === 'dark' ? 'vs-dark' : 'vs')
  const [showPassword, setShowPassword] = useState(false)
  const [isHeaderBulk, setIsHeaderBulk] = useState(false)
  const [headerBulkLocal, setHeaderBulkLocal] = useState('')
  const [gqlSchema, setGqlSchema] = useState<string | null>(null)
  const [gqlSchemaLoading, setGqlSchemaLoading] = useState(false)
  const [gqlRightTab, setGqlRightTab] = useState<'variables' | 'schema'>('variables')
  const [testsSubTab, setTestsSubTab] = useState<'script' | 'extract' | 'schema'>('script')
  const prevGqlUrlRef = useRef<string>('')
  useEffect(() => {
    if (workingRequest.body_type === 'graphql' && workingRequest.url !== prevGqlUrlRef.current) {
      prevGqlUrlRef.current = workingRequest.url
      setGqlSchema(null)
    }
  }, [workingRequest.url, workingRequest.body_type])
  const preEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const testsEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const onSendRef = useRef(onSend)
  onSendRef.current = onSend

  const registerSendShortcut = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onSendRef.current?.()
    })
  }

  const insertSnippet = (editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>, code: string) => {
    const editor = editorRef.current
    if (!editor) return
    const selection = editor.getSelection()
    const range = selection ?? new monaco.Range(1, 1, 1, 1)
    const currentVal = editor.getValue()
    const insertText = currentVal ? '\n\n' + code : code
    editor.executeEdits('snippet', [{ range, text: insertText, forceMoveMarkers: true }])
    editor.focus()
  }

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
              { id: 'binary', label: 'binary' },
              { id: 'graphql', label: 'GraphQL' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => handleBodyTypeChange(t.id === 'raw-json' ? 'raw-json' : t.id)}
                className={`px-2 py-1 text-[10px] font-bold uppercase rounded transition-colors cursor-pointer ${(workingRequest.body_type === t.id || (t.id === 'raw-json' && workingRequest.body_type?.startsWith('raw-')))
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
                <button className="flex items-center gap-1 text-[10px] font-bold text-primary uppercase cursor-pointer">
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
                    const isMinified = (workingRequest.body as string).trim().indexOf('\n') === -1
                    if (isMinified) {
                      onUpdate({ body: JSON.stringify(json, null, 2) })
                      toast.success('JSON Beautified')
                    } else {
                      onUpdate({ body: JSON.stringify(json) })
                      toast.success('JSON Minified')
                    }
                  } catch {
                    toast.error('Invalid JSON')
                  }
                }}
                className="text-[9px] font-black uppercase tracking-widest text-muted hover:text-primary transition-colors cursor-pointer"
              >
                {(workingRequest.body as string)?.trim().indexOf('\n') === -1 ? 'Beautify' : 'Minified'}
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
              onMount={(editor) => {
                registerSendShortcut(editor)
                editor.onMouseDown((e) => {
                  if (!onSetVar) return
                  const pos = e.target.position
                  if (!pos) return
                  const model = editor.getModel()
                  if (!model) return
                  const lineContent = model.getLineContent(pos.lineNumber)
                  const regex = /\{\{([^}]+)\}\}/g
                  let match
                  while ((match = regex.exec(lineContent)) !== null) {
                    const start = match.index + 1
                    const end = start + match[0].length
                    if (pos.column >= start && pos.column <= end) {
                      onSetVar(match[1].trim())
                      break
                    }
                  }
                })
              }}
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
                initialData={Array.isArray(workingRequest.body) ? workingRequest.body : []}
                disabled={isLocked}
                allowFileType={workingRequest.body_type === 'form-data'}
                onChange={(data) => onUpdate({ body: data })}
              />
            </div>
          )}

          {workingRequest.body_type === 'binary' && (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center text-muted">
                <FileCode2 size={32} />
              </div>
              <button className="px-4 py-2 bg-surface border border-border rounded-lg text-xs font-bold hover:border-primary transition-colors cursor-pointer">
                Select File
              </button>
              <span className="text-[10px] text-muted uppercase tracking-widest">Feature coming soon</span>
            </div>
          )}

          {workingRequest.body_type === 'graphql' && (() => {
            const parseGqlBody = (raw: unknown) => {
              try {
                const parsed = JSON.parse(typeof raw === 'string' ? raw : '{}')
                return { query: parsed.query || '', variables: parsed.variables || '{}', operationName: parsed.operationName || '' }
              } catch { return { query: '', variables: '{}', operationName: '' } }
            }
            const gqlBody = parseGqlBody(workingRequest.body)

            // Read current body at call-time to avoid stale closure
            const updateGql = (patch: Partial<typeof gqlBody>) => {
              const current = parseGqlBody(workingRequest.body)
              onUpdate({ body: JSON.stringify({ ...current, ...patch }) })
            }

            const loadSchema = async () => {
              if (!workingRequest.url) { toast.error('Set request URL first'); return }
              setGqlSchemaLoading(true)
              try {
                const introspectionBody = JSON.stringify({
                  query: `{
                    __schema {
                      types {
                        name kind description
                        fields {
                          name description
                          args { name description type { name kind ofType { name kind } } defaultValue }
                          type { name kind ofType { name kind ofType { name kind } } }
                        }
                        enumValues { name description }
                        inputFields { name description type { name kind ofType { name kind } } }
                        interfaces { name }
                        possibleTypes { name }
                      }
                      queryType { name }
                      mutationType { name }
                      subscriptionType { name }
                    }
                  }`
                })
                const headers = { 'Content-Type': 'application/json', ...workingRequest.headers }
                const res = await apiClient.executeRequest<any>(
                  'POST', workingRequest.url, headers, introspectionBody, 'raw-json'
                )
                const schema = res.data?.data?.__schema || res.data
                setGqlSchema(JSON.stringify(schema, null, 2))
                toast.success('Schema loaded')
              } catch (e) {
                toast.error(`Schema load failed: ${e instanceof Error ? e.message : String(e)}`)
              } finally {
                setGqlSchemaLoading(false)
              }
            }

            return (
              <div className="absolute inset-0 flex flex-col">
                {/* Operation Name + Load Schema toolbar */}
                <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-background/50 shrink-0">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Operation</span>
                  <input
                    type="text"
                    value={gqlBody.operationName}
                    onChange={e => updateGql({ operationName: e.target.value })}
                    placeholder="operationName (optional)"
                    className="flex-1 bg-transparent text-xs text-text border border-border rounded px-2 py-1 outline-none focus:border-primary"
                  />
                  <button
                    onClick={loadSchema}
                    disabled={gqlSchemaLoading}
                    className="flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest bg-surface border border-border text-muted hover:text-primary hover:border-primary transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {gqlSchemaLoading ? <RefreshCw size={10} className="animate-spin" /> : <BookOpen size={10} />}
                    {gqlSchemaLoading ? 'Loading...' : 'Load Schema'}
                  </button>
                </div>

                {/* Main split: query left, variables/schema right */}
                <div className="flex-1 flex min-h-0">
                  {/* Query editor */}
                  <div className="flex-1 flex flex-col border-r border-border min-w-0">
                    <div className="px-3 py-1.5 border-b border-border bg-background/30">
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted">Query</span>
                    </div>
                    <div className="flex-1">
                      <Editor
                        height="100%"
                        language="graphql"
                        theme={monacoTheme}
                        value={gqlBody.query}
                        onChange={val => updateGql({ query: val || '' })}
                        onMount={registerSendShortcut}
                        options={{ minimap: { enabled: false }, fontSize, automaticLayout: true, padding: { top: 8 }, readOnly: isLocked }}
                      />
                    </div>
                  </div>

                  {/* Variables / Schema tab panel */}
                  <div className="w-[45%] flex flex-col min-w-0">
                    <div className="flex items-center border-b border-border bg-background/30 shrink-0">
                      {(['variables', 'schema'] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => setGqlRightTab(tab)}
                          className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-colors cursor-pointer ${gqlRightTab === tab ? 'text-primary border-b-2 border-primary' : 'text-muted hover:text-text'}`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                    <div className="flex-1 min-h-0">
                      {gqlRightTab === 'variables' ? (
                        <Editor
                          height="100%"
                          language="json"
                          theme={monacoTheme}
                          value={gqlBody.variables}
                          onChange={val => updateGql({ variables: val || '{}' })}
                          onMount={registerSendShortcut}
                          options={{ minimap: { enabled: false }, fontSize, automaticLayout: true, padding: { top: 8 }, readOnly: isLocked }}
                        />
                      ) : (
                        <div className="h-full overflow-auto p-3">
                          {gqlSchema ? (
                            <pre className="text-[10px] font-mono text-muted whitespace-pre-wrap">{gqlSchema}</pre>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center opacity-40 gap-2">
                              <BookOpen size={32} />
                              <span className="text-[10px] font-bold uppercase tracking-widest">No schema loaded</span>
                              <span className="text-[9px] text-muted">Click "Load Schema" to fetch via introspection</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
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
            className={`px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${isHeaderBulk ? 'bg-success text-white shadow-lg shadow-success/20' : 'bg-surface text-muted hover:text-text border border-border'
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
      <div className={`h-full flex flex-col ${activeTab === 'Pre-request' ? 'flex' : 'hidden'}`}>
        <div className="p-2 bg-background/50 border-b border-border flex items-center justify-between shrink-0">
          <span className="text-[9px] text-muted font-black uppercase tracking-[0.2em] flex items-center gap-2">
            <TerminalIcon size={12} className="text-primary" /> Script: Before execution
          </span>
          <span className="text-[9px] text-muted/50 italic">wap.environment.set / wap.request</span>
        </div>
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              defaultLanguage="javascript"
              theme={monacoTheme}
              value={workingRequest.pre_request_script || ''}
              onMount={(editor) => { preEditorRef.current = editor; registerSendShortcut(editor) }}
              onChange={(val) => onUpdate({ pre_request_script: val || '' })}
              options={{
                minimap: { enabled: false },
                fontSize: fontSize,
                scrollBeyondLastLine: false,
                padding: { top: 10 },
                readOnly: isLocked,
                suggestOnTriggerCharacters: true,
                quickSuggestions: true,
              }}
            />
          </div>
          {!isLocked && <ScriptSnippetsPanel mode="pre" onInsert={(code) => insertSnippet(preEditorRef, code)} />}
        </div>
      </div>

      {/* --- TESTS TAB --- */}
      {(() => {
        const extractionRules: ExtractionRule[] = workingRequest.extraction_rules || []
        const schemaAssertions: SchemaAssertion[] = workingRequest.schema_assertions || []
        const addExtractRule = () => {
          const newRule: ExtractionRule = { id: crypto.randomUUID(), variableName: '', jsonPath: '', enabled: true }
          onUpdate({ extraction_rules: [...extractionRules, newRule] })
        }
        const updateExtractRule = (id: string, patch: Partial<ExtractionRule>) => {
          onUpdate({ extraction_rules: extractionRules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })
        }
        const deleteExtractRule = (id: string) => {
          onUpdate({ extraction_rules: extractionRules.filter((r) => r.id !== id) })
        }
        const addSchemaAssertion = () => {
          const newAssertion: SchemaAssertion = { id: crypto.randomUUID(), name: 'Schema Check', schema: '{\n  "type": "object"\n}', enabled: true }
          onUpdate({ schema_assertions: [...schemaAssertions, newAssertion] })
        }
        const updateSchemaAssertion = (id: string, patch: Partial<SchemaAssertion>) => {
          onUpdate({ schema_assertions: schemaAssertions.map((a) => (a.id === id ? { ...a, ...patch } : a)) })
        }
        const deleteSchemaAssertion = (id: string) => {
          onUpdate({ schema_assertions: schemaAssertions.filter((a) => a.id !== id) })
        }
        return (
          <div className={`h-full flex flex-col ${activeTab === 'Tests' ? 'flex' : 'hidden'}`}>
            {/* Sub-tabs */}
            <div className="flex border-b border-border bg-surface/10 shrink-0">
              {([
                { id: 'script', label: 'Script' },
                { id: 'extract', label: `Extract (${extractionRules.filter((r) => r.enabled).length})` },
                { id: 'schema', label: `Schema (${schemaAssertions.filter((a) => a.enabled).length})` }
              ] as { id: 'script' | 'extract' | 'schema'; label: string }[]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTestsSubTab(t.id)}
                  className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wide border-b-2 transition-colors ${testsSubTab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Script sub-tab */}
            {testsSubTab === 'script' && (
              <>
                <div className="p-2 bg-background/50 border-b border-border flex items-center justify-between shrink-0">
                  <span className="text-[9px] text-muted font-black uppercase tracking-[0.2em] flex items-center gap-2">
                    <RefreshCw size={12} className="text-primary" /> Script: After response
                  </span>
                  <span className="text-[9px] text-muted/50 italic">wap.test / wap.response / wap.environment.set</span>
                </div>
                <div className="flex-1 flex overflow-hidden">
                  <div className="flex-1 overflow-hidden">
                    <Editor
                      height="100%"
                      defaultLanguage="javascript"
                      theme={monacoTheme}
                      value={workingRequest.post_request_script || ''}
                      onMount={(editor) => { testsEditorRef.current = editor; registerSendShortcut(editor) }}
                      onChange={(val) => onUpdate({ post_request_script: val || '' })}
                      options={{
                        minimap: { enabled: false },
                        fontSize: fontSize,
                        scrollBeyondLastLine: false,
                        padding: { top: 10 },
                        readOnly: isLocked,
                        suggestOnTriggerCharacters: true,
                        quickSuggestions: true,
                      }}
                    />
                  </div>
                  {!isLocked && <ScriptSnippetsPanel mode="tests" onInsert={(code) => insertSnippet(testsEditorRef, code)} />}
                </div>
              </>
            )}

            {/* Extract sub-tab */}
            {testsSubTab === 'extract' && (
              <div className="flex-1 overflow-auto p-4 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs font-bold text-text">Variable Extraction Rules</p>
                    <p className="text-[10px] text-muted mt-0.5">Extract values from JSON response and save to environment variables automatically after each request.</p>
                  </div>
                  {!isLocked && (
                    <button
                      onClick={addExtractRule}
                      className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded text-[10px] font-bold hover:bg-primary/20 transition-colors"
                    >
                      <Plus size={12} /> Add Rule
                    </button>
                  )}
                </div>
                {extractionRules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted opacity-50">
                    <Zap size={32} className="mb-3 opacity-30" />
                    <p className="text-xs italic">No extraction rules. Add one to auto-extract response values into environment variables.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 px-2 pb-1 border-b border-border">
                      <span className="text-[9px] font-black text-muted uppercase">JSON Path</span>
                      <span className="text-[9px] font-black text-muted uppercase">Variable Name</span>
                      <span className="text-[9px] font-black text-muted uppercase">On</span>
                      <span />
                    </div>
                    {extractionRules.map((rule) => (
                      <div key={rule.id} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center p-2 rounded bg-surface/30 border border-border/50">
                        <input
                          value={rule.jsonPath}
                          disabled={isLocked}
                          onChange={(e) => updateExtractRule(rule.id, { jsonPath: e.target.value })}
                          placeholder="e.g. data.token"
                          className="bg-background border border-border rounded px-2 py-1 text-xs font-mono text-text focus:outline-none focus:border-primary disabled:opacity-50"
                        />
                        <input
                          value={rule.variableName}
                          disabled={isLocked}
                          onChange={(e) => updateExtractRule(rule.id, { variableName: e.target.value })}
                          placeholder="e.g. authToken"
                          className="bg-background border border-border rounded px-2 py-1 text-xs font-mono text-text focus:outline-none focus:border-primary disabled:opacity-50"
                        />
                        <button
                          disabled={isLocked}
                          onClick={() => updateExtractRule(rule.id, { enabled: !rule.enabled })}
                          className={`px-2 py-0.5 rounded text-[9px] font-black uppercase transition-colors ${rule.enabled ? 'bg-primary/20 text-primary' : 'bg-surface text-muted border border-border'} disabled:opacity-50`}
                        >
                          {rule.enabled ? 'ON' : 'OFF'}
                        </button>
                        {!isLocked && (
                          <button onClick={() => deleteExtractRule(rule.id)} className="text-muted hover:text-danger transition-colors">
                            <XCircle size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Schema sub-tab */}
            {testsSubTab === 'schema' && (
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
                  <div>
                    <p className="text-xs font-bold text-text">JSON Schema Assertions</p>
                    <p className="text-[10px] text-muted mt-0.5">Validate response body against JSON Schema. Results appear in "Test Results" tab.</p>
                  </div>
                  {!isLocked && (
                    <button
                      onClick={addSchemaAssertion}
                      className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded text-[10px] font-bold hover:bg-primary/20 transition-colors"
                    >
                      <Plus size={12} /> Add Schema
                    </button>
                  )}
                </div>
                {schemaAssertions.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted opacity-50">
                    <ShieldCheck size={32} className="mb-3 opacity-30" />
                    <p className="text-xs italic">No schema assertions. Add one to validate response structure.</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto p-3 space-y-4">
                    {schemaAssertions.map((assertion) => (
                      <div key={assertion.id} className="border border-border rounded-lg overflow-hidden">
                        <div className="flex items-center gap-2 p-2 bg-surface/30 border-b border-border">
                          <input
                            value={assertion.name}
                            disabled={isLocked}
                            onChange={(e) => updateSchemaAssertion(assertion.id, { name: e.target.value })}
                            className="flex-1 bg-transparent text-xs font-semibold text-text focus:outline-none disabled:opacity-50"
                            placeholder="Assertion name..."
                          />
                          <button
                            disabled={isLocked}
                            onClick={() => updateSchemaAssertion(assertion.id, { enabled: !assertion.enabled })}
                            className={`px-2 py-0.5 rounded text-[9px] font-black uppercase transition-colors ${assertion.enabled ? 'bg-primary/20 text-primary' : 'bg-surface text-muted border border-border'} disabled:opacity-50`}
                          >
                            {assertion.enabled ? 'ON' : 'OFF'}
                          </button>
                          {!isLocked && (
                            <button onClick={() => deleteSchemaAssertion(assertion.id)} className="text-muted hover:text-danger transition-colors">
                              <XCircle size={14} />
                            </button>
                          )}
                        </div>
                        <div style={{ height: '200px' }}>
                          <Editor
                            height="200px"
                            defaultLanguage="json"
                            theme={monacoTheme}
                            value={assertion.schema}
                            onChange={(val) => updateSchemaAssertion(assertion.id, { schema: val || '' })}
                            options={{
                              minimap: { enabled: false },
                              fontSize: fontSize - 1,
                              scrollBeyondLastLine: false,
                              padding: { top: 8, bottom: 8 },
                              readOnly: isLocked,
                              lineNumbers: 'off',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

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
                      className="absolute right-2.5 top-2.5 text-muted hover:text-text transition-colors cursor-pointer"
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
                        className="absolute right-2.5 top-2.5 text-muted hover:text-text transition-colors cursor-pointer"
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const overflowBtnRef = useRef<HTMLButtonElement>(null)
  const overflowDropRef = useRef<HTMLDivElement>(null)
  const [hasOverflow, setHasOverflow] = useState(false)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [overflowPos, setOverflowPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const check = () => setHasOverflow(el.scrollWidth > el.clientWidth)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [tabs])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        overflowDropRef.current && !overflowDropRef.current.contains(e.target as Node) &&
        overflowBtnRef.current && !overflowBtnRef.current.contains(e.target as Node)
      ) setOverflowOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const mod = isMac ? e.metaKey : e.ctrlKey

      if (mod && e.key === 't') {
        e.preventDefault()
        openDraftRequest({})
        return
      }
      if (mod && !e.altKey && e.key === 'w') {
        e.preventDefault()
        const { activeTabId: currentId } = useDataStore.getState()
        if (currentId) closeTab(currentId)
        return
      }
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

  const handleOverflowOpen = () => {
    if (overflowBtnRef.current) {
      const rect = overflowBtnRef.current.getBoundingClientRect()
      setOverflowPos({ top: rect.bottom + 4, left: rect.right - 200 })
    }
    setOverflowOpen((v) => !v)
  }

  const overflowDropdown = overflowOpen ? ReactDOM.createPortal(
    <div
      ref={overflowDropRef}
      style={{ position: 'fixed', top: overflowPos.top, left: overflowPos.left, zIndex: 99999 }}
      className="w-52 bg-surface border border-border rounded-lg shadow-xl py-1 overflow-hidden"
    >
      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted">All Tabs</div>
      {tabs.map((tab) => (
        <button
          key={tab.requestId}
          onClick={() => { setActiveTab(tab.requestId); setOverflowOpen(false) }}
          className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-background transition-colors text-left ${activeTabId === tab.requestId ? 'text-primary' : 'text-text'}`}
        >
          <span className={`text-[9px] font-black shrink-0 w-8 ${METHOD_COLOR[tab.method] ?? 'text-muted'}`}>{tab.method}</span>
          <span className="truncate flex-1">{tab.name}</span>
          {tab.isDirty && <span className="text-primary shrink-0">•</span>}
        </button>
      ))}
    </div>,
    document.body
  ) : null

  return (
    <div className="flex bg-background border-b border-border shrink-0 items-stretch">
      {/* Scrollable tab list */}
      <div ref={scrollRef} className="flex overflow-x-auto no-scrollbar flex-1">
        {tabs.map((tab) => (
          <ContextMenu.Root key={tab.requestId}>
            <ContextMenu.Trigger asChild>
              <div
                onClick={(): void => setActiveTab(tab.requestId)}
                className={`group flex items-center h-10 px-3 border-r border-border cursor-pointer transition-all min-w-[120px] max-w-[200px] relative shrink-0 ${activeTabId === tab.requestId
                  ? 'bg-surface border-t-2 border-t-primary'
                  : 'hover:bg-surface/50'
                  }`}
              >
                <span className={`text-[9px] font-black mr-2 shrink-0 ${METHOD_COLOR[tab.method] ?? 'text-muted'}`}>
                  {tab.method}
                </span>
                <span className={`text-xs truncate flex-1 ${activeTabId === tab.requestId ? 'text-text font-medium' : 'text-muted'}`}>
                  {tab.name}
                  {tab.isDirty && <span className="ml-1 text-primary">•</span>}
                </span>
                <button
                  onClick={(e): void => { e.stopPropagation(); closeTab(tab.requestId) }}
                  className="ml-2 p-0.5 rounded-full hover:bg-border transition-colors opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
                >
                  <X size={10} />
                </button>
              </div>
            </ContextMenu.Trigger>

            <ContextMenu.Portal>
              <ContextMenu.Content className="bg-surface border border-border rounded-lg shadow-2xl p-1 z-[200] min-w-[200px] animate-in fade-in-0 zoom-in-95">
                <ContextMenu.Item className={ctxMenuItemCls} onSelect={() => openDraftRequest({})}>
                  <Plus size={13} className="text-muted" /> New Request <span className={ctxMenuShortcutCls}>⌘T</span>
                </ContextMenu.Item>
                <ContextMenu.Item className={ctxMenuItemCls} onSelect={() => duplicateTab(tab.requestId)}>
                  <Copy size={13} className="text-muted" /> Duplicate Tab
                </ContextMenu.Item>
                <div className={ctxMenuSeparatorCls} />
                <ContextMenu.Item className={ctxMenuItemCls} onSelect={() => closeTab(tab.requestId)}>
                  <X size={13} className="text-muted" /> Close Tab <span className={ctxMenuShortcutCls}>⌘W</span>
                </ContextMenu.Item>
                <ContextMenu.Item className={ctxMenuItemCls} onSelect={() => forceCloseTab(tab.requestId)}>
                  <XCircle size={13} className="text-muted" /> Force Close Tab <span className={ctxMenuShortcutCls}>⌥⌘W</span>
                </ContextMenu.Item>
                <ContextMenu.Item className={ctxMenuItemCls} onSelect={() => closeOtherTabs(tab.requestId)}>
                  <Minus size={13} className="text-muted" /> Close Other Tabs
                </ContextMenu.Item>
                <div className={ctxMenuSeparatorCls} />
                <ContextMenu.Item className={ctxMenuItemCls} onSelect={() => closeAllTabs()}>
                  <X size={13} className="text-muted" /> Close All Tabs
                </ContextMenu.Item>
                <ContextMenu.Item className={`${ctxMenuItemCls} text-rose-400 hover:text-rose-400 hover:bg-rose-500/10`} onSelect={() => forceCloseAllTabs()}>
                  <XCircle size={13} /> Force Close All Tabs
                </ContextMenu.Item>
              </ContextMenu.Content>
            </ContextMenu.Portal>
          </ContextMenu.Root>
        ))}
      </div>

      {/* Overflow indicator */}
      {hasOverflow && (
        <>
          <button
            ref={overflowBtnRef}
            onClick={handleOverflowOpen}
            title="Show all tabs"
            className="px-2 border-r border-border text-muted hover:text-text hover:bg-surface/50 transition-colors shrink-0 flex items-center"
          >
            <ChevronRight size={14} />
          </button>
          {overflowDropdown}
        </>
      )}

      {/* New tab button — only show when there are existing tabs */}
      {tabs.length > 0 && (
        <button
          onClick={() => openDraftRequest({})}
          title="New Request (⌘T)"
          className="px-3 text-muted hover:text-text hover:bg-surface/50 transition-colors shrink-0 flex items-center"
        >
          <Plus size={14} />
        </button>
      )}
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
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false)
  const [builderHeight, setBuilderHeight] = useState(60) // in percentage
  const [isResizing, setIsResizing] = useState(false)
  const mainPanelRef = useRef<HTMLDivElement>(null)

  const activeEnv = environments.find((e) => e.id === activeEnvironmentId) ?? null

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !mainPanelRef.current) return
      const rect = mainPanelRef.current.getBoundingClientRect()
      const relativeY = e.clientY - rect.top
      const totalHeight = rect.height

      const minTopPx = 300 // minimum request builder height (URL bar + protocol + toolbar + tabs + some body space)
      const minBottomPx = 80  // minimum response area height (tab bar ~33px + padding + border buffer)

      const clampedY = Math.min(Math.max(relativeY, minTopPx), totalHeight - minBottomPx)
      const heightPct = (clampedY / totalHeight) * 100
      setBuilderHeight(heightPct)
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
    const handleOpenShortcuts = () => setIsShortcutsModalOpen(true)
    window.addEventListener('wapbolt:trigger-save-modal', handleTriggerSaveModal)
    window.addEventListener('wapbolt:open-shortcuts', handleOpenShortcuts)

    const handleKeyDown = (e: KeyboardEvent): void => {
      // Shift+? — Open keyboard shortcuts modal
      if (e.shiftKey && e.key === '?') {
        const active = document.activeElement
        const isTyping =
          active &&
          (active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            !!active.closest('.monaco-editor') ||
            !!(active as HTMLElement).isContentEditable)
        if (!isTyping) {
          e.preventDefault()
          setIsShortcutsModalOpen(true)
          return
        }
      }

      // Ctrl/Cmd + Enter for Send — skip in WS mode (WebSocketPanel handles its own Cmd+Enter)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        const { tabs, activeTabId } = useDataStore.getState()
        const activeTab = tabs.find((t) => t.requestId === activeTabId)
        if ((activeTab?.workingRequest?.request_type ?? 'http') !== 'http') return
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
      window.removeEventListener('wapbolt:open-shortcuts', handleOpenShortcuts)
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
      <div className="flex-1 bg-background flex flex-col overflow-hidden" ref={mainPanelRef}>
        <RequestTabs />

        {/* Top half: Request Builder */}
        <div
          className={`flex flex-col min-h-0 border-b border-border bg-background relative ${(workingRequest.request_type ?? 'http') !== 'http' ? 'flex-1' : 'shrink-0'}`}
          style={(workingRequest.request_type ?? 'http') === 'http' ? { height: `${builderHeight}%` } : undefined}
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
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-border/30 transition-colors text-xs font-medium text-text cursor-pointer"
                >
                  <Save size={14} className="text-muted" />
                  <span>Save</span>
                </button>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button className="px-2 py-1.5 hover:bg-border/30 transition-colors focus:outline-none cursor-pointer">
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
                  className="px-4 py-1.5 hover:bg-border/30 transition-colors text-xs font-medium text-text cursor-pointer"
                >
                  Share
                </button>
                <button
                  onClick={() => setComingSoon({ isOpen: true, feature: 'Request Sharing' })}
                  className="px-2 py-1.5 hover:bg-border/30 transition-colors cursor-pointer"
                >
                  <LinkIcon size={14} className="text-muted" />
                </button>
              </div>
            </div>
          </div>

          {/* URL Bar Area */}
          <div className="p-4 flex flex-col gap-3">
            {/* Protocol toggle */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-muted uppercase tracking-widest">Protocol</span>
              {(['http', 'ws', 'sse'] as const).map((proto) => {
                const active = (workingRequest.request_type ?? 'http') === proto
                const activeClass =
                  proto === 'ws'
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                    : proto === 'sse'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-primary/20 text-primary border-primary/40'
                const label = proto === 'ws' ? 'WebSocket' : proto === 'sse' ? 'SSE' : 'HTTP'
                return (
                  <button
                    key={proto}
                    onClick={() => {
                      if (proto === 'ws' && workingRequest.url && !workingRequest.url.startsWith('ws')) {
                        const url = workingRequest.url.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://')
                        setWorkingRequest({ request_type: proto, url })
                      } else if (proto === 'sse' && workingRequest.url) {
                        const url = workingRequest.url.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://')
                        setWorkingRequest({ request_type: proto, url })
                      } else if (proto === 'http' && workingRequest.url) {
                        const url = workingRequest.url.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://')
                        setWorkingRequest({ request_type: proto, url })
                      } else {
                        setWorkingRequest({ request_type: proto })
                      }
                    }}
                    className={`px-3 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border transition-colors ${active ? activeClass : 'text-muted border-border hover:text-text'}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            <div className="flex gap-2">
              <div className="flex-1 flex shadow-sm rounded border border-border focus-within:border-primary transition-colors bg-surface overflow-hidden">
                {(workingRequest.request_type ?? 'http') === 'http' && (
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
                )}
                {(workingRequest.request_type === 'ws' || workingRequest.request_type === 'sse') && (
                  <input
                    value={workingRequest.url}
                    onChange={(e) => setWorkingRequest({ url: e.target.value })}
                    placeholder={workingRequest.request_type === 'sse' ? 'https://api.example.com/events' : 'wss://...'}
                    className="flex-1 bg-transparent text-sm text-text px-3 py-2 focus:outline-none font-mono"
                  />
                )}

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

              {(workingRequest.request_type ?? 'http') === 'http' && (
                <div className="flex shadow-sm rounded overflow-hidden">
                  <button
                    onClick={executeActiveRequest}
                    disabled={activeTabRequest.isSending}
                    className="bg-primary hover:bg-primary-hover text-white px-6 py-2 text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer rounded"
                  >
                    {activeTabRequest.isSending ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <span>Send</span>
                    )}
                  </button>
                </div>
              )}
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
                  onClick={() => {
                    const curl = generateCurl({
                      method: workingRequest.method,
                      url: workingRequest.url,
                      headers: workingRequest.headers,
                      body: workingRequest.body,
                      bodyType: workingRequest.body_type
                    })
                    if (!curl) return
                    navigator.clipboard
                      .writeText(curl)
                      .then(() => toast.success('cURL command copied to clipboard'))
                      .catch(() => toast.error('Clipboard access denied'))
                  }}
                  className="px-2 py-1 text-muted hover:text-text rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                  title="Copy as cURL"
                >
                  <Copy size={12} />
                  Copy cURL
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

          {/* WebSocket Panel replaces tabs+editor+response when WS mode is active */}
          {(workingRequest.request_type ?? 'http') === 'ws' && (
            <WebSocketPanel key={`ws-${activeTabRequest.requestId}`} />
          )}

          {/* SSE Panel replaces tabs+editor+response when SSE mode is active */}
          {workingRequest.request_type === 'sse' && (
            <SSEPanel key={`sse-${activeTabRequest.requestId}`} />
          )}

          {/* Tabs Area — HTTP only */}
          {(workingRequest.request_type ?? 'http') === 'http' && (
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
                      (tab === 'Tests' && (workingRequest.post_request_script || (workingRequest.extraction_rules || []).length > 0 || (workingRequest.schema_assertions || []).length > 0)) ||
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
          )}

          {/* Tab Content — HTTP only */}
          {(workingRequest.request_type ?? 'http') === 'http' && (
            <div className="flex-1 overflow-hidden relative">
              <EditorArea
                key={`editor-${activeTabRequest.requestId}`}
                activeTab={activeTab}
                requestId={activeTabRequest.requestId}
                workingRequest={workingRequest}
                isLocked={isLockedByOthers}
                onUpdate={(update): void => setWorkingRequest(update)}
                onSetVar={setSettingVar}
                onSend={executeActiveRequest}
              />
            </div>
          )}
        </div>

        {/* Resizer Bar — HTTP only */}
        {(workingRequest.request_type ?? 'http') === 'http' && (
          <div
            className={`h-1.5 w-full cursor-row-resize hover:bg-primary/40 transition-colors z-20 shrink-0 ${isResizing ? 'bg-primary/60' : 'bg-transparent'}`}
            onMouseDown={() => setIsResizing(true)}
          />
        )}

        {/* Bottom half: Response Area — HTTP only */}
        {(workingRequest.request_type ?? 'http') === 'http' && (
          <div className="flex-1 flex flex-col min-h-0">
            <ResponseArea />
          </div>
        )}
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

      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />
    </div>
  )
}
