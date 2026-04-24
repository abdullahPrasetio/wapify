import React from 'react'
import { X, Rocket } from 'lucide-react'

interface ComingSoonModalProps {
  isOpen: boolean
  onClose: () => void
  featureName: string
}

export const ComingSoonModal = ({ isOpen, onClose, featureName }: ComingSoonModalProps): React.JSX.Element | null => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-border flex items-center justify-between bg-white/5">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Rocket size={18} className="text-primary" /> Coming Soon
          </h2>
          <button onClick={onClose} className="text-muted hover:text-text transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-8 flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Rocket size={32} className="text-primary animate-bounce" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-text">Feature in Development</h3>
            <p className="text-sm text-muted">
              The <span className="text-primary font-bold">{featureName}</span> feature is currently under development and will be available in a future update.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full mt-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-bold transition-all shadow-lg shadow-primary/20"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  )
}
