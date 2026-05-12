import React, { useState, useEffect } from 'react'
import { X, Check, Cloud, Shield, AlertCircle, Loader2 } from 'lucide-react'
import { apiClient } from '../../api/client'

interface ConfluenceSettingsModalProps {
  onClose: () => void
}

export const ConfluenceSettingsModal: React.FC<ConfluenceSettingsModalProps> = ({ onClose }) => {
  const [config, setConfig] = useState({
    confluence_enabled: 'false'
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const response = await apiClient.get('/api/v1/admin/confluence/config')
      if (response.status === 200) {
        setConfig({ confluence_enabled: (response.data as any).confluence_enabled || 'false' })
      }
    } catch (err: any) {
      setError('Failed to fetch Confluence configuration')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    try {
      await apiClient.put('/api/v1/admin/confluence/config', config)
      onClose()
    } catch (err: any) {
      setError('Failed to save Confluence configuration')
    } finally {
      setIsSaving(false)
    }
  }

  const handleChange = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-surface border border-border rounded-2xl p-8 flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-primary" size={32} />
          <p className="text-sm text-muted">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl p-6 w-full max-w-md animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-500">
              <Cloud size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text">Confluence Settings (Global)</h3>
              <p className="text-xs text-muted">Admin: Enable or disable feature</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-text transition-colors">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-500">
            <AlertCircle size={16} />
            <span className="text-xs font-medium">{error}</span>
          </div>
        )}

        <div className="space-y-6">
          {/* Toggle Enabled */}
          <div className="flex items-center justify-between p-5 bg-background border border-border rounded-2xl">
            <div className="flex items-center gap-4">
              <Shield size={24} className={config.confluence_enabled === 'true' ? 'text-green-500' : 'text-muted'} />
              <div>
                <p className="text-sm font-bold text-text">Feature Integration</p>
                <p className="text-xs text-muted">Allow users to sync to Confluence</p>
              </div>
            </div>
            <button
              onClick={() => handleChange('confluence_enabled', config.confluence_enabled === 'true' ? 'false' : 'true')}
              className={`w-14 h-7 rounded-full transition-all relative ${config.confluence_enabled === 'true' ? 'bg-primary' : 'bg-muted/30'}`}
            >
              <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-md ${config.confluence_enabled === 'true' ? 'right-1' : 'left-1'}`} />
            </button>
          </div>

          <div className="flex gap-3 pt-4 border-t border-border/50">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-xs font-semibold text-muted border border-border hover:bg-background transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 py-3 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover disabled:bg-muted text-white transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Check size={16} />
              )}
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
