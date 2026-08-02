import React, { useState, useRef, useEffect } from 'react'
import { Check } from 'lucide-react'
import { useDataStore } from '../../store/useDataStore'
import { toast } from 'sonner'

interface VariableOverlayInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onUpdateValue?: (value: string) => void
  multiline?: boolean
  // When set, the highlight/autocomplete also resolves against this
  // collection's variables (not just the active Environment) — matches the
  // precedence `replaceVariables` already uses at execution time: Environment
  // wins on key conflict.
  collectionId?: number
}

export const VariableOverlayInput: React.FC<VariableOverlayInputProps> = ({
  value,
  onChange,
  className,
  onUpdateValue,
  multiline = true,
  collectionId,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [activeVar, setActiveVar] = useState<string | null>(null)
  const [newValue, setNewValue] = useState('')
  const [autocomplete, setAutocomplete] = useState<{
    prefix: string
    replaceStart: number
    replaceEnd: number
    selectedIndex: number
  } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { environments, activeEnvironmentId, updateEnvironment, collections } = useDataStore()
  const activeEnv = environments.find((e) => e.id === activeEnvironmentId) ?? null
  const envVars = activeEnv?.variables ?? {}
  const collectionVars = collections.find((c) => c.id === collectionId)?.variables ?? {}
  // Read-only merge for highlight/autocomplete — same precedence as
  // `replaceVariables` at execution time (Environment overrides Collection).
  const allVars = { ...collectionVars, ...envVars }

  const text = String(value || '')

  // Auto-adjust height for textarea when focused
  useEffect(() => {
    if (multiline && textareaRef.current) {
      if (isFocused) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
      } else {
        textareaRef.current.style.height = '40px'
      }
    }
  }, [value, multiline, isFocused])

  // Close popup on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setAutocomplete(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Detect {{ autocomplete context from cursor position
  const detectAutocomplete = (inputValue: string, cursorPos: number) => {
    const before = inputValue.slice(0, cursorPos)
    const lastOpen = before.lastIndexOf('{{')
    if (lastOpen === -1) return null

    const between = before.slice(lastOpen + 2)
    if (between.includes('}}') || between.includes('\n')) return null

    return {
      prefix: between,
      replaceStart: lastOpen,
      replaceEnd: cursorPos,
      selectedIndex: 0
    }
  }

  const getFilteredVars = (prefix: string) =>
    Object.keys(allVars).filter((k) =>
      k.toLowerCase().startsWith(prefix.toLowerCase())
    )

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (onChange) onChange(e as React.ChangeEvent<HTMLTextAreaElement>)

    const cursor = e.target.selectionStart ?? e.target.value.length
    const ctx = detectAutocomplete(e.target.value, cursor)
    if (ctx && getFilteredVars(ctx.prefix).length > 0) {
      setAutocomplete(ctx)
    } else {
      setAutocomplete(null)
    }
  }

  const applyAutocomplete = (varName: string) => {
    if (!autocomplete) return
    const currentText = String(value || '')
    const newText =
      currentText.slice(0, autocomplete.replaceStart) +
      `{{${varName}}}` +
      currentText.slice(autocomplete.replaceEnd)

    const fakeEvent = {
      target: { value: newText }
    } as React.ChangeEvent<HTMLTextAreaElement>
    if (onChange) onChange(fakeEvent)
    setAutocomplete(null)

    // Restore focus
    setTimeout(() => {
      const el = (multiline ? textareaRef.current : inputRef.current) as HTMLElement | null
      el?.focus()
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (autocomplete) {
      const vars = getFilteredVars(autocomplete.prefix)
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setAutocomplete((prev) =>
          prev ? { ...prev, selectedIndex: Math.min(prev.selectedIndex + 1, vars.length - 1) } : prev
        )
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setAutocomplete((prev) =>
          prev ? { ...prev, selectedIndex: Math.max(prev.selectedIndex - 1, 0) } : prev
        )
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (vars.length > 0) {
          e.preventDefault()
          applyAutocomplete(vars[autocomplete.selectedIndex] ?? vars[0])
          return
        }
      }
      if (e.key === 'Escape') {
        setAutocomplete(null)
        return
      }
    }
    if (props.onKeyDown) props.onKeyDown(e as any)
  }

  const handleVarClick = (varName: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setActiveVar(varName)
    const existingValue = envVars[varName] || envVars[varName.toLowerCase()] || allVars[varName] || allVars[varName.toLowerCase()] || ''
    setNewValue(String(existingValue))
    setIsOpen(true)
  }

  const handleSaveVar = async () => {
    if (!activeVar || !activeEnv || !newValue.trim()) return
    const newVars = { ...activeEnv.variables, [activeVar]: newValue.trim() }
    await updateEnvironment(activeEnv.id, activeEnv.name, newVars)
    toast.success(`Variable "${activeVar}" set successfully`)
    setIsOpen(false)
  }

  // Render text with highlights
  const { res: renderedHighlights, parts: interactionParts } = (() => {
    const regex = /\{\{([^}]+)\}\}/g
    const res: React.ReactNode[] = []
    const parts: React.ReactNode[] = []
    let lastIdx = 0
    let match
    let idx = 0

    while ((match = regex.exec(text)) !== null) {
      const plainText = text.substring(lastIdx, match.index)
      res.push(<span key={`t-${idx}`}>{plainText}</span>)

      const varName = match[1].trim()
      const isSet = allVars[varName] !== undefined || allVars[varName.toLowerCase()] !== undefined

      res.push(
        <span
          key={`v-${idx}`}
          className={`px-0.5 rounded border-b ${
            isSet
              ? 'text-emerald-400 border-emerald-500/50 bg-emerald-500/5'
              : 'text-amber-400 border-amber-500/50 bg-amber-500/5'
          }`}
        >
          {`{{${varName}}}`}
        </span>
      )

      parts.push(<span key={`it-${idx}`} className="text-transparent">{plainText}</span>)
      parts.push(
        <span
          key={`iv-${idx}`}
          onMouseDown={(e) => {
            e.stopPropagation()
            handleVarClick(varName, e)
          }}
          className="pointer-events-auto cursor-pointer text-transparent"
        >
          {`{{${varName}}}`}
        </span>
      )

      lastIdx = regex.lastIndex
      idx++
    }

    const finalPlainText = text.substring(lastIdx)
    res.push(<span key="last-t">{finalPlainText}</span>)
    parts.push(<span key="last-it" className="text-transparent">{finalPlainText}</span>)

    return { res, parts }
  })()

  const handleFocus = (e: React.FocusEvent<any>) => {
    setIsFocused(true)
    if (props.onFocus) props.onFocus(e)
  }

  const handleBlur = (e: React.FocusEvent<any>) => {
    setIsFocused(false)
    if (props.onBlur) props.onBlur(e)
  }

  const sharedStyles: React.CSSProperties = {
    padding: '10px 12px',
    lineHeight: '1.5',
    fontSize: '0.875rem',
    fontFamily: 'Menlo, Monaco, Consolas, monospace',
    boxSizing: 'border-box'
  }

  const filteredVars = autocomplete ? getFilteredVars(autocomplete.prefix) : []

  return (
    <div ref={containerRef} className={`relative w-full group flex ${multiline && isFocused ? 'items-start' : 'items-center'} h-full transition-all duration-200`}>
      {/* 1. Backdrop Overlay (Visual) */}
      <div
        className={`absolute inset-0 text-sm font-mono pointer-events-none ${multiline && isFocused ? 'whitespace-pre-wrap break-all' : 'whitespace-nowrap overflow-hidden text-ellipsis'} flex ${multiline && isFocused ? 'items-start' : 'items-center'} ${className || ''}`}
        aria-hidden="true"
        style={sharedStyles}
      >
        <div className={`w-full text-text/90 ${!isFocused ? 'truncate' : ''}`}>
          {renderedHighlights}
        </div>
      </div>

      {/* 2. Real Input/Textarea */}
      {multiline ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange as any}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown as any}
          rows={1}
          className={`w-full bg-transparent text-sm font-mono text-transparent caret-primary focus:outline-none transition-all z-10 resize-none ${isFocused ? 'whitespace-pre-wrap break-all' : 'whitespace-nowrap overflow-hidden'} ${className || ''}`}
          style={sharedStyles}
          {...(props as any)}
        />
      ) : (
        <input
          ref={inputRef}
          value={value}
          onChange={handleChange as any}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown as any}
          className={`w-full bg-transparent text-sm font-mono text-transparent caret-primary focus:outline-none transition-colors z-10 ${className || ''}`}
          style={sharedStyles}
          {...(props as any)}
        />
      )}

      {/* 3. Click Layer */}
      <div
        className={`absolute inset-0 text-sm font-mono pointer-events-none ${multiline && isFocused ? 'whitespace-pre-wrap break-all' : 'whitespace-nowrap overflow-hidden'} flex ${multiline && isFocused ? 'items-start' : 'items-center'} z-20 ${className || ''}`}
        style={sharedStyles}
      >
        <div className={`w-full ${!isFocused ? 'truncate' : ''}`}>
          {interactionParts}
        </div>
      </div>

      {/* Autocomplete Dropdown */}
      {autocomplete && filteredVars.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-1001 w-56 rounded-lg bg-surface border border-border shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="px-2 py-1 border-b border-border text-[9px] text-muted uppercase tracking-widest font-bold">
            {collectionId !== undefined ? 'Environment + Collection Variables' : 'Environment Variables'}
          </div>
          {filteredVars.slice(0, 8).map((varName, i) => (
            <button
              key={varName}
              onMouseDown={(e) => {
                e.preventDefault()
                applyAutocomplete(varName)
              }}
              className={`w-full text-left px-3 py-1.5 text-xs font-mono flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                i === autocomplete.selectedIndex
                  ? 'bg-primary/20 text-primary'
                  : 'text-text hover:bg-surface/80'
              }`}
            >
              <span className="font-semibold">{`{{${varName}}}`}</span>
              <span className="text-[10px] text-muted truncate max-w-20">
                {String(allVars[varName] || '').slice(0, 20) || '—'}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Variable Set Popup */}
      {isOpen && activeVar && (
        <div className="fixed z-1000 w-64 rounded-xl bg-surface border border-border/50 shadow-2xl p-4 backdrop-blur-xl animate-in fade-in zoom-in duration-100"
          style={{
            left: containerRef.current?.getBoundingClientRect().left,
            top: (containerRef.current?.getBoundingClientRect().top || 0) - 130
          }}
        >
          <div className="absolute -bottom-1.5 left-4 w-3 h-3 bg-surface border-r border-b border-border/50 rotate-45" />

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                allVars[activeVar] !== undefined ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
              }`}>
                {`{{${activeVar}}}`}
              </span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-muted hover:text-text cursor-pointer">
              <X size={14} />
            </button>
          </div>

          {!activeEnv ? (
            <p className="text-[10px] text-amber-400 bg-amber-400/5 p-2 rounded border border-amber-400/20">
              {collectionVars[activeVar] !== undefined
                ? `Currently resolved from the collection ("${collectionVars[activeVar]}"). Select or create an environment to override it here.`
                : 'No active environment. Please select or create an environment first.'}
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-muted mb-1.5">
                  {envVars[activeVar] ? 'Update value in' : 'Set value in'} <span className="text-text font-medium">{activeEnv.name}</span>:
                </p>
                <input
                  autoFocus
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveVar()}
                  placeholder={
                    envVars[activeVar] ||
                    (collectionVars[activeVar] ? `(collection) ${collectionVars[activeVar]}` : 'Enter value...')
                  }
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-text focus:outline-none focus:border-primary/40"
                />
              </div>
              <button
                onClick={handleSaveVar}
                disabled={!newValue.trim()}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary hover:bg-primary-hover text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-primary/20"
              >
                <Check size={12} />
                Save Variable
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


const X = ({ size, className }: { size: number, className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>
)
