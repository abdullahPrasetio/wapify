import { useDataStore } from '../../store/useDataStore'
import { useAppStore } from '../../store/useAppStore'
import { X, Clock, Database, Globe, ArrowLeft } from 'lucide-react'
import Editor from '@monaco-editor/react'
import { useState } from 'react'

export const HistoryDetailView = (): React.JSX.Element => {
  const { history } = useDataStore()
  const { activeHistoryId, setActiveHistoryId } = useAppStore()
  const [activeTab, setActiveTab] = useState<'Request' | 'Response'>('Response')
  const [subTab, setSubTab] = useState<'Body' | 'Headers'>('Body')

  const item = history.find((h) => h.id === activeHistoryId)

  if (!item) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted">
        <p>History item not found</p>
        <button 
          onClick={() => setActiveHistoryId(null)}
          className="mt-4 text-primary text-sm flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Back to Request Builder
        </button>
      </div>
    )
  }

  const statusColor = item.status_code >= 200 && item.status_code < 300 ? 'text-success' : 'text-danger'

  return (
    <div className="flex-1 bg-background flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="h-14 border-b border-border flex items-center justify-between px-6 bg-surface/30 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setActiveHistoryId(null)}
            className="p-1.5 rounded-full hover:bg-surface transition-colors text-muted hover:text-text"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-surface border border-border text-primary uppercase">
                {item.method}
              </span>
              <span className="text-sm font-mono text-text truncate max-w-md">{item.url}</span>
            </div>
            <span className="text-[10px] text-muted">Executed on {new Date(item.created_at).toLocaleString()}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-black ${statusColor}`}>{item.status_code}</span>
            <span className="text-[10px] text-muted font-bold uppercase">{item.response_time}ms</span>
          </div>
          <button 
            onClick={() => setActiveHistoryId(null)}
            className="p-1 text-muted hover:text-text transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex px-6 border-b border-border bg-surface/10 shrink-0">
        {['Response', 'Request'].map((tab) => (
          <div
            key={tab}
            onClick={() => {
                setActiveTab(tab as any)
                setSubTab('Body')
            }}
            className={`px-4 py-3 text-xs font-bold cursor-pointer border-b-2 transition-colors ${
              activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'
            }`}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* Sub Tabs (Body / Headers) */}
      <div className="flex px-6 py-2 gap-2 bg-surface/5 shrink-0">
        {['Body', 'Headers'].map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab as any)}
            className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all ${
              subTab === tab ? 'bg-primary text-white' : 'bg-surface text-muted hover:text-text border border-border'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'Response' && subTab === 'Body' && (
          <Editor
            height="100%"
            defaultLanguage="json"
            theme="vs-dark"
            value={item.response_body || ''}
            options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, padding: { top: 16 } }}
          />
        )}
        {activeTab === 'Request' && subTab === 'Body' && (
          <Editor
            height="100%"
            defaultLanguage="json"
            theme="vs-dark"
            value={item.request_body || ''}
            options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, padding: { top: 16 } }}
          />
        )}
        {subTab === 'Headers' && (
          <div className="p-6 h-full overflow-auto font-mono">
             <table className="w-full text-xs text-left">
                <thead>
                    <tr className="text-muted uppercase tracking-wider font-bold border-b border-border">
                        <th className="py-2 w-1/3">Key</th>
                        <th className="py-2">Value</th>
                    </tr>
                </thead>
                <tbody>
                    {Object.entries((activeTab === 'Request' ? item.request_headers : item.response_headers) || {}).map(([key, value]) => (
                        <tr key={key} className="border-b border-border/50">
                            <td className="py-2 text-primary font-medium">{key}</td>
                            <td className="py-2 text-text">{Array.isArray(value) ? value.join(', ') : String(value)}</td>
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
