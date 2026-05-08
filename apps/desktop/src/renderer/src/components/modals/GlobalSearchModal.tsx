import React, { useState, useEffect, useMemo, useRef } from 'react'
import { 
  Search, 
  FileCode2, 
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
  Globe
} from 'lucide-react'
import { useDataStore } from '../../store/useDataStore'
import { useAppStore } from '../../store/useAppStore'
import { useAuthStore } from '../../store/useAuthStore'
import type { ApiRequest, Collection } from '../../types'

interface SearchResult {
  id: string
  type: 'request' | 'collection' | 'navigation' | 'mock'
  title: string
  subtitle?: string
  icon: React.ElementType
  action: () => void
  method?: string
}

export const GlobalSearchModal = (): React.JSX.Element | null => {
  const { isSearchModalOpen, setSearchModalOpen, setActiveView, theme } = useAppStore()
  const { user } = useAuthStore()
  const { 
    collections, 
    requests,
    searchableRequests,
    searchableCollections,
    activeTeamId,
    setActiveTeam,
    openRequestInTab, 
    toggleExpand,
    expandedItems,
    fetchSearchableData
  } = useDataStore()

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsContainerRef = useRef<HTMLDivElement>(null)

  // Fetch searchable data when opened
  useEffect(() => {
    if (isSearchModalOpen) {
      fetchSearchableData()
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isSearchModalOpen])

  const results = useMemo(() => {
    // 1. Base suggestions if no query
    if (!query.trim()) {
      const navs: SearchResult[] = [
        { id: 'nav-dashboard', type: 'navigation', title: 'Go to Dashboard', icon: LayoutDashboard, action: () => setActiveView('request-builder') },
        { id: 'nav-settings', type: 'navigation', title: 'Open Settings', icon: Settings, action: () => {
           setActiveView('request-builder')
           window.dispatchEvent(new CustomEvent('wapbolt:open-settings'))
        }},
        { id: 'nav-mock', type: 'navigation', title: 'Workspace Mock Server', icon: DatabaseZap, action: () => {
           setActiveView('request-builder')
           window.dispatchEvent(new CustomEvent('wapbolt:open-standalone-mock'))
        }},
      ]

      if (user?.is_super_admin) {
        navs.push(
          { id: 'nav-users', type: 'navigation', title: 'User Management', icon: UserCog, action: () => setActiveView('admin-users') },
          { id: 'nav-teams', type: 'navigation', title: 'Workspace Management', icon: Building2, action: () => setActiveView('admin-teams') },
          { id: 'nav-donations', type: 'navigation', title: 'Donation Settings', icon: Heart, action: () => setActiveView('admin-donations') }
        )
      }
      return navs
    }

    const q = query.toLowerCase()
    const filtered: SearchResult[] = []

    // 2. Filter Cross-Team Requests
    searchableRequests.forEach(req => {
      if (req.name.toLowerCase().includes(q) || req.url.toLowerCase().includes(q)) {
        const isCurrentTeam = req.team_id === activeTeamId
        filtered.push({
          id: `req-${req.id}`,
          type: 'request',
          title: req.name,
          subtitle: `${isCurrentTeam ? '' : '[External Workspace] '}${req.url}`,
          method: req.method,
          icon: Zap,
          action: async () => {
            if (!isCurrentTeam) {
              await setActiveTeam(req.team_id)
            }
            // Need to find the full request object from state or wait for reload
            // For now, use a trick: wait for reload or pass partial
            setTimeout(() => {
              const fullReq = useDataStore.getState().requests.find(r => r.id === req.id)
              if (fullReq) {
                openRequestInTab(fullReq)
              }
            }, isCurrentTeam ? 0 : 500)
            setActiveView('request-builder')
          }
        })
      }
    })

    // 3. Filter Cross-Team Collections
    searchableCollections.forEach(col => {
      if (col.name.toLowerCase().includes(q)) {
        const isCurrentTeam = col.team_id === activeTeamId
        filtered.push({
          id: `col-${col.id}`,
          type: 'collection',
          title: col.name,
          subtitle: isCurrentTeam ? 'Collection' : '[External Workspace] Collection',
          icon: FolderIcon,
          action: async () => {
            if (!isCurrentTeam) {
              await setActiveTeam(col.team_id)
            }
            setTimeout(() => {
              useDataStore.getState().toggleExpand(`collection-${col.id}`)
            }, isCurrentTeam ? 0 : 500)
            setActiveView('request-builder')
          }
        })
      }
    })

    // 4. Filter Navigations
    const allNavs: SearchResult[] = [
      { id: 'nav-dashboard', type: 'navigation', title: 'Dashboard', icon: LayoutDashboard, action: () => setActiveView('request-builder') },
      { id: 'nav-settings', type: 'navigation', title: 'Settings', icon: Settings, action: () => {
         setActiveView('request-builder')
         window.dispatchEvent(new CustomEvent('wapbolt:open-settings'))
      }},
      { id: 'nav-mock', type: 'navigation', title: 'Workspace Mock Server', icon: DatabaseZap, action: () => {
         setActiveView('request-builder')
         window.dispatchEvent(new CustomEvent('wapbolt:open-standalone-mock'))
      }},
    ]

    if (user?.is_super_admin) {
      allNavs.push(
        { id: 'nav-users', type: 'navigation', title: 'User Management', icon: UserCog, action: () => setActiveView('admin-users') },
        { id: 'nav-teams', type: 'navigation', title: 'Workspace Management', icon: Building2, action: () => setActiveView('admin-teams') },
        { id: 'nav-donations', type: 'navigation', title: 'Donation Settings', icon: Heart, action: () => setActiveView('admin-donations') }
      )
    }

    allNavs.forEach(nav => {
      if (nav.title.toLowerCase().includes(q)) {
        filtered.push(nav)
      }
    })

    return filtered.slice(0, 10)
  }, [query, searchableRequests, searchableCollections, activeTeamId, user, setActiveView, openRequestInTab, toggleExpand, setActiveTeam])

  // Handle Keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isSearchModalOpen) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % results.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (results[selectedIndex]) {
          results[selectedIndex].action()
          setSearchModalOpen(false)
        }
      } else if (e.key === 'Escape') {
        setSearchModalOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSearchModalOpen, results, selectedIndex, setSearchModalOpen])

  // Auto-scroll selected item into view
  useEffect(() => {
    const selectedElement = resultsContainerRef.current?.children[selectedIndex] as HTMLElement
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex])

  if (!isSearchModalOpen) return null

  return (
    <div className="fixed inset-0 z-[500] flex items-start justify-center pt-[15vh] px-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200">
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
            placeholder="Search for requests, collections, or navigation..."
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
          className="flex-1 max-h-[400px] overflow-y-auto p-2"
        >
          {results.length > 0 ? (
            <div className="space-y-1">
              {results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => {
                    result.action()
                    setSearchModalOpen(false)
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                    index === selectedIndex 
                      ? 'bg-primary/10 border border-primary/20 shadow-lg shadow-primary/5' 
                      : 'hover:bg-background/50 border border-transparent'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    index === selectedIndex ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-110' : 'bg-background text-muted'
                  } transition-all duration-300`}>
                    <result.icon size={20} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {result.method && (
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border border-current opacity-70 ${
                          result.method === 'GET' ? 'text-success' : 
                          result.method === 'POST' ? 'text-warning' : 'text-info'
                        }`}>
                          {result.method}
                        </span>
                      )}
                      <span className={`text-sm font-bold truncate ${index === selectedIndex ? 'text-primary' : 'text-text'}`}>
                        {result.title}
                      </span>
                    </div>
                    {result.subtitle && (
                      <p className="text-[11px] text-muted truncate mt-0.5 font-mono opacity-60">
                        {result.subtitle}
                      </p>
                    )}
                  </div>

                  <div className={`transition-opacity duration-300 ${index === selectedIndex ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-primary text-white text-[9px] font-black uppercase tracking-widest shadow-lg shadow-primary/20">
                      Open <ChevronRight size={12} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-muted opacity-40 italic gap-4">
              <Search size={48} className="text-muted/20" />
              <p className="text-sm">No results found for "{query}"</p>
            </div>
          )}
        </div>

        {/* Footer Info */}
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
          </div>
          
          <div className="flex items-center gap-2 text-[10px] font-black text-primary/60 uppercase tracking-[0.2em]">
            <Command size={12} /> Global Search
          </div>
        </div>
      </div>
      
      {/* Click outside listener */}
      <div 
        className="absolute inset-0 z-[-1]" 
        onClick={() => setSearchModalOpen(false)} 
      />
    </div>
  )
}
