import { Plus, Trash2, CheckSquare, Square } from 'lucide-react'
import { useState } from 'react'
import { useDataStore } from '../../store/useDataStore'

interface KeyValueRow {
  id: string
  key: string
  value: string
  description?: string
  enabled: boolean
}

interface KeyValueEditorProps {
  initialData?: Record<string, string | number | boolean>
  disabled?: boolean
  onChange?: (data: Record<string, string | number | boolean>) => void
}

export const KeyValueEditor = ({
  initialData = {},
  disabled = false,
  onChange
}: KeyValueEditorProps): React.JSX.Element => {
  const { environments, activeEnvironmentId } = useDataStore()
  const activeEnv = environments.find((e) => e.id === activeEnvironmentId)
  const envVars = activeEnv?.variables || {}

  const [hoverVar, setHoverVar] = useState<{
    name: string
    value: string
    x: number
    y: number
  } | null>(null)

  // Initialize rows directly from initialData
  const getInitialRows = (): KeyValueRow[] => {
    const data = initialData || {}
    const rows: KeyValueRow[] = Object.entries(data).map(([key, value]) => ({
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2),
      key,
      value: String(value),
      enabled: true
    }))

    // Add one empty row at the end
    rows.push({
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2),
      key: '',
      value: '',
      enabled: true
    })

    return rows
  }

  const [rows, setRows] = useState<KeyValueRow[]>(getInitialRows)

  const handleRowChange = (id: string, field: keyof KeyValueRow, value: string | boolean): void => {
    const newRows = rows.map((row) => {
      if (row.id === id) {
        return { ...row, [field]: value }
      }
      return row
    })

    // If the last row was changed, add a new empty row
    const lastRow = newRows[newRows.length - 1]
    if (lastRow.id === id && (lastRow.key || lastRow.value)) {
      newRows.push({
        id: crypto.randomUUID(),
        key: '',
        value: '',
        enabled: true
      })
    }

    setRows(newRows)
    notifyChange(newRows)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLInputElement>, value: string): void => {
    const input = e.currentTarget
    const rect = input.getBoundingClientRect()
    const x = e.clientX - rect.left

    // mono text-sm is typically around 8.4px per char
    const charWidth = 8.4
    const padding = 12
    const pos = Math.floor((x - padding) / charWidth)

    const regex = /\{\{([^}]+)\}\}/g
    let match
    let found = false
    while ((match = regex.exec(value)) !== null) {
      const start = match.index
      const end = start + match[0].length
      if (pos >= start && pos < end) {
        // Precise check
        const varName = match[1].trim()
        const val = envVars[varName]
        if (val !== undefined) {
          setHoverVar({ name: varName, value: String(val), x: e.clientX, y: e.clientY })
          found = true
          break
        }
      }
    }
    if (!found) setHoverVar(null)
  }

  const removeRow = (id: string): void => {
    if (rows.length <= 1) return
    const newRows = rows.filter((row) => row.id !== id)
    setRows(newRows)
    notifyChange(newRows)
  }

  const notifyChange = (currentRows: KeyValueRow[]): void => {
    if (!onChange) return
    const data: Record<string, string | number | boolean> = {}
    currentRows.forEach((row) => {
      if (row.enabled && row.key) {
        data[row.key] = row.value
      }
    })
    onChange(data)
  }

  return (
    <div className="w-full border border-border rounded-md overflow-hidden bg-background relative">
      {/* Tooltip */}
      {hoverVar && (
        <div
          className="fixed z-[100] bg-surface/95 backdrop-blur-md text-text px-3 py-2 rounded-lg shadow-2xl border border-primary/40 text-[11px] pointer-events-none animate-in fade-in zoom-in duration-150 min-w-[160px]"
          style={{
            left: hoverVar.x,
            top: hoverVar.y - 18,
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
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-surface rotate-45 border-r border-b border-primary/40" />
        </div>
      )}

      <table className="w-full text-xs text-left border-collapse">
        <thead>
          <tr className="bg-surface/50 border-b border-border text-muted uppercase tracking-wider font-semibold">
            <th className="w-10 px-3 py-2 border-r border-border text-center"></th>
            <th className="px-3 py-2 border-r border-border">Key</th>
            <th className="px-3 py-2 border-r border-border">Value</th>
            <th className="px-3 py-2">Description</th>
            <th className="w-10 px-3 py-2 text-center"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border group hover:bg-surface/30">
              <td className="px-3 py-1 border-r border-border text-center">
                <button
                  disabled={disabled}
                  onClick={() => handleRowChange(row.id, 'enabled', !row.enabled)}
                  className={`transition-colors ${disabled ? 'text-muted/50 cursor-not-allowed' : 'text-muted hover:text-primary'}`}
                >
                  {row.enabled ? <CheckSquare size={14} /> : <Square size={14} />}
                </button>
              </td>
              <td className="p-0 border-r border-border">
                <input
                  type="text"
                  value={row.key}
                  disabled={disabled}
                  onChange={(e) => handleRowChange(row.id, 'key', e.target.value)}
                  placeholder="Key"
                  className={`w-full bg-transparent px-3 py-2 focus:outline-none text-text placeholder:text-muted/50 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                />
              </td>
              <td className="p-0 border-r border-border">
                <input
                  type="text"
                  value={row.value}
                  disabled={disabled}
                  onChange={(e) => handleRowChange(row.id, 'value', e.target.value)}
                  onMouseMove={(e) => handleMouseMove(e, row.value)}
                  onMouseLeave={() => setHoverVar(null)}
                  placeholder="Value"
                  className={`w-full bg-transparent px-3 py-2 focus:outline-none text-text placeholder:text-muted/50 font-mono ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                />
              </td>
              <td className="p-0">
                <input
                  type="text"
                  value={row.description || ''}
                  disabled={disabled}
                  onChange={(e) => handleRowChange(row.id, 'description', e.target.value)}
                  placeholder="Description"
                  className={`w-full bg-transparent px-3 py-2 focus:outline-none text-text placeholder:text-muted/50 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                />
              </td>
              <td className="px-3 py-1 text-center">
                <button
                  disabled={disabled}
                  onClick={() => removeRow(row.id)}
                  className={`transition-all ${disabled ? 'text-muted/20 cursor-not-allowed' : 'text-muted hover:text-danger opacity-0 group-hover:opacity-100'}`}
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-2 bg-surface/10">
        <button
          disabled={disabled}
          onClick={() => {
            const newRows = [
              ...rows,
              { id: crypto.randomUUID(), key: '', value: '', enabled: true }
            ]
            setRows(newRows)
          }}
          className={`text-xs flex items-center gap-1 font-medium px-2 py-1 ${disabled ? 'text-muted/50 cursor-not-allowed' : 'text-primary hover:text-primary-hover'}`}
        >
          <Plus size={14} /> Add Row
        </button>
      </div>
    </div>
  )
}
