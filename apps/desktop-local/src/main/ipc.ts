import { app, ipcMain, BrowserWindow } from 'electron'
import type Database from 'better-sqlite3'
import axios from 'axios'
import https from 'https'
import { createLocalRouter, isWapboltApiUrl } from './local/router'

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

export function registerIpcHandlers(db: Database.Database): void {
  const localRouter = createLocalRouter(db)

  ipcMain.handle('wapbolt:request', async (_event, config: IpcRequestConfig) => {
    if (isWapboltApiUrl(config.url)) {
      return localRouter.handle(config)
    }
    return httpExecute(config)
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
