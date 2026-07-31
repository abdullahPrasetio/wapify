import { useState, useRef, useEffect, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { Search, Settings, ChevronLeft, ChevronRight, ChevronDown, Check, Users, Plus, ShieldCheck, UserCog, Building2, Heart, Cloud, LayoutDashboard, ArrowRight } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import { useAppStore } from '../../store/useAppStore'
import { useDataStore } from '../../store/useDataStore'
import { SyncControls } from './SyncControls'

const IS_WINDOWS = navigator.userAgent.includes('Windows')

function WindowControls(): React.JSX.Element | null {
  if (!IS_WINDOWS) return null
  return (
    <div
      className="flex items-center shrink-0"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <button
        onClick={() => window.api?.minimizeWindow()}
        className="w-10 h-11 flex items-center justify-center text-muted hover:text-text hover:bg-white/10 transition-colors"
        title="Minimize"
      >
        <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor"><rect width="10" height="1"/></svg>
      </button>
      <button
        onClick={() => window.api?.maximizeWindow()}
        className="w-10 h-11 flex items-center justify-center text-muted hover:text-text hover:bg-white/10 transition-colors"
        title="Maximize"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1"><rect x="0.5" y="0.5" width="9" height="9"/></svg>
      </button>
      <button
        onClick={() => window.api?.closeWindow()}
        className="w-10 h-11 flex items-center justify-center text-muted hover:text-white hover:bg-red-500 transition-colors"
        title="Close"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><line x1="0" y1="0" x2="10" y2="10"/><line x1="10" y1="0" x2="0" y2="10"/></svg>
      </button>
    </div>
  )
}

function WorkspaceSwitcher(): React.JSX.Element {
  const { teams, activeTeamId, setActiveTeam, createTeam } = useDataStore()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const activeTeam = teams.find((t) => t.id === activeTeamId)

  const handleOpen = (): void => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen((v) => {
      if (v) { setShowNewForm(false); setNewName('') }
      return !v
    })
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
        setShowNewForm(false)
        setNewName('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (showNewForm) setTimeout(() => inputRef.current?.focus(), 50)
  }, [showNewForm])

  const handleCreate = useCallback(async (): Promise<void> => {
    const name = newName.trim()
    if (!name || creating) return
    setCreating(true)
    await createTeam(name, '')
    setCreating(false)
    setNewName('')
    setShowNewForm(false)
    setOpen(false)
  }, [newName, creating, createTeam])

  const dropdown = open ? ReactDOM.createPortal(
    <div
      ref={dropRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 99999 }}
      className="w-56 bg-surface border border-border rounded-lg shadow-xl py-1 overflow-hidden"
    >
      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted">
        Workspaces
      </div>
      {teams.map((team) => (
        <button
          key={team.id}
          onClick={() => { setActiveTeam(team.id); setOpen(false) }}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-background transition-colors text-left"
        >
          <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center text-primary text-[10px] font-black shrink-0">
            {team.name[0]?.toUpperCase()}
          </div>
          <span className="flex-1 truncate text-text">{team.name}</span>
          {team.id === activeTeamId && <Check size={11} className="text-primary shrink-0" />}
        </button>
      ))}
      {teams.length === 0 && <div className="px-3 py-2 text-xs text-muted italic">No workspaces yet</div>}

      <div className="border-t border-border mt-1 pt-1">
        {showNewForm ? (
          <div className="px-3 py-2 flex items-center gap-1.5">
            <input
              ref={inputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') { setShowNewForm(false); setNewName('') }
              }}
              placeholder="Workspace name..."
              className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs text-text focus:border-primary outline-none"
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="p-1 rounded bg-primary text-white disabled:opacity-40 hover:bg-primary/80 transition-colors"
            >
              <ArrowRight size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewForm(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-background transition-colors text-muted hover:text-text"
          >
            <Plus size={11} /> New Workspace
          </button>
        )}
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold text-text hover:bg-surface transition-colors max-w-[160px]"
        title="Switch workspace"
      >
        <Users size={12} className="text-primary shrink-0" />
        <span className="truncate">{activeTeam?.name ?? 'No Workspace'}</span>
        <ChevronDown size={11} className="text-muted shrink-0" />
      </button>
      {dropdown}
    </div>
  )
}

function AdminDropdown(): React.JSX.Element | null {
  const { user } = useAuthStore()
  const { setActiveView } = useAppStore()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!user?.is_super_admin) return null

  const handleOpen = (): void => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.right - 208 })
    }
    setOpen((v) => !v)
  }

  const nav = (view: Parameters<typeof setActiveView>[0]): void => {
    setActiveView(view)
    setOpen(false)
  }

  const items = [
    { icon: <LayoutDashboard size={12} />, label: 'Dashboard', view: 'request-builder' as const },
    { icon: <UserCog size={12} />, label: 'User Management', view: 'admin-users' as const },
    { icon: <Building2 size={12} />, label: 'Workspace Management', view: 'admin-teams' as const },
    { icon: <Heart size={12} />, label: 'Donation Settings', view: 'admin-donations' as const },
  ]

  const dropdown = open ? ReactDOM.createPortal(
    <div
      ref={dropRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 99999 }}
      className="w-52 bg-surface border border-border rounded-lg shadow-xl py-1 overflow-hidden"
    >
      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
        <ShieldCheck size={10} /> Admin Panel
      </div>
      {items.map((item) => (
        <button
          key={item.view}
          onClick={() => nav(item.view)}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-background transition-colors text-text text-left"
        >
          <span className="text-muted">{item.icon}</span>
          {item.label}
        </button>
      ))}
      <div className="border-t border-border mt-1 pt-1">
        <button
          onClick={() => {
            setOpen(false)
            window.dispatchEvent(new CustomEvent('wapbolt:open-confluence-settings'))
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-background transition-colors text-muted hover:text-blue-400"
        >
          <Cloud size={12} className="text-blue-400" /> Confluence Sync
        </button>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="p-1.5 rounded text-muted hover:text-text hover:bg-surface transition-colors"
        title="Admin Panel"
      >
        <Settings size={14} />
      </button>
      {dropdown}
    </div>
  )
}

export const TopNavbar = (): React.JSX.Element => {
  const { user } = useAuthStore()
  const { setSearchModalOpen, setActiveView } = useAppStore()
  const { tabs, activeTabId, setActiveTab } = useDataStore()

  const currentTabIndex = tabs.findIndex((t) => t.requestId === activeTabId)
  const hasPrev = currentTabIndex > 0
  const hasNext = currentTabIndex >= 0 && currentTabIndex < tabs.length - 1

  const goToPrevTab = (): void => {
    if (hasPrev) setActiveTab(tabs[currentTabIndex - 1].requestId)
  }
  const goToNextTab = (): void => {
    if (hasNext) setActiveTab(tabs[currentTabIndex + 1].requestId)
  }

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <div
      className={`h-11 shrink-0 flex items-center pl-4 gap-3 border-b border-border bg-surface/60 backdrop-blur-sm ${IS_WINDOWS ? '' : 'pr-4'}`}
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* macOS traffic lights spacer — hidden on Windows */}
      {!IS_WINDOWS && <div className="w-16 shrink-0" />}

      {/* Prev / Next Tab */}
      <div
        className="flex items-center gap-0.5"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={goToPrevTab}
          disabled={!hasPrev}
          className="p-1.5 rounded text-muted hover:text-text hover:bg-surface transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Previous Tab"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          onClick={goToNextTab}
          disabled={!hasNext}
          className="p-1.5 rounded text-muted hover:text-text hover:bg-surface transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Next Tab"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Logo + App name */}
      <button
        onClick={() => setActiveView('request-builder')}
        className="flex items-center gap-2 text-xs font-black text-text hover:text-primary transition-colors"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <span className="w-5 h-5 rounded bg-primary flex items-center justify-center text-white text-[10px] font-black shrink-0">W</span>
        Wapbolt
      </button>

      {/* Divider */}
      <div className="w-px h-4 bg-border shrink-0" />

      {/* Workspace Switcher */}
      <WorkspaceSwitcher />

      {/* Search — center */}
      <div className="flex-1 flex justify-center">
        <button
          onClick={() => setSearchModalOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-background border border-border text-muted text-xs hover:border-primary/50 hover:text-text transition-colors w-full max-w-sm"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <Search size={12} />
          <span className="flex-1 text-left">Search</span>
          <kbd className="text-[10px] font-mono opacity-50">⌘K</kbd>
        </button>
      </div>

      {/* Right: Settings + Avatar */}
      <div
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Hanya tampil di Wapbolt Local (AppMode.sync) — no-op di Cloud */}
        <SyncControls />
        <AdminDropdown />

        <div
          className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-black shrink-0 cursor-default"
          title={user?.name ?? ''}
        >
          {initials}
        </div>
      </div>

      {/* Windows window controls */}
      <WindowControls />
    </div>
  )
}
