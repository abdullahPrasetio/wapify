import { Trash2, CheckSquare, Square, Eye, EyeOff } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { VariableOverlayInput } from './VariableOverlayInput'

interface KeyValueRow {
  id: string
  key: string
  value: string
  description?: string
  enabled: boolean
}

interface KeyValueEditorProps {
  initialData?: Record<string, string | number | boolean> | any[]
  disabled?: boolean
  onChange?: (data: any) => void
  secretKeys?: Set<string>
  onSecretToggle?: (key: string) => void
}

const mapDataToRows = (data: any): KeyValueRow[] => {
  let rows: KeyValueRow[] = []
  if (Array.isArray(data)) {
    rows = data.map((item) => ({
      id: crypto.randomUUID(),
      key: item.key || '',
      value: String(item.value || ''),
      enabled: item.enabled !== undefined ? item.enabled : true,
      description: item.description
    }))
  } else {
    rows = Object.entries(data || {}).map(([key, value]) => ({
      id: crypto.randomUUID(),
      key,
      value: String(value),
      enabled: true
    }))
  }
  // Selalu tambah baris kosong di akhir
  rows.push({ id: crypto.randomUUID(), key: '', value: '', enabled: true })
  return rows
}

export const KeyValueEditor = ({
  initialData = {},
  disabled = false,
  onChange,
  secretKeys,
  onSecretToggle
}: KeyValueEditorProps): React.JSX.Element => {
  const [rows, setRows] = useState<KeyValueRow[]>(() => mapDataToRows(initialData))
  const isInternalChange = useRef(false)
  const prevDataRef = useRef(JSON.stringify(initialData))

  useEffect(() => {
    const currentDataStr = JSON.stringify(initialData)
    if (prevDataRef.current !== currentDataStr) {
      prevDataRef.current = currentDataStr
      if (!isInternalChange.current) {
        setRows(mapDataToRows(initialData))
      }
    }
    isInternalChange.current = false
  }, [initialData])

  const notifyChange = (currentRows: KeyValueRow[]): void => {
    if (!onChange) return

    // SINKRONISASI TOTAL DENGAN LAYAR:
    // Hanya baris yang benar-benar kosong (Key & Value "") yang dibuang dari payload.
    // Selama Key ada (meskipun Value ""), data harus dikirim agar DB terupdate.
    if (Array.isArray(initialData)) {
      const data = currentRows
        .filter((row) => row.key.trim() !== '' || row.value.trim() !== '')
        .map((row) => ({
          key: row.key,
          value: row.value,
          enabled: row.enabled,
          description: row.description,
          type: 'text'
        }))
      onChange(data)
    } else {
      const data: Record<string, string> = {}
      currentRows.forEach((row) => {
        if (row.enabled && row.key.trim() !== '') {
          data[row.key] = row.value
        }
      })
      onChange(data)
    }
  }

  const handleRowChange = (id: string, field: keyof KeyValueRow, value: string | boolean): void => {
    const newRows = rows.map((row) => {
      if (row.id === id) {
        return { ...row, [field]: value }
      }
      return row
    })

    const lastRow = newRows[newRows.length - 1]
    if (lastRow.id === id && (lastRow.key || lastRow.value)) {
      newRows.push({
        id: crypto.randomUUID(),
        key: '',
        value: '',
        enabled: true
      })
    }

    isInternalChange.current = true
    setRows(newRows)
    notifyChange(newRows)
  }

  const removeRow = (id: string): void => {
    if (rows.length <= 1) return
    const newRows = rows.filter((row) => row.id !== id)
    isInternalChange.current = true
    setRows(newRows)
    notifyChange(newRows)
  }

  return (
    <div className="w-full border border-border rounded-md overflow-hidden bg-background">
      <table className="w-full text-xs text-left border-collapse">
        <thead>
          <tr className="bg-surface/50 border-b border-border text-[10px] text-muted uppercase tracking-[0.2em] font-black">
            <th className="w-10 px-3 py-2 border-r border-border text-center"></th>
            <th className="px-4 py-2 border-r border-border">Key</th>
            <th className="px-4 py-2 border-r border-border">Value</th>
            <th className="px-4 py-2 text-center">Description</th>
            <th className="w-10 px-3 py-2 text-center"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const isLastEmpty = index === rows.length - 1 && !row.key && !row.value
            const isSecret = secretKeys && row.key ? secretKeys.has(row.key) : false
            return (
              <tr
                key={row.id}
                className={`border-b border-border group hover:bg-surface/30 transition-colors ${!row.enabled ? 'opacity-50' : ''}`}
              >
                <td className="px-3 py-1 border-r border-border text-center">
                  <button
                    disabled={disabled}
                    onClick={() => handleRowChange(row.id, 'enabled', !row.enabled)}
                    className={`transition-colors ${disabled ? 'text-muted/50 cursor-not-allowed' : isLastEmpty ? 'text-muted/20' : 'text-muted hover:text-primary'}`}
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
                    className={`bg-transparent border-none px-4 py-2.5 ${isLastEmpty ? 'opacity-50' : ''}`}
                  />
                </td>
                <td className="p-0 border-r border-border">
                  {onSecretToggle && isSecret ? (
                    <div className="flex items-center px-3 py-2 h-full font-mono text-sm text-muted select-none">
                      <span className="tracking-widest flex-1">••••••••</span>
                    </div>
                  ) : (
                    <VariableOverlayInput
                      value={row.value}
                      disabled={disabled}
                      onChange={(e) => handleRowChange(row.id, 'value', e.target.value)}
                      placeholder="Value"
                      className={`bg-transparent border-none px-4 py-2.5 ${isLastEmpty ? 'opacity-50' : ''}`}
                    />
                  )}
                </td>
                <td className="p-0">
                  <textarea
                    rows={1}
                    value={row.description || ''}
                    disabled={disabled}
                    onChange={(e) => handleRowChange(row.id, 'description', e.target.value)}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement
                      target.style.height = 'auto'
                      target.style.height = `${target.scrollHeight}px`
                    }}
                    placeholder="Description"
                    className={`w-full bg-transparent px-4 py-2.5 focus:outline-none text-text placeholder:text-muted/30 resize-none overflow-hidden whitespace-pre-wrap break-all ${disabled ? 'cursor-not-allowed' : ''} ${isLastEmpty ? 'opacity-30' : ''}`}
                    style={{ height: 'auto' }}
                  />
                </td>
                <td className="px-3 py-1 text-center">
                  {!isLastEmpty && (
                    <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                      {onSecretToggle && row.key && (
                        <button
                          disabled={disabled}
                          title={isSecret ? 'Unmask value' : 'Mark as secret'}
                          onClick={() => onSecretToggle(row.key)}
                          className={`transition-colors ${disabled ? 'text-muted/20 cursor-not-allowed' : isSecret ? 'text-amber-400 hover:text-amber-300' : 'text-muted hover:text-text'}`}
                        >
                          {isSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      )}
                      <button
                        disabled={disabled}
                        onClick={() => removeRow(row.id)}
                        className={`transition-all ${disabled ? 'text-muted/20 cursor-not-allowed' : 'text-muted hover:text-danger'}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
