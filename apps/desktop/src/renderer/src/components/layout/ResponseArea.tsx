import { useDataStore } from '../../store/useDataStore'
import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

// Configure Monaco to use the bundled version (OFFLINE)
loader.config({ monaco })
import { Clock, Database, Globe } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export const ResponseArea = (): React.JSX.Element => {
  const { tabs, activeTabId } = useDataStore()
  const [activeTab, setActiveTab] = useState<'Body' | 'Headers'>('Body')

  const activeTabRequest = tabs.find((t) => t.requestId === activeTabId)

  if (!activeTabRequest) return <></>

  const { lastResponse, isSending } = activeTabRequest

  if (isSending) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium animate-pulse">Sending Request...</p>
      </div>
    )
  }

  if (!lastResponse) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted border-t border-border bg-background/30">
        <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4 border border-border">
          <Globe size={32} className="opacity-20" />
        </div>
        <p className="text-sm italic">Enter a URL and click Send to see the response</p>
      </div>
    )
  }

  const { status, timing, data, headers } = lastResponse
  const statusColor = status >= 200 && status < 300 ? 'text-success' : 'text-danger'

  const formattedData = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data)

  return (
    <div className="flex-1 flex flex-col overflow-hidden border-t border-border bg-background">
      {/* Response Header Info */}
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

      {/* Response Tabs */}
      <div className="flex px-4 border-b border-border bg-surface/10 shrink-0">
        {['Body', 'Headers'].map((tab) => (
          <div
            key={tab}
            onClick={(): void => setActiveTab(tab as 'Body' | 'Headers')}
            className={`px-4 py-2 text-xs font-semibold cursor-pointer border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'Body' && (
          <div className="h-full w-full">
            <Editor
              height="100%"
              defaultLanguage="json"
              theme="vs-dark"
              value={formattedData}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 12,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 10, bottom: 10 }
              }}
            />
          </div>
        )}

        {activeTab === 'Headers' && (
          <div className="p-4 h-full overflow-auto font-mono">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-muted uppercase tracking-wider font-bold border-b border-border">
                  <th className="py-2 w-1/3">Key</th>
                  <th className="py-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(headers).map(([key, values]) => (
                  <tr key={key} className="border-b border-border/50 hover:bg-surface/30">
                    <td className="py-2 text-primary font-medium">{key}</td>
                    <td className="py-2 text-text">{values.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
  const bytes = new TextEncoder().encode(JSON.stringify(data)).length
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(2)} KB`
}
