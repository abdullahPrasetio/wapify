import * as Dialog from '@radix-ui/react-dialog'
import { FileDown, X } from 'lucide-react'
import { useState } from 'react'
import { useDataStore } from '../../store/useDataStore'

export const ImportModal = (): React.JSX.Element => {
  const [open, setOpen] = useState(false)
  const [jsonContent, setJsonContent] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const { importCollection } = useDataStore()

  const handleImport = async (): Promise<void> => {
    if (!jsonContent.trim()) return
    setIsImporting(true)
    await importCollection(jsonContent)
    setIsImporting(false)
    setJsonContent('')
    setOpen(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event): void => {
      const content = event.target?.result as string
      setJsonContent(content)
    }
    reader.readAsText(file)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          title="Import Collection"
          className="text-muted hover:text-text transition-colors p-1"
        >
          <FileDown size={14} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-300" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl z-50 p-6 animate-in zoom-in-95 fade-in duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <FileDown size={20} />
              </div>
              <div>
                <Dialog.Title className="text-lg font-bold text-text">
                  Import Collection
                </Dialog.Title>
                <Dialog.Description className="text-xs text-muted">
                  Import Postman Collection (v2.1) via JSON file or paste content
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close className="text-muted hover:text-text transition-colors">
              <X size={20} />
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">
                Upload File
              </label>
              <div className="relative group">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="border-2 border-dashed border-border group-hover:border-primary rounded-lg p-8 flex flex-col items-center justify-center transition-colors bg-background/50">
                  <FileDown size={24} className="text-muted group-hover:text-primary mb-2" />
                  <span className="text-sm text-text font-medium">
                    Click to upload or drag & drop
                  </span>
                  <span className="text-xs text-muted">Postman Collection JSON</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface px-2 text-muted font-bold tracking-widest">OR</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">
                Paste JSON
              </label>
              <textarea
                value={jsonContent}
                onChange={(e): void => setJsonContent(e.target.value)}
                placeholder='{ "info": { ... }, "item": [ ... ] }'
                className="w-full h-40 bg-background border border-border rounded-lg p-3 text-xs font-mono text-text placeholder:text-muted focus:outline-none focus:border-primary resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8">
            <Dialog.Close asChild>
              <button className="px-4 py-2 text-sm font-medium text-text hover:bg-background rounded-lg transition-colors">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleImport}
              disabled={isImporting || !jsonContent.trim()}
              className="px-6 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-lg shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:scale-95 flex items-center gap-2"
            >
              {isImporting ? 'Importing...' : 'Import Now'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
