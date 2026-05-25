import { Bell, Search, Trash2, CheckCircle, Clock, ArrowLeft } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useNotificationStore, Notification } from '../../store/useNotificationStore'
import { useAppStore } from '../../store/useAppStore'
import { formatDistanceToNow } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { useDataStore } from '../../store/useDataStore'

export const ActivityLogView = () => {
  const { notifications, markAllAsRead, markAsRead, clearAllNotifications } = useNotificationStore()
  const { setActiveView } = useAppStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const handleNotificationClick = async (n: Notification) => {
    markAsRead(n.id)

    // Deep linking logic
    if (n.metadata?.request_id || n.metadata?.collection_id) {
      setActiveView('request-builder')

      if (n.metadata.collection_id) {
        useDataStore.getState().toggleExpand(`collection-${n.metadata.collection_id}`)
        await useDataStore.getState().fetchCollectionContents(n.metadata.collection_id)
      }

      if (n.metadata.request_id) {
        const req = useDataStore.getState().requests.find(r => r.id === n.metadata.request_id)
        if (req) {
          useDataStore.getState().openRequestInTab(req)
        }
      }
    }
  }

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      const matchesSearch = n.message.toLowerCase().includes(search.toLowerCase()) || 
                            n.title.toLowerCase().includes(search.toLowerCase()) ||
                            (n.sender?.name || '').toLowerCase().includes(search.toLowerCase())
      
      const matchesFilter = filter === 'all' || !n.is_read
      return matchesSearch && matchesFilter
    })
  }, [notifications, search, filter])

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Header */}
      <div className="px-8 py-6 border-b border-border flex items-center justify-between bg-surface/30 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setActiveView('request-builder')}
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-muted hover:text-text cursor-pointer"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-black text-text italic uppercase tracking-tighter">Activity Log</h1>
            <p className="text-xs text-muted font-bold uppercase tracking-widest">Workspace collaborations & updates</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={markAllAsRead}
            className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 border border-primary/20 cursor-pointer"
          >
            <CheckCircle size={14} />
            Mark all as read
          </button>
          <button 
            onClick={() => {
              if (confirm('Are you sure you want to delete all notifications? This cannot be undone.')) {
                clearAllNotifications()
              }
            }}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 border border-red-500/20 cursor-pointer"
          >
            <Trash2 size={14} />
            Clear Activities
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-8 py-4 border-b border-border flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input 
            type="text"
            placeholder="Search activities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2 text-xs text-text focus:outline-none focus:border-primary transition-all shadow-inner"
          />
        </div>

        <div className="flex items-center gap-1 bg-surface border border-border p-1 rounded-xl shadow-inner">
          <button 
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${filter === 'all' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted hover:text-text'}`}
          >
            All
          </button>
          <button 
            onClick={() => setFilter('unread')}
            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${filter === 'unread' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted hover:text-text'}`}
          >
            Unread
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {filteredNotifications.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20">
            <div className="w-24 h-24 bg-surface border border-border rounded-[2.5rem] flex items-center justify-center mb-6 shadow-2xl">
              <Bell size={40} className="text-muted" />
            </div>
            <h3 className="text-lg font-black text-text uppercase italic mb-2">No activities found</h3>
            <p className="text-sm text-muted max-w-xs">There are no collaboration activities to show right now.</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4">
                {filteredNotifications.map((n) => (
              <div 
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`group p-4 bg-surface border border-border rounded-2xl flex gap-4 transition-all hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 cursor-pointer relative ${!n.is_read ? 'shadow-lg shadow-primary/5 border-primary/20' : ''}`}
              >
                {!n.is_read && (
                  <div className="absolute left-[-4px] top-4 bottom-4 w-2 bg-primary rounded-full" />
                )}
                
                <div className="shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-primary font-black text-lg shadow-inner">
                    {n.sender?.name?.[0].toUpperCase() || 'S'}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-text">{n.sender?.name || 'System'}</span>
                      <span className="text-[10px] text-muted font-black uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-full border border-border/50">
                        {n.type.replace('ENTITY_', '')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] text-muted flex items-center gap-1.5 font-medium">
                        <Clock size={12} className="text-muted/50" />
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: idLocale })}
                      </span>
                    </div>
                  </div>
                  <h4 className="text-sm font-bold text-text/90 mb-1">{n.title}</h4>
                  <p className="text-sm text-muted leading-relaxed">{n.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
