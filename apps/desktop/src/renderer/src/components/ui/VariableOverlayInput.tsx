import React, { useState, useRef, useEffect } from 'react'
import { Check, AlertCircle, PlusCircle } from 'lucide-react'
import { useDataStore } from '../../store/useDataStore'
import { toast } from 'sonner'

interface VariableOverlayInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onUpdateValue?: (value: string) => void
}

export const VariableOverlayInput: React.FC<VariableOverlayInputProps> = ({
  value,
  onChange,
  className,
  onUpdateValue,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [activeVar, setActiveVar] = useState<string | null>(null)
  const [newValue, setNewValue] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const { environments, activeEnvironmentId, updateEnvironment } = useDataStore()
  const activeEnv = environments.find((e) => e.id === activeEnvironmentId) ?? null
  const envVars = activeEnv?.variables ?? {}

  const text = String(value || '')

  // Close popup on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleVarClick = (varName: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setActiveVar(varName)
    // Pre-fill with existing value if it exists
    const existingValue = envVars[varName] || envVars[varName.toLowerCase()] || ''
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
      // Normal text before variable
      res.push(<span key={`t-${idx}`}>{text.substring(lastIdx, match.index)}</span>)
      
      const varName = match[1].trim()
      const isSet = envVars[varName] !== undefined || envVars[varName.toLowerCase()] !== undefined

      // Variable part (Visual)
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

      // Variable part (Interaction - for Layer 3)
      parts.push(<span key={`it-${idx}`}>{text.substring(lastIdx, match.index)}</span>)
      parts.push(
        <span
          key={`iv-${idx}`}
          onMouseDown={(e) => {
            e.stopPropagation()
            handleVarClick(varName, e)
          }}
          className="pointer-events-auto cursor-pointer"
          style={{ color: 'transparent' }}
        >
          {`{{${varName}}}`}
        </span>
      )

      lastIdx = regex.lastIndex
      idx++
    }

    // Normal text after last variable
    res.push(<span key="last-t">{text.substring(lastIdx)}</span>)
    parts.push(<span key="last-it" style={{ color: 'transparent' }}>{text.substring(lastIdx)}</span>)
    
    return { res, parts }
  })()

  return (
    <div ref={containerRef} className="relative w-full group flex items-center h-full">
      {/* 1. Backdrop Overlay (Visible) */}
      <div 
        className={`absolute inset-0 px-3 py-2.5 text-sm font-mono pointer-events-none whitespace-pre overflow-hidden flex items-center ${className || ''}`}
        aria-hidden="true"
        style={{ border: '1px solid transparent' }}
      >
        <div className="w-full text-text/90">
          {renderedHighlights}
        </div>
      </div>

      {/* 2. Real Input (Interaction Layer - Text is transparent) */}
      <input
        ref={inputRef}
        value={value}
        onChange={onChange}
        className={`w-full bg-transparent border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono text-transparent caret-white focus:outline-none focus:border-primary/50 transition-colors z-10 ${className || ''}`}
        {...props}
      />

      {/* 3. Click Layer (Only for variables) */}
      <div 
        className={`absolute inset-0 px-3 py-2.5 text-sm font-mono pointer-events-none whitespace-pre overflow-hidden flex items-center z-20 ${className || ''}`}
        style={{ border: '1px solid transparent' }}
      >
        <div className="w-full">
          {interactionParts}
        </div>
      </div>

      {/* Popup remains the same... */}

      {/* Popup */}
      {isOpen && activeVar && (
        <div className="fixed z-[1000] w-64 rounded-xl bg-[#0d1117] border border-white/10 shadow-2xl p-4 backdrop-blur-xl animate-in fade-in zoom-in duration-100"
          style={{ 
            left: containerRef.current?.getBoundingClientRect().left,
            top: (containerRef.current?.getBoundingClientRect().top || 0) - 130
          }}
        >
          <div className="absolute -bottom-1.5 left-4 w-3 h-3 bg-[#0d1117] border-r border-b border-white/10 rotate-45" />
          
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                envVars[activeVar] ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
              }`}>
                {`{{${activeVar}}}`}
              </span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-muted hover:text-foreground">
              <X size={14} />
            </button>
          </div>

          {!activeEnv ? (
            <p className="text-[10px] text-amber-400 bg-amber-400/5 p-2 rounded border border-amber-400/20">
              No active environment. Please select or create an environment first.
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-muted mb-1.5">
                  {envVars[activeVar] ? 'Update value in' : 'Set value in'} <span className="text-foreground font-medium">{activeEnv.name}</span>:
                </p>
                <input
                  autoFocus
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveVar()}
                  placeholder={envVars[activeVar] || "Enter value..."}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/40"
                />
              </div>
              <button
                onClick={handleSaveVar}
                disabled={!newValue.trim()}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary/80 hover:bg-primary text-white transition-all disabled:opacity-40"
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
