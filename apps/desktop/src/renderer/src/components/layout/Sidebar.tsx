import {
  Folder as FolderIcon,
  Plus,
  Search,
  Settings,
  ChevronRight,
  ChevronDown,
  Globe,
  LogOut,
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
  Key, DatabaseZap,
  Heart, ListTree,
  Cloud,
  RotateCcw,
  Crown,
  Clock,
  Check
} from 'lucide-react'
import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, createContext, useContext } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
  DragOverlay,
  useDroppable
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Dialog from '@radix-ui/react-dialog'

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
import { ConfluenceSettingsModal } from '../modals/ConfluenceSettingsModal'
import { UserConfluenceSettingsModal } from '../modals/UserConfluenceSettingsModal'
import { CollectionModal } from '../modals/CollectionModal'
import type { ApiRequest, Collection, Folder, RequestExample } from '../../types'
import { DocumentationPanel } from './DocumentationPanel'
import { MockServerPanel } from './MockServerPanel'
import { CollectionRunnerPanel } from './CollectionRunnerPanel'
import { NotificationBell } from './NotificationBell'
import { wsClient } from '../../api/websocket'
import { apiClient } from '../../api/client'

interface DragZoneInfo {
  id: string
  zone: 'sort-top' | 'sort-bottom' | 'nest'
}

interface DragStateContextValue {
  activeDragId: string | null
  overInfo: DragZoneInfo | null
}

const DragStateContext = createContext<DragStateContextValue>({ activeDragId: null, overInfo: null })

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
  } = useSortable({ id, disabled })

  const { overInfo } = useContext(DragStateContext)
  const isOverSelf = overInfo?.id === id

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? 'transform 150ms ease',
    opacity: isDragging ? 0 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group/sortable">
      {/* Visual drop indicators — driven by DragStateContext, not mousemove */}
      {isOverSelf && !isDragging && (
        <>
          {overInfo?.zone === 'sort-top' && (
            <div className="absolute -top-0.5 left-2 right-2 h-0.5 bg-primary z-30 rounded-full shadow-[0_0_6px_rgba(99,102,241,0.6)]">
              <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-primary" />
            </div>
          )}
          {overInfo?.zone === 'sort-bottom' && (
            <div className="absolute -bottom-0.5 left-2 right-2 h-0.5 bg-primary z-30 rounded-full shadow-[0_0_6px_rgba(99,102,241,0.6)]">
              <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-primary" />
            </div>
          )}
          {overInfo?.zone === 'nest' && type === 'folder' && (
            <div className="absolute inset-0 bg-primary/15 border border-primary/50 rounded z-10 pointer-events-none" />
          )}
        </>
      )}

      <div {...attributes} {...listeners} className="relative z-10">
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
          <button
            onClick={(e): void => { e.stopPropagation(); e.preventDefault(); handleContextMenu(e) }}
            className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded hover:bg-border text-muted hover:text-text transition-all"
            title="Folder actions"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <circle cx="2" cy="6" r="1.2"/><circle cx="6" cy="6" r="1.2"/><circle cx="10" cy="6" r="1.2"/>
            </svg>
          </button>
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
    updateCollection
  } = useDataStore()
  const { setActiveView } = useAppStore()

  const isExpanded = !!expandedItems[`collection-${collection.id}`]
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [promptType, setPromptType] = useState<'request' | 'folder' | null>(null)
  const [showDocs, setShowDocs] = useState(false)
  const [showMockServer, setShowMockServer] = useState(false)
  const [showRunner, setShowRunner] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Auto-fetch if expanded state was restored from localStorage but data not yet loaded
  useEffect(() => {
    if (isExpanded && !requestsByCollection[collection.id]) {
      fetchCollectionContents(collection.id)
    }
  }, [])

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
            { label: 'Collection Settings', icon: Settings, onClick: (): void => setShowSettings(true) },
            { label: 'Export Collection', icon: Download, onClick: (): Promise<void> => exportCollection(collection.id) },
            { label: 'Delete Collection', icon: Trash2, onClick: handleDeleteCollection, variant: 'danger' }
          ]}
        />
      )}

      {showDocs && <DocumentationPanel collectionId={collection.id} collectionName={collection.name} onClose={() => setShowDocs(false)} />}

      {showMockServer && <MockServerPanel collectionId={collection.id} collectionName={collection.name} requests={requests} onClose={() => setShowMockServer(false)} />}

      {showRunner && (
        <CollectionRunnerPanel
          collectionId={collection.id}
          collectionName={collection.name}
          onClose={() => setShowRunner(false)}
        />
      )}

      {showSettings && (
        <CollectionModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          title="Collection Settings"
          submitText="Save Changes"
          initialData={{
            name: collection.name,
            description: collection.description,
            confluence_page_id: collection.confluence_page_id || ''
          }}
          onSubmit={(data) => updateCollection(collection.id, data.name, data.description, data.confluence_page_id)}
        />
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

const PremiumBadge = (): React.JSX.Element => {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const { user } = useAuthStore()

  const handleOpen = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (!message) {
      try {
        const res = await apiClient.get<{ message: string }>('/api/v1/donations/premium-message')
        if (res.status === 200) setMessage((res.data as { message: string }).message)
      } catch { /* use default */ }
    }
    setOpen(true)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          onClick={handleOpen}
          className="flex items-center gap-1 bg-primary/10 text-primary text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-primary/30 hover:bg-primary/20 transition-colors shrink-0"
        >
          <Crown size={9} />
          Premium
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] animate-in fade-in duration-300" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-surface border border-border rounded-2xl shadow-2xl z-[101] p-0 overflow-hidden animate-in zoom-in-95 fade-in duration-300 focus:outline-none">

          {/* Header — same pattern as ChangePasswordModal */}
          <div className="bg-primary/10 px-6 py-8 flex flex-col items-center border-b border-primary/20 relative">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 text-muted hover:text-text transition-colors p-1 hover:bg-white/10 rounded-md"
            >
              <X size={18} />
            </button>
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white shadow-xl shadow-primary/30 mb-4">
              <Crown size={32} />
            </div>
            <Dialog.Title className="text-xl font-bold text-text">Premium Member</Dialog.Title>
            <Dialog.Description className="text-xs text-muted mt-1">
              Halo, {user?.name}! 👋
            </Dialog.Description>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Thank you message */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/15">
              <Heart size={18} className="text-red-400 fill-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-text leading-relaxed">
                {message || 'Terima kasih karena Anda sudah berdonasi dan mendukung pengembangan Wapbolt. Dukungan Anda sangat berarti bagi kami!'}
              </p>
            </div>

            {/* Member since */}
            {user?.premium_since && (
              <div className="flex items-center gap-2 text-xs text-muted px-1">
                <Crown size={12} className="text-primary shrink-0" />
                <span>Member sejak {new Date(user.premium_since).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            )}

            <Dialog.Close asChild>
              <button className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-primary/20">
                Tutup
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function EnvSelector(): React.JSX.Element {
  const { environments, activeEnvironmentId, setActiveEnvironment } = useDataStore()
  const activeEnv = environments.find((e) => e.id === activeEnvironmentId)
  const globalEnvs = environments.filter((e) => e.is_global)
  const workspaceEnvs = environments.filter((e) => !e.is_global)

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-background border border-border rounded-lg text-xs hover:border-primary/50 transition-colors group">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeEnv ? 'bg-emerald-400' : 'bg-muted'}`} />
            <span className="truncate text-text font-medium">{activeEnv?.name ?? 'No Environment'}</span>
          </div>
          <ChevronDown size={11} className="text-muted shrink-0 group-data-[state=open]:rotate-180 transition-transform" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-50 w-[var(--radix-dropdown-menu-trigger-width)] bg-surface border border-border rounded-lg shadow-xl py-1 overflow-hidden"
        >
          <DropdownMenu.Item
            onSelect={() => setActiveEnvironment(null)}
            className={`flex items-center gap-2 px-3 py-2 text-xs cursor-pointer outline-none transition-colors ${!activeEnvironmentId ? 'text-primary bg-primary/10' : 'text-text hover:bg-background'}`}
          >
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${!activeEnvironmentId ? 'bg-primary' : 'bg-muted'}`} />
            <span className="flex-1">No Environment</span>
            {!activeEnvironmentId && <Check size={11} className="text-primary shrink-0" />}
          </DropdownMenu.Item>

          {globalEnvs.length > 0 && (
            <>
              <DropdownMenu.Separator className="my-1 border-t border-border" />
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted flex items-center gap-1.5">
                <Globe size={9} /> Global
              </div>
              {globalEnvs.map((env) => (
                <DropdownMenu.Item
                  key={env.id}
                  onSelect={() => setActiveEnvironment(env.id)}
                  className={`flex items-center gap-2 px-3 py-2 text-xs cursor-pointer outline-none transition-colors ${activeEnvironmentId === env.id ? 'text-primary bg-primary/10' : 'text-text hover:bg-background'}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeEnvironmentId === env.id ? 'bg-emerald-400' : 'bg-muted'}`} />
                  <span className="flex-1 truncate">{env.name}</span>
                  {activeEnvironmentId === env.id && <Check size={11} className="text-primary shrink-0" />}
                </DropdownMenu.Item>
              ))}
            </>
          )}

          {workspaceEnvs.length > 0 && (
            <>
              <DropdownMenu.Separator className="my-1 border-t border-border" />
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted flex items-center gap-1.5">
                <Server size={9} /> Workspace
              </div>
              {workspaceEnvs.map((env) => (
                <DropdownMenu.Item
                  key={env.id}
                  onSelect={() => setActiveEnvironment(env.id)}
                  className={`flex items-center gap-2 px-3 py-2 text-xs cursor-pointer outline-none transition-colors ${activeEnvironmentId === env.id ? 'text-primary bg-primary/10' : 'text-text hover:bg-background'}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeEnvironmentId === env.id ? 'bg-emerald-400' : 'bg-muted'}`} />
                  <span className="flex-1 truncate">{env.name}</span>
                  {activeEnvironmentId === env.id && <Check size={11} className="text-primary shrink-0" />}
                </DropdownMenu.Item>
              ))}
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export const Sidebar = (): React.JSX.Element => {
  const { user, logout } = useAuthStore()
  const [showServerSettings, setShowServerSettings] = useState(false)
  const [showUserConfluence, setShowUserConfluence] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showStandaloneMock, setShowStandaloneMock] = useState(false)
  const [showConfluenceSettings, setShowConfluenceSettings] = useState(false)
  const [appVersion, setAppVersion] = useState<string>('')
  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')

  const {
    teams,
    activeTeamId,
    collections,
    collectionsLoading,
    fetchTeams,
    createCollection,
    history,
    clearHistory,
    collapseAll,
    confluenceEnabled,
    fetchConfluenceEnabled
  } = useDataStore()

  useEffect(() => {
    const checkWs = () => {
      if (wsClient.ws && wsClient.ws.readyState === WebSocket.OPEN) {
        setWsStatus('connected')
      } else if (user) {
        setWsStatus('connecting')
      } else {
        setWsStatus('disconnected')
      }
    }
    checkWs()
    const interval = setInterval(checkWs, 500)
    return () => clearInterval(interval)
  }, [user])

  const [searchQuery, setSearchQuery] = useState('')
  const [historySearch, setHistorySearch] = useState('')

  const [sidebarTab, setSidebarTab] = useState<'collections' | 'environments' | 'history'>('collections')
  const [sidebarWidth, setSidebarWidth] = useState(256)
  const isResizingSidebar = useRef(false)

  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizingSidebar.current = true
    const startX = e.clientX
    const startW = sidebarWidth
    const onMove = (ev: MouseEvent) => {
      if (!isResizingSidebar.current) return
      const newW = Math.min(Math.max(startW + ev.clientX - startX, 160), 480)
      setSidebarWidth(newW)
    }
    const onUp = () => {
      isResizingSidebar.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [sidebarWidth])
  const [isNewCollectionModalOpen, setIsNewCollectionModalOpen] = useState(false)

  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [overInfo, setOverInfo] = useState<DragZoneInfo | null>(null)
  const overInfoRef = useRef<DragZoneInfo | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 300, tolerance: 5 },
    })
  )

  useLayoutEffect(() => {
    window.api?.getAppVersion().then(setAppVersion)
  }, [])

  useEffect(() => { fetchTeams() }, [fetchTeams])
  useEffect(() => { fetchConfluenceEnabled() }, [fetchConfluenceEnabled])

  useEffect(() => {
    const handleOpenSettings = () => setShowServerSettings(true)
    const handleOpenMock = () => setShowStandaloneMock(true)
    const handleOpenConfluence = () => {
      setShowUserConfluence(true)
    }

    window.addEventListener('wapbolt:open-settings', handleOpenSettings)
    window.addEventListener('wapbolt:open-standalone-mock', handleOpenMock)
    window.addEventListener('wapbolt:open-user-confluence-settings', handleOpenConfluence)

    return () => {
      window.removeEventListener('wapbolt:open-settings', handleOpenSettings)
      window.removeEventListener('wapbolt:open-standalone-mock', handleOpenMock)
      window.removeEventListener('wapbolt:open-user-confluence-settings', handleOpenConfluence)
    }
  }, [])

  const activeTeam = teams.find((t) => t.id === activeTeamId)
  const filteredCollections = collections
    .filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  const computeDropZone = (
    overIdStr: string,
    overRect: DOMRect | null,
    pointerX: number,
    pointerY: number
  ): 'sort-top' | 'sort-bottom' | 'nest' => {
    if (!overRect) return 'sort-bottom'
    const relX = pointerX - overRect.left
    const relY = pointerY - overRect.top
    if (overIdStr.startsWith('folder-')) {
      // Left 30% = sort, right 70% = nest into folder
      if (relX < overRect.width * 0.3) {
        return relY < overRect.height / 2 ? 'sort-top' : 'sort-bottom'
      }
      return 'nest'
    }
    return relY < overRect.height / 2 ? 'sort-top' : 'sort-bottom'
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id.toString())
    setOverInfo(null)
    overInfoRef.current = null
  }

  const handleDragMove = (event: DragMoveEvent) => {
    const { over, activatorEvent, delta } = event
    if (!over) {
      setOverInfo(null)
      overInfoRef.current = null
      return
    }
    const overIdStr = over.id.toString()
    const pointer = activatorEvent as MouseEvent
    const pointerX = pointer.clientX + delta.x
    const pointerY = pointer.clientY + delta.y
    const overRect = over.rect as unknown as DOMRect | null
    const zone = computeDropZone(overIdStr, overRect, pointerX, pointerY)
    const info = { id: overIdStr, zone }
    overInfoRef.current = info
    setOverInfo(info)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)
    setOverInfo(null)
    if (!over || active.id === over.id) { overInfoRef.current = null; return }

    const activeIdStr = active.id.toString()
    const overIdStr = over.id.toString()

    const isRequest = activeIdStr.startsWith('request-')
    const entityId = parseInt(activeIdStr.split('-')[1])

    const state = useDataStore.getState()
    const allRequests = state.requests
    const allFolders = Object.values(state.foldersByCollection).flat()

    // Use the zone we tracked in onDragMove (most up-to-date)
    const dropZone = overInfoRef.current?.zone ?? 'sort-bottom'
    overInfoRef.current = null

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

  // Resolve active drag item info for DragOverlay ghost
  const activeDragLabel = useMemo(() => {
    if (!activeDragId) return null
    const state = useDataStore.getState()
    if (activeDragId.startsWith('request-')) {
      const id = parseInt(activeDragId.split('-')[1])
      const req = state.requests.find(r => r.id === id)
      return req ? { type: 'request', method: req.method, name: req.name } : null
    }
    if (activeDragId.startsWith('folder-')) {
      const id = parseInt(activeDragId.split('-')[1])
      const folder = Object.values(state.foldersByCollection).flat().find(f => f.id === id)
      return folder ? { type: 'folder', name: folder.name } : null
    }
    return null
  }, [activeDragId])

  return (
    <DragStateContext.Provider value={{ activeDragId, overInfo }}>
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { setActiveDragId(null); setOverInfo(null); overInfoRef.current = null }}
    >
      <div className="h-full bg-surface border-r border-border flex flex-row flex-shrink-0 overflow-hidden relative" style={{ width: sidebarWidth + 64 }}>
        {/* Icon rail */}
        <div className="w-16 shrink-0 h-full bg-surface border-r border-border flex flex-col items-center py-2 gap-0.5">
          {([
            { id: 'collections', icon: <FolderIcon size={15} />, label: 'Collections' },
            { id: 'environments', icon: <Globe size={15} />, label: 'Environ' },
            { id: 'history', icon: <Clock size={15} />, label: 'History' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSidebarTab(tab.id)}
              title={tab.id === 'environments' ? 'Environments' : tab.label}
              className={`w-14 flex flex-col items-center gap-0.5 py-1.5 rounded-lg transition-colors ${sidebarTab === tab.id ? 'bg-primary/15 text-primary' : 'text-muted hover:text-text hover:bg-background'}`}
            >
              {tab.icon}
              <span className="text-[8px] font-semibold leading-none tracking-tight">{tab.label}</span>
            </button>
          ))}
          <div className="flex-1" />
          {activeTeamId && (
            <button
              onClick={() => setShowStandaloneMock(true)}
              title="Workspace Mock Server"
              className="w-14 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              <DatabaseZap size={15} />
              <span className="text-[8px] font-semibold leading-none tracking-tight">Mock</span>
            </button>
          )}
        </div>

        {/* Content panel */}
        <div className="flex flex-col overflow-hidden" style={{ width: sidebarWidth }}>
          {/* Panel header */}
          <div className="px-3 py-2 border-b border-border shrink-0 flex items-center justify-between h-9">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted">
              {sidebarTab === 'collections' ? 'Collections' : sidebarTab === 'environments' ? 'Environments' : 'History'}
            </span>
            {sidebarTab === 'collections' && (
              <button onClick={collapseAll} title="Collapse All" className="p-1 rounded hover:bg-background text-muted hover:text-text transition-colors">
                <ListTree size={13} />
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
            ) : sidebarTab === 'environments' ? (
              <div className="flex flex-col h-full px-3 py-3 gap-3">
                <div className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center justify-between">
                  <div className="flex items-center gap-1"><Globe size={11} /> Environment</div>
                  <EnvironmentModal />
                </div>
                <EnvSelector />
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* Search + Clear */}
                <div className="px-3 pt-2 pb-1 flex items-center gap-1.5 shrink-0">
                  <div className="relative flex-1">
                    <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                    <input
                      type="text"
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      placeholder="Search history..."
                      className="w-full bg-background border border-border rounded pl-6 pr-2 py-1 text-[11px] text-text placeholder:text-muted/50 focus:outline-none focus:border-primary"
                    />
                    {historySearch && (
                      <button
                        onClick={() => setHistorySearch('')}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => confirm('Clear history?') && clearHistory()}
                    className="text-muted hover:text-danger shrink-0"
                    title="Clear All"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* History List */}
                <div className="overflow-y-auto flex-1 px-2 pb-2">
                  {(() => {
                    const q = historySearch.trim().toLowerCase()
                    const filtered = q
                      ? history.filter(
                          (h) =>
                            h.url.toLowerCase().includes(q) ||
                            h.method.toLowerCase().includes(q) ||
                            String(h.status_code).includes(q)
                        )
                      : history

                    if (filtered.length === 0) {
                      return (
                        <div className="text-center py-8 text-xs text-muted italic">
                          {q ? 'No results found.' : 'No history yet.'}
                        </div>
                      )
                    }

                    // Group by date
                    const groups: { label: string; items: typeof filtered }[] = []
                    filtered.forEach((h) => {
                      const d = new Date(h.created_at)
                      const today = new Date()
                      const yesterday = new Date(today)
                      yesterday.setDate(today.getDate() - 1)
                      const label =
                        d.toDateString() === today.toDateString()
                          ? 'Today'
                          : d.toDateString() === yesterday.toDateString()
                          ? 'Yesterday'
                          : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
                      const existing = groups.find((g) => g.label === label)
                      if (existing) existing.items.push(h)
                      else groups.push({ label, items: [h] })
                    })

                    return groups.map((group) => (
                      <div key={group.label} className="mt-2">
                        <div className="px-2 py-1 text-[9px] font-black text-muted/60 uppercase tracking-widest">
                          {group.label}
                        </div>
                        {group.items.map((h) => (
                          <div
                            key={h.id}
                            className="px-2 py-2 rounded hover:bg-background cursor-pointer group/item flex flex-col gap-0.5 border-l-2 border-transparent hover:border-primary/50 relative"
                          >
                            <div
                              className="flex items-center justify-between text-[10px] font-black"
                              onClick={() => useAppStore.getState().setActiveHistoryId(h.id)}
                            >
                              <span className={METHOD_COLORS[h.method] ?? 'text-muted'}>{h.method}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-muted font-normal opacity-0 group-hover/item:opacity-100 transition-opacity">
                                  {(new Date(h.created_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <button
                                  title="Replay request"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const headers: Record<string, string> = {}
                                    Object.entries(h.request_headers || {}).forEach(([k, v]) => {
                                      headers[k] = Array.isArray(v) ? v[0] : String(v)
                                    })
                                    useDataStore.getState().setWorkingRequest({
                                      method: h.method,
                                      url: h.url,
                                      headers,
                                      body: h.request_body || '',
                                      body_type: headers['content-type']?.includes('application/json') ? 'raw-json' : 'raw-text'
                                    })
                                    useAppStore.getState().setActiveHistoryId(null)
                                  }}
                                  className="opacity-0 group-hover/item:opacity-100 transition-opacity text-muted hover:text-primary"
                                >
                                  <RotateCcw size={11} />
                                </button>
                              </div>
                            </div>
                            <div
                              className="text-[11px] text-text truncate font-mono"
                              onClick={() => useAppStore.getState().setActiveHistoryId(h.id)}
                            >
                              {h.url}
                            </div>
                            <span
                              className={`text-[9px] font-bold ${h.status_code < 300 ? 'text-success' : 'text-danger'}`}
                              onClick={() => useAppStore.getState().setActiveHistoryId(h.id)}
                            >
                              {h.status_code || 'Err'} ({h.response_time}ms)
                            </span>
                          </div>
                        ))}
                      </div>
                    ))
                  })()}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border shrink-0">
          <div className="px-3 py-2 flex flex-col gap-1 border-t border-border/50 bg-background/50">
            {appVersion && <div className="px-1 text-[9px] font-black uppercase tracking-[0.2em] text-muted/70 mb-1 text-center">Wapbolt v{appVersion}</div>}
            <div className="flex items-center justify-between min-w-0 px-1">
              <DropdownMenu.Root>
                <div className="flex flex-1 items-center gap-2 min-w-0">
                  <DropdownMenu.Trigger asChild>
                    <button className="flex flex-1 items-center gap-2 min-w-0 p-1 rounded-lg hover:bg-background text-left transition-colors focus:outline-none">
                      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/20 text-primary font-bold text-xs shrink-0 ring-1 ring-primary/20">
                        {user?.name?.substring(0, 2).toUpperCase() || 'U'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-text truncate">{user?.name}</div>
                        <div className="text-[10px] text-muted truncate">{user?.email}</div>
                      </div>
                    </button>
                  </DropdownMenu.Trigger>
                  {user?.is_premium && <PremiumBadge />}
                </div>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="min-w-[200px] bg-surface border border-border rounded-lg shadow-xl p-1 z-[100] text-sm font-sans"
                    sideOffset={5}
                    side="top"
                    align="start"
                  >
                    {confluenceEnabled && (
                      <DropdownMenu.Item
                        onClick={() => setShowUserConfluence(true)}
                        className="flex items-center px-2 py-1.5 text-xs text-text hover:bg-background hover:text-text rounded cursor-pointer outline-none data-highlighted:bg-background"
                      >
                        <Cloud size={14} className="mr-2 text-blue-400" />
                        Confluence Settings
                      </DropdownMenu.Item>
                    )}
                    <DropdownMenu.Item
                      onClick={() => setShowChangePassword(true)}
                      className="flex items-center px-2 py-1.5 text-xs text-text hover:bg-background hover:text-text rounded cursor-pointer outline-none data-[highlighted]:bg-background"
                    >
                      <Key size={14} className="mr-2" />
                      Change Password
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onClick={() => setShowServerSettings(true)}
                      className="flex items-center px-2 py-1.5 text-xs text-text hover:bg-background hover:text-text rounded cursor-pointer outline-none data-[highlighted]:bg-background"
                    >
                      <Settings size={14} className="mr-2" />
                      App Settings
                    </DropdownMenu.Item>
                    
                    <DropdownMenu.Separator className="h-px bg-border my-1" />
                    
                    <DropdownMenu.Item
                      onClick={logout}
                      className="flex items-center px-2 py-1.5 text-xs text-danger hover:bg-danger/10 hover:text-danger rounded cursor-pointer outline-none data-[highlighted]:bg-danger/10"
                    >
                      <LogOut size={14} className="mr-2" />
                      Logout
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
              
              <NotificationBell />
            </div>
            <div className="flex items-center gap-1.5 px-1 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${wsStatus === 'connected' ? 'bg-green-400' : wsStatus === 'connecting' ? 'bg-yellow-400' : 'bg-red-400 opacity-60'}`} />
              <span
                title={wsStatus === 'connected' ? 'Collaboration connected' : wsStatus === 'connecting' ? 'Collaboration connecting' : 'Collaboration disconnected'}
                data-ws-status={wsStatus}
                className={`text-[9px] font-medium truncate ${wsStatus === 'connected' ? 'text-green-400' : wsStatus === 'connecting' ? 'text-yellow-400' : 'text-red-400 opacity-60'}`}
              >
                {wsStatus === 'connected' ? 'Collaboration connected' : wsStatus === 'connecting' ? 'Collaboration connecting' : 'Collaboration disconnected'}
              </span>
            </div>
          </div>
          </div>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleSidebarResizeStart}
          className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-primary/40 transition-colors z-10"
        />

        {showServerSettings && <ServerSettingsModal onClose={() => setShowServerSettings(false)} />}
        {showConfluenceSettings && <ConfluenceSettingsModal onClose={() => setShowConfluenceSettings(false)} />}
        {showUserConfluence && <UserConfluenceSettingsModal onClose={() => setShowUserConfluence(false)} />}
        {showChangePassword && <ChangePasswordModal isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />}
        {showStandaloneMock && activeTeam && (
          <StandaloneMockPanel
            teamId={activeTeam.id}
            workspaceName={activeTeam.name}
            onClose={() => setShowStandaloneMock(false)}
          />
        )}

        {isNewCollectionModalOpen && (
          <CollectionModal
            title="New Collection"
            submitText="Create"
            isOpen={isNewCollectionModalOpen}
            onClose={() => setIsNewCollectionModalOpen(false)}
            onSubmit={(data) => { createCollection(data.name, data.description, data.confluence_page_id) }}
          />
        )}
      </div>

      {/* Drag ghost overlay */}
      <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
        {activeDragLabel && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-primary/60 rounded-lg shadow-2xl shadow-black/40 text-xs font-medium text-text opacity-95 backdrop-blur-sm max-w-55">
            {activeDragLabel.type === 'folder' ? (
              <>
                <FolderIcon size={13} className="text-primary shrink-0" />
                <span className="truncate">{activeDragLabel.name}</span>
              </>
            ) : (
              <>
                <span className={`text-[9px] font-black w-8 text-right shrink-0 ${METHOD_COLORS[(activeDragLabel as any).method] ?? 'text-muted'}`}>
                  {(activeDragLabel as any).method}
                </span>
                <span className="truncate">{activeDragLabel.name}</span>
              </>
            )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
    </DragStateContext.Provider>
  )
}
