import * as Dialog from '@radix-ui/react-dialog'
import { useState, useEffect } from 'react'
import { X, Folder, Globe } from 'lucide-react'
import { useDataStore } from '../../store/useDataStore'
import { toast } from 'sonner'
import { ApiRequest } from '../../types'

interface SaveRequestLocationModalProps {
  isOpen: boolean
  onClose: () => void
  draftRequest: Partial<ApiRequest>
  draftId: string
}

export const SaveRequestLocationModal = ({
  isOpen,
  onClose,
  draftRequest,
  draftId
}: SaveRequestLocationModalProps): React.JSX.Element => {
  const { collections, foldersByCollection, createRequest, tabs } = useDataStore()
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null)
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null)
  const [requestName, setRequestName] = useState(draftRequest.name || 'New Request')

  useEffect(() => {
    if (isOpen) {
      if (collections.length > 0 && !selectedCollectionId) {
        setSelectedCollectionId(collections[0].id)
      }
      // Extract name from draft if possible (Wapbolt draft tabs usually have name)
      const tab = tabs.find(t => t.requestId === draftId)
      if (tab) {
         let name = tab.name
         if (name.startsWith('[Draft] ')) name = name.replace('[Draft] ', '')
         setRequestName(name)
      }
    }
  }, [isOpen, collections, draftId, tabs, selectedCollectionId])

  const folders = selectedCollectionId ? (foldersByCollection[selectedCollectionId] || []) : []

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
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] bg-surface border border-border rounded-xl shadow-2xl z-[101] p-6 animate-in zoom-in-95 fade-in duration-200">
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-lg font-semibold text-text">Save Request to Collection</Dialog.Title>
            <Dialog.Close className="text-muted hover:text-text transition-colors">
              <X size={20} />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted mb-1.5 block">Request Name</label>
              <input
                autoFocus
                type="text"
                value={requestName}
                onChange={(e) => setRequestName(e.target.value)}
                placeholder="My API Request"
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted mb-1.5 block">Collection</label>
              <div className="relative">
                <Globe className="absolute left-3 top-3 text-muted" size={16} />
                <select
                  value={selectedCollectionId || ''}
                  onChange={(e) => {
                    setSelectedCollectionId(Number(e.target.value))
                    setSelectedFolderId(null)
                  }}
                  className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-text focus:outline-none focus:border-primary transition-colors appearance-none"
                >
                  <option value="" disabled>Select a collection</option>
                  {collections.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedCollectionId && (
              <div>
                <label className="text-xs font-semibold text-muted mb-1.5 block">Folder (Optional)</label>
                <div className="relative">
                  <Folder className="absolute left-3 top-3 text-muted" size={16} />
                  <select
                    value={selectedFolderId || ''}
                    onChange={(e) => setSelectedFolderId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-text focus:outline-none focus:border-primary transition-colors appearance-none"
                  >
                    <option value="">No Folder (Root of Collection)</option>
                    {folders.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
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
