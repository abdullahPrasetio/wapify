import { Trash2, CheckSquare, Square, Eye, EyeOff, Paperclip, Type } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { VariableOverlayInput } from './VariableOverlayInput'

interface KeyValueRow {
  id: string
  key: string
  value: string
  description?: string
  enabled: boolean
  type?: 'text' | 'file'
}

interface KeyValueEditorProps {
  initialData?: Record<string, string | number | boolean> | any[]
  disabled?: boolean
  onChange?: (data: any) => void
  secretKeys?: Set<string>
  onSecretToggle?: (key: string) => void
  allowFileType?: boolean
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const mapDataToRows = (data: any): KeyValueRow[] => {
  let rows: KeyValueRow[] = []
  if (Array.isArray(data)) {
    rows = data.map((item) => ({
      id: crypto.randomUUID(),
      key: item.key || '',
      value: String(item.value || ''),
      enabled: item.enabled !== undefined ? item.enabled : true,
      description: item.description,
      type: item.type === 'file' ? 'file' : 'text'
    }))
  } else {
    rows = Object.entries(data || {}).map(([key, value]) => ({
      id: crypto.randomUUID(),
      key,
      value: String(value),
      enabled: true,
      type: 'text' as const
    }))
  }
  rows.push({ id: crypto.randomUUID(), key: '', value: '', enabled: true, type: 'text' })
  return rows
}

export const KeyValueEditor = ({
  initialData = {},
  disabled = false,
  onChange,
  secretKeys,
  onSecretToggle,
  allowFileType = false
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

    if (Array.isArray(initialData) || allowFileType) {
      const data = currentRows
        .filter((row) => row.key.trim() !== '' || row.value.trim() !== '')
        .map((row) => ({
          key: row.key,
          value: row.value,
          enabled: row.enabled,
          description: row.description,
          type: row.type || 'text'
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
      newRows.push({ id: crypto.randomUUID(), key: '', value: '', enabled: true, type: 'text' })
    }

    isInternalChange.current = true
    setRows(newRows)
    notifyChange(newRows)
  }

  const toggleRowType = (id: string): void => {
    const newRows = rows.map((row) => {
      if (row.id === id) {
        return { ...row, type: row.type === 'file' ? ('text' as const) : ('file' as const), value: '' }
      }
      return row
    })
    isInternalChange.current = true
    setRows(newRows)
    notifyChange(newRows)
  }

  const handleFilePick = async (id: string): Promise<void> => {
    let result: { path: string; name: string; size: number } | null = null
    try {
      result = await window.api.openFileDialog()
    } catch {
      return
    }
    if (!result) return
    const newRows = rows.map((row) => {
      if (row.id === id) return { ...row, value: result.path, description: `${result.name} (${formatFileSize(result.size)})` }
      return row
    })
    // If last row was the file row, add empty row
    const lastRow = newRows[newRows.length - 1]
    if (lastRow.id === id && lastRow.key) {
      newRows.push({ id: crypto.randomUUID(), key: '', value: '', enabled: true, type: 'text' })
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
            {allowFileType && <th className="w-16 px-2 py-2 border-r border-border text-center">Type</th>}
            <th className="px-4 py-2 border-r border-border">Value</th>
            <th className="px-4 py-2 text-center">Description</th>
            <th className="w-10 px-3 py-2 text-center"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const isLastEmpty = index === rows.length - 1 && !row.key && !row.value
            const isSecret = secretKeys && row.key ? secretKeys.has(row.key) : false
            const isFile = allowFileType && row.type === 'file'
            const fileName = isFile && row.value ? row.value.split('/').pop() ?? row.value : null
            return (
              <tr
                key={row.id}
                className={`border-b border-border group hover:bg-surface/30 transition-colors ${!row.enabled ? 'opacity-50' : ''}`}
              >
                {/* Enable toggle */}
                <td className="px-3 py-1 border-r border-border text-center">
                  <button
                    disabled={disabled}
                    onClick={() => handleRowChange(row.id, 'enabled', !row.enabled)}
                    className={`transition-colors ${disabled ? 'text-muted/50 cursor-not-allowed' : isLastEmpty ? 'text-muted/20 cursor-pointer' : 'text-muted hover:text-primary cursor-pointer'}`}
                  >
                    {row.enabled ? <CheckSquare size={14} /> : <Square size={14} />}
                  </button>
                </td>

                {/* Key */}
                <td className="p-0 border-r border-border">
                  <VariableOverlayInput
                    value={row.key}
                    disabled={disabled}
                    onChange={(e) => handleRowChange(row.id, 'key', e.target.value)}
                    placeholder="Key"
                    className={`bg-transparent border-none px-4 py-2.5 ${isLastEmpty ? 'opacity-50' : ''}`}
                  />
                </td>

                {/* Type toggle */}
                {allowFileType && (
                  <td className="px-2 py-1 border-r border-border text-center">
                    {!isLastEmpty && (
                      <button
                        disabled={disabled}
                        onClick={() => toggleRowType(row.id)}
                        title={isFile ? 'Switch to text' : 'Switch to file'}
                        className={`flex items-center justify-center w-full transition-colors ${disabled ? 'cursor-not-allowed opacity-40' : isFile ? 'text-primary cursor-pointer' : 'text-muted hover:text-text cursor-pointer'}`}
                      >
                        {isFile ? <Paperclip size={13} /> : <Type size={13} />}
                      </button>
                    )}
                  </td>
                )}

                {/* Value / File picker */}
                <td className="p-0 border-r border-border">
                  {isFile ? (
                    <div className="flex items-center gap-2 px-3 py-1.5">
                      <button
                        disabled={disabled}
                        onClick={() => handleFilePick(row.id)}
                        className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border transition-colors ${disabled ? 'opacity-40 cursor-not-allowed border-border text-muted' : 'border-border hover:border-primary hover:text-primary text-muted cursor-pointer'}`}
                      >
                        <Paperclip size={11} />
                        {fileName ? 'Change' : 'Choose File'}
                      </button>
                      {fileName && (
                        <span className="text-[11px] text-text truncate max-w-35" title={row.value}>
                          {fileName}
                        </span>
                      )}
                    </div>
                  ) : isSecret && onSecretToggle ? (
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

                {/* Description */}
                <td className="p-0">
                  <textarea
                    rows={1}
                    value={row.description || ''}
                    disabled={disabled || isFile}
                    onChange={(e) => handleRowChange(row.id, 'description', e.target.value)}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement
                      target.style.height = 'auto'
                      target.style.height = `${target.scrollHeight}px`
                    }}
                    placeholder={isFile ? 'auto' : 'Description'}
                    className={`w-full bg-transparent px-4 py-2.5 focus:outline-none text-text placeholder:text-muted/30 resize-none overflow-hidden whitespace-pre-wrap break-all ${(disabled || isFile) ? 'cursor-not-allowed' : ''} ${isLastEmpty ? 'opacity-30' : ''}`}
                    style={{ height: 'auto' }}
                  />
                </td>

                {/* Actions */}
                <td className="px-3 py-1 text-center">
                  {!isLastEmpty && (
                    <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                      {onSecretToggle && row.key && !isFile && (
                        <button
                          disabled={disabled}
                          title={isSecret ? 'Unmask value' : 'Mark as secret'}
                          onClick={() => onSecretToggle(row.key)}
                          className={`transition-colors ${disabled ? 'text-muted/20 cursor-not-allowed' : isSecret ? 'text-amber-400 hover:text-amber-300 cursor-pointer' : 'text-muted hover:text-text cursor-pointer'}`}
                        >
                          {isSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      )}
                      <button
                        disabled={disabled}
                        onClick={() => removeRow(row.id)}
                        className={`transition-all ${disabled ? 'text-muted/20 cursor-not-allowed' : 'text-muted hover:text-danger cursor-pointer'}`}
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
