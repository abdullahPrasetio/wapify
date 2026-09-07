import React, { useState } from 'react'
import { Settings, Globe, X, Check, Type, Sun, Moon, Monitor } from 'lucide-react'
import { getBaseUrl, setBaseUrl } from '../../api/client'
import { useAppStore } from '../../store/useAppStore'
import { toast } from 'sonner'

interface ServerSettingsModalProps {
  onClose: () => void
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({ onClose }) => {
  const [url, setUrl] = useState(getBaseUrl())
  const { fontSize, setFontSize, theme, setTheme } = useAppStore()

  const handleSave = () => {
    setBaseUrl(url)
    toast.success(url.trim() ? 'Server URL updated' : 'Server URL reset to default')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
              <Settings size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text">App Settings</h3>
              <p className="text-xs text-muted">Configure your workspace</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-text transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Appearance Settings */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] block">
              Appearance
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => setTheme('light')}
                className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${theme === 'light' ? 'bg-primary/10 border-primary' : 'bg-background border-border hover:border-muted'}`}
              >
                <Sun size={16} className={theme === 'light' ? 'text-primary' : 'text-muted'} />
                <span className={`text-[9px] font-bold uppercase ${theme === 'light' ? 'text-primary' : 'text-muted'}`}>Light</span>
              </button>

              <button 
                onClick={() => setTheme('dark')}
                className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${theme === 'dark' ? 'bg-primary/10 border-primary' : 'bg-background border-border hover:border-muted'}`}
              >
                <Moon size={16} className={theme === 'dark' ? 'text-primary' : 'text-muted'} />
                <span className={`text-[9px] font-bold uppercase ${theme === 'dark' ? 'text-primary' : 'text-muted'}`}>Dark</span>
              </button>

              <button 
                onClick={() => setTheme('system')}
                className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${theme === 'system' ? 'bg-primary/10 border-primary' : 'bg-background border-border hover:border-muted'}`}
              >
                <Monitor size={16} className={theme === 'system' ? 'text-primary' : 'text-muted'} />
                <span className={`text-[9px] font-bold uppercase ${theme === 'system' ? 'text-primary' : 'text-muted'}`}>System</span>
              </button>
            </div>
          </div>

          {/* Server URL Settings */}
          <div className="space-y-3 pt-2 border-t border-border/50">
            <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] block">
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
                className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-text focus:outline-none focus:border-primary/50 transition-all font-mono"
              />
            </div>
          </div>

          {/* Font Size Settings */}
          <div className="space-y-3 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-2">
                <Type size={12} className="text-primary" /> Editor Font Size
              </label>
              <span className="text-xs font-bold text-primary">{fontSize}px</span>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setFontSize(Math.max(10, fontSize - 1))}
                className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center text-muted hover:text-text hover:border-primary transition-all"
              >
                -
              </button>
              <input 
                type="range"
                min="10"
                max="24"
                step="1"
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value))}
                className="flex-1 accent-primary h-1.5 bg-border rounded-lg appearance-none cursor-pointer"
              />
              <button 
                onClick={() => setFontSize(Math.min(24, fontSize + 1))}
                className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center text-muted hover:text-text hover:border-primary transition-all"
              >
                +
              </button>
            </div>

            <div className="p-2 bg-background border border-border/50 rounded-lg font-mono text-muted text-center" style={{ fontSize: `${fontSize}px` }}>
              Preview Text
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-xs font-semibold text-muted border border-border hover:bg-background transition-all"
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
