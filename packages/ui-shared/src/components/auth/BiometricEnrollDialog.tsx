import { useState } from 'react'
import ReactDOM from 'react-dom'
import { Fingerprint } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'

// Muncul sekali setelah login lokal sukses di macOS ber-Touch ID yang belum
// opt-in. Menawarkan (bukan memaksa) mengamankan sesi tersimpan dengan Touch
// ID agar login berikutnya cukup sidik jari. Consent sync (§8.3) diprioritaskan
// dulu supaya dialog tidak menumpuk.

export function BiometricEnrollDialog(): React.JSX.Element | null {
  const { pendingBiometricEnroll, pendingSyncConsent, resolveBiometricEnroll } = useAuthStore()
  const [working, setWorking] = useState(false)

  if (!pendingBiometricEnroll) return null
  // Biarkan dialog consent sync selesai lebih dulu.
  if (pendingSyncConsent && pendingSyncConsent.length > 0) return null

  const handle = async (enable: boolean): Promise<void> => {
    setWorking(true)
    try {
      await resolveBiometricEnroll(enable)
    } finally {
      setWorking(false)
    }
  }

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[500] bg-black/50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="p-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <Fingerprint size={22} className="text-primary" />
          </div>
          <h2 className="text-base font-bold text-text mb-2">Aktifkan login dengan Touch ID?</h2>
          <p className="text-sm text-muted leading-relaxed">
            Login berikutnya cukup pakai sidik jari, tanpa mengetik email dan password. Kredensial Anda tetap
            tersimpan aman di perangkat ini dan hanya dibuka setelah Touch ID berhasil.
          </p>
        </div>
        <div className="px-6 pb-6 flex flex-col gap-2">
          <button
            onClick={() => handle(true)}
            disabled={working}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-bold transition-colors disabled:opacity-60"
          >
            <Fingerprint size={14} />
            {working ? 'Memverifikasi…' : 'Ya, aktifkan Touch ID'}
          </button>
          <button
            onClick={() => handle(false)}
            disabled={working}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-background border border-border hover:border-primary/50 text-text text-sm font-semibold transition-colors disabled:opacity-60"
          >
            Nanti saja
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
