import React, { useEffect } from 'react'
import { X, Keyboard } from 'lucide-react'

interface ShortcutRowProps {
  keys: string[]
  label: string
}

const isMac = navigator.platform.toUpperCase().includes('MAC')
const Mod = isMac ? '⌘' : 'Ctrl'
const Alt = isMac ? '⌥' : 'Alt'

function Key({ k }: { k: string }): React.JSX.Element {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[26px] h-[22px] px-1.5 rounded bg-surface border border-border text-[11px] font-mono font-semibold text-text shadow-sm">
      {k}
    </kbd>
  )
}

function ShortcutRow({ keys, label }: ShortcutRowProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-muted text-xs">+</span>}
            <Key k={k} />
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div>
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary mb-2">{title}</h3>
      <div className="mb-4">{children}</div>
    </div>
  )
}

interface KeyboardShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const KeyboardShortcutsModal = ({ isOpen, onClose }: KeyboardShortcutsModalProps): React.JSX.Element | null => {
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface border border-border rounded-xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-white/5 shrink-0">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Keyboard size={16} className="text-primary" />
            Keyboard Shortcuts
          </h2>
          <button onClick={onClose} className="text-muted hover:text-text transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto grid grid-cols-2 gap-x-8">
          <div>
            <Section title="Global">
              <ShortcutRow keys={[Mod, 'T']} label="New request tab" />
              <ShortcutRow keys={[Mod, 'W']} label="Close active tab" />
              <ShortcutRow keys={[Alt, Mod, 'W']} label="Force close tab" />
              <ShortcutRow keys={['Shift', '?']} label="Keyboard shortcuts" />
            </Section>

            <Section title="Request Editor">
              <ShortcutRow keys={[Mod, '↵']} label="Send request" />
              <ShortcutRow keys={[Mod, 'S']} label="Save request" />
            </Section>
          </div>

          <div>
            <Section title="Tab Navigation">
              <ShortcutRow keys={[Mod, '1–9']} label="Switch to tab N" />
            </Section>

            <Section title="WebSocket">
              <ShortcutRow keys={[Mod, '↵']} label="Send message" />
            </Section>

            <Section title="Collection Runner">
              <ShortcutRow keys={['Esc']} label="Close panel" />
            </Section>

            <Section title="Modals & Panels">
              <ShortcutRow keys={['Esc']} label="Close modal / panel" />
            </Section>
          </div>
        </div>

        <div className="px-5 pb-4 text-center text-xs text-muted shrink-0">
          Press <Key k="Esc" /> or click outside to close
        </div>
      </div>
    </div>
  )
}
