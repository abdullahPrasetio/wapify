import { Plus, Trash2, CheckSquare, Square } from 'lucide-react'
import { useState } from 'react'
import { VariableOverlayInput } from './VariableOverlayInput'

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
  const [rows, setRows] = useState<KeyValueRow[]>(() => {
    const data = initialData || {}
    const rows: KeyValueRow[] = Object.entries(data).map(([key, value]) => ({
      id: crypto.randomUUID(),
      key,
      value: String(value),
      enabled: true
    }))

    // Add one empty row at the end
    rows.push({
      id: crypto.randomUUID(),
      key: '',
      value: '',
      enabled: true
    })

    return rows
  })

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
                <VariableOverlayInput
                  value={row.key}
                  disabled={disabled}
                  onChange={(e) => handleRowChange(row.id, 'key', e.target.value)}
                  placeholder="Key"
                  className="bg-transparent border-none px-3 py-2"
                />
              </td>
              <td className="p-0 border-r border-border">
                <VariableOverlayInput
                  value={row.value}
                  disabled={disabled}
                  onChange={(e) => handleRowChange(row.id, 'value', e.target.value)}
                  placeholder="Value"
                  className="bg-transparent border-none px-3 py-2"
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
