import { Bell, X } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNotificationStore, Notification } from '../../store/useNotificationStore'
import { formatDistanceToNow } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { useDataStore } from '../../store/useDataStore'
import { useAppStore } from '../../store/useAppStore'

export const NotificationBell = () => {
  const { unreadCount, notifications, fetchNotifications, markAsRead, markAllAsRead } = useNotificationStore()
  const { setActiveView } = useAppStore()
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState({ bottom: 0, left: 0 })

  useEffect(() => {
    fetchNotifications()
  }, [])

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setCoords({
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left
      })
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      window.addEventListener('resize', () => setIsOpen(false))
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('resize', () => setIsOpen(false))
    }
  }, [isOpen])

  const handleNotificationClick = async (n: Notification) => {
    markAsRead(n.id)

    // Deep linking logic
    if (n.metadata?.request_id || n.metadata?.collection_id) {
      setActiveView('request-builder')

      if (n.metadata.collection_id) {
        // Ensure collection is expanded and contents are loaded
        useDataStore.getState().toggleExpand(`collection-${n.metadata.collection_id}`)
        await useDataStore.getState().fetchCollectionContents(n.metadata.collection_id)
      }

      if (n.metadata.request_id) {
        // Find the request in the newly loaded contents and open it
        const req = useDataStore.getState().requests.find(r => r.id === n.metadata.request_id)
        if (req) {
          useDataStore.getState().openRequestInTab(req)
        }
      }
      setIsOpen(false)
    }
  }

  const dropdownContent = (
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        bottom: `${coords.bottom}px`,
        left: `${coords.left}px`,
      }}
      className="w-80 bg-surface border border-border rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[9999] overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-white/5 backdrop-blur-md">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text">Notifications</h3>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                markAllAsRead()
              }}
              className="text-[9px] text-primary hover:text-primary-hover font-black uppercase tracking-wider"
            >
              Clear All
            </button>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="text-muted hover:text-text transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
        {notifications.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center text-center opacity-40">
            <Bell size={24} className="mb-2" />
            <p className="text-[10px] font-bold uppercase tracking-widest">No notifications</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {notifications.slice(0, 5).map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`px-4 py-3 flex gap-3 cursor-pointer hover:bg-white/5 transition-colors relative ${!n.is_read ? 'bg-primary/5' : ''}`}
              >
                {!n.is_read && (
                  <div className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r" />
                )}
                <div className="shrink-0 mt-0.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-primary font-black text-[10px] shadow-inner">
                    {n.sender?.name?.[0].toUpperCase() || 'S'}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[11px] font-bold text-text truncate">
                      {n.sender?.name || 'System'}
                    </span>
                    <span className="text-[9px] text-muted/60 shrink-0 flex items-center gap-1 font-medium">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: idLocale })}
                    </span>
                  </div>
                  <p className="text-[11px] text-text/70 leading-relaxed line-clamp-2 font-medium">
                    {n.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-2 bg-white/5 border-t border-border flex justify-center">
        <button
          onClick={() => {
            setActiveView('activity-log')
            setIsOpen(false)
          }}
          className="text-[9px] text-muted hover:text-text font-black uppercase tracking-widest transition-colors"
        >
          View all activity
        </button>
      </div>
    </div>
  )

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`relative transition-all p-1.5 rounded-lg hover:bg-white/10 ${isOpen ? 'text-primary bg-white/10' : 'text-muted hover:text-text'}`}
      >
        <Bell size={14} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-danger rounded-full border-2 border-surface animate-pulse" />
        )}
      </button>

      {isOpen && createPortal(dropdownContent, document.body)}
    </div>
  )
}
