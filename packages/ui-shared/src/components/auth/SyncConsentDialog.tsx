import ReactDOM from 'react-dom'
import { UploadCloud, HardDrive } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'

// §8.3: muncul tepat setelah login sukses (pertama kali atau belakangan
// setelah sempat "Lewati") kalau ada data pra-login yang belum pernah
// tersync — bukan auto-push, user yang memutuskan.

const ENTITY_LABEL: Record<string, string> = {
  team: 'workspace',
  collection: 'collection',
  folder: 'folder',
  request: 'request',
  environment: 'environment',
  example: 'contoh response'
}

export function SyncConsentDialog(): React.JSX.Element | null {
  const { pendingSyncConsent, resolveSyncConsent } = useAuthStore()

  if (!pendingSyncConsent || pendingSyncConsent.length === 0) return null

  const summary = pendingSyncConsent
    .map((p) => `${p.count} ${ENTITY_LABEL[p.entity] ?? p.entity}`)
    .join(', ')

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[500] bg-black/50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="p-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <UploadCloud size={22} className="text-primary" />
          </div>
          <h2 className="text-base font-bold text-text mb-2">Kirim data offline ke server ini?</h2>
          <p className="text-sm text-muted leading-relaxed">
            Anda punya <span className="text-text font-semibold">{summary}</span> yang dibuat sebelum masuk akun
            ini. Data server sudah ditarik ke perangkat ini — sekarang pilih apa yang terjadi dengan data lama Anda.
          </p>
        </div>
        <div className="px-6 pb-6 flex flex-col gap-2">
          <button
            onClick={() => resolveSyncConsent('push')}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-bold transition-colors"
          >
            <UploadCloud size={14} />
            Ya, kirim ke server (jadi workspace baru)
          </button>
          <button
            onClick={() => resolveSyncConsent('exclude')}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-background border border-border hover:border-primary/50 text-text text-sm font-semibold transition-colors"
          >
            <HardDrive size={14} />
            Tidak, simpan di perangkat ini saja
          </button>
          <p className="text-center text-[11px] text-muted mt-1">
            Pilihan ini tidak akan ditanya lagi. Ubah nanti lewat Settings kalau berubah pikiran.
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}
