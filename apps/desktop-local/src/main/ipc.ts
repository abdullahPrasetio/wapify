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
  SyncSession
} from './local/sync/session'
import {
  createSyncEngine,
  listConflicts,
  resolveConflict,
  getPendingLocalOnlySummary,
  excludePendingLocalOnly,
  HttpFn
} from './local/sync/engine'
import { wipeLocalData } from './local/wipe'

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
}

interface IpcResponse {
  status: number
  headers: Record<string, string[]>
  data: unknown
  timing: number
}

async function httpExecute(config: IpcRequestConfig): Promise<IpcResponse> {
  const startTime = Date.now()
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
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    })

    const timing = Date.now() - startTime
    const normalizedHeaders: Record<string, string[]> = {}
    Object.entries(response.headers).forEach(([key, value]) => {
      normalizedHeaders[key.toLowerCase()] = Array.isArray(value) ? value : [String(value)]
    })

    return { status: response.status, headers: normalizedHeaders, data: response.data, timing }
  } catch (error: any) {
    return {
      status: error.response?.status || 0,
      headers: {},
      data: { error: error.message, details: error.response?.data },
      timing: Date.now() - startTime
    }
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
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  })
  if (refreshRes.status !== 200 || !refreshRes.data?.token) {
    return { error: `Refresh token ditolak server (${refreshRes.status})` }
  }
  const accessToken = refreshRes.data.token as string

  const http: HttpFn = async (method, path, body) => {
    const res = await axios({
      method: method as 'get',
      url: `${base}${path}`,
      data: body,
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      timeout: 30000,
      validateStatus: () => true,
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    })
    return { status: res.status, data: res.data }
  }
  return http
}

export function registerIpcHandlers(db: Database.Database): void {
  const localRouter = createLocalRouter(db)

  ipcMain.handle('wapbolt:request', async (_event, config: IpcRequestConfig) => {
    if (isWapboltApiUrl(config.url)) {
      return localRouter.handle(config)
    }
    return httpExecute(config)
  })

  // ─── Sesi login-sekali (§8 revisi) ────────────────────────────────────────
  ipcMain.handle('wapbolt:set-token', (_e, token: string) => saveRefreshToken(db, token))
  ipcMain.handle('wapbolt:get-token', () => getRefreshToken(db))
  ipcMain.handle('wapbolt:delete-token', () => {
    clearSession(db)
  })
  ipcMain.handle('wapbolt:save-session', (_e, session: SyncSession) => saveSession(db, session))
  ipcMain.handle('wapbolt:get-session', () => getSession(db))

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
      const message = err instanceof Error ? err.message : 'Sync gagal'
      log.error(`[sync] error: ${message}`)
      return { pulled: 0, pushed: 0, conflicts: 0, errors: [message] }
    }
  })

  ipcMain.handle('wapbolt:sync-status', () => {
    const dirty = db
      .prepare('SELECT COUNT(*) as n FROM sync_meta WHERE dirty = 1')
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
      const message = err instanceof Error ? err.message : 'Pull gagal'
      log.error(`[sync] login-pull error: ${message}`)
      return { pullSummary: { pulled: 0, pushed: 0, conflicts: 0, errors: [message] }, pending: [] }
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
        const message = err instanceof Error ? err.message : 'Push gagal'
        log.error(`[sync] login-finish push error: ${message}`)
        return { pushed: 0, errors: [message] }
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
