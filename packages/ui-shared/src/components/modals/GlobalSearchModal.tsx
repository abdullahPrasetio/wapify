import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Search,
  Folder as FolderIcon,
  Zap,
  Settings,
  Command,
  ChevronRight,
  DatabaseZap,
  LayoutDashboard,
  UserCog,
  Building2,
  Heart,
  Bell,
  Cloud,
  History,
  Variable,
  Globe
} from 'lucide-react'
import { useDataStore } from '../../store/useDataStore'
import { useAppStore } from '../../store/useAppStore'
import { useAuthStore } from '../../store/useAuthStore'

interface SearchResult {
  id: string
  type: 'request' | 'collection' | 'folder' | 'env-var' | 'history' | 'navigation' | 'mock'
  title: string
  subtitle?: string
  icon: React.ElementType
  action: () => void
  method?: string
  badge?: string
}

interface ResultGroup {
  label: string
  results: SearchResult[]
}

/** Simple fuzzy match — true if all chars in `pattern` appear in `text` in order */
function fuzzyMatch(text: string, pattern: string): boolean {
  if (!pattern) return true
  const t = text.toLowerCase()
  const p = pattern.toLowerCase()
  let ti = 0
  for (let pi = 0; pi < p.length; pi++) {
    ti = t.indexOf(p[pi], ti)
    if (ti === -1) return false
    ti++
  }
  return true
}

/** Score fuzzy match — exact substring scores higher */
function fuzzyScore(text: string, pattern: string): number {
  const t = text.toLowerCase()
  const p = pattern.toLowerCase()
  if (t.includes(p)) return 2
  return 1
}

const MAX_PER_GROUP = 6

export const GlobalSearchModal = (): React.JSX.Element | null => {
  const { isSearchModalOpen, setSearchModalOpen, setActiveView, setActiveHistoryId } = useAppStore()
  const { user } = useAuthStore()
  const {
    searchableRequests,
    searchableCollections,
    activeTeamId,
    setActiveTeam,
    openRequestInTab,
    toggleExpand,
    fetchSearchableData,
    foldersByCollection,
    environments,
    history,
    fetchHistory
  } = useDataStore()

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isSearchModalOpen) {
      fetchSearchableData()
      fetchHistory()
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isSearchModalOpen])

  const groups = useMemo<ResultGroup[]>(() => {
    const q = query.trim()

    // ── No query: show navigation shortcuts ──────────────────────────────────
    if (!q) {
      const navs: SearchResult[] = [
        { id: 'nav-dashboard', type: 'navigation', title: 'Go to Dashboard', icon: LayoutDashboard, action: () => setActiveView('request-builder') },
        { id: 'nav-activity', type: 'navigation', title: 'Activity Log', icon: Bell, action: () => setActiveView('activity-log') },
        {
          id: 'nav-settings', type: 'navigation', title: 'Open Settings', icon: Settings, action: () => {
            setActiveView('request-builder')
            window.dispatchEvent(new CustomEvent('wapbolt:open-settings'))
          }
        },
        {
          id: 'nav-mock', type: 'navigation', title: 'Workspace Mock Server', icon: DatabaseZap, action: () => {
            setActiveView('request-builder')
            window.dispatchEvent(new CustomEvent('wapbolt:open-standalone-mock'))
          }
        },
        {
          id: 'nav-confluence', type: 'navigation', title: 'Confluence Settings', icon: Cloud, action: () => {
            setActiveView('request-builder')
            setTimeout(() => window.dispatchEvent(new CustomEvent('wapbolt:open-user-confluence-settings')), 10)
          }
        },
      ]
      if (user?.is_super_admin) {
        navs.push(
          { id: 'nav-users', type: 'navigation', title: 'User Management', icon: UserCog, action: () => setActiveView('admin-users') },
          { id: 'nav-teams', type: 'navigation', title: 'Workspace Management', icon: Building2, action: () => setActiveView('admin-teams') },
          { id: 'nav-donations', type: 'navigation', title: 'Donation Settings', icon: Heart, action: () => setActiveView('admin-donations') }
        )
      }
      return [{ label: 'Quick Navigation', results: navs }]
    }

    const result: ResultGroup[] = []

    // ── Requests ─────────────────────────────────────────────────────────────
    const reqResults: SearchResult[] = (searchableRequests || [])
      .filter(req => fuzzyMatch(req.name, q) || fuzzyMatch(req.url, q))
      .sort((a, b) => {
        const sa = Math.max(fuzzyScore(a.name, q), fuzzyScore(a.url, q))
        const sb = Math.max(fuzzyScore(b.name, q), fuzzyScore(b.url, q))
        return sb - sa
      })
      .slice(0, MAX_PER_GROUP)
      .map(req => {
        const isCurrentTeam = req.team_id === activeTeamId
        return {
          id: `req-${req.id}`,
          type: 'request' as const,
          title: req.name,
          subtitle: `${isCurrentTeam ? '' : '[External] '}${req.url}`,
          method: req.method,
          icon: Zap,
          action: async () => {
            if (!isCurrentTeam) await setActiveTeam(req.team_id)
            await useDataStore.getState().fetchCollectionContents(req.collection_id)
            const fullReq = useDataStore.getState().requests.find(r => r.id === req.id)
            if (fullReq) openRequestInTab(fullReq)
            setActiveView('request-builder')
          }
        }
      })
    if (reqResults.length) result.push({ label: 'Requests', results: reqResults })

    // ── Collections ───────────────────────────────────────────────────────────
    const colResults: SearchResult[] = (searchableCollections || [])
      .filter(col => fuzzyMatch(col.name, q))
      .sort((a, b) => fuzzyScore(b.name, q) - fuzzyScore(a.name, q))
      .slice(0, MAX_PER_GROUP)
      .map(col => {
        const isCurrentTeam = col.team_id === activeTeamId
        return {
          id: `col-${col.id}`,
          type: 'collection' as const,
          title: col.name,
          subtitle: isCurrentTeam ? 'Collection' : '[External] Collection',
          icon: FolderIcon,
          action: async () => {
            if (!isCurrentTeam) await setActiveTeam(col.team_id)
            useDataStore.getState().toggleExpand(`collection-${col.id}`)
            useDataStore.getState().fetchCollectionContents(col.id)
            setActiveView('request-builder')
          }
        }
      })
    if (colResults.length) result.push({ label: 'Collections', results: colResults })

    // ── Folders ───────────────────────────────────────────────────────────────
    const allFolders = Object.values(foldersByCollection).flat()
    const folderResults: SearchResult[] = allFolders
      .filter(f => fuzzyMatch(f.name, q))
      .sort((a, b) => fuzzyScore(b.name, q) - fuzzyScore(a.name, q))
      .slice(0, MAX_PER_GROUP)
      .map(f => ({
        id: `folder-${f.id}`,
        type: 'folder' as const,
        title: f.name,
        subtitle: 'Folder',
        icon: FolderIcon,
        action: () => {
          toggleExpand(`collection-${f.collection_id}`)
          toggleExpand(`folder-${f.id}`)
          setActiveView('request-builder')
        }
      }))
    if (folderResults.length) result.push({ label: 'Folders', results: folderResults })

    // ── Environment Variables ─────────────────────────────────────────────────
    const envVarResults: SearchResult[] = []
    for (const env of environments) {
      for (const [key, value] of Object.entries(env.variables || {})) {
        if (fuzzyMatch(key, q) || fuzzyMatch(env.name, q)) {
          envVarResults.push({
            id: `env-${env.id}-${key}`,
            type: 'env-var',
            title: key,
            subtitle: `${env.name} → ${String(value).slice(0, 60)}`,
            badge: env.is_global ? 'Global' : 'Env',
            icon: env.is_global ? Globe : Variable,
            action: () => {
              setActiveView('request-builder')
              window.dispatchEvent(new CustomEvent('wapbolt:open-settings', { detail: { tab: 'environments' } }))
            }
          })
        }
        if (envVarResults.length >= MAX_PER_GROUP) break
      }
      if (envVarResults.length >= MAX_PER_GROUP) break
    }
    if (envVarResults.length) result.push({ label: 'Environment Variables', results: envVarResults })

    // ── History ───────────────────────────────────────────────────────────────
    const historyResults: SearchResult[] = (history || [])
      .filter(h => fuzzyMatch(h.url, q) || fuzzyMatch(h.method, q))
      .sort((a, b) => fuzzyScore(b.url, q) - fuzzyScore(a.url, q))
      .slice(0, MAX_PER_GROUP)
      .map(h => ({
        id: `hist-${h.id}`,
        type: 'history' as const,
        title: h.url,
        subtitle: `${new Date(h.created_at).toLocaleString()} · ${h.response_time}ms · ${h.status_code}`,
        method: h.method,
        icon: History,
        action: () => {
          setActiveHistoryId(h.id)
        }
      }))
    if (historyResults.length) result.push({ label: 'History', results: historyResults })

    // ── Navigation ────────────────────────────────────────────────────────────
    const allNavs: SearchResult[] = [
      { id: 'nav-dashboard', type: 'navigation', title: 'Dashboard', icon: LayoutDashboard, action: () => setActiveView('request-builder') },
      { id: 'nav-activity', type: 'navigation', title: 'Activity Log', icon: Bell, action: () => setActiveView('activity-log') },
      { id: 'nav-settings', type: 'navigation', title: 'Settings', icon: Settings, action: () => { setActiveView('request-builder'); window.dispatchEvent(new CustomEvent('wapbolt:open-settings')) } },
      { id: 'nav-mock', type: 'navigation', title: 'Workspace Mock Server', icon: DatabaseZap, action: () => { setActiveView('request-builder'); window.dispatchEvent(new CustomEvent('wapbolt:open-standalone-mock')) } },
      { id: 'nav-confluence', type: 'navigation', title: 'Confluence Settings', icon: Cloud, action: () => { setActiveView('request-builder'); setTimeout(() => window.dispatchEvent(new CustomEvent('wapbolt:open-user-confluence-settings')), 10) } },
    ]
    if (user?.is_super_admin) {
      allNavs.push(
        { id: 'nav-users', type: 'navigation', title: 'User Management', icon: UserCog, action: () => setActiveView('admin-users') },
        { id: 'nav-teams', type: 'navigation', title: 'Workspace Management', icon: Building2, action: () => setActiveView('admin-teams') },
        { id: 'nav-donations', type: 'navigation', title: 'Donation Settings', icon: Heart, action: () => setActiveView('admin-donations') }
      )
    }
    const navResults = allNavs.filter(n => fuzzyMatch(n.title, q))
    if (navResults.length) result.push({ label: 'Navigation', results: navResults })

    return result
  }, [query, searchableRequests, searchableCollections, foldersByCollection, environments, history, activeTeamId, user, setActiveView, setActiveHistoryId, openRequestInTab, toggleExpand, setActiveTeam])

  // Flat list for keyboard navigation
  const flatResults = useMemo(() => groups.flatMap(g => g.results), [groups])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Handle keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isSearchModalOpen) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % Math.max(flatResults.length, 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + Math.max(flatResults.length, 1)) % Math.max(flatResults.length, 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (flatResults[selectedIndex]) {
          flatResults[selectedIndex].action()
          setSearchModalOpen(false)
        }
      } else if (e.key === 'Escape') {
        setSearchModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSearchModalOpen, flatResults, selectedIndex, setSearchModalOpen])

  // Auto-scroll selected item into view
  useEffect(() => {
    const el = document.querySelector(`[data-result-index="${selectedIndex}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedIndex])

  if (!isSearchModalOpen) return null

  let globalIndex = 0

  const methodColor = (method?: string) => {
    if (!method) return 'text-muted'
    if (method === 'GET') return 'text-success'
    if (method === 'POST') return 'text-warning'
    if (method === 'DELETE') return 'text-error'
    return 'text-info'
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-start justify-center pt-[12vh] px-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-surface border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col animate-in slide-in-from-top-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-background/50">
          <Search size={20} className="text-primary animate-pulse" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search requests, folders, env vars, history..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-none text-text text-lg focus:outline-none placeholder:text-muted/50"
          />
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-surface border border-border text-[10px] font-black text-muted uppercase tracking-tighter">
            <span className="text-xs">ESC</span>
          </div>
        </div>

        {/* Results */}
        <div
          ref={resultsContainerRef}
          className="flex-1 max-h-115 overflow-y-auto p-2"
        >
          {groups.length > 0 ? (
            <div className="space-y-3">
              {groups.map((group) => (
                <div key={group.label}>
                  <div className="px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-muted/50">
                    {group.label}
                  </div>
                  <div className="space-y-0.5">
                    {group.results.map((result) => {
                      const idx = globalIndex++
                      const isSelected = idx === selectedIndex
                      return (
                        <button
                          key={result.id}
                          data-result-index={idx}
                          onClick={() => {
                            result.action()
                            setSearchModalOpen(false)
                          }}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`w-full flex items-center gap-4 px-4 py-2.5 rounded-xl text-left transition-all duration-150 ${isSelected
                            ? 'bg-primary/10 border border-primary/20 shadow-sm shadow-primary/5'
                            : 'hover:bg-background/50 border border-transparent'
                            }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-background text-muted'
                            } transition-all duration-200`}>
                            <result.icon size={16} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {result.method && (
                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border border-current opacity-70 ${methodColor(result.method)}`}>
                                  {result.method}
                                </span>
                              )}
                              {result.badge && (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded border border-primary/30 text-primary/60">
                                  {result.badge}
                                </span>
                              )}
                              <span className={`text-sm font-semibold truncate ${isSelected ? 'text-primary' : 'text-text'}`}>
                                {result.title}
                              </span>
                            </div>
                            {result.subtitle && (
                              <p className="text-[10px] text-muted truncate mt-0.5 font-mono opacity-60">
                                {result.subtitle}
                              </p>
                            )}
                          </div>

                          <div className={`transition-opacity duration-200 ${isSelected ? 'opacity-100' : 'opacity-0'}`}>
                            <div className="flex items-center gap-1 px-2 py-1 rounded bg-primary text-white text-[9px] font-black uppercase tracking-widest shadow-md shadow-primary/20">
                              Open <ChevronRight size={10} />
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted opacity-40 italic gap-4">
              <Search size={40} className="text-muted/20" />
              <p className="text-sm">No results found for "{query}"</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-background/30 flex items-center justify-between">
          <div className="flex items-center gap-4 text-[10px] font-bold text-muted uppercase tracking-widest">
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface border border-border">↑↓</div>
              <span>Navigate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface border border-border">Enter</div>
              <span>Select</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface border border-border">ESC</div>
              <span>Close</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-black text-primary/60 uppercase tracking-[0.2em]">
            <Command size={12} /> Global Search
          </div>
        </div>
      </div>

      {/* Click outside */}
      <div className="absolute inset-0 z-[-1]" onClick={() => setSearchModalOpen(false)} />
    </div>
  )
}
