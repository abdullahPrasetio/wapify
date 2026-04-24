import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { X, Terminal, ArrowRight } from 'lucide-react'
import { parseCurlCommand } from '../../utils/curlParser'
import { toast } from 'sonner'

interface ImportCurlModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (data: any) => void
}

export const ImportCurlModal = ({
  isOpen,
  onClose,
  onImport
}: ImportCurlModalProps): React.JSX.Element => {
  const [curlCommand, setCurlCommand] = useState('')

  const handleImport = async () => {
    if (!curlCommand.trim()) return

    const parsed = await parseCurlCommand(curlCommand)
    if (parsed) {
      onImport(parsed)
      toast.success('cURL command imported successfully')
      setCurlCommand('')
      onClose()
    } else {
      toast.error('Failed to parse cURL command. Please check the syntax.')
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] animate-in fade-in duration-200" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl z-[160] overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Terminal size={18} />
              </div>
              <Dialog.Title className="text-sm font-bold text-text uppercase tracking-widest">
                Import from cURL
              </Dialog.Title>
            </div>
            <Dialog.Close className="text-muted hover:text-text transition-colors">
              <X size={20} />
            </Dialog.Close>
          </div>

          <div className="p-6">
            <p className="text-xs text-muted mb-4 font-medium leading-relaxed">
              Paste your cURL command below. It will automatically detect headers, method, URL, and body.
            </p>

            <textarea
              autoFocus
              value={curlCommand}
              onChange={(e) => setCurlCommand(e.target.value)}
              placeholder="curl -X POST https://api.example.com..."
              className="w-full h-48 bg-background border border-border rounded-xl p-4 text-sm font-mono text-text focus:outline-none focus:border-primary transition-all resize-none placeholder:text-muted/30 shadow-inner"
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-muted hover:text-text transition-colors uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!curlCommand.trim()}
                className="px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:grayscale"
              >
                Import Request <ArrowRight size={14} strokeWidth={3} />
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
