import {
  Folder as FolderIcon,
  Plus,
  Search,
  Settings,
  ChevronRight,
  ChevronDown,
  Hash,
  LogOut,
  Users,
  ShieldCheck,
  UserCog,
  Building2,
  LayoutDashboard,
  FilePlus,
  FolderPlus,
  Trash2,
  PlayCircle,
  BookOpen,
  Server,
  Edit,
  X,
  Download,
  Copy,
  GripVertical, Key, DatabaseZap,
  Zap, Heart, ListTree
} from 'lucide-react'
import { useState, useEffect, useLayoutEffect, useMemo } from 'react'
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDroppable
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { useAuthStore } from '../../store/useAuthStore'
import { useDataStore } from '../../store/useDataStore'
import { useAppStore } from '../../store/useAppStore'
import { ContextMenu } from '../ui/ContextMenu'
import { ImportModal } from '../modals/ImportModal'
import { PromptModal } from '../modals/PromptModal'
import { EnvironmentModal } from '../modals/EnvironmentModal'
import { ServerSettingsModal } from '../modals/ServerSettingsModal'
import { ChangePasswordModal } from "../modals/ChangePasswordModal"
import { StandaloneMockPanel } from "./StandaloneMockPanel"
import { DocumentationPanel } from './DocumentationPanel'
import { MockServerPanel } from './MockServerPanel'
import type { ApiRequest, Collection, Folder, RequestExample } from '../../types'

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-success',
  POST: 'text-warning',
  PUT: 'text-info',
  PATCH: 'text-secondary',
  DELETE: 'text-danger'
}

const CollectionHeader = ({ collection, isExpanded, onExpand, onContextMenu }: {
  collection: Collection,
  isExpanded: boolean,
  onExpand: () => void,
  onContextMenu: (e: React.MouseEvent) => void
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `collection-${collection.id}`,
  })

  return (
    <div
      ref={setNodeRef}
      onClick={onExpand}
      onContextMenu={onContextMenu}
      className={`flex items-center px-2 py-1.5 rounded hover:bg-background cursor-pointer text-sm text-text group transition-all duration-200 ${isOver ? 'bg-primary/20 ring-1 ring-primary/50' : ''}`}
    >
      {isExpanded ? (
        <ChevronDown size={14} className="text-muted mr-1 shrink-0" />
      ) : (
        <ChevronRight size={14} className="text-muted mr-1 shrink-0" />
      )}
      <FolderIcon size={14} className="text-primary mr-2 shrink-0" />
      <span className="truncate flex-1 font-medium">{collection.name}</span>
    </div>
  )
}

interface SortableItemProps {
  id: string
  children: React.ReactNode
  disabled?: boolean
  type?: 'folder' | 'request'
}

const SortableItem = ({ id, children, disabled, type = 'request' }: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
    over
  } = useSortable({ id, disabled })

  const [dropMode, setDropMode] = useState<'sort-top' | 'sort-bottom' | 'nest' | null>(null)

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isOver || isDragging) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // LOGIC: Left 30% of the width is ALWAYS sorting
    const isLeftSide = x < rect.width * 0.3

    if (type === 'folder') {
      if (isLeftSide) {
        if (y < rect.height / 2) setDropMode('sort-top')
        else setDropMode('sort-bottom')
      } else {
        setDropMode('nest')
      }
    } else {
      if (y < rect.height / 2) setDropMode('sort-top')
      else setDropMode('sort-bottom')
    }
  }

  const handleMouseLeave = () => setDropMode(null)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 100 : 'auto'
  }

  const isOverSelf = isOver && over?.id === id

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group/sortable"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Visual Indicators */}
      {isOverSelf && !isDragging && (
        <>
          {dropMode === 'sort-top' && (
            <div className="absolute -top-0.5 left-0 right-0 h-0.5 bg-info z-30 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          )}
          {dropMode === 'sort-bottom' && (
            <div className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-info z-30 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          )}
          {dropMode === 'nest' && type === 'folder' && (
            <div className="absolute inset-0 bg-primary/20 border border-primary/40 rounded z-10 pointer-events-none" />
          )}
        </>
      )}

      <div
        {...attributes}
        {...listeners}
        className="absolute left-[-10px] top-1.5 opacity-0 group-hover/sortable:opacity-40 cursor-grab active:cursor-grabbing p-1 z-20"
      >
        <GripVertical size={10} />
      </div>
      <div className="relative z-20">
        {children}
      </div>
    </div>
  )
}

interface RequestItemProps {
  request: ApiRequest
  onSelect: (request: ApiRequest) => void
  onDelete: (request: ApiRequest) => void
  onDuplicate: (request: ApiRequest) => void
}

const RequestItem = ({
  request,
  onSelect,
  onDelete,
  onDuplicate
}: RequestItemProps): React.JSX.Element => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const { expandedItems, toggleExpand, renameRequest } = useDataStore()

  const isExpanded = !!expandedItems[`request-${request.id}`]

  const handleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const hasExamples = request.examples && request.examples.length > 0

  return (
    <SortableItem id={`request-${request.id}`}>
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
    </SortableItem>
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
        className="flex items-center px-2 py-1 rounded hover:bg-background cursor-pointer text-[11px] text-muted hover:text-text group"
      >
        <div className="w-4 h-4 shrink-0 flex items-center justify-center mr-1">
          <ChevronRight size={10} className="opacity-0 group-hover:opacity-100" />
        </div>
        <span className="truncate flex-1">Example: {example.name}</span>
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            items={[
              {
                label: 'Delete Example',
                icon: Trash2,
                onClick: () => {
                  if (confirm('Delete this example?')) deleteExample(example.id)
                },
                variant: 'danger'
              }
            ]}
          />
        )}
      </div>
    </>
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
  const {
    expandedItems,
    toggleExpand,
    requestsByFolder,
    openRequestInTab,
    createRequest,
    createFolder,
    deleteFolder,
    deleteRequest,
    duplicateRequest
  } = useDataStore()
  const { setActiveView } = useAppStore()

  const requests = requestsByFolder[folder.id] || []
  const subFolders = allFolders.filter((f) => f.parent_folder_id === folder.id)
  const isExpanded = !!expandedItems[`folder-${folder.id}`]
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [promptType, setPromptType] = useState<'request' | 'folder' | null>(null)

  const handleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleAddRequest = (): void => setPromptType('request')
  const handleAddFolder = (): void => setPromptType('folder')

  const handleDeleteFolder = (): void => {
    if (window.confirm(`Delete folder "${folder.name}"? All content inside will be deleted.`)) {
      deleteFolder(folder.id)
    }
  }

  const handleDeleteRequest = (req: ApiRequest): void => {
    if (window.confirm(`Delete request "${req.name}"?`)) {
      deleteRequest(req.id)
    }
  }

  const handleDuplicateRequest = (req: ApiRequest): void => {
    duplicateRequest(req.id)
  }

  const handleSelectRequest = (req: ApiRequest): void => {
    openRequestInTab(req)
    setActiveView('request-builder')
  }

  const sortableIds = useMemo(() => {
    return [
      ...subFolders.map(f => `folder-${f.id}`),
      ...requests.map(r => `request-${r.id}`)
    ]
  }, [subFolders, requests])

  return (
    <SortableItem id={`folder-${folder.id}`} type="folder">
      <div>
        <div
          onClick={(): void => toggleExpand(`folder-${folder.id}`)}
          onContextMenu={handleContextMenu}
          className={`flex items-center px-2 py-1 rounded hover:bg-background cursor-pointer text-xs text-text group ${contextMenu ? 'bg-background' : ''}`}
        >
          {isExpanded ? (
            <ChevronDown size={12} className="text-muted mr-1 shrink-0" />
          ) : (
            <ChevronRight size={12} className="text-muted mr-1 shrink-0" />
          )}
          <FolderIcon size={12} className="text-muted mr-2 shrink-0" />
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

        {promptType !== null && (
          <PromptModal
            isOpen={promptType !== null}
            title={promptType === 'request' ? 'New Request' : 'New Folder'}
            placeholder={promptType === 'request' ? 'Request name...' : 'Folder name...'}
            onClose={(): void => setPromptType(null)}
            onSubmit={(val): void => {
              if (promptType === 'request') {
                createRequest(collectionId, folder.id, val)
                setActiveView('request-builder')
              } else {
                createFolder(collectionId, folder.id, val)
              }
            }}
          />
        )}

        {isExpanded && (
          <div className="ml-2 pl-2 border-l border-border/50 space-y-0.5 py-1">
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {subFolders.map((sub) => (
                <FolderItem
                  key={sub.id}
                  folder={sub}
                  collectionId={collectionId}
                  allFolders={allFolders}
                />
              ))}
              {requests.map((req) => (
                <RequestItem
                  key={req.id}
                  request={req}
                  onSelect={handleSelectRequest}
                  onDelete={handleDeleteRequest}
                  onDuplicate={handleDuplicateRequest}
                />
              ))}
            </SortableContext>
            {subFolders.length === 0 && requests.length === 0 && (
              <div className="text-[10px] text-muted px-2 py-1 italic opacity-50 text-center">Empty</div>
            )}
          </div>
        )}
      </div>
    </SortableItem>
  )
}

const CollectionItem = ({ collection }: { collection: Collection }): React.JSX.Element => {
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
    duplicateRequest,
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
  const [runResults, setRunResults] = useState<any[]>([])

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
    duplicateRequest(req.id)
  }

  const handleSelectRequest = (req: ApiRequest): void => {
    openRequestInTab(req)
    setActiveView('request-builder')
  }

  const requests: ApiRequest[] = requestsByCollection[collection.id] ?? []
  const allFolders: Folder[] = foldersByCollection[collection.id] ?? []
  const rootFolders = allFolders.filter((f) => f.parent_folder_id === null)

  const sortableIds = useMemo(() => {
    return [
      `collection-${collection.id}`,
      ...rootFolders.map(f => `folder-${f.id}`),
      ...requests.map(r => `request-${r.id}`)
    ]
  }, [collection.id, rootFolders, requests])

  return (
    <div>
      <CollectionHeader
        collection={collection}
        isExpanded={isExpanded}
        onExpand={handleExpand}
        onContextMenu={handleContextMenu}
      />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={(): void => setContextMenu(null)}
          items={[
            { label: 'Add Request', icon: FilePlus, onClick: handleAddRequest },
            { label: 'Add Folder', icon: FolderPlus, onClick: handleAddFolder },
            { label: 'Run Collection', icon: PlayCircle, onClick: (): void => setShowRunner(true) },
            { label: 'View Documentation', icon: BookOpen, onClick: (): void => setShowDocs(true) },
            { label: 'Mock Server', icon: Server, onClick: (): void => setShowMockServer(true) },
            { label: 'Export Collection', icon: Download, onClick: (): Promise<void> => exportCollection(collection.id) },
            { label: 'Delete Collection', icon: Trash2, onClick: handleDeleteCollection, variant: 'danger' }
          ]}
        />
      )}

      {showDocs && <DocumentationPanel collectionId={collection.id} collectionName={collection.name} onClose={() => setShowDocs(false)} />}

      {showMockServer && <MockServerPanel collectionId={collection.id} collectionName={collection.name} requests={requests} onClose={() => setShowMockServer(false)} />}

      {showRunner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden h-[600px]">
            <div className="p-4 border-b border-border flex items-center justify-between bg-white/5">
              <h2 className="text-base font-bold flex items-center gap-2">
                <PlayCircle size={18} className="text-primary" /> Collection Runner: {collection.name}
              </h2>
              <button onClick={() => setShowRunner(false)} className="text-muted hover:text-text transition-colors"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {runnerState === 'idle' ? (
                <div className="text-center py-12">
                  <button
                    onClick={async () => {
                      setRunnerState('running')
                      await runCollection(collection.id, (res) => setRunResults(p => [...p, res]))
                      setRunnerState('finished')
                    }}
                    className="px-12 py-3 bg-primary text-white rounded-lg font-bold shadow-lg"
                  >Run Collection</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {runResults.map((r, i) => (
                    <div key={i} className="bg-background/50 border border-border/50 rounded-lg p-3">
                      <span className="text-xs font-bold mr-2 uppercase tracking-widest">{r.method}</span>
                      <span className="text-xs">{r.name}</span>
                      <span className={`float-right text-xs ${r.status < 300 ? 'text-success' : 'text-danger'}`}>{r.status} ({r.time}ms)</span>
                    </div>
                  ))}
                </div>
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
          if (promptType === 'request') createRequest(collection.id, null, val)
          else createFolder(collection.id, null, val)
          toggleExpand(`collection-${collection.id}`)
        }}
      />

      {isExpanded && (
        <div className="ml-4 pl-3 border-l border-border space-y-0.5 py-1">
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            {rootFolders.map((f) => <FolderItem key={f.id} folder={f} collectionId={collection.id} allFolders={allFolders} />)}
            {requests.map((r) => <RequestItem key={r.id} request={r} onSelect={handleSelectRequest} onDelete={handleDeleteRequest} onDuplicate={handleDuplicateRequest} />)}
          </SortableContext>
          {rootFolders.length === 0 && requests.length === 0 && <div className="text-xs text-muted px-2 py-1 italic text-center opacity-50">Empty</div>}
        </div>
      )}
    </div>
  )
}

export const Sidebar = (): React.JSX.Element => {
  const { user, logout } = useAuthStore()
  const [showServerSettings, setShowServerSettings] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showStandaloneMock, setShowStandaloneMock] = useState(false)
  const [appVersion, setAppVersion] = useState<string>('')

  const {
    teams,
    activeTeamId,
    collections,
    collectionsLoading,
    fetchTeams,
    setActiveTeam,
    environments,
    activeEnvironmentId,
    setActiveEnvironment,
    createCollection,
    history,
    clearHistory,
    collapseAll
  } = useDataStore()

  const { activeView, setActiveView } = useAppStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<'collections' | 'history'>('collections')
  const [isNewCollectionModalOpen, setIsNewCollectionModalOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  useLayoutEffect(() => {
    window.api.getAppVersion().then(setAppVersion)
  }, [])

  useEffect(() => { fetchTeams() }, [fetchTeams])

  useEffect(() => {
    const handleOpenSettings = () => setShowServerSettings(true)
    const handleOpenMock = () => setShowStandaloneMock(true)

    window.addEventListener('wapbolt:open-settings', handleOpenSettings)
    window.addEventListener('wapbolt:open-standalone-mock', handleOpenMock)

    return () => {
      window.removeEventListener('wapbolt:open-settings', handleOpenSettings)
      window.removeEventListener('wapbolt:open-standalone-mock', handleOpenMock)
    }
  }, [])

  const activeTeam = teams.find((t) => t.id === activeTeamId)
  const filteredCollections = collections.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeIdStr = active.id.toString()
    const overIdStr = over.id.toString()

    const isRequest = activeIdStr.startsWith('request-')
    const entityId = parseInt(activeIdStr.split('-')[1])

    const state = useDataStore.getState()
    const allRequests = state.requests
    const allFolders = Object.values(state.foldersByCollection).flat()

    // DETECT DROP ZONE PRECISELY USING POINTER COORDINATES
    const overRect = over.rect
    const pointer = (event.activatorEvent as MouseEvent)
    const pointerX = pointer.clientX + (event.delta.x || 0)
    const pointerY = pointer.clientY + (event.delta.y || 0)

    let dropZone: 'sort-top' | 'sort-bottom' | 'nest' = 'sort-bottom'

    if (overRect) {
      const relativeX = pointerX - overRect.left
      const relativeY = pointerY - overRect.top
      const isLeftSide = relativeX < (overRect.width * 0.3)

      if (overIdStr.startsWith('folder-')) {
        if (isLeftSide) {
          dropZone = relativeY < overRect.height / 2 ? 'sort-top' : 'sort-bottom'
        } else {
          dropZone = 'nest'
        }
      } else {
        dropZone = relativeY < overRect.height / 2 ? 'sort-top' : 'sort-bottom'
      }
    }

    if (isRequest) {
      const targetFold = allFolders.find(f => `folder-${f.id}` === overIdStr)
      const targetColl = state.collections.find(c => `collection-${c.id}` === overIdStr)
      const targetReq = allRequests.find(r => `request-${r.id}` === overIdStr)

      // ACTION: NEST INSIDE FOLDER
      if (targetFold && dropZone === 'nest') {
        const siblings = allRequests.filter(r => r.folder_id === targetFold.id)
        const maxIdx = siblings.reduce((max, r) => Math.max(max, r.order_index), 0)
        await state.moveRequest(entityId, targetFold.collection_id, targetFold.id, maxIdx + 1000)
        return
      }

      // ACTION: REORDER (SIBLING)
      if (targetReq || targetFold) {
        const target = targetReq || targetFold!
        const targetCollectionId = target.collection_id
        const targetFolderId = (target as any).folder_id !== undefined ? (target as any).folder_id : (target as any).parent_folder_id

        // Find ALL siblings (both folders and requests) at this level to calculate correct index
        const siblingRequests = allRequests.filter(r => r.collection_id === targetCollectionId && r.folder_id === targetFolderId)
        const siblingFolders = allFolders.filter(f => f.collection_id === targetCollectionId && f.parent_folder_id === targetFolderId)

        const allSiblings = [
          ...siblingRequests.map(r => ({ id: r.id, type: 'request', order_index: r.order_index })),
          ...siblingFolders.map(f => ({ id: f.id, type: 'folder', order_index: f.order_index }))
        ].sort((a, b) => a.order_index - b.order_index)

        const overIdx = allSiblings.findIndex(s => s.id === target.id && s.type === (targetReq ? 'request' : 'folder'))

        let newOrderIndex = 0
        if (dropZone === 'sort-top') {
          const prev = allSiblings[overIdx - 1]
          newOrderIndex = prev ? (prev.order_index + target.order_index) / 2 : target.order_index - 1000
        } else {
          const next = allSiblings[overIdx + 1]
          newOrderIndex = next ? (target.order_index + next.order_index) / 2 : target.order_index + 1000
        }
        await state.moveRequest(entityId, targetCollectionId, targetFolderId, newOrderIndex)
      } else if (targetColl) {
        const siblings = allRequests.filter(r => r.collection_id === targetColl.id && r.folder_id === null)
        const maxIdx = siblings.reduce((max, r) => Math.max(max, r.order_index), 0)
        await state.moveRequest(entityId, targetColl.id, null, maxIdx + 1000)
      }
    } else {
      // Folder dragging
      const folderId = parseInt(activeIdStr.split('-')[1])
      const targetFold = allFolders.find(f => `folder-${f.id}` === overIdStr)
      const targetColl = state.collections.find(c => `collection-${c.id}` === overIdStr)

      // ACTION: NEST INSIDE FOLDER
      if (targetFold && dropZone === 'nest') {
        if (targetFold.id === folderId) return
        const siblings = allFolders.filter(f => f.parent_folder_id === targetFold.id)
        const maxIdx = siblings.reduce((max, f) => Math.max(max, f.order_index), 0)
        await state.moveFolder(folderId, targetFold.collection_id, targetFold.id, maxIdx + 1000)
        return
      }

      // ACTION: REORDER OR MOVE TO ROOT
      if (targetFold || targetColl) {
        const targetCollectionId = targetFold ? targetFold.collection_id : (targetColl as Collection).id
        const targetParentId = targetFold ? targetFold.parent_folder_id : null

        const siblingRequests = allRequests.filter(r => r.collection_id === targetCollectionId && r.folder_id === targetParentId)
        const siblingFolders = allFolders.filter(f => f.collection_id === targetCollectionId && f.parent_folder_id === targetParentId)

        const allSiblings = [
          ...siblingRequests.map(r => ({ id: r.id, type: 'request', order_index: r.order_index })),
          ...siblingFolders.map(f => ({ id: f.id, type: 'folder', order_index: f.order_index }))
        ].sort((a, b) => a.order_index - b.order_index)

        if (targetFold) {
          const overIdx = allSiblings.findIndex(s => s.id === targetFold.id && s.type === 'folder')
          let newOrderIndex = 0
          if (dropZone === 'sort-top') {
            const prev = allSiblings[overIdx - 1]
            newOrderIndex = prev ? (prev.order_index + targetFold.order_index) / 2 : targetFold.order_index - 1000
          } else {
            const next = allSiblings[overIdx + 1]
            newOrderIndex = next ? (targetFold.order_index + next.order_index) / 2 : targetFold.order_index + 1000
          }
          await state.moveFolder(folderId, targetCollectionId, targetParentId, newOrderIndex)
        } else {
          const maxIdx = allSiblings.reduce((max, s) => Math.max(max, s.order_index), 0)
          await state.moveFolder(folderId, targetCollectionId, null, maxIdx + 1000)
        }
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      <div className="w-64 h-full bg-surface border-r border-border flex flex-col flex-shrink-0 overflow-hidden">
        <div className="h-14 flex items-center justify-between px-4 border-b border-border shrink-0">
          <div onClick={() => setActiveView('request-builder')} className="font-semibold text-text flex items-center gap-2 cursor-pointer group">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30 group-hover:scale-110 transition-transform">
              <Zap size={16} fill="currentColor" />
            </div>
            <span className="text-sm font-black tracking-tight">WAPBOLT</span>
          </div>
          {/* <button 
            onClick={() => {
              if (window.api) window.api.reloadApp();
              else fetchTeams();
            }} 
            title="Reload Application" 
            className="text-muted hover:text-text transition-colors"
          >
            <RefreshCw size={14} className={teamsLoading ? 'animate-spin' : ''} />
          </button> */}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
          {user?.is_super_admin && (
            <div className="px-3 py-2 border-b border-border shrink-0">
              <div onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)} className="text-xs font-semibold text-primary uppercase tracking-wider mb-1.5 flex items-center justify-between cursor-pointer hover:text-primary-hover">
                <div className="flex items-center gap-1.5"><ShieldCheck size={13} /> Admin Panel</div>
                {isAdminMenuOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </div>
              {isAdminMenuOpen && (
                <div className="space-y-1 mt-2 mb-1">
                  <div onClick={() => setActiveView('request-builder')} className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer ${activeView === 'request-builder' ? 'bg-primary/10 text-primary' : 'text-text hover:bg-background'}`}>
                    <LayoutDashboard size={12} /> Dashboard
                  </div>
                  <div onClick={() => setActiveView('admin-users')} className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer ${activeView === 'admin-users' ? 'bg-primary/10 text-primary' : 'text-text hover:bg-background'}`}>
                    <UserCog size={12} /> User Management
                  </div>
                  <div onClick={() => setActiveView('admin-teams')} className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer ${activeView === 'admin-teams' ? 'bg-primary/10 text-primary' : 'text-text hover:bg-background'}`}>
                    <Building2 size={12} /> Workspace Management
                  </div>
                  <div onClick={() => setActiveView('admin-donations')} className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer ${activeView === 'admin-donations' ? 'bg-primary/10 text-primary' : 'text-text hover:bg-background'}`}>
                    <Heart size={12} /> Donation Settings
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="px-3 py-2 border-b border-border shrink-0">
            <div className="text-xs font-bold text-text/60 uppercase tracking-widest mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5"><Users size={12} /> Workspaces</div>
              <button onClick={() => { const name = window.prompt('Workspace Name:'); if (name) useDataStore.getState().createTeam(name, '') }} title="New Workspace" className="text-muted hover:text-text transition-colors"><Plus size={12} /></button>
            </div>
            <div className="space-y-0.5">
              {teams.map((team) => (
                <div key={team.id} onClick={() => { setActiveTeam(team.id); setActiveView('request-builder') }} className={`flex items-center px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${team.id === activeTeamId ? 'bg-primary/15 text-primary font-medium' : 'text-text hover:bg-background'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full mr-2 shrink-0 ${team.id === activeTeamId ? 'bg-primary' : 'bg-muted'}`} />
                  <span className="truncate">{team.name}</span>
                </div>
              ))}
            </div>

            {activeTeamId && (
              <div onClick={() => setShowStandaloneMock(true)} className="flex items-center gap-2 px-2 py-1.5 rounded text-[10px] cursor-pointer text-emerald-400 hover:bg-emerald-500/10 transition-colors mt-2 border border-emerald-500/10 bg-emerald-500/5 font-black uppercase tracking-[0.1em] shadow-lg shadow-emerald-500/5">
                <DatabaseZap size={11} /> Workspace Mock Server
              </div>
            )}
          </div>

          <div className="flex px-3 pt-3 gap-2 border-b border-border items-center">
            <div className="flex flex-1 gap-4">
              <div onClick={() => setSidebarTab('collections')} className={`pb-2 text-xs font-bold uppercase tracking-wider cursor-pointer border-b-2 transition-all ${sidebarTab === 'collections' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'}`}>Collections</div>
              <div onClick={() => setSidebarTab('history')} className={`pb-2 text-xs font-bold uppercase tracking-wider cursor-pointer border-b-2 transition-all ${sidebarTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'}`}>History</div>
            </div>
            
            {sidebarTab === 'collections' && (
              <button 
                onClick={collapseAll}
                title="Collapse All"
                className="mb-2 p-1 rounded hover:bg-background text-muted hover:text-text transition-colors"
              >
                <ListTree size={14} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
            {sidebarTab === 'collections' ? (
              <div className="px-2 py-2 space-y-0.5">
                <div className="p-2 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 text-muted" size={13} />
                    <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-background border border-border rounded text-xs pl-8 pr-3 py-2 text-text focus:border-primary transition-colors" />
                  </div>
                </div>
                <div className="px-2 pb-2 flex items-center justify-between">
                  <span className="text-[10px] font-black text-text/50 uppercase tracking-[0.2em]">List</span>
                  {activeTeam && (
                    <div className="flex items-center gap-2">
                      <ImportModal />
                      <button onClick={() => setIsNewCollectionModalOpen(true)} title="New Collection" className="text-muted hover:text-text transition-colors"><Plus size={13} /></button>
                    </div>
                  )}
                </div>
                {collectionsLoading ? <div className="text-center py-8 text-xs text-muted">Loading...</div> : filteredCollections.map((c) => <CollectionItem key={c.id} collection={c} />)}
              </div>
            ) : (
              <div className="px-2 py-2 space-y-0.5">
                <div className="px-2 py-2 flex items-center justify-between">
                  <span className="text-[10px] font-black text-text/50 uppercase tracking-[0.2em]">Recent Activity</span>
                  <button onClick={() => confirm('Clear history?') && clearHistory()} className="text-muted hover:text-danger" title="Clear All"><Trash2 size={12} /></button>
                </div>
                {history.map((h) => (
                  <div key={h.id} onClick={() => useAppStore.getState().setActiveHistoryId(h.id)} className="px-2 py-2 rounded hover:bg-background cursor-pointer group flex flex-col gap-0.5 border-l-2 border-transparent hover:border-primary/50">
                    <div className="flex items-center justify-between text-[10px] font-black">
                      <span className={METHOD_COLORS[h.method] ?? 'text-muted'}>{h.method}</span>
                      <span className="text-muted font-normal">{(new Date(h.created_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="text-[11px] text-text truncate font-mono">{h.url}</div>
                    <span className={`text-[9px] font-bold ${h.status_code < 300 ? 'text-success' : 'text-danger'}`}>{h.status_code || 'Err'} ({h.response_time}ms)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border shrink-0">
          <div className="px-3 py-2 border-b border-border">
            <div className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1"><Hash size={11} /> Environment</div>
              <EnvironmentModal />
            </div>
            <select value={activeEnvironmentId ?? ''} onChange={(e) => setActiveEnvironment(e.target.value === '' ? null : Number(e.target.value))} className="w-full bg-background border border-border rounded text-xs px-2 py-1.5 text-text focus:border-primary">
              <option value="">No Environment</option>
              {environments.map((env) => <option key={env.id} value={env.id}>{env.name}</option>)}
            </select>
          </div>

          <div className="px-3 py-2 flex flex-col gap-1 border-t border-border/50 bg-background/50">
            {appVersion && <div className="px-1 text-[9px] font-black uppercase tracking-[0.2em] text-muted/70 mb-1 text-center">Wapbolt v{appVersion}</div>}
            <div className="flex items-center justify-between min-w-0">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-text truncate">{user?.name}</div>
                <div className="text-[10px] text-muted truncate">{user?.email}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <button onClick={() => setShowChangePassword(true)} title="Change Password" className="text-muted hover:text-text"><Key size={14} /></button>
                <button onClick={() => setShowServerSettings(true)} className="text-muted hover:text-text"><Settings size={14} /></button>
                <button onClick={logout} className="text-muted hover:text-danger"><LogOut size={14} /></button>
              </div>
            </div>
          </div>
        </div>

        {showServerSettings && <ServerSettingsModal onClose={() => setShowServerSettings(false)} />}
        {showChangePassword && <ChangePasswordModal isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />}
        {showStandaloneMock && activeTeam && (
          <StandaloneMockPanel
            teamId={activeTeam.id}
            workspaceName={activeTeam.name}
            onClose={() => setShowStandaloneMock(false)}
          />
        )}

        {isNewCollectionModalOpen && (
          <PromptModal
            title="New Collection"
            placeholder="Collection name..."
            isOpen={isNewCollectionModalOpen}
            onClose={() => setIsNewCollectionModalOpen(false)}
            onSubmit={(val) => { createCollection(val) }}
          />
        )}
      </div>
    </DndContext>
  )
}
