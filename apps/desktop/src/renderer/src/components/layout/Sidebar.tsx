import {
  Folder as FolderIcon,
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
  Trash2,
  Download,
  Copy,
  BookOpen,
  Server,
  Edit,
  Play,
  PlayCircle,
  X
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { useDataStore, CollectionRunResult } from '../../store/useDataStore'
import { useAppStore } from '../../store/useAppStore'
import type { Collection, ApiRequest, Folder, RequestExample } from '../../types'
import { ImportModal } from '../modals/ImportModal'
import { EnvironmentModal } from '../modals/EnvironmentModal'
import { PromptModal } from '../modals/PromptModal'
import { ServerSettingsModal } from '../modals/ServerSettingsModal'
import { DocumentationPanel } from './DocumentationPanel'
import { MockServerPanel } from './MockServerPanel'

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-success',
  POST: 'text-warning',
  PUT: 'text-info',
  PATCH: 'text-secondary',
  DELETE: 'text-danger',
  HEAD: 'text-muted',
  OPTIONS: 'text-muted'
}

interface ContextMenuProps {
  x: number
  y: number
  onClose: () => void
  items: {
    label: string
    icon: React.ElementType
    onClick: () => void | Promise<void>
    variant?: 'default' | 'danger'
  }[]
}

const ContextMenu = ({ x, y, onClose, items }: ContextMenuProps): React.JSX.Element => {
  useEffect(() => {
    const handleClick = (): void => onClose()
    window.addEventListener('click', handleClick)
    return (): void => window.removeEventListener('click', handleClick)
  }, [onClose])

  return (
    <div
      className="fixed z-[100] w-48 bg-surface border border-border rounded-md shadow-xl py-1 animate-in fade-in zoom-in duration-100"
      style={{ top: y, left: x }}
      onClick={(e): void => e.stopPropagation()}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={(): void => {
            item.onClick()
            onClose()
          }}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
            item.variant === 'danger'
              ? 'text-danger hover:bg-danger/10'
              : 'text-text hover:bg-background'
          }`}
        >
          <item.icon size={13} className="shrink-0" />
          {item.label}
        </button>
      ))}
    </div>
  )
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
  const { expandedItems, toggleExpand } = useDataStore()
  const isExpanded = !!expandedItems[`folder-${folder.id}`]
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [promptType, setPromptType] = useState<'request' | 'folder' | null>(null)

  const {
    requestsByFolder,
    openRequestInTab,
    createRequest,
    createFolder,
    deleteFolder,
    deleteRequest
  } = useDataStore()
  const { setActiveView } = useAppStore()

  const requests = requestsByFolder[folder.id] || []
  const subFolders = allFolders.filter((f) => f.parent_folder_id === folder.id)

  const handleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleSelectRequest = (req: ApiRequest): void => {
    openRequestInTab(req)
    setActiveView('request-builder')
  }

  const handleAddRequest = (): void => setPromptType('request')
  const handleAddFolder = (): void => setPromptType('folder')

  const handleDeleteFolder = (): void => {
    if (window.confirm(`Delete folder "${folder.name}" and all its contents?`)) {
      deleteFolder(folder.id)
    }
  }

  const handleDeleteRequest = (req: ApiRequest): void => {
    if (window.confirm(`Delete request "${req.name}"?`)) {
      deleteRequest(req.id)
    }
  }

  const handleDuplicateRequest = (req: ApiRequest): void => {
    createRequest(collectionId, folder.id, `${req.name} (Copy)`, {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      auth_config: req.auth_config
    })
  }

  return (
    <div>
      <div
        onClick={(): void => toggleExpand(`folder-${folder.id}`)}
        onContextMenu={handleContextMenu}
        className={`flex items-center px-2 py-1.5 rounded hover:bg-background cursor-pointer text-xs text-text group ${contextMenu ? 'bg-background' : ''}`}
      >
        {isExpanded ? (
          <ChevronDown size={12} className="text-muted mr-1 shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-muted mr-1 shrink-0" />
        )}
        <Hash size={12} className="text-muted mr-2 shrink-0" />
        <span className="truncate flex-1">{folder.name}</span>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={(): void => setContextMenu(null)}
          items={[
            { label: 'Add Request', icon: FilePlus, onClick: handleAddRequest },
            { label: 'Add Folder', icon: FolderPlus, onClick: handleAddFolder },
            { label: 'Delete Folder', icon: Trash2, onClick: handleDeleteFolder, variant: 'danger' }
          ]}
        />
      )}

      <PromptModal
        isOpen={promptType !== null}
        title={promptType === 'request' ? 'New Request' : 'New Folder'}
        placeholder={promptType === 'request' ? 'Request name...' : 'Folder name...'}
        onClose={(): void => setPromptType(null)}
        onSubmit={(val): void => {
          console.log('[Sidebar] Prompt submitted:', val, 'for type:', promptType)
          if (promptType === 'request') {
            createRequest(collectionId, folder.id, val)
            setActiveView('request-builder')
          } else {
            createFolder(collectionId, folder.id, val)
          }
          toggleExpand(`folder-${folder.id}`)
        }}
      />

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
            <RequestItem
              key={req.id}
              request={req}
              onSelect={handleSelectRequest}
              onDelete={handleDeleteRequest}
              onDuplicate={handleDuplicateRequest}
            />
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

const ExampleItem = ({ example }: { example: RequestExample }): React.JSX.Element => {
  const { openExample, deleteExample } = useDataStore()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const handleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  return (
    <>
      <div
        onClick={() => {
          openExample(example)
          useAppStore.getState().setActiveView('request-builder')
        }}
        onContextMenu={handleContextMenu}
        className={`flex items-center px-2 py-1 rounded hover:bg-background cursor-pointer text-xs text-text ${contextMenu ? 'bg-background' : ''}`}
      >
        <span className="text-[9px] font-bold text-muted mr-2 bg-surface px-1 py-0.5 rounded">E</span>
        <span className="truncate text-muted hover:text-text transition-colors">{example.name}</span>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={(): void => setContextMenu(null)}
          items={[
            {
              label: 'Delete',
              icon: Trash2,
              onClick: (): void => {
                deleteExample(example.id)
              },
              variant: 'danger'
            }
          ]}
        />
      )}
    </>
  )
}

const RequestItem = ({
  request,
  onSelect,
  onDelete,
  onDuplicate
}: {
  request: ApiRequest
  onSelect: (req: ApiRequest) => void
  onDelete: (req: ApiRequest) => void
  onDuplicate: (req: ApiRequest) => void
}): React.JSX.Element => {
  const { expandedItems, toggleExpand, renameRequest } = useDataStore()
  const isExpanded = !!expandedItems[`request-${request.id}`]
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)

  const handleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const hasExamples = request.examples && request.examples.length > 0

  return (
    <div>
      <div
        onClick={(): void => {
          if (hasExamples) {
            toggleExpand(`request-${request.id}`)
          } else {
            onSelect(request)
          }
        }}
        onDoubleClick={(): void => onSelect(request)}
        onContextMenu={handleContextMenu}
        className={`flex items-center px-2 py-1 rounded hover:bg-background cursor-pointer text-xs text-text ${contextMenu ? 'bg-background' : ''}`}
      >
        {hasExamples ? (
          isExpanded ? (
            <ChevronDown size={12} className="text-muted mr-1 shrink-0" />
          ) : (
            <ChevronRight size={12} className="text-muted mr-1 shrink-0" />
          )
        ) : (
          <div className="w-4 h-4 shrink-0" />
        )}
        <span
          className={`text-[9px] font-bold mr-2 w-8 text-right shrink-0 ${METHOD_COLORS[request.method] ?? 'text-muted'}`}
        >
          {request.method}
        </span>
        <span className="truncate flex-1" onClick={(e) => {
          // If we clicked the name directly, let's select it even if it has examples
          e.stopPropagation()
          onSelect(request)
        }}>{request.name}</span>

        {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={(): void => setContextMenu(null)}
          items={[
            { label: 'Duplicate', icon: Copy, onClick: (): void => onDuplicate(request) },
            {
              label: 'Rename',
              icon: Edit,
              onClick: (): void => setIsRenaming(true)
            },
            {
              label: 'Delete',
              icon: Trash2,
              onClick: (): void => onDelete(request),
              variant: 'danger'
            }
          ]}
        />
      )}

      {isRenaming && (
        <PromptModal
          title="Rename Request"
          defaultValue={request.name}
          isOpen={isRenaming}
          onClose={() => setIsRenaming(false)}
          onSubmit={(name) => renameRequest(request.id, name)}
          submitText="Save"
        />
      )}
      </div>

      {isExpanded && hasExamples && (
        <div className="ml-6 pl-2 border-l border-border/50 space-y-0.5 py-0.5">
          {request.examples?.map((ex) => (
            <ExampleItem key={ex.id} example={ex} />
          ))}
        </div>
      )}
    </div>
  )
}

interface CollectionItemProps {
  collection: Collection
}

const CollectionItem = ({ collection }: CollectionItemProps): React.JSX.Element => {
  const {
    expandedItems,
    toggleExpand,
    fetchCollectionContents,
    requestsByCollection,
    foldersByCollection,
    openRequestInTab,
    createRequest,
    createFolder,
    deleteCollection,
    deleteRequest,
    exportCollection,
    runCollection
  } = useDataStore()
  const { setActiveView } = useAppStore()

  const isExpanded = !!expandedItems[`collection-${collection.id}`]
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [promptType, setPromptType] = useState<'request' | 'folder' | null>(null)
  const [showDocs, setShowDocs] = useState(false)
  const [showMockServer, setShowMockServer] = useState(false)
  const [showRunner, setShowRunner] = useState(false)
  const [runnerState, setRunnerState] = useState<'idle' | 'running' | 'finished'>('idle')
  const [runResults, setRunResults] = useState<CollectionRunResult[]>([])
  const [currentRunningRequest, setCurrentRunningRequest] = useState<string | null>(null)

  const handleExpand = async (): Promise<void> => {
    if (!isExpanded && !requestsByCollection[collection.id]) {
      await fetchCollectionContents(collection.id)
    }
    toggleExpand(`collection-${collection.id}`)
  }

  const handleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleAddRequest = (): void => setPromptType('request')
  const handleAddFolder = (): void => setPromptType('folder')

  const handleDeleteCollection = (): void => {
    if (window.confirm(`Delete collection "${collection.name}"? This cannot be undone.`)) {
      deleteCollection(collection.id)
    }
  }

  const handleDeleteRequest = (req: ApiRequest): void => {
    if (window.confirm(`Delete request "${req.name}"?`)) {
      deleteRequest(req.id)
    }
  }

  const handleDuplicateRequest = (req: ApiRequest): void => {
    createRequest(collection.id, null, `${req.name} (Copy)`, {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      auth_config: req.auth_config
    })
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
        onContextMenu={handleContextMenu}
        className={`flex items-center px-2 py-1.5 rounded hover:bg-background cursor-pointer text-sm text-text group ${contextMenu ? 'bg-background' : ''}`}
      >
        {isExpanded ? (
          <ChevronDown size={14} className="text-muted mr-1 shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-muted mr-1 shrink-0" />
        )}
        <FolderIcon size={14} className="text-primary mr-2 shrink-0" />
        <span className="truncate flex-1 font-medium">{collection.name}</span>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={(): void => setContextMenu(null)}
          items={[
            { label: 'Add Request', icon: FilePlus, onClick: handleAddRequest },
            { label: 'Add Folder', icon: FolderPlus, onClick: handleAddFolder },
            {
              label: 'Run Collection',
              icon: PlayCircle,
              onClick: (): void => setShowRunner(true)
            },
            {
              label: 'View Documentation',
              icon: BookOpen,
              onClick: (): void => setShowDocs(true)
            },
            {
              label: 'Mock Server',
              icon: Server,
              onClick: (): void => setShowMockServer(true)
            },
            {
              label: 'Export Collection',
              icon: Download,
              onClick: (): Promise<void> => exportCollection(collection.id)
            },
            {
              label: 'Delete Collection',
              icon: Trash2,
              onClick: handleDeleteCollection,
              variant: 'danger'
            }
          ]}
        />
      )}

      {showDocs && (
        <DocumentationPanel
          collectionId={collection.id}
          collectionName={collection.name}
          onClose={() => setShowDocs(false)}
        />
      )}

      {showMockServer && (
        <MockServerPanel
          collectionId={collection.id}
          collectionName={collection.name}
          requests={requests}
          onClose={() => setShowMockServer(false)}
        />
      )}

      {showRunner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 h-[600px]">
             <div className="p-4 border-b border-border flex items-center justify-between bg-white/5">
                <h2 className="text-base font-bold flex items-center gap-2">
                  <PlayCircle size={18} className="text-primary" />
                  Collection Runner: {collection.name}
                </h2>
                <button 
                  onClick={() => {
                    if (runnerState === 'running') {
                      if (!confirm('Run is in progress. Close anyway?')) return
                    }
                    setShowRunner(false)
                    setRunnerState('idle')
                    setRunResults([])
                  }} 
                  className="text-muted hover:text-text transition-colors"
                >
                  <X size={18} />
                </button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-6">
                {runnerState === 'idle' && (
                  <div className="text-center space-y-4 py-12">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Play size={32} className="text-primary translate-x-0.5" />
                    </div>
                    <h3 className="text-lg font-semibold">Ready to start?</h3>
                    <p className="text-muted text-sm leading-relaxed max-w-sm mx-auto">
                      This will execute all {requests.length} requests in this collection sequentially using the active environment variables.
                    </p>
                    <div className="pt-6">
                      <button 
                        onClick={async () => {
                          setRunnerState('running')
                          setRunResults([])
                          await runCollection(collection.id, (result) => {
                            setRunResults(prev => [...prev, result])
                            setCurrentRunningRequest(result.name)
                          })
                          setRunnerState('finished')
                          setCurrentRunningRequest(null)
                        }}
                        className="px-12 py-3 bg-primary text-white rounded-lg font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95"
                      >
                        Run Collection
                      </button>
                    </div>
                  </div>
                )}

                {(runnerState === 'running' || runnerState === 'finished') && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="space-y-1">
                        <div className="text-xs font-bold uppercase tracking-wider text-muted">Progress</div>
                        <div className="text-sm font-medium">
                          {runnerState === 'running' ? `Running: ${currentRunningRequest}` : 'Run Finished'}
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-xs font-bold uppercase tracking-wider text-muted">Results</div>
                        <div className="text-sm font-bold flex items-center gap-3">
                          <span className="text-success">{runResults.filter(r => r.status >= 200 && r.status < 300).length} Passed</span>
                          <span className="text-danger">{runResults.filter(r => r.status === 0 || r.status >= 400).length} Failed</span>
                        </div>
                      </div>
                    </div>

                    <div className="w-full bg-background rounded-full h-2 overflow-hidden border border-border">
                      <div 
                        className="bg-primary h-full transition-all duration-300"
                        style={{ width: `${(runResults.length / (requests.length || 1)) * 100}%` }}
                      />
                    </div>

                    <div className="space-y-2 pt-4">
                      {runResults.map((result, idx) => (
                        <div key={idx} className="bg-background/50 border border-border/50 rounded-lg p-3 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${METHOD_COLORS[result.method] ?? 'bg-muted/20 text-muted'}`}>
                                {result.method}
                              </span>
                              <span className="text-xs font-medium">{result.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-xs font-mono ${result.status >= 200 && result.status < 300 ? 'text-success' : 'text-danger'}`}>
                                {result.status || 'ERROR'}
                              </span>
                              <span className="text-[10px] text-muted font-mono">{result.time}ms</span>
                            </div>
                          </div>
                          
                          {result.testResults.length > 0 && (
                            <div className="grid grid-cols-1 gap-1 pl-4 border-l border-border mt-1">
                              {result.testResults.map((test, tidx) => (
                                <div key={tidx} className="flex items-center gap-2 text-[10px]">
                                  {test.status === 'passed' ? (
                                    <div className="w-2 h-2 rounded-full bg-success shrink-0" />
                                  ) : (
                                    <div className="w-2 h-2 rounded-full bg-danger shrink-0" />
                                  )}
                                  <span className={test.status === 'passed' ? 'text-text/70' : 'text-danger font-medium'}>
                                    {test.name} {test.error && `(${test.error})`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
             </div>

             <div className="p-4 bg-black/20 flex items-center justify-between border-t border-border/50">
                <div className="text-[9px] text-muted font-mono uppercase tracking-widest">
                  Wapify Engine v1.0 Stable
                </div>
                {runnerState === 'finished' && (
                  <button 
                    onClick={() => {
                      setRunnerState('idle')
                      setRunResults([])
                    }}
                    className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wider"
                  >
                    Run Again
                  </button>
                )}
             </div>
          </div>
        </div>
      )}

      <PromptModal
        isOpen={promptType !== null}
        title={promptType === 'request' ? 'New Request' : 'New Folder'}
        placeholder={promptType === 'request' ? 'Request name...' : 'Folder name...'}
        onClose={(): void => setPromptType(null)}
        onSubmit={(val): void => {
          console.log('[Sidebar] Collection root prompt submitted:', val, 'for type:', promptType)
          if (promptType === 'request') {
            createRequest(collection.id, null, val)
            setActiveView('request-builder')
          } else {
            createFolder(collection.id, null, val)
          }
          toggleExpand(`collection-${collection.id}`)
        }}
      />

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
            <RequestItem
              key={req.id}
              request={req}
              onSelect={handleSelectRequest}
              onDelete={handleDeleteRequest}
              onDuplicate={handleDuplicateRequest}
            />
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
  const [showServerSettings, setShowServerSettings] = useState(false)
  const [appVersion, setAppVersion] = useState<string>('')

  useEffect(() => {
    window.api.getAppVersion().then(setAppVersion)
  }, [])

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
  const [isNewCollectionModalOpen, setIsNewCollectionModalOpen] = useState(false)

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
    setIsNewCollectionModalOpen(true)
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
          <div className="text-xs font-bold text-text/60 uppercase tracking-widest mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Users size={12} />
              Teams
            </div>
            <button
              onClick={(): void => {
                const name = window.prompt('Team Name:')
                if (name) {
                  try {
                    const desc = window.prompt('Description (Optional):', '')
                    createTeam(name, desc || '')
                  } catch (err: unknown) {
                    console.error(err)
                  }
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
                <span className="text-[10px] font-black text-text/50 uppercase tracking-[0.2em]">
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
                <span className="text-[10px] font-black text-text/50 uppercase tracking-[0.2em]">
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
                      onClick={(): void => useAppStore.getState().setActiveHistoryId(h.id)}
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
              onChange={(e): void => {
                const val = e.target.value
                setActiveEnvironment(val === '' ? null : Number(val))
              }}
              className="w-full bg-background border border-border rounded text-xs px-2 py-1.5 text-text focus:outline-none focus:border-primary"
            >
              <option value="">No Environment</option>
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
        <div className="px-3 py-2 flex flex-col gap-1 border-t border-border/50 bg-background/50">
          {appVersion && (
            <div className="px-1 text-[9px] font-black uppercase tracking-[0.2em] text-muted/70 mb-1">
              Wapify v{appVersion}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-xs font-bold text-text truncate">{user?.name}</div>
              <div className="text-[10px] text-muted font-medium truncate">{user?.email}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <button 
                onClick={() => setShowServerSettings(true)}
                title="Server Configuration" 
                className="text-muted hover:text-text transition-colors"
              >
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

      {showServerSettings && <ServerSettingsModal onClose={() => setShowServerSettings(false)} />}

      <PromptModal
        title="New Collection"
        placeholder="Collection name..."
        isOpen={isNewCollectionModalOpen}
        onClose={(): void => setIsNewCollectionModalOpen(false)}
        onSubmit={(val) => { createCollection(val) }}
      />
    </div>
  )
}
