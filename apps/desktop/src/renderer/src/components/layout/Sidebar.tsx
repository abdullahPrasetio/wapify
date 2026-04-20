import {
  Folder,
  Plus,
  Search,
  Settings,
  ChevronRight,
  ChevronDown,
  Hash,
  RefreshCw,
  LogOut,
  Users,
  ShieldCheck,
  UserCog,
  Building2,
  LayoutDashboard,
  FilePlus,
  FolderPlus,
  Clock,
  Trash2
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { useDataStore } from '../../store/useDataStore'
import { useAppStore } from '../../store/useAppStore'
import type { Collection, ApiRequest } from '../../types'

import { ImportModal } from '../modals/ImportModal'
import { EnvironmentModal } from '../modals/EnvironmentModal'

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-success',
  POST: 'text-warning',
  PUT: 'text-info',
  PATCH: 'text-secondary',
  DELETE: 'text-danger',
  HEAD: 'text-muted',
  OPTIONS: 'text-muted'
}

interface FolderItemProps {
  folder: Folder
  collectionId: number
  level: number
}

const FolderItem = ({
  folder,
  collectionId,
  allFolders
}: {
  folder: Folder
  collectionId: number
  allFolders: Folder[]
}): React.JSX.Element => {
  const [isExpanded, setIsExpanded] = useState(false)
  const { requestsByFolder, openRequestInTab, createRequest, createFolder } = useDataStore()
  const { setActiveView } = useAppStore()

  const requests = requestsByFolder[folder.id] || []
  const subFolders = allFolders.filter((f) => f.parent_folder_id === folder.id)

  const handleSelectRequest = (req: ApiRequest): void => {
    openRequestInTab(req)
    setActiveView('request-builder')
  }

  const handleAddRequest = (e: React.MouseEvent): void => {
    e.stopPropagation()
    const name = window.prompt('Request Name:', 'New Request')
    if (name) {
      createRequest(collectionId, folder.id, name)
    }
  }

  const handleAddFolder = (e: React.MouseEvent): void => {
    e.stopPropagation()
    const name = window.prompt('Sub-folder Name:', 'New Folder')
    if (name) {
      createFolder(collectionId, folder.id, name)
    }
  }

  return (
    <div>
      <div
        onClick={(): void => setIsExpanded(!isExpanded)}
        className="flex items-center px-2 py-1.5 rounded hover:bg-background cursor-pointer text-xs text-text group"
      >
        {isExpanded ? (
          <ChevronDown size={12} className="text-muted mr-1 shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-muted mr-1 shrink-0" />
        )}
        <Hash size={12} className="text-muted mr-2 shrink-0" />
        <span className="truncate flex-1">{folder.name}</span>
        <div className="opacity-0 group-hover:opacity-100 flex items-center transition-opacity gap-1">
          <button
            onClick={handleAddFolder}
            title="Add Sub-folder"
            className="text-muted hover:text-primary p-0.5"
          >
            <FolderPlus size={12} />
          </button>
          <button
            onClick={handleAddRequest}
            title="Add Request"
            className="text-muted hover:text-primary p-0.5"
          >
            <FilePlus size={12} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="ml-2 pl-2 border-l border-border/50 space-y-0.5 py-1">
          {/* Sub-folders */}
          {subFolders.map((sub) => (
            <FolderItem
              key={sub.id}
              folder={sub}
              collectionId={collectionId}
              allFolders={allFolders}
            />
          ))}

          {/* Folder Requests */}
          {requests.map((req) => (
            <div
              key={req.id}
              onClick={(): void => handleSelectRequest(req)}
              className="flex items-center px-2 py-1 rounded hover:bg-background cursor-pointer text-xs text-text"
            >
              <span
                className={`text-[9px] font-bold mr-2 w-8 text-right shrink-0 ${METHOD_COLORS[req.method] ?? 'text-muted'}`}
              >
                {req.method}
              </span>
              <span className="truncate">{req.name}</span>
            </div>
          ))}

          {subFolders.length === 0 && requests.length === 0 && (
            <div className="text-[10px] text-muted px-2 py-1 italic opacity-50 text-center">
              Empty
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface CollectionItemProps {
  collection: Collection
}

const CollectionItem = ({ collection }: CollectionItemProps): React.JSX.Element => {
  const [isExpanded, setIsExpanded] = useState(false)
  const {
    fetchCollectionContents,
    requestsByCollection,
    foldersByCollection,
    openRequestInTab,
    createRequest,
    createFolder
  } = useDataStore()
  const { setActiveView } = useAppStore()

  const handleExpand = async (): Promise<void> => {
    if (!isExpanded && !requestsByCollection[collection.id]) {
      await fetchCollectionContents(collection.id)
    }
    setIsExpanded(!isExpanded)
  }

  const handleAddRequest = (e: React.MouseEvent): void => {
    e.stopPropagation()
    const name = window.prompt('Request Name:', 'New Request')
    if (name) {
      createRequest(collection.id, null, name)
    }
  }

  const handleAddFolder = (e: React.MouseEvent): void => {
    e.stopPropagation()
    const name = window.prompt('Folder Name:', 'New Folder')
    if (name) {
      createFolder(collection.id, null, name)
    }
  }

  const handleSelectRequest = (req: ApiRequest): void => {
    openRequestInTab(req)
    setActiveView('request-builder')
  }

  const requests: ApiRequest[] = requestsByCollection[collection.id] ?? []
  const allFolders: Folder[] = foldersByCollection[collection.id] ?? []
  const rootFolders = allFolders.filter((f) => f.parent_folder_id === null)

  return (
    <div>
      <div
        onClick={handleExpand}
        className="flex items-center px-2 py-1.5 rounded hover:bg-background cursor-pointer text-sm text-text group"
      >
        {isExpanded ? (
          <ChevronDown size={14} className="text-muted mr-1 shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-muted mr-1 shrink-0" />
        )}
        <Folder size={14} className="text-primary mr-2 shrink-0" />
        <span className="truncate flex-1 font-medium">{collection.name}</span>
        <div className="opacity-0 group-hover:opacity-100 flex items-center transition-opacity gap-1">
          <button
            onClick={handleAddFolder}
            title="Add Folder"
            className="text-muted hover:text-primary p-0.5"
          >
            <FolderPlus size={13} />
          </button>
          <button
            onClick={handleAddRequest}
            title="Add Request"
            className="text-muted hover:text-primary p-0.5"
          >
            <FilePlus size={13} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="ml-4 pl-3 border-l border-border space-y-0.5 py-1">
          {/* Root Folders */}
          {rootFolders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              collectionId={collection.id}
              allFolders={allFolders}
            />
          ))}

          {/* Root Requests */}
          {requests.map((req) => (
            <div
              key={req.id}
              onClick={(): void => handleSelectRequest(req)}
              className="flex items-center px-2 py-1.5 rounded hover:bg-background cursor-pointer text-sm text-text"
            >
              <span
                className={`text-[10px] font-bold mr-2 w-10 text-right shrink-0 ${METHOD_COLORS[req.method] ?? 'text-muted'}`}
              >
                {req.method}
              </span>
              <span className="truncate">{req.name}</span>
            </div>
          ))}

          {rootFolders.length === 0 && requests.length === 0 && (
            <div className="text-xs text-muted px-2 py-1 italic text-center opacity-50">Empty</div>
          )}
        </div>
      )}
    </div>
  )
}

export const Sidebar = (): React.JSX.Element => {
  const { user, logout } = useAuthStore()
  const {
    teams,
    activeTeamId,
    collections,
    collectionsLoading,
    teamsLoading,
    fetchTeams,
    setActiveTeam,
    createTeam,
    environments,
    activeEnvironmentId,
    setActiveEnvironment,
    createCollection,
    history,
    historyLoading,
    clearHistory
  } = useDataStore()
  const { activeView, setActiveView } = useAppStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<'collections' | 'history'>('collections')

  // Fetch teams on mount
  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  const activeTeam = teams.find((t) => t.id === activeTeamId)
  const activeEnvironment = environments.find((e) => e.id === activeEnvironmentId)

  const filteredCollections = collections.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleNewCollection = (): void => {
    const name = window.prompt('Collection Name:', 'New Collection')
    if (name) {
      createCollection(name)
    }
  }

  const handleSelectTeam = (id: number): void => {
    setActiveTeam(id)
    setActiveView('request-builder')
  }

  const formatTime = (dateStr: string): string => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="w-64 h-full bg-surface border-r border-border flex flex-col flex-shrink-0">
      {/* Sidebar Header - Logo & App Name */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border shrink-0">
        <div
          onClick={(): void => setActiveView('request-builder')}
          className="font-semibold text-text flex items-center gap-2 cursor-pointer"
        >
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-white font-black text-xs shadow-sm shadow-primary/40">
            W
          </div>
          <span className="text-sm">Wapify</span>
        </div>
        <button
          onClick={(): Promise<void> => fetchTeams()}
          title="Refresh"
          className="text-muted hover:text-text transition-colors"
        >
          <RefreshCw size={14} className={teamsLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        {/* Superadmin Menu */}
        {user?.is_super_admin && (
          <div className="px-3 py-2 border-b border-border shrink-0">
            <div
              onClick={(): void => setIsAdminMenuOpen(!isAdminMenuOpen)}
              className="text-xs font-semibold text-primary uppercase tracking-wider mb-1.5 flex items-center justify-between cursor-pointer hover:text-primary-hover"
            >
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={13} />
                Admin Panel
              </div>
              {isAdminMenuOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </div>
            {isAdminMenuOpen && (
              <div className="space-y-1 mt-2 mb-1">
                <div
                  onClick={(): void => setActiveView('request-builder')}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${activeView === 'request-builder' ? 'bg-primary/10 text-primary' : 'text-text hover:bg-background'}`}
                >
                  <LayoutDashboard size={12} className="text-muted" />
                  Dashboard
                </div>
                <div
                  onClick={(): void => setActiveView('admin-users')}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${activeView === 'admin-users' ? 'bg-primary/10 text-primary' : 'text-text hover:bg-background'}`}
                >
                  <UserCog size={12} className="text-muted" />
                  User Management
                </div>
                <div
                  onClick={(): void => setActiveView('admin-teams')}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${activeView === 'admin-teams' ? 'bg-primary/10 text-primary' : 'text-text hover:bg-background'}`}
                >
                  <Building2 size={12} className="text-muted" />
                  Team Management
                </div>
              </div>
            )}
          </div>
        )}

        {/* Team Selector */}
        <div className="px-3 py-2 border-b border-border shrink-0">
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Users size={12} />
              Teams
            </div>
            <button
              onClick={(): void => {
                const name = window.prompt('Team Name:')
                if (name) {
                  const desc = window.prompt('Description (Optional):', '')
                  createTeam(name, desc || '')
                }
              }}
              title="New Team"
              className="text-muted hover:text-text transition-colors"
            >
              <Plus size={12} />
            </button>
          </div>
          <div className="space-y-0.5">
            {teams.map((team) => (
              <div
                key={team.id}
                onClick={(): void => handleSelectTeam(team.id)}
                className={`flex items-center px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${
                  team.id === activeTeamId
                    ? 'bg-primary/15 text-primary font-medium'
                    : 'text-text hover:bg-background'
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full mr-2 shrink-0 ${team.id === activeTeamId ? 'bg-primary' : 'bg-muted'}`}
                />
                <span className="truncate">{team.name}</span>
              </div>
            ))}
            {teams.length === 0 && !teamsLoading && (
              <div className="text-xs text-muted px-2 py-1 italic">No teams</div>
            )}
          </div>
        </div>

        {/* Sidebar Tab Switcher */}
        <div className="flex px-3 pt-3 gap-4 border-b border-border">
          <div
            onClick={(): void => setSidebarTab('collections')}
            className={`pb-2 text-xs font-bold uppercase tracking-wider cursor-pointer border-b-2 transition-all ${sidebarTab === 'collections' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'}`}
          >
            Collections
          </div>
          <div
            onClick={(): void => setSidebarTab('history')}
            className={`pb-2 text-xs font-bold uppercase tracking-wider cursor-pointer border-b-2 transition-all ${sidebarTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'}`}
          >
            History
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
          {sidebarTab === 'collections' ? (
            <div className="px-2 py-2 space-y-0.5">
              <div className="p-2 shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 text-muted" size={13} />
                  <input
                    type="text"
                    placeholder="Search collections..."
                    value={searchQuery}
                    onChange={(e): void => setSearchQuery(e.target.value)}
                    className="w-full bg-background border border-border rounded text-xs pl-8 pr-3 py-2 text-text placeholder-muted focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <div className="px-2 pb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">
                  List
                </span>
                {activeTeam && (
                  <div className="flex items-center gap-2">
                    <ImportModal />
                    <button
                      onClick={handleNewCollection}
                      title="New Collection"
                      className="text-muted hover:text-text transition-colors"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                )}
              </div>

              {collectionsLoading ? (
                <div className="flex items-center justify-center py-8 text-muted">
                  <RefreshCw size={16} className="animate-spin mr-2" />
                  <span className="text-xs">Loading...</span>
                </div>
              ) : filteredCollections.length === 0 ? (
                <div className="text-xs text-muted px-2 py-4 text-center italic">
                  {activeTeamId ? 'No collections.' : 'Select a team.'}
                </div>
              ) : (
                filteredCollections.map((collection) => (
                  <CollectionItem key={collection.id} collection={collection} />
                ))
              )}
            </div>
          ) : (
            <div className="px-2 py-2 space-y-0.5">
              <div className="px-2 py-2 flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">
                  Recent Activity
                </span>
                <button
                  onClick={(): void => {
                    if (window.confirm('Clear history?')) clearHistory()
                  }}
                  className="text-muted hover:text-danger transition-colors"
                  title="Clear All"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {historyLoading ? (
                <div className="flex items-center justify-center py-8 text-muted">
                  <RefreshCw size={16} className="animate-spin mr-2" />
                  <span className="text-xs">Loading...</span>
                </div>
              ) : history.length === 0 ? (
                <div className="text-xs text-muted px-2 py-8 text-center italic flex flex-col items-center gap-2">
                  <Clock size={24} className="opacity-20" />
                  No execution history yet.
                </div>
              ) : (
                <div className="space-y-1">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="px-2 py-2 rounded hover:bg-background cursor-pointer group flex flex-col gap-0.5 border-l-2 border-transparent hover:border-primary/50"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[10px] font-black ${METHOD_COLORS[h.method] ?? 'text-muted'}`}
                        >
                          {h.method}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-muted">{formatTime(h.created_at)}</span>
                          {h.user && (
                            <div className="w-3.5 h-3.5 rounded-full bg-primary/20 flex items-center justify-center text-[7px] font-bold text-primary">
                              {h.user.name.charAt(0)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] text-text truncate font-mono">{h.url}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span
                          className={`text-[9px] font-bold ${h.status_code >= 200 && h.status_code < 300 ? 'text-success' : 'text-danger'}`}
                        >
                          {h.status_code || 'Err'}
                        </span>
                        <span className="text-[9px] text-muted">{h.response_time}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer: Environment + User */}
      <div className="border-t border-border shrink-0">
        {/* Environment selector */}
        <div className="px-3 py-2 border-b border-border">
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-1 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Hash size={11} />
              Environment
            </div>
            <EnvironmentModal />
          </div>
          {environments.length > 0 ? (
            <select
              value={activeEnvironmentId ?? ''}
              onChange={(e): void => setActiveEnvironment(Number(e.target.value))}
              className="w-full bg-background border border-border rounded text-xs px-2 py-1.5 text-text focus:outline-none focus:border-primary"
            >
              {environments.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-xs text-muted italic">{activeEnvironment?.name ?? 'No env'}</div>
          )}
        </div>

        {/* User info + Logout */}
        <div className="px-3 py-2.5 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-xs font-medium text-text truncate">{user?.name}</div>
            <div className="text-[10px] text-muted truncate">{user?.email}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <button title="Settings" className="text-muted hover:text-text transition-colors">
              <Settings size={14} />
            </button>
            <button
              onClick={logout}
              title="Logout"
              className="text-muted hover:text-danger transition-colors"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
