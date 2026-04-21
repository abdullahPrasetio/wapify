import React, { useState } from 'react'
import type { Environment } from '../../types'

interface SetVarModalProps {
  varName: string
  initialValue?: string
  activeEnv: Environment | null
  onSave: (key: string, value: string) => void
  onClose: () => void
}

export const SetVarModal: React.FC<SetVarModalProps> = ({ varName, initialValue = '', activeEnv, onSave, onClose }) => {
  const [value, setValue] = useState(initialValue)

  const handleSave = () => {
    if (!value.trim()) return
    onSave(varName, value.trim())
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#1c1c1c] border border-white/10 rounded-xl shadow-2xl p-6 w-[350px] animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-foreground mb-1">Set Variable</h3>
        {activeEnv ? (
          <p className="text-xs text-muted mb-5 leading-relaxed">
            Setting <code className="text-amber-400 font-mono bg-amber-400/10 px-1 rounded">{`{{${varName}}}`}</code> in{' '}
            <span className="text-foreground font-semibold">{activeEnv.name}</span>
          </p>
        ) : (
          <p className="text-xs text-amber-400 mb-5 bg-amber-400/5 p-2 rounded border border-amber-400/20">
            No active environment selected. Please select one to save variables.
          </p>
        )}
        
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 block">
              Variable Value
            </label>
            <input
              autoFocus
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder={`Enter value for ${varName}...`}
              disabled={!activeEnv}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-muted focus:outline-none focus:border-primary/50 transition-all disabled:opacity-50"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-xs font-semibold text-muted border border-white/10 hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!activeEnv || !value.trim()}
              className="flex-1 py-2 rounded-lg text-xs font-bold bg-primary hover:bg-primary-hover text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
            >
              Save Value
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
