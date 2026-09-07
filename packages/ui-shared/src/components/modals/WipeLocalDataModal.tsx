import { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useDataStore } from '../../store/useDataStore'

// §8.4: aksi terpisah dari logout — TIDAK pernah dipicu otomatis. Wajib
// memperingatkan kalau ada data pra-login yang cuma ada lokal (dirty,
// remote_id NULL, belum di-exclude) sebelum mengizinkan hapus.

interface PendingSummary {
  entity: string
  count: number
}

const ENTITY_LABEL: Record<string, string> = {
  team: 'workspace',
  collection: 'collection',
  folder: 'folder',
  request: 'request',
  environment: 'environment',
  example: 'contoh response'
}

export function WipeLocalDataModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [pending, setPending] = useState<PendingSummary[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [wiping, setWiping] = useState(false)

  useEffect(() => {
    if (!window.api?.localDataPendingSummary) {
      setLoading(false)
      return
    }
    window.api
      .localDataPendingSummary()
      .then(setPending)
      .finally(() => setLoading(false))
  }, [])

  const handleWipe = async (): Promise<void> => {
    if (!window.api?.wipeLocalData) return
    setWiping(true)
    try {
      await window.api.wipeLocalData()
      toast.success('Semua data lokal telah dihapus')
      onClose()
      const store = useDataStore.getState()
      await store.fetchTeams()
    } catch (err) {
      toast.error(`Gagal menghapus data: ${err instanceof Error ? err.message : 'unknown'}`)
    } finally {
      setWiping(false)
    }
  }

  const hasUnsynced = !loading && pending !== null && pending.length > 0

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[500] bg-black/50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2 text-sm font-bold text-danger">
            <Trash2 size={14} />
            Hapus Semua Data Lokal
          </div>
          <button onClick={onClose} className="text-muted hover:text-text" title="Batal">
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-text leading-relaxed">
            Ini akan menghapus <span className="font-semibold">semua</span> team, collection, folder, dan request
            yang tersimpan di perangkat ini. Tindakan ini <span className="font-semibold">tidak bisa dibatalkan</span>.
          </p>

          {loading && <p className="text-xs text-muted">Memeriksa data belum tersinkron…</p>}

          {hasUnsynced && (
            <div className="flex items-start gap-2.5 bg-danger/10 border border-danger/30 rounded-lg px-3.5 py-3">
              <AlertTriangle size={16} className="text-danger shrink-0 mt-0.5" />
              <div className="text-xs text-danger leading-relaxed">
                <span className="font-bold">Perhatian:</span> ada{' '}
                {pending!.map((p) => `${p.count} ${ENTITY_LABEL[p.entity] ?? p.entity}`).join(', ')} yang{' '}
                <span className="font-bold">belum pernah dikirim ke server</span> — satu-satunya salinan ada di
                perangkat ini. Menghapus sekarang akan menghilangkannya secara permanen.
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg bg-background border border-border text-text text-sm font-semibold hover:border-primary/50 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleWipe}
              disabled={wiping || loading}
              className="flex-1 py-2.5 rounded-lg bg-danger hover:bg-danger/90 text-white text-sm font-bold transition-colors disabled:opacity-60"
            >
              {wiping ? 'Menghapus…' : 'Ya, Hapus Semua'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
