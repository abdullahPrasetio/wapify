import { LucideIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface ContextMenuItem {
  label: string
  icon: LucideIcon
  onClick: () => void
  variant?: 'default' | 'danger'
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export const ContextMenu = ({ x, y, items, onClose }: ContextMenuProps): React.JSX.Element => {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Prevent menu from going off screen
  const menuX = Math.min(x, window.innerWidth - 160)
  const menuY = Math.min(y, window.innerHeight - 200)

  return (
    <div
      ref={menuRef}
      className="fixed z-[200] w-48 bg-surface border border-border rounded-lg shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: menuX, top: menuY }}
    >
      {items.map((item, idx) => (
        <button
          key={idx}
          onClick={(e): void => {
            e.stopPropagation()
            item.onClick()
            onClose()
          }}
          className={`w-full flex items-center gap-3 px-3 py-2 text-xs transition-colors ${
            item.variant === 'danger'
              ? 'text-danger hover:bg-danger/10'
              : 'text-text hover:bg-background'
          }`}
        >
          <item.icon size={14} className={item.variant === 'danger' ? 'text-danger' : 'text-muted'} />
          <span className="font-medium">{item.label}</span>
        </button>
      ))}
    </div>
  )
}
