import { useCallback, useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { RefreshCw, AlertTriangle, X } from 'lucide-react'
import { toast } from 'sonner'
import { getAppMode } from '../../config/appMode'
import { getBaseUrl } from '../../api/client'
import { useDataStore } from '../../store/useDataStore'

// Tombol "Sync Now" + badge pending/konflik (docs/local-app-design.md §6-§7).
// Hanya dirender saat AppMode.sync aktif (Wapbolt Local) — Cloud tidak pernah
// melihat komponen ini.

interface SyncStatus {
  pendingChanges: number
  pendingConflicts: number
  lastFullSyncAt: string | null
}

interface ConflictRow {
  id: number
  entity: string
  kind: string
  local_id: number
  local_snapshot: string
  remote_snapshot: string
  detected_at: string
}

function snapshotLabel(json: string): string {
  try {
    const parsed = JSON.parse(json)
    if (parsed === null) return '(dihapus)'
    return parsed.name ?? parsed.url ?? '(tanpa nama)'
  } catch {
    return '(tidak terbaca)'
  }
}

function ConflictDialog({
  conflicts,
  onResolve,
  onClose
}: {
  conflicts: ConflictRow[]
  onResolve: (id: number, resolution: 'local' | 'remote') => void
  onClose: () => void
}): React.JSX.Element {
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[400] bg-black/50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 text-sm font-bold text-text">
            <AlertTriangle size={14} className="text-warning" />
            Konflik Sync ({conflicts.length})
          </div>
          <button onClick={onClose} className="text-muted hover:text-text" title="Tutup (konflik tetap pending)">
            <X size={14} />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-border">
          {conflicts.map((c) => (
            <div key={c.id} className="px-4 py-3 text-xs">
              <div className="font-semibold text-text mb-1">
                {c.entity} · {snapshotLabel(c.local_snapshot) !== '(dihapus)' ? snapshotLabel(c.local_snapshot) : snapshotLabel(c.remote_snapshot)}
                <span className="ml-2 text-[10px] uppercase tracking-wide text-muted">{c.kind}</span>
              </div>
              <div className="text-muted mb-2">
                Lokal: {snapshotLabel(c.local_snapshot)} · Server: {snapshotLabel(c.remote_snapshot)}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onResolve(c.id, 'local')}
                  className="px-2.5 py-1 rounded bg-primary text-white font-semibold hover:bg-primary-hover"
                >
                  Pakai punya saya
                </button>
                <button
                  onClick={() => onResolve(c.id, 'remote')}
                  className="px-2.5 py-1 rounded bg-background border border-border text-text font-semibold hover:border-primary/50"
                >
                  Pakai punya server
                </button>
              </div>
            </div>
          ))}
          {conflicts.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-muted">Tidak ada konflik pending.</div>
          )}
        </div>
        <div className="px-4 py-2.5 border-t border-border text-[10px] text-muted">
          Menutup dialog tanpa memilih = konflik tetap pending, tidak ada yang ditimpa (§6.3).
        </div>
      </div>
    </div>,
    document.body
  )
}

export function SyncControls(): React.JSX.Element | null {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [conflicts, setConflicts] = useState<ConflictRow[] | null>(null)

  const refreshStatus = useCallback(async () => {
    if (!window.api?.syncStatus) return
    try {
      setStatus(await window.api.syncStatus())
    } catch {
      /* silent */
    }
  }, [])

  useEffect(() => {
    refreshStatus()
    const id = setInterval(refreshStatus, 5000)
    return () => clearInterval(id)
  }, [refreshStatus])

  if (!getAppMode().sync || !window.api?.syncNow) return null

  const refetchAll = async (): Promise<void> => {
    const store = useDataStore.getState()
    await store.fetchTeams()
    if (store.activeTeamId) {
      await store.fetchCollections(store.activeTeamId)
      store.fetchEnvironments(store.activeTeamId)
    }
  }

  const handleSync = async (): Promise<void> => {
    if (syncing) return
    setSyncing(true)
    try {
      const summary = await window.api.syncNow!(getBaseUrl())
      await refetchAll()
      await refreshStatus()
      if (summary.errors.length > 0) {
        toast.error(`Sync selesai dengan error: ${summary.errors[0]}`, { duration: 6000 })
      } else {
        toast.success(
          `Sync selesai — ${summary.pulled} pulled, ${summary.pushed} pushed, ${summary.conflicts} konflik`,
          { id: 'sync-summary' }
        )
      }
      if (summary.conflicts > 0 && window.api?.syncListConflicts) {
        setConflicts((await window.api.syncListConflicts()) as ConflictRow[])
      }
    } catch (err) {
      toast.error(`Sync gagal: ${err instanceof Error ? err.message : 'unknown'}`)
    } finally {
      setSyncing(false)
    }
  }

  const openConflicts = async (): Promise<void> => {
    if (!window.api?.syncListConflicts) return
    setConflicts((await window.api.syncListConflicts()) as ConflictRow[])
  }

  const handleResolve = async (id: number, resolution: 'local' | 'remote'): Promise<void> => {
    if (!window.api?.syncResolveConflict) return
    await window.api.syncResolveConflict(id, resolution)
    if (resolution === 'remote') await refetchAll()
    await refreshStatus()
    if (window.api?.syncListConflicts) {
      setConflicts((await window.api.syncListConflicts()) as ConflictRow[])
    }
  }

  const pendingConflicts = status?.pendingConflicts ?? 0
  const pendingChanges = status?.pendingChanges ?? 0

  return (
    <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      {pendingConflicts > 0 && (
        <button
          onClick={openConflicts}
          className="flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-bold bg-danger/15 text-danger hover:bg-danger/25 transition-colors"
          title={`${pendingConflicts} konflik menunggu keputusan`}
        >
          <AlertTriangle size={11} />
          {pendingConflicts}
        </button>
      )}
      <button
        onClick={handleSync}
        disabled={syncing}
        className="relative flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-semibold text-muted hover:text-text hover:bg-surface transition-colors disabled:opacity-60"
        title={
          status?.lastFullSyncAt
            ? `Sync terakhir: ${new Date(status.lastFullSyncAt).toLocaleString()}`
            : 'Belum pernah sync'
        }
      >
        <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
        {syncing ? 'Syncing…' : 'Sync Now'}
        {pendingChanges > 0 && !syncing && (
          <span className="absolute -top-0.5 -right-0.5 min-w-3.5 h-3.5 px-0.5 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
            {pendingChanges > 99 ? '99+' : pendingChanges}
          </span>
        )}
      </button>
      {conflicts !== null && (
        <ConflictDialog conflicts={conflicts} onResolve={handleResolve} onClose={() => setConflicts(null)} />
      )}
    </div>
  )
}
