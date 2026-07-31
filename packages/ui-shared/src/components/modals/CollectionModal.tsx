import React, { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Folder, BookOpen, Save } from 'lucide-react'
import { useDataStore } from '../../store/useDataStore'

interface CollectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { name: string, description: string, confluence_page_id: string }) => void
  initialData?: {
    name: string
    description: string
    confluence_page_id: string
  }
  title: string
  submitText: string
}

export const CollectionModal: React.FC<CollectionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  title,
  submitText
}) => {
  const { confluenceEnabled } = useDataStore()
  const [data, setData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    confluence_page_id: initialData?.confluence_page_id || ''
  })

  useEffect(() => {
    if (isOpen) {
      setData({
        name: initialData?.name || '',
        description: initialData?.description || '',
        confluence_page_id: initialData?.confluence_page_id || ''
      })
    }
  }, [isOpen, initialData])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (data.name.trim()) {
      onSubmit(data)
      onClose()
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] animate-in fade-in duration-200" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] bg-surface border border-border rounded-xl shadow-2xl z-[101] p-0 animate-in zoom-in-95 fade-in duration-200 overflow-hidden">
          <div className="p-6 border-b border-border bg-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                <Folder size={18} />
              </div>
              <Dialog.Title className="text-lg font-bold text-text">{title}</Dialog.Title>
            </div>
            <Dialog.Close className="text-muted hover:text-text transition-colors">
              <X size={20} />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Name */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] block">
                Collection Name
              </label>
              <input
                autoFocus
                type="text"
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                placeholder="My Awesome API"
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text focus:outline-none focus:border-primary transition-colors"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] block">
                Description
              </label>
              <textarea
                value={data.description}
                onChange={(e) => setData({ ...data, description: e.target.value })}
                placeholder="Describe what this collection is about..."
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text focus:outline-none focus:border-primary transition-colors h-24 resize-none"
              />
            </div>

            {/* Confluence ID */}
            {confluenceEnabled && (
              <div className="space-y-2 pt-4 border-t border-border/50">
                <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-2">
                  <BookOpen size={12} className="text-blue-500" /> Confluence Page ID
                </label>
                <input
                  type="text"
                  value={data.confluence_page_id}
                  onChange={(e) => setData({ ...data, confluence_page_id: e.target.value })}
                  placeholder="123456789"
                  className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text focus:outline-none focus:border-primary transition-colors font-mono"
                />
                <p className="text-[9px] text-muted italic">Required if you want to sync documentation to Confluence.</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 text-xs font-semibold text-text hover:bg-background rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!data.name.trim()}
                className="px-6 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
              >
                <Save size={14} />
                {submitText}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
