import * as Dialog from '@radix-ui/react-dialog'
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

interface PromptModalProps {
  title: string
  description?: string
  placeholder?: string
  defaultValue?: string
  isOpen: boolean
  onClose: () => void
  onSubmit: (value: string) => void
}

export const PromptModal = ({
  title,
  description,
  placeholder,
  defaultValue = '',
  isOpen,
  onClose,
  onSubmit
}: PromptModalProps): React.JSX.Element => {
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    if (isOpen && setValue) {
      setTimeout(() => setValue(defaultValue), 0)
    }
  }, [isOpen, defaultValue])

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (value.trim()) {
      onSubmit(value.trim())
      onClose()
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] animate-in fade-in duration-200" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-surface border border-border rounded-xl shadow-2xl z-[101] p-6 animate-in zoom-in-95 fade-in duration-200">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold text-text">{title}</Dialog.Title>
            <Dialog.Close className="text-muted hover:text-text transition-colors">
              <X size={20} />
            </Dialog.Close>
          </div>

          {description && (
            <Dialog.Description className="text-sm text-muted mb-4">
              {description}
            </Dialog.Description>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                autoFocus
                type="text"
                value={value}
                onChange={(e): void => setValue(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-text hover:bg-background rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!value.trim()}
                className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                Create
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
