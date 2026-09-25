import { systemPreferences } from 'electron'

// Biometric (Touch ID) khusus macOS. Ini HANYA gerbang autentikasi lokal —
// tidak menyimpan password. Refresh token + session sudah tersimpan aman via
// safeStorage (lihat local/sync/session.ts); Touch ID hanya membuka akses ke
// session yang sudah ada supaya user tidak perlu mengetik ulang kredensial.
//
// systemPreferences.canPromptTouchID() / promptTouchID() hanya tersedia di
// darwin. Di platform lain, semua fungsi di sini balik "tidak tersedia"
// dengan aman.

export function isBiometricAvailable(): boolean {
  if (process.platform !== 'darwin') return false
  try {
    // canPromptTouchID true kalau perangkat punya Touch ID DAN user sudah
    // mendaftarkan sidik jari. Bisa lempar di macOS lama — bungkus try/catch.
    return systemPreferences.canPromptTouchID()
  } catch {
    return false
  }
}

// Munculkan prompt Touch ID. Resolve kalau user lolos, reject kalau gagal/
// dibatalkan. `reason` tampil di dialog sistem ("... ingin <reason>").
export async function promptBiometric(reason: string): Promise<void> {
  if (process.platform !== 'darwin') {
    throw new Error('Biometric hanya tersedia di macOS')
  }
  if (!isBiometricAvailable()) {
    throw new Error('Touch ID tidak tersedia atau belum dikonfigurasi di perangkat ini')
  }
  // promptTouchID reject dengan Error kalau gagal/cancel — biarkan naik ke caller.
  await systemPreferences.promptTouchID(reason)
}
