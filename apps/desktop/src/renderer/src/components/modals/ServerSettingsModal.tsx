import React, { useState } from 'react'
import { Settings, Globe, X, Check } from 'lucide-react'
import { getBaseUrl, setBaseUrl } from '../../api/client'

interface ServerSettingsModalProps {
  onClose: () => void
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({ onClose }) => {
  const [url, setUrl] = useState(getBaseUrl())

  const handleSave = () => {
    if (!url.trim()) return
    setBaseUrl(url.trim())
    onClose()
    // Optional: window.location.reload() if we want to ensure everything uses new URL
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1c1c1c] border border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
              <Settings size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Server Config</h3>
              <p className="text-xs text-muted">Point Wapify to your backend</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-2 block">
              Backend Server URL
            </label>
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors">
                <Globe size={16} />
              </div>
              <input
                autoFocus
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder="http://localhost:8000"
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-all font-mono"
              />
            </div>
            <p className="mt-2 text-[10px] text-muted leading-relaxed">
              Default is <code className="text-primary/70">http://localhost:8000</code>. If you are using Cloudflare Tunnel or an IP, enter it here.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-xs font-semibold text-muted border border-white/10 hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-3 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
            >
              <Check size={16} />
              Apply & Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
