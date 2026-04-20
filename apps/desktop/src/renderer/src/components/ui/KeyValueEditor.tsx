import { Plus, Trash2, CheckSquare, Square } from 'lucide-react'
import { useState } from 'react'

interface KeyValueRow {
  id: string
  key: string
  value: string
  description?: string
  enabled: boolean
}

interface KeyValueEditorProps {
  initialData?: Record<string, string | number | boolean>
  onChange?: (data: Record<string, string | number | boolean>) => void
}

export const KeyValueEditor = ({
  initialData = {},
  onChange
}: KeyValueEditorProps): React.JSX.Element => {
  // Initialize rows directly from initialData
  const getInitialRows = (): KeyValueRow[] => {
    const data = initialData || {}
    const rows: KeyValueRow[] = Object.entries(data).map(([key, value]) => ({
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      key,
      value: String(value),
      enabled: true
    }))

    // Add one empty row at the end
    rows.push({
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
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
    <div className="w-full border border-border rounded-md overflow-hidden bg-background">
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
                  onClick={() => handleRowChange(row.id, 'enabled', !row.enabled)}
                  className="text-muted hover:text-primary transition-colors"
                >
                  {row.enabled ? <CheckSquare size={14} /> : <Square size={14} />}
                </button>
              </td>
              <td className="p-0 border-r border-border">
                <input
                  type="text"
                  value={row.key}
                  onChange={(e) => handleRowChange(row.id, 'key', e.target.value)}
                  placeholder="Key"
                  className="w-full bg-transparent px-3 py-2 focus:outline-none text-text placeholder:text-muted/50"
                />
              </td>
              <td className="p-0 border-r border-border">
                <input
                  type="text"
                  value={row.value}
                  onChange={(e) => handleRowChange(row.id, 'value', e.target.value)}
                  placeholder="Value"
                  className="w-full bg-transparent px-3 py-2 focus:outline-none text-text placeholder:text-muted/50"
                />
              </td>
              <td className="p-0">
                <input
                  type="text"
                  value={row.description || ''}
                  onChange={(e) => handleRowChange(row.id, 'description', e.target.value)}
                  placeholder="Description"
                  className="w-full bg-transparent px-3 py-2 focus:outline-none text-text placeholder:text-muted/50"
                />
              </td>
              <td className="px-3 py-1 text-center">
                <button
                  onClick={() => removeRow(row.id)}
                  className="text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
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
          onClick={() => {
            const newRows = [
              ...rows,
              { id: crypto.randomUUID(), key: '', value: '', enabled: true }
            ]
            setRows(newRows)
          }}
          className="text-xs text-primary hover:text-primary-hover flex items-center gap-1 font-medium px-2 py-1"
        >
          <Plus size={14} /> Add Row
        </button>
      </div>
    </div>
  )
}
