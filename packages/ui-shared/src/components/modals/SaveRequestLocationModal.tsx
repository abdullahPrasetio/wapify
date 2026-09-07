import * as Dialog from '@radix-ui/react-dialog'
import { useState, useEffect, useMemo } from 'react'
import { X, Folder, FolderOpen, Globe, ChevronRight } from 'lucide-react'
import { useDataStore } from '../../store/useDataStore'
import { toast } from 'sonner'
import { ApiRequest, Folder as FolderType } from '../../types'

interface SaveRequestLocationModalProps {
  isOpen: boolean
  onClose: () => void
  draftRequest: Partial<ApiRequest>
  draftId: string
}

interface FolderNode extends FolderType {
  children: FolderNode[]
  depth: number
}

function buildFolderTree(folders: FolderType[], parentId: number | null = null, depth = 0): FolderNode[] {
  return folders
    .filter((f) => f.parent_folder_id === parentId)
    .sort((a, b) => a.order_index - b.order_index || a.id - b.id)
    .map((f) => ({
      ...f,
      depth,
      children: buildFolderTree(folders, f.id, depth + 1)
    }))
}


interface FolderRowProps {
  node: FolderNode
  selected: boolean
  onSelect: (id: number | null) => void
}

const FolderRow = ({ node, selected, onSelect }: FolderRowProps) => {
  const [expanded, setExpanded] = useState(true)

  return (
    <>
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${selected ? 'bg-primary/20 text-primary' : 'hover:bg-background text-text'}`}
        style={{ paddingLeft: `${12 + node.depth * 16}px` }}
        onClick={() => onSelect(node.id)}
      >
        {node.children.length > 0 && (
          <button
            className="shrink-0 text-muted hover:text-text transition-colors"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
          >
            <ChevronRight size={12} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        )}
        {node.children.length === 0 && <span className="w-3 shrink-0" />}
        {selected
          ? <FolderOpen size={14} className="shrink-0 text-primary" />
          : <Folder size={14} className="shrink-0 text-muted" />
        }
        <span className="truncate">{node.name}</span>
      </div>
      {expanded && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <FolderRow key={child.id} node={child} selected={selected && false} onSelect={onSelect} />
          ))}
        </div>
      )}
    </>
  )
}

const FolderTree = ({
  folders,
  selectedFolderId,
  onSelect,
}: {
  folders: FolderType[]
  selectedFolderId: number | null
  onSelect: (id: number | null) => void
}) => {
  const tree = useMemo(() => buildFolderTree(folders), [folders])

  const renderNode = (node: FolderNode): React.JSX.Element => {
    const isSelected = selectedFolderId === node.id
    return (
      <FolderTreeNode
        key={node.id}
        node={node}
        selectedFolderId={selectedFolderId}
        isSelected={isSelected}
        onSelect={onSelect}
      />
    )
  }

  return (
    <div className="space-y-0.5">
      {/* Root option */}
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${selectedFolderId === null ? 'bg-primary/20 text-primary' : 'hover:bg-background text-muted'}`}
        onClick={() => onSelect(null)}
      >
        <span className="w-3 shrink-0" />
        <Globe size={14} className="shrink-0" />
        <span className="italic">Root of Collection</span>
      </div>
      {tree.map(renderNode)}
    </div>
  )
}

interface FolderTreeNodeProps {
  node: FolderNode
  selectedFolderId: number | null
  isSelected: boolean
  onSelect: (id: number | null) => void
}

const FolderTreeNode = ({ node, selectedFolderId, isSelected, onSelect }: FolderTreeNodeProps) => {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0

  return (
    <>
      <div
        className={`flex items-center gap-2 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${isSelected ? 'bg-primary/20 text-primary' : 'hover:bg-background text-text'}`}
        style={{ paddingLeft: `${12 + node.depth * 16}px`, paddingRight: '12px' }}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren ? (
          <button
            className="shrink-0 text-muted hover:text-text transition-colors"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
          >
            <ChevronRight size={12} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        {isSelected
          ? <FolderOpen size={14} className="shrink-0 text-primary" />
          : <Folder size={14} className="shrink-0 text-muted" />
        }
        <span className="truncate">{node.name}</span>
      </div>
      {expanded && hasChildren && (
        <>
          {node.children.map((child) => (
            <FolderTreeNode
              key={child.id}
              node={child}
              selectedFolderId={selectedFolderId}
              isSelected={selectedFolderId === child.id}
              onSelect={onSelect}
            />
          ))}
        </>
      )}
    </>
  )
}

export const SaveRequestLocationModal = ({
  isOpen,
  onClose,
  draftRequest,
  draftId
}: SaveRequestLocationModalProps): React.JSX.Element => {
  const { collections, foldersByCollection, fetchCollectionContents, createRequest, tabs } = useDataStore()
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null)
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null)
  const [requestName, setRequestName] = useState(draftRequest.name || 'New Request')

  useEffect(() => {
    if (isOpen) {
      const firstId = collections.length > 0 ? collections[0].id : null
      if (firstId && !selectedCollectionId) {
        setSelectedCollectionId(firstId)
        if (!foldersByCollection[firstId]) fetchCollectionContents(firstId)
      }
      const tab = tabs.find(t => t.requestId === draftId)
      if (tab) {
        let name = tab.name
        if (name.startsWith('[Draft] ')) name = name.replace('[Draft] ', '')
        setRequestName(name)
      } else if (draftRequest.name) {
        setRequestName(draftRequest.name)
      }
    }
  }, [isOpen, collections, draftId, tabs, selectedCollectionId, draftRequest.name, foldersByCollection, fetchCollectionContents])

  // Reset folder selection when collection changes and fetch folders if needed
  const handleCollectionChange = (id: number) => {
    setSelectedCollectionId(id)
    setSelectedFolderId(null)
    if (!foldersByCollection[id]) fetchCollectionContents(id)
  }

  const folders: FolderType[] = selectedCollectionId ? (foldersByCollection[selectedCollectionId] || []) : []

  const selectedFolderName = useMemo(() => {
    if (selectedFolderId === null) return 'Root of Collection'
    return folders.find(f => f.id === selectedFolderId)?.name ?? 'Root of Collection'
  }, [selectedFolderId, folders])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCollectionId) {
      toast.error('Please select a collection')
      return
    }
    if (!requestName.trim()) {
      toast.error('Request name is required')
      return
    }

    try {
      await createRequest(selectedCollectionId, selectedFolderId, requestName.trim(), draftRequest)
      onClose()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] animate-in fade-in duration-200" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] bg-surface border border-border rounded-xl shadow-2xl z-[101] p-6 animate-in zoom-in-95 fade-in duration-200">
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-lg font-semibold text-text">Save Request to Collection</Dialog.Title>
            <Dialog.Close className="text-muted hover:text-text transition-colors">
              <X size={20} />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {/* Request Name */}
            <div>
              <label className="text-xs font-semibold text-muted mb-1.5 block uppercase tracking-widest">Request Name</label>
              <input
                autoFocus
                type="text"
                value={requestName}
                onChange={(e) => setRequestName(e.target.value)}
                placeholder="My API Request"
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Collection Selector */}
            <div>
              <label className="text-xs font-semibold text-muted mb-1.5 block uppercase tracking-widest">Collection</label>
              <div className="relative">
                <Globe className="absolute left-3 top-3 text-muted" size={16} />
                <select
                  value={selectedCollectionId || ''}
                  onChange={(e) => handleCollectionChange(Number(e.target.value))}
                  className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-text focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
                >
                  <option value="" disabled>Select a collection</option>
                  {collections.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Folder Tree */}
            {selectedCollectionId && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-muted uppercase tracking-widest">Save Location</label>
                  <span className="text-[10px] text-primary font-medium truncate max-w-[200px]">{selectedFolderName}</span>
                </div>
                <div className="bg-background border border-border rounded-lg p-2 max-h-[200px] overflow-y-auto">
                  {folders.length === 0 ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted italic">
                      <Globe size={14} />
                      Root of Collection (no folders)
                    </div>
                  ) : (
                    <FolderTree
                      folders={folders}
                      selectedFolderId={selectedFolderId}
                      onSelect={setSelectedFolderId}
                    />
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-text hover:bg-background rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!requestName.trim() || !selectedCollectionId}
                className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
