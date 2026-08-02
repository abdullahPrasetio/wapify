import React, { useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import { Save, BookOpen, Shield, Eye, EyeOff, Terminal as TerminalIcon, Braces, Play, Download, Folder, Hash, User } from 'lucide-react'
import { useDataStore, type CollectionTab } from '../../store/useDataStore'
import { useAppStore } from '../../store/useAppStore'
import { useAuthStore } from '../../store/useAuthStore'
import { KeyValueEditor } from '../ui/KeyValueEditor'
import { VariableOverlayInput } from '../ui/VariableOverlayInput'
import { CollectionRunnerPanel } from './CollectionRunnerPanel'
import type { AuthConfig } from '../../types'

const SETTINGS_TABS = ['Overview', 'Authorization', 'Scripts', 'Variables'] as const
type SettingsTab = (typeof SETTINGS_TABS)[number]

interface CollectionTabContentProps {
  tab: CollectionTab
}

const countRequests = (
  collectionId: number,
  requestsByCollection: Record<number, { id: number }[]>,
  requestsByFolder: Record<number, { id: number }[]>,
  foldersByCollection: Record<number, { id: number; parent_folder_id: number | null }[]>
): number => {
  let count = (requestsByCollection[collectionId] || []).length
  const folders = foldersByCollection[collectionId] || []
  const walk = (parentFolderId: number | null): void => {
    folders.filter((f) => f.parent_folder_id === parentFolderId).forEach((f) => {
      count += (requestsByFolder[f.id] || []).length
      walk(f.id)
    })
  }
  walk(null)
  return count
}

export const CollectionTabContent: React.FC<CollectionTabContentProps> = ({ tab }) => {
  const {
    collections,
    requestsByCollection,
    requestsByFolder,
    foldersByCollection,
    fetchCollectionContents,
    setCollectionTabDraft,
    saveCollectionTab,
    exportCollection,
    confluenceEnabled
  } = useDataStore()
  const { fontSize, theme } = useAppStore()
  const { user } = useAuthStore()
  const monacoTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs')
    : (theme === 'dark' ? 'vs-dark' : 'vs')

  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('Overview')
  const [showPassword, setShowPassword] = useState(false)
  const [showRunner, setShowRunner] = useState(false)

  const collection = collections.find((c) => c.id === tab.collectionId)

  useEffect(() => {
    fetchCollectionContents(tab.collectionId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.collectionId])

  useEffect(() => {
    const handleSave = (): void => { saveCollectionTab(tab.collectionId) }
    window.addEventListener('wapbolt:save-collection-tab', handleSave)
    return () => window.removeEventListener('wapbolt:save-collection-tab', handleSave)
  }, [tab.collectionId, saveCollectionTab])

  const data = tab.draft
  const update = (partial: Partial<typeof data>): void => setCollectionTabDraft(tab.collectionId, partial)

  const auth = data.auth_config
  const handleAuthChange = (partial: Partial<AuthConfig>): void => {
    update({ auth_config: { ...auth, ...partial } as AuthConfig })
  }

  const requestCount = countRequests(tab.collectionId, requestsByCollection, requestsByFolder, foldersByCollection)
  const isOwner = collection && user && collection.created_by === user.id

  return (
    <div className="flex-1 bg-background flex flex-col overflow-hidden min-w-0">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary shrink-0">
            <Folder size={16} />
          </div>
          <span className="text-base font-bold text-text truncate">{data.name || tab.name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowRunner(true)}
            className="px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface rounded-lg transition-all flex items-center gap-1.5"
          >
            <Play size={13} /> Run
          </button>
          <button
            onClick={() => exportCollection(tab.collectionId)}
            className="px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface rounded-lg transition-all flex items-center gap-1.5"
          >
            <Download size={13} /> Export
          </button>
          <button
            onClick={() => saveCollectionTab(tab.collectionId)}
            disabled={!tab.isDirty || !data.name.trim()}
            className="px-4 py-1.5 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
          >
            <Save size={13} /> Save
          </button>
        </div>
      </div>

      {/* Info row */}
      <div className="px-6 py-2 border-b border-border/50 flex items-center gap-4 text-[11px] text-muted shrink-0">
        <span className="flex items-center gap-1"><Hash size={11} /> {requestCount} request{requestCount !== 1 ? 's' : ''}</span>
        {collection && (
          <>
            <span className="flex items-center gap-1"><User size={11} /> Created by: {isOwner ? 'You' : 'Team member'}</span>
            <span>Created {new Date(collection.created_at).toLocaleDateString()}</span>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex px-6 border-b border-border bg-surface/10 shrink-0">
        {SETTINGS_TABS.map((t) => (
          <div
            key={t}
            onClick={() => setActiveSettingsTab(t)}
            className={`px-3 py-2.5 text-xs font-medium cursor-pointer border-b-2 transition-colors ${activeSettingsTab === t ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'}`}
          >
            {t}
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-6">
        {/* --- Overview --- */}
        <div className={`max-w-xl space-y-5 ${activeSettingsTab === 'Overview' ? 'block' : 'hidden'}`}>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] block">
              Collection Name
            </label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="My Awesome API"
              className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-text focus:outline-none focus:border-primary transition-colors"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] block">
              Description
            </label>
            <textarea
              value={data.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="Describe what this collection is about..."
              className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-text focus:outline-none focus:border-primary transition-colors h-24 resize-none"
            />
          </div>

          {confluenceEnabled && (
            <div className="space-y-2 pt-4 border-t border-border/50">
              <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-2">
                <BookOpen size={12} className="text-blue-500" /> Confluence Page ID
              </label>
              <input
                type="text"
                value={data.confluence_page_id}
                onChange={(e) => update({ confluence_page_id: e.target.value })}
                placeholder="123456789"
                className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-text focus:outline-none focus:border-primary transition-colors font-mono"
              />
              <p className="text-[9px] text-muted italic">Required if you want to sync documentation to Confluence.</p>
            </div>
          )}
        </div>

        {/* --- Authorization --- */}
        <div className={`h-full ${activeSettingsTab === 'Authorization' ? 'flex' : 'hidden'}`}>
          <div className="flex gap-6 h-full w-full">
            <div className="w-40 shrink-0 flex flex-col gap-1 border-r border-border pr-4">
              <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 px-2">
                Type
              </label>
              {['No Auth', 'Bearer Token', 'Basic Auth', 'API Key'].map((type) => (
                <div
                  key={type}
                  onClick={() => handleAuthChange({ type })}
                  className={`px-3 py-2 rounded text-xs font-medium cursor-pointer transition-colors ${auth.type === type ? 'bg-primary/20 text-primary' : 'text-text hover:bg-surface'}`}
                >
                  {type}
                </div>
              ))}
            </div>

            <div className="flex-1 max-w-xl">
              {(!auth.type || auth.type === 'No Auth') && (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-50 py-10">
                  <Shield size={40} className="text-muted mb-4" />
                  <p className="text-sm text-muted">
                    Requests in this collection can inherit this authorization.
                  </p>
                </div>
              )}

              {auth.type === 'Bearer Token' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-muted mb-1.5 block">Token</label>
                    <div className="relative bg-surface border border-border rounded h-9 pl-3 pr-8">
                      <VariableOverlayInput
                        multiline={false}
                        masked
                        revealed={showPassword}
                        value={auth.token || ''}
                        onChange={(e) => handleAuthChange({ token: e.target.value })}
                        placeholder="Enter bearer token"
                        collectionId={tab.collectionId}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-muted hover:text-text transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {auth.type === 'Basic Auth' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted mb-1.5 block">Username</label>
                    <div className="bg-surface border border-border rounded px-3 h-9">
                      <VariableOverlayInput
                        multiline={false}
                        value={auth.username || ''}
                        onChange={(e) => handleAuthChange({ username: e.target.value })}
                        placeholder="Username"
                        collectionId={tab.collectionId}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted mb-1.5 block">Password</label>
                    <div className="relative bg-surface border border-border rounded h-9 pl-3 pr-8">
                      <VariableOverlayInput
                        multiline={false}
                        masked
                        revealed={showPassword}
                        value={auth.password || ''}
                        onChange={(e) => handleAuthChange({ password: e.target.value })}
                        placeholder="Password"
                        collectionId={tab.collectionId}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-muted hover:text-text transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {auth.type === 'API Key' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-muted mb-1.5 block">Key</label>
                      <div className="bg-surface border border-border rounded px-3 h-9">
                        <VariableOverlayInput
                          multiline={false}
                          value={auth.key || ''}
                          onChange={(e) => handleAuthChange({ key: e.target.value })}
                          placeholder="X-API-Key"
                          collectionId={tab.collectionId}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted mb-1.5 block">Value</label>
                      <div className="bg-surface border border-border rounded px-3 h-9">
                        <VariableOverlayInput
                          multiline={false}
                          value={auth.value || ''}
                          onChange={(e) => handleAuthChange({ value: e.target.value })}
                          placeholder="Value"
                          collectionId={tab.collectionId}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted mb-1.5 block">Add to</label>
                    <select
                      value={auth.addTo || 'header'}
                      onChange={(e) => handleAuthChange({ addTo: e.target.value as 'header' | 'query' })}
                      className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                    >
                      <option value="header">Header</option>
                      <option value="query">Query Params</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- Scripts --- */}
        <div className={`h-full flex-col gap-4 max-w-4xl ${activeSettingsTab === 'Scripts' ? 'flex' : 'hidden'}`}>
          <div className="flex-1 min-h-0 flex flex-col">
            <span className="text-[9px] text-muted font-black uppercase tracking-[0.2em] flex items-center gap-2 mb-1.5">
              <TerminalIcon size={12} className="text-primary" /> Pre-request Script
            </span>
            <p className="text-[10px] text-muted/70 mb-2">Runs before every request in this collection, before the request's own pre-request script.</p>
            <div className="flex-1 min-h-[160px] border border-border rounded-lg overflow-hidden">
              <Editor
                height="100%"
                defaultLanguage="javascript"
                theme={monacoTheme}
                value={data.pre_request_script}
                onChange={(val) => update({ pre_request_script: val || '' })}
                options={{
                  minimap: { enabled: false },
                  fontSize,
                  scrollBeyondLastLine: false,
                  padding: { top: 10 }
                }}
              />
            </div>
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            <span className="text-[9px] text-muted font-black uppercase tracking-[0.2em] flex items-center gap-2 mb-1.5">
              <TerminalIcon size={12} className="text-primary" /> Post-request Script (Tests)
            </span>
            <p className="text-[10px] text-muted/70 mb-2">Runs after every request in this collection, after the request's own test script.</p>
            <div className="flex-1 min-h-[160px] border border-border rounded-lg overflow-hidden">
              <Editor
                height="100%"
                defaultLanguage="javascript"
                theme={monacoTheme}
                value={data.post_request_script}
                onChange={(val) => update({ post_request_script: val || '' })}
                options={{
                  minimap: { enabled: false },
                  fontSize,
                  scrollBeyondLastLine: false,
                  padding: { top: 10 }
                }}
              />
            </div>
          </div>
        </div>

        {/* --- Variables --- */}
        <div className={`max-w-2xl ${activeSettingsTab === 'Variables' ? 'block' : 'hidden'}`}>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Braces size={12} /> Collection Variables
            </label>
            <span className="text-[10px] text-muted italic">
              Used as {'{{variable_name}}'} — overridden by the active Environment
            </span>
          </div>
          <KeyValueEditor
            initialData={data.variables}
            onChange={(vars) => update({ variables: vars as Record<string, string> })}
            collectionId={tab.collectionId}
          />
        </div>
      </div>

      {showRunner && collection && (
        <CollectionRunnerPanel
          collectionId={tab.collectionId}
          collectionName={collection.name}
          onClose={() => setShowRunner(false)}
        />
      )}
    </div>
  )
}
