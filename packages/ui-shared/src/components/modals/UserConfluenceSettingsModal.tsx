import React, { useState, useEffect } from 'react'
import { X, Check, Cloud, Globe, Key, AlertCircle, Loader2, Shield, Mail, Lock } from 'lucide-react'
import { apiClient } from '../../api/client'

interface UserConfluenceSettingsModalProps {
  onClose: () => void
}

export const UserConfluenceSettingsModal: React.FC<UserConfluenceSettingsModalProps> = ({ onClose }) => {
  const [config, setConfig] = useState({
    base_url: '',
    confluence_email: '',
    confluence_pat: '',
    confluence_api_token: '',
    space_key: '',
    auth_method: 'cloud'
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authMethod, setAuthMethod] = useState<'pat' | 'cloud'>('cloud')

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const response = await apiClient.get('/api/v1/confluence/user-config')
      if (response.status === 200 && response.data) {
        const data = response.data as any
        setConfig({
          base_url: data.base_url || '',
          confluence_email: data.confluence_email || '',
          confluence_pat: data.confluence_pat || '',
          confluence_api_token: data.confluence_api_token || '',
          space_key: data.space_key || '',
          auth_method: data.auth_method || 'cloud'
        })
        setAuthMethod(data.auth_method || 'cloud')
      }
    } catch (err: any) {
      setError('Failed to fetch your Confluence configuration')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    // Validation
    if (!config.base_url) {
      setError('Base URL is required')
      return
    }

    if (authMethod === 'pat') {
      if (!config.confluence_pat) {
        setError('Personal Access Token is required for Server/DC method')
        return
      }
    } else {
      if (!config.confluence_email || !config.confluence_api_token) {
        setError('Email and API Token are required for Cloud method')
        return
      }
    }

    setIsSaving(true)
    setError(null)
    try {
      const payload = { ...config, auth_method: authMethod }
      await apiClient.put('/api/v1/confluence/user-config', payload)
      onClose()
    } catch (err: any) {
      setError('Failed to save your Confluence configuration')
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
          <p className="text-sm text-muted">Loading your settings...</p>
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
              <h3 className="text-lg font-bold text-text">Confluence Settings</h3>
              <p className="text-xs text-muted">Your personal sync credentials</p>
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

        <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar">
          {/* Base URL */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] block">
              Confluence Base URL
            </label>
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary">
                <Globe size={16} />
              </div>
              <input
                type="text"
                value={config.base_url}
                onChange={(e) => handleChange('base_url', e.target.value)}
                placeholder="https://your-domain.atlassian.net"
                className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text focus:outline-none focus:border-primary/50 transition-all"
              />
            </div>
            <p className="text-[9px] text-muted">Example: https://org.atlassian.net (without /wiki)</p>
          </div>

          <div className="h-px bg-border/50 my-4" />

          {/* Auth Method Switcher */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] block">
              Authentication Method
            </label>
            <div className="flex bg-background border border-border rounded-xl p-1">
              <button
                onClick={() => {
                  setAuthMethod('cloud')
                  setError(null)
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${authMethod === 'cloud' ? 'bg-blue-500/10 text-blue-500' : 'text-muted hover:text-text'}`}
              >
                <Cloud size={14} /> Cloud
              </button>
              <button
                onClick={() => {
                  setAuthMethod('pat')
                  setError(null)
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${authMethod === 'pat' ? 'bg-primary/10 text-primary' : 'text-muted hover:text-text'}`}
              >
                <Lock size={14} /> Server / DC
              </button>
            </div>
          </div>

          <div className="h-px bg-border/50 my-4" />

          {authMethod === 'pat' ? (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] block">
                  Personal Access Token (PAT)
                </label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary">
                    <Key size={16} />
                  </div>
                  <input
                    type="password"
                    value={config.confluence_pat}
                    onChange={(e) => handleChange('confluence_pat', e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>
                <p className="text-[9px] text-muted">Uses Bearer authentication for Server / Data Center.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] block">
                  Confluence Email
                </label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary">
                    <Mail size={16} />
                  </div>
                  <input
                    type="email"
                    value={config.confluence_email}
                    onChange={(e) => handleChange('confluence_email', e.target.value)}
                    placeholder="your-email@org.com"
                    className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] block">
                  API Token
                </label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary">
                    <Key size={16} />
                  </div>
                  <input
                    type="password"
                    value={config.confluence_api_token}
                    onChange={(e) => handleChange('confluence_api_token', e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>
                <p className="text-[9px] text-muted">Create an API token in your Atlassian account security settings.</p>
              </div>
            </div>
          )}

          <div className="h-px bg-border/50 my-4" />

          {/* Space Key */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] block">
              Default Space Key
            </label>
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary">
                <Shield size={16} />
              </div>
              <input
                type="text"
                value={config.space_key}
                onChange={(e) => handleChange('space_key', e.target.value)}
                placeholder="DEV"
                className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text focus:outline-none focus:border-primary/50 transition-all font-mono uppercase"
              />
            </div>
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
