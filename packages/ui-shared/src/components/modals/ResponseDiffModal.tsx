import React, { useState } from 'react'
import { X, GitCompare, Trash2 } from 'lucide-react'
import { DiffEditor, loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { useAppStore } from '../../store/useAppStore'
import type { ResponseSnapshot } from '../../store/useDataStore'

loader.config({ monaco })

interface ResponseDiffModalProps {
  isOpen: boolean
  onClose: () => void
  snapshots: ResponseSnapshot[]
  currentResponse?: { status: number; timing: number; data: unknown; headers: Record<string, string[]> } | null
  onDeleteSnapshot: (id: string) => void
}

const formatData = (data: unknown): string => {
  if (data === null || data === undefined) return ''
  if (typeof data === 'object') return JSON.stringify(data, null, 2)
  return String(data)
}

const formatTs = (ts: number): string =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export const ResponseDiffModal = ({
  isOpen,
  onClose,
  snapshots,
  currentResponse,
  onDeleteSnapshot
}: ResponseDiffModalProps): React.JSX.Element | null => {
  const { theme } = useAppStore()
  const monacoTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs')
    : (theme === 'dark' ? 'vs-dark' : 'vs')

  const allOptions = [
    ...(currentResponse
      ? [{ id: '__current__', label: `Current — ${currentResponse.status}`, data: currentResponse.data, status: currentResponse.status, timing: currentResponse.timing }]
      : []),
    ...snapshots.map((s) => ({ id: s.id, label: `${s.label} @ ${formatTs(s.timestamp)}`, data: s.data, status: s.status, timing: s.timing }))
  ]

  const [leftId, setLeftId] = useState<string>(allOptions[0]?.id ?? '')
  const [rightId, setRightId] = useState<string>(allOptions[1]?.id ?? '')

  if (!isOpen) return null

  const left = allOptions.find((o) => o.id === leftId)
  const right = allOptions.find((o) => o.id === rightId)

  const leftText = formatData(left?.data)
  const rightText = formatData(right?.data)

  const statusColor = (s: number) => (s >= 200 && s < 300 ? 'text-success' : 'text-danger')

  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface border border-border rounded-xl w-full max-w-5xl h-[85vh] shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-white/5 shrink-0">
          <h2 className="text-base font-bold flex items-center gap-2">
            <GitCompare size={16} className="text-primary" />
            Response Compare
          </h2>
          <button onClick={onClose} className="text-muted hover:text-text transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Selectors */}
        <div className="grid grid-cols-2 gap-4 px-4 py-3 border-b border-border shrink-0">
          {[{ id: leftId, setId: setLeftId, label: 'Left' }, { id: rightId, setId: setRightId, label: 'Right' }].map(({ id, setId, label }) => {
            const selected = allOptions.find((o) => o.id === id)
            return (
              <div key={label} className="flex items-center gap-2">
                <span className="text-[10px] font-black text-muted uppercase w-8">{label}</span>
                <select
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-primary cursor-pointer"
                >
                  {allOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
                {selected && (
                  <span className={`text-xs font-bold ${statusColor(selected.status)}`}>
                    {selected.status}
                  </span>
                )}
                {selected && selected.id !== '__current__' && (
                  <button
                    onClick={() => { onDeleteSnapshot(selected.id); if (id === leftId) setLeftId(allOptions[0]?.id ?? ''); else setRightId(allOptions[0]?.id ?? '') }}
                    className="text-muted hover:text-danger transition-colors"
                    title="Delete snapshot"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Diff Editor */}
        <div className="flex-1 overflow-hidden">
          {left && right ? (
            <DiffEditor
              height="100%"
              language="json"
              theme={monacoTheme}
              original={leftText}
              modified={rightText}
              options={{
                readOnly: true,
                renderSideBySide: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 12,
                lineNumbers: 'on',
                wordWrap: 'on'
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted text-sm">
              Select two responses to compare
            </div>
          )}
        </div>

        {/* Stats bar */}
        {left && right && (
          <div className="px-4 py-2 border-t border-border shrink-0 flex items-center gap-6 text-xs text-muted">
            <span><span className="font-bold text-text">{left.label}</span> — {left.timing} ms</span>
            <span className="text-border">|</span>
            <span><span className="font-bold text-text">{right.label}</span> — {right.timing} ms</span>
          </div>
        )}
      </div>
    </div>
  )
}
