import { app, ipcMain, BrowserWindow } from 'electron'
import type Database from 'better-sqlite3'
import axios from 'axios'
import https from 'https'
import log from 'electron-log'
import { createLocalRouter, isWapboltApiUrl } from './local/router'
import { backupDb } from './local/db'
import {
  saveRefreshToken,
  getRefreshToken,
  saveSession,
  getSession,
  clearSession,
  getLastFullSyncAt,
  setBiometricEnabled,
  isBiometricEnabled,
  SyncSession
} from './local/sync/session'
import { isBiometricAvailable, promptBiometric } from './biometric'
import {
  createSyncEngine,
  listConflicts,
  resolveConflict,
  getPendingLocalOnlySummary,
  excludePendingLocalOnly,
  HttpFn
} from './local/sync/engine'
import { wipeLocalData } from './local/wipe'

// ─── Agent HTTPS khusus sync (keep-alive, koneksi di-pool) ──────────────────
// PENTING: engine sync menembakkan puluhan–ratusan call SEKUENSIAL (per team →
// per collection → folders + requests). Kalau tiap call bikin https.Agent baru
// tanpa keep-alive, tiap request membuka handshake TLS baru dan koneksi lama
// tidak dilepas rapi. Reverse proxy / STB di depan server punya limit koneksi
// rendah, sehingga koneksi menumpuk sampai server berhenti menerima `connect`
// baru → handshake menggantung sampai TCP timeout OS (~75 detik: gejala
// "connect ETIMEDOUT" di log). Satu agent keep-alive yang di-reuse menekan
// jumlah koneksi TLS ke segelintir socket yang dipakai ulang.
const syncHttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 4, // batasi paralelisme koneksi; engine memang sekuensial
  rejectUnauthorized: false
})

// ─── IPC: LocalRouter vs HTTP passthrough (§2) ──────────────────────────────
// Request ke `/api/v1/...` (Wapbolt sendiri) di-route ke LocalRouter (SQLite).
// Request ke target API arbitrary (tombol "Send" di request builder) TETAP
// lewat httpExecute selamanya — itu memang fungsi utama aplikasi.
// LocalRouter baru mengimplementasikan GET /api/v1/teams (Fase 1); sisanya
// §5.1 masih TODO(Fase 2) dan balik 501 apa adanya.

interface IpcRequestConfig {
  method: string
  url: string
  headers?: Record<string, string>
  body?: any
  body_type?: string
  requestId?: string
  // Base URL Wapbolt yang sedang dikonfigurasi renderer (getBaseUrl()). Dipakai
  // isWapboltApiUrl untuk membedakan API internal Wapbolt dari target arbitrary
  // milik user yang kebetulan juga pakai path /api/v1/... (mis. localhost:3002).
  baseUrl?: string
}

interface IpcResponse {
  status: number
  headers: Record<string, string[]>
  data: unknown
  timing: number
  cancelled?: boolean
}

// Sama seperti apps/desktop: ipcRenderer.invoke tidak bisa dibatalkan sendiri
// dari renderer, jadi cancel dikirim lewat channel terpisah dan dicocokkan ke
// AbortController yang sedang berjalan lewat requestId.
const inFlightRequests = new Map<string, AbortController>()

async function httpExecute(config: IpcRequestConfig): Promise<IpcResponse> {
  const startTime = Date.now()
  const controller = new AbortController()
  if (config.requestId) inFlightRequests.set(config.requestId, controller)
  try {
    let requestData: any = config.body
    const finalHeaders: Record<string, string> = { ...(config.headers || {}) }

    if (config.body_type === 'x-www-form-urlencoded' && Array.isArray(config.body)) {
      const params = new URLSearchParams()
      config.body.forEach((item: any) => {
        if (item.enabled && item.key) {
          params.append(item.key, String(item.value || ''))
        }
      })
      requestData = params
    }

    const response = await axios({
      method: config.method as any,
      url: config.url,
      data: requestData,
      headers: finalHeaders,
      timeout: 30000,
      validateStatus: () => true,
      signal: controller.signal,
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    })

    const timing = Date.now() - startTime
    const normalizedHeaders: Record<string, string[]> = {}
    Object.entries(response.headers).forEach(([key, value]) => {
      normalizedHeaders[key.toLowerCase()] = Array.isArray(value) ? value : [String(value)]
    })

    return { status: response.status, headers: normalizedHeaders, data: response.data, timing }
  } catch (error: any) {
    const timing = Date.now() - startTime
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
      return { status: 0, headers: {}, data: { error: 'Request dibatalkan' }, timing, cancelled: true }
    }
    return {
      status: error.response?.status || 0,
      headers: {},
      data: { error: error.message, details: error.response?.data },
      timing
    }
  } finally {
    if (config.requestId) inFlightRequests.delete(config.requestId)
  }
}

// Bangun HttpFn utk SyncEngine: axios ke server dgn access token yang
// di-refresh dari refresh token tersimpan (satu kali per sesi sync).
async function buildSyncHttp(db: Database.Database, serverUrl: string): Promise<HttpFn | { error: string }> {
  const refreshToken = getRefreshToken(db)
  if (!refreshToken) return { error: 'Belum login ke server (refresh token tidak ada)' }

  const base = serverUrl.replace(/\/$/, '')
  const refreshRes = await axios({
    method: 'POST',
    url: `${base}/api/v1/auth/refresh`,
    data: { refresh_token: refreshToken },
    timeout: 15000,
    validateStatus: () => true,
    httpsAgent: syncHttpsAgent
  })
  if (refreshRes.status !== 200 || !refreshRes.data?.token) {
    return { error: `Refresh token ditolak server (${refreshRes.status})` }
  }
  const accessToken = refreshRes.data.token as string

  // Timeout & retry disetel longgar khusus sync: PULL menarik SELURUH isi
  // server (bukan cuma yang baru) lewat Cloudflare Tunnel → STB, jadi satu
  // response besar / tunnel yang sesekali tersendat gampang menembus timeout
  // lama (30s). Retry hanya untuk kegagalan transport (timeout / network
  // reset), bukan untuk status HTTP — status ditangani engine.
  const SYNC_HTTP_TIMEOUT_MS = 120_000
  const SYNC_HTTP_MAX_ATTEMPTS = 3

  const isRetriableTransportError = (err: unknown): boolean => {
    if (!axios.isAxiosError(err)) return false
    if (err.response) return false // dapat response HTTP → bukan masalah transport
    return (
      err.code === 'ECONNABORTED' || // timeout axios
      err.code === 'ETIMEDOUT' ||
      err.code === 'ECONNRESET' ||
      err.code === 'ECONNREFUSED' ||
      err.code === 'EAI_AGAIN' ||
      err.code === 'ERR_NETWORK'
    )
  }

  const http: HttpFn = async (method, path, body) => {
    let lastErr: unknown
    for (let attempt = 1; attempt <= SYNC_HTTP_MAX_ATTEMPTS; attempt++) {
      const t0 = Date.now()
      try {
        const res = await axios({
          method: method as 'get',
          url: `${base}${path}`,
          data: body,
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          timeout: SYNC_HTTP_TIMEOUT_MS,
          validateStatus: () => true,
          httpsAgent: syncHttpsAgent
        })
        log.info(`[sync] ${method} ${path} → ${res.status} (${Date.now() - t0}ms, attempt ${attempt})`)
        return { status: res.status, data: res.data }
      } catch (err) {
        lastErr = err
        const elapsed = Date.now() - t0
        const message = err instanceof Error ? err.message : String(err)
        if (isRetriableTransportError(err) && attempt < SYNC_HTTP_MAX_ATTEMPTS) {
          const backoff = 1000 * attempt // 1s, 2s
          log.warn(
            `[sync] ${method} ${path} GAGAL (transport) setelah ${elapsed}ms: ${message} — retry ${attempt + 1}/${SYNC_HTTP_MAX_ATTEMPTS} dalam ${backoff}ms`
          )
          await new Promise((r) => setTimeout(r, backoff))
          continue
        }
        log.error(`[sync] ${method} ${path} GAGAL setelah ${elapsed}ms (attempt ${attempt}): ${message}`)
        throw err
      }
    }
    // Tidak tercapai secara logika, tapi jaga-jaga agar tipe balikan aman.
    throw lastErr
  }
  return http
}

// Ubah error mentah (mis. "timeout of 120000ms exceeded" dari axios) menjadi
// pesan yang bisa dipahami user. Sync PULL menarik seluruh isi server lewat
// Cloudflare Tunnel → STB, jadi timeout biasanya berarti data server besar /
// koneksi tersendat, bukan salah user.
function describeSyncError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message)) {
      return 'Sync melebihi batas waktu — koneksi ke server lambat atau data server terlalu besar. Coba lagi; kalau tetap gagal, hubungi admin.'
    }
    if (!err.response) {
      return 'Tidak bisa terhubung ke server. Periksa koneksi internet dan URL server, lalu coba lagi.'
    }
  }
  return err instanceof Error ? err.message : 'Sync gagal'
}

export function registerIpcHandlers(db: Database.Database): void {
  const localRouter = createLocalRouter(db)

  ipcMain.handle('wapbolt:request', async (_event, config: IpcRequestConfig) => {
    if (isWapboltApiUrl(config.url, config.baseUrl)) {
      return localRouter.handle(config)
    }
    return httpExecute(config)
  })
  ipcMain.on('wapbolt:request-cancel', (_e, requestId: string) => {
    inFlightRequests.get(requestId)?.abort()
  })

  // ─── Sesi login-sekali (§8 revisi) ────────────────────────────────────────
  ipcMain.handle('wapbolt:set-token', (_e, token: string) => saveRefreshToken(db, token))
  ipcMain.handle('wapbolt:get-token', () => getRefreshToken(db))
  ipcMain.handle('wapbolt:delete-token', () => {
    // Kalau biometric aktif, logout TIDAK boleh menghapus refresh token/sesi —
    // justru itu gunanya: setelah logout, user masuk lagi cepat via Touch ID.
    // Sesi yang di-guard tetap disimpan; renderer cukup keluar dari state auth.
    // Untuk benar-benar melupakan akun, user pakai "Nonaktifkan Touch ID" atau
    // "Hapus Data Lokal".
    if (isBiometricEnabled(db)) {
      log.info('[biometric] logout: sesi dipertahankan untuk login Touch ID berikutnya')
      return
    }
    clearSession(db)
  })
  ipcMain.handle('wapbolt:save-session', (_e, session: SyncSession) => saveSession(db, session))
  ipcMain.handle('wapbolt:get-session', () => getSession(db))

  // ─── Biometric (Touch ID) — macOS ─────────────────────────────────────────
  // Guard lokal untuk membuka session yang sudah tersimpan tanpa mengetik ulang
  // password. Tidak menyimpan password; refresh token tetap di safeStorage.
  ipcMain.handle('wapbolt:biometric-status', () => {
    // available: perangkat mendukung Touch ID & sudah dikonfigurasi.
    // enabled: user sudah opt-in DAN masih ada session tersimpan untuk dibuka.
    const available = isBiometricAvailable()
    const enabled = available && isBiometricEnabled(db) && getSession(db) !== null
    return { available, enabled }
  })

  // Aktif/nonaktifkan opt-in. Saat mengaktifkan, minta Touch ID sekali sebagai
  // konfirmasi bahwa user memang pemilik sidik jari di perangkat ini.
  ipcMain.handle('wapbolt:biometric-enable', async (_e, enable: boolean) => {
    if (!enable) {
      setBiometricEnabled(db, false)
      return { ok: true }
    }
    if (!isBiometricAvailable()) {
      return { ok: false, error: 'Touch ID tidak tersedia di perangkat ini' }
    }
    if (getSession(db) === null) {
      return { ok: false, error: 'Belum ada sesi login untuk diamankan dengan Touch ID' }
    }
    try {
      await promptBiometric('mengaktifkan login dengan Touch ID')
      setBiometricEnabled(db, true)
      log.info('[biometric] diaktifkan')
      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verifikasi Touch ID gagal'
      log.warn(`[biometric] enable dibatalkan/gagal: ${message}`)
      return { ok: false, error: message }
    }
  })

  // Login via Touch ID: verifikasi lalu kembalikan session tersimpan. Renderer
  // memakai session ini persis seperti hasil rehydrate (getSyncSession).
  ipcMain.handle('wapbolt:biometric-login', async () => {
    if (!isBiometricEnabled(db)) {
      return { ok: false, error: 'Login Touch ID belum diaktifkan' }
    }
    const session = getSession(db)
    if (session === null) {
      // Session hilang (mis. logout di tempat lain) — matikan flag biar konsisten.
      setBiometricEnabled(db, false)
      return { ok: false, error: 'Sesi tidak ditemukan. Silakan login dengan password.' }
    }
    try {
      await promptBiometric('masuk ke Wapbolt Local')
      log.info('[biometric] login sukses')
      return { ok: true, session }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verifikasi Touch ID gagal'
      log.warn(`[biometric] login gagal/dibatalkan: ${message}`)
      return { ok: false, error: message }
    }
  })

  // ─── Sync (§6) ────────────────────────────────────────────────────────────
  ipcMain.handle('wapbolt:sync-now', async (_e, serverUrl: string) => {
    try {
      backupDb(db, db.name) // §10: snapshot sebelum sync menyentuh data
      const httpOrErr = await buildSyncHttp(db, serverUrl)
      if (typeof httpOrErr !== 'function') {
        return { pulled: 0, pushed: 0, conflicts: 0, errors: [httpOrErr.error] }
      }
      const engine = createSyncEngine(db, httpOrErr)
      const result = await engine.syncNow()
      log.info(
        `[sync] selesai: pulled=${result.pulled} pushed=${result.pushed} conflicts=${result.conflicts} errors=${result.errors.length}`
      )
      return result
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      log.error(`[sync] error: ${raw}`)
      return { pulled: 0, pushed: 0, conflicts: 0, errors: [describeSyncError(err)] }
    }
  })

  ipcMain.handle('wapbolt:sync-status', () => {
    // Hitung HANYA row yang benar-benar akan dipush oleh engine. Harus selaras
    // dengan filter di pushEntity/pushTombstones — kalau tidak, badge "Sync
    // Now" menampilkan angka yang tak pernah bisa nol:
    //   - excluded_from_sync = 1 → user pilih "simpan lokal saja" (§8.3),
    //     sengaja tidak akan pernah dipush.
    // Tombstone (deleted_at IS NOT NULL) tetap dihitung karena masih perlu
    // dikirim sebagai DELETE ke server.
    const dirty = db
      .prepare('SELECT COUNT(*) as n FROM sync_meta WHERE dirty = 1 AND excluded_from_sync = 0')
      .get() as { n: number }
    const conflicts = db
      .prepare('SELECT COUNT(*) as n FROM sync_conflicts WHERE resolved_at IS NULL')
      .get() as { n: number }
    return {
      pendingChanges: dirty.n,
      pendingConflicts: conflicts.n,
      lastFullSyncAt: getLastFullSyncAt(db)
    }
  })

  ipcMain.handle('wapbolt:sync-list-conflicts', () => listConflicts(db))
  ipcMain.handle('wapbolt:sync-resolve-conflict', (_e, id: number, resolution: 'local' | 'remote') =>
    resolveConflict(db, id, resolution)
  )

  // ─── Login opsional + consent push data pra-login (§8.2-8.3) ───────────────
  // Dipanggil renderer tepat setelah /api/v1/auth/login sukses (login pertama
  // ATAU belakangan setelah sempat "Lewati"). PULL selalu jalan; PUSH data
  // pra-login menunggu keputusan user lewat sync-login-finish.
  ipcMain.handle('wapbolt:sync-login-pull', async (_e, serverUrl: string) => {
    try {
      backupDb(db, db.name) // §10: snapshot sebelum initial pull menyentuh data
      const httpOrErr = await buildSyncHttp(db, serverUrl)
      if (typeof httpOrErr !== 'function') {
        return { pullSummary: { pulled: 0, pushed: 0, conflicts: 0, errors: [httpOrErr.error] }, pending: [] }
      }
      const engine = createSyncEngine(db, httpOrErr)
      await engine.pull()
      const pending = getPendingLocalOnlySummary(db)
      log.info(`[sync] login-pull selesai, pending pra-login: ${JSON.stringify(pending)}`)
      return { pullSummary: { pulled: 0, pushed: 0, conflicts: 0, errors: [] }, pending }
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      log.error(`[sync] login-pull error: ${raw}`)
      return {
        pullSummary: { pulled: 0, pushed: 0, conflicts: 0, errors: [describeSyncError(err)] },
        pending: []
      }
    }
  })

  ipcMain.handle(
    'wapbolt:sync-login-finish',
    async (_e, serverUrl: string, decision: 'push' | 'exclude') => {
      if (decision === 'exclude') {
        excludePendingLocalOnly(db)
        return { pushed: 0, errors: [] }
      }
      try {
        const httpOrErr = await buildSyncHttp(db, serverUrl)
        if (typeof httpOrErr !== 'function') {
          return { pushed: 0, errors: [httpOrErr.error] }
        }
        const engine = createSyncEngine(db, httpOrErr)
        await engine.push()
        return { pushed: 0, errors: [] }
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err)
        log.error(`[sync] login-finish push error: ${raw}`)
        return { pushed: 0, errors: [describeSyncError(err)] }
      }
    }
  )

  // ─── Hapus data lokal (§8.4) — aksi terpisah, bukan bagian dari logout ─────
  ipcMain.handle('wapbolt:local-data-pending-summary', () => getPendingLocalOnlySummary(db))
  ipcMain.handle('wapbolt:wipe-local-data', () => {
    backupDb(db, db.name) // §10: salinan terakhir sebelum aksi destruktif
    wipeLocalData(db)
    log.info('[wipe] semua data lokal dihapus, di-seed ulang ke state first-run')
  })

  ipcMain.handle('wapbolt:get-version', () => {
    return app.getVersion()
  })

  ipcMain.on('wapbolt:reload', () => {
    BrowserWindow.getFocusedWindow()?.webContents.reloadIgnoringCache()
  })
  ipcMain.on('wapbolt:minimize', () => {
    BrowserWindow.getFocusedWindow()?.minimize()
  })
  ipcMain.on('wapbolt:maximize', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) win.isMaximized() ? win.unmaximize() : win.maximize()
  })
  ipcMain.on('wapbolt:close', () => {
    BrowserWindow.getFocusedWindow()?.close()
  })
}
