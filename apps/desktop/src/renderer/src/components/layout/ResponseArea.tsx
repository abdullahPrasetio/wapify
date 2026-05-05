import { useDataStore, LogEntry } from '../../store/useDataStore'
import { useAppStore } from '../../store/useAppStore'
import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

// Configure Monaco to use the bundled version (OFFLINE)
loader.config({ monaco })
import { Clock, Database, Globe, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PromptModal } from '../modals/PromptModal'

export const ResponseArea = (): React.JSX.Element => {
  const { tabs, activeTabId, logs, clearLogs, saveExample } = useDataStore()
  const { fontSize } = useAppStore()
  const [activeTab, setActiveTab] = useState<'Body' | 'Headers' | 'Tests' | 'Console'>('Body')
  const [isPromptOpen, setIsPromptOpen] = useState(false)

  const activeTabRequest = tabs.find((t) => t.requestId === activeTabId)

  if (!activeTabRequest) return <></>

  const { lastResponse, isSending, testResults } = activeTabRequest

  // Filter logs for this request only
  const filteredLogs = logs.filter((l) => l.requestId === activeTabId)

  if (isSending) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted bg-background/50">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium animate-pulse">Sending Request...</p>
      </div>
    )
  }

  const { status, timing, data, headers } = lastResponse || {
    status: 0,
    timing: 0,
    data: null,
    headers: {}
  }

  // Detect content type
  const getHeader = (key: string): string => {
    const val = headers[key] || headers[key.toLowerCase()]
    if (Array.isArray(val)) return val[0] || ''
    return ''
  }
  const contentType = getHeader('Content-Type')
  const isPdf = contentType.includes('application/pdf')

  const statusColor = status >= 200 && status < 300 ? 'text-success' : 'text-danger'

  const formattedData = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data)

  const TABS = ['Body', 'Headers', 'Test Results', 'Console']

  const handleSaveExample = (name: string) => {
    if (typeof activeTabId === 'number') {
      saveExample(activeTabId, name)
    } else {
      toast.error('Cannot save example from a draft request')
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden border-t border-border bg-background">
      <PromptModal
        isOpen={isPromptOpen}
        onClose={() => setIsPromptOpen(false)}
        onSubmit={handleSaveExample}
        title="Save Example"
        description="Enter a name for this example response."
        defaultValue={`Success - ${status} ${getStatusText(status)}`}
        submitText="Save"
      />
      {/* Response Header Info */}
      {lastResponse && (
        <div className="h-10 px-4 border-b border-border flex items-center justify-between bg-surface/30 shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-muted uppercase">Status:</span>
              <span className={`text-xs font-black ${statusColor}`}>
                {status} {getStatusText(status)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={12} className="text-muted" />
              <span className="text-[10px] font-bold text-muted uppercase">Time:</span>
              <span className="text-xs font-semibold text-text">{timing} ms</span>
            </div>
            <div className="flex items-center gap-2">
              <Database size={12} className="text-muted" />
              <span className="text-[10px] font-bold text-muted uppercase">Size:</span>
              <span className="text-xs font-semibold text-text">{calculateSize(data)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPromptOpen(true)}
              disabled={typeof activeTabId === 'string' && activeTabId.startsWith('draft-')}
              className="text-[10px] font-bold text-primary hover:text-primary-hover transition-colors px-2 py-1 bg-primary/10 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save as Example
            </button>
            <button
              onClick={(): void => {
                navigator.clipboard.writeText(formattedData)
                toast.success('Response copied to clipboard')
              }}
              className="text-[10px] font-bold text-primary hover:text-primary-hover transition-colors px-2 py-1 bg-primary/10 rounded"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Response Tabs */}
      <div className="flex px-4 border-b border-border bg-surface/10 shrink-0">
        {TABS.map((tab) => (
          <div
            key={tab}
            onClick={(): void => {
              if (tab === 'Body') setActiveTab('Body')
              else if (tab === 'Headers') setActiveTab('Headers')
              else if (tab === 'Test Results') setActiveTab('Tests')
              else setActiveTab('Console')
            }}
            className={`px-4 py-2 text-xs font-semibold cursor-pointer border-b-2 transition-colors relative ${
              (activeTab === 'Body' && tab === 'Body') ||
              (activeTab === 'Headers' && tab === 'Headers') ||
              (activeTab === 'Tests' && tab === 'Test Results') ||
              (activeTab === 'Console' && tab === 'Console')
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            {tab}
            {tab === 'Test Results' && testResults && testResults.length > 0 && (
              <span className="ml-2 px-1 rounded-sm bg-surface text-[9px] border border-border">
                {testResults.filter((r) => r.status === 'passed').length}/{testResults.length}
              </span>
            )}
            {tab === 'Console' && filteredLogs.length > 0 && (
              <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
            )}
          </div>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {!lastResponse && activeTab !== 'Console' ? (
          <div className="flex-1 h-full flex flex-col items-center justify-center text-muted bg-background/30">
            <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4 border border-border">
              <Globe size={32} className="opacity-20" />
            </div>
            <p className="text-sm italic">Select a request and click &quot;Send&quot; to see the response here.</p>
          </div>
        ) : (
          <>
            {activeTab === 'Body' && (
              <div className="h-full w-full bg-[#1e1e1e]">
                {isPdf ? (
                   <iframe
                     src={`data:application/pdf;base64,${data}`}
                     className="w-full h-full border-none"
                     title="PDF Preview"
                   />
                ) : (
                  <Editor
                    height="100%"
                    defaultLanguage="json"
                    theme="vs-dark"
                    value={formattedData}
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      fontSize: fontSize,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      padding: { top: 10, bottom: 10 }
                    }}
                  />
                )}
              </div>
            )}

            {activeTab === 'Headers' && (
              <div className="p-4 h-full overflow-auto font-mono">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-muted uppercase tracking-wider font-bold border-b border-border">
                      <th className="py-2 w-48 shrink-0 pr-4">Key</th>
                      <th className="py-2">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(headers).map(([key, values]) => {
                      // Pretty format key: content-type -> Content-Type
                      const prettyKey = key.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('-')
                      const displayKey = key.trim() === '' ? 'Set-Cookie' : prettyKey // Fallback for empty keys (often seen with multiple Set-Cookie)

                      return (
                        <tr key={key} className="border-b border-border/50 hover:bg-surface/30 group">
                          <td className="py-2 text-primary font-bold pr-4 break-all align-top">{displayKey}:</td>
                          <td className="py-2 text-text break-all align-top">
                            {Array.isArray(values) ? values.join(', ') : values}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'Tests' && (
              <div className="p-4 h-full overflow-auto space-y-2">
                {testResults && testResults.length > 0 ? (
                  testResults.map((res, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-md bg-surface/30 border border-border"
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${res.status === 'passed' ? 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-danger shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}
                      />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-text">{res.name}</p>
                        {res.error && (
                          <p className="text-[10px] text-danger mt-1 font-mono italic">
                            {res.error}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest ${res.status === 'passed' ? 'text-success' : 'text-danger'}`}
                      >
                        {res.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted opacity-50 italic py-20">
                    <p className="text-xs">
                      No test results to display. Add tests in the "Tests" tab.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'Console' && (
              <div className="h-full flex flex-col overflow-hidden bg-[#0d0d0d]">
                <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between bg-white/5">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-widest">
                    Console Output
                  </span>
                  <button
                    onClick={clearLogs}
                    className="text-[10px] font-bold text-muted hover:text-text transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-2 font-mono text-[11px] space-y-1">
                  {filteredLogs.length > 0 ? (
                    filteredLogs.map((log) => (
                      <LogItem key={log.id} log={log} />
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-muted opacity-30 italic py-20">
                      <p className="text-xs">Console is empty</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const LogItem = ({ log }: { log: LogEntry }): React.JSX.Element => {
  const [isOpen, setIsOpen] = useState(false)

  if (log.level === 'network' && log.details) {
    const { request, response } = log.details
    return (
      <div className="border-l-2 border-primary/30 hover:bg-white/5 transition-all">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-2 py-1.5 cursor-pointer group"
        >
          {isOpen ? <ChevronDown size={12} className="text-muted" /> : <ChevronRight size={12} className="text-muted" />}
          <span className="text-muted shrink-0 w-16 opacity-50 text-[10px]">{log.timestamp}</span>
          <span className="text-success font-black text-[10px] uppercase w-10 shrink-0">{request.method}</span>
          <span className="text-text/90 truncate flex-1 font-sans">{request.url}</span>
          <div className="flex items-center gap-3 shrink-0 ml-2">
            <span className={`text-[10px] font-black ${response.status < 300 ? 'text-success' : 'text-danger'}`}>
              {response.status}
            </span>
            <span className="text-[10px] text-muted font-bold">{response.timing}ms</span>
          </div>
        </div>
        {isOpen && (
          <div className="pl-8 pr-4 pb-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Request Headers */}
            <div>
              <div className="text-[9px] font-black text-muted uppercase tracking-[0.2em] mb-1.5 flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-primary" /> Request Headers
              </div>
              <div className="bg-black/30 rounded-lg p-3 text-[10px] space-y-1 border border-white/5">
                {Object.entries(request.headers || {}).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-primary font-bold w-40 shrink-0 opacity-80">{k}:</span>
                    <span className="text-text/70 break-all">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Request Body */}
            {request.body && (
              <div>
                <div className="text-[9px] font-black text-muted uppercase tracking-[0.2em] mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-primary" /> Request Body
                  </div>
                  <span className="text-[8px] opacity-50 font-mono">Format: {request.body_type || 'raw'}</span>
                </div>
                <pre className="bg-black/30 rounded-lg p-3 text-[10px] text-text/70 whitespace-pre-wrap break-all border border-white/5 max-h-60 overflow-auto font-mono">
                  {(() => {
                    if ((request.body_type === 'x-www-form-urlencoded' || request.body_type === 'form-data') && Array.isArray(request.body)) {
                      const params = new URLSearchParams()
                      request.body.forEach((item: any) => {
                        if (item.enabled && item.key) params.append(item.key, item.value || '')
                      })
                      return params.toString()
                    }
                    return typeof request.body === 'string' ? request.body : JSON.stringify(request.body, null, 2)
                  })()}
                </pre>
              </div>
            )}

            {/* Response Headers */}
            <div>
              <div className="text-[9px] font-black text-muted uppercase tracking-[0.2em] mb-1.5 flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-success" /> Response Headers
              </div>
              <div className="bg-black/30 rounded-lg p-3 text-[10px] space-y-1 border border-white/5">
                {Object.entries(response.headers || {}).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-success font-bold w-40 shrink-0 opacity-80">{k}:</span>
                    <span className="text-text/70 break-all">{Array.isArray(v) ? v.join(', ') : String(v)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Response Body */}
            <div>
              <div className="text-[9px] font-black text-muted uppercase tracking-[0.2em] mb-1.5 flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-success" /> Response Body
              </div>
              <pre className="bg-black/30 rounded-lg p-3 text-[10px] text-text/70 whitespace-pre-wrap break-all border border-white/5 max-h-80 overflow-auto">
                {typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : String(response.data)}
              </pre>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`flex gap-3 px-2 py-1.5 rounded hover:bg-white/5 border-l-2 ${
        log.level === 'error'
          ? 'border-danger bg-danger/5'
          : log.level === 'warn'
            ? 'border-warning bg-warning/5'
            : log.level === 'info'
              ? 'border-info bg-info/5'
              : 'border-transparent'
      } transition-all group`}
    >
      <span className="text-muted shrink-0 w-16 opacity-50 text-[10px]">{log.timestamp}</span>
      <span
        className={`shrink-0 w-12 font-black uppercase text-[9px] ${
          log.level === 'error'
            ? 'text-danger'
            : log.level === 'warn'
              ? 'text-warning'
              : log.level === 'info'
                ? 'text-info'
                : 'text-muted'
        }`}
      >
        {log.level}
      </span>
      <span className="text-text/90 break-all whitespace-pre-wrap">{log.message}</span>
    </div>
  )
}

function getStatusText(status: number): string {
  const texts: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error'
  }
  return texts[status] ?? ''
}

function calculateSize(data: unknown): string {
  if (!data) return '0 B'
  let bytes = 0
  if (typeof data === 'string') {
    bytes = data.length 
  } else {
    bytes = new TextEncoder().encode(JSON.stringify(data)).length
  }
  
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
