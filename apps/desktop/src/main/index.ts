import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'
import icon from '../../resources/icon.png?asset'
import keytar from 'keytar'
import axios from 'axios'
import FormData from 'form-data'

// Konfigurasi logger
autoUpdater.logger = log
log.transports.file.level = 'info'
log.info('App starting...')

const KEYTAR_SERVICE = 'io.wapbolt.desktop'
const KEYTAR_ACCOUNT = 'refresh_token'

// ─── IPC: Keytar (Secure Storage) ──────────────────────────────────────────
ipcMain.handle('wapbolt:set-token', async (_event, token: string) => {
  return keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, token)
})

ipcMain.handle('wapbolt:get-token', async () => {
  return keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
})

ipcMain.handle('wapbolt:delete-token', async () => {
  return keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
})

// ─── IPC: HTTP Request via Main Process (bebas CORS) ───────────────────────
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

ipcMain.handle('wapbolt:request', async (_event, config: IpcRequestConfig): Promise<IpcResponse> => {
  const startTime = Date.now()
  try {
    let requestData: any = config.body
    const finalHeaders: Record<string, string> = { ...(config.headers || {}) }

    // Serialize body based on body_type
    if (config.body_type === 'form-data' && Array.isArray(config.body)) {
      const form = new FormData()
      config.body.forEach((item: any) => {
        if (item.enabled && item.key) {
          form.append(item.key, item.value || '')
        }
      })
      requestData = form
      // Ensure Content-Type is NOT set manually so Axios/FormData can set boundary
      delete finalHeaders['Content-Type']
      delete finalHeaders['content-type']
      // Merge form-data headers (boundary)
      Object.assign(finalHeaders, form.getHeaders())
    } else if (config.body_type === 'x-www-form-urlencoded' && Array.isArray(config.body)) {
      const params = new URLSearchParams()
      config.body.forEach((item: any) => {
        if (item.enabled && item.key) {
          params.append(item.key, item.value || '')
        }
      })
      requestData = params // Pass object directly, Axios handles serialization and Content-Type
      
      // If user hasn't set Content-Type, or it's wrong, we force it or let Axios handle it
      // Standard practice: if we pass URLSearchParams, Axios sets application/x-www-form-urlencoded
    } else if (config.body_type?.startsWith('raw-')) {
       // Just use string data directly
    }

    const response = await axios({
      method: config.method as any,
      url: config.url,
      data: requestData,
      headers: finalHeaders,
      timeout: 30000,
      validateStatus: () => true // Don't throw on 4xx/500
    })

    console.log(`\n[Main Process] >>> SENDING REQUEST: ${config.method} ${config.url}`)
    console.log(`[Main Process] HEADERS:`, JSON.stringify(finalHeaders, null, 2))
    console.log(`[Main Process] BODY TYPE: ${config.body_type}`)
    console.log(`[Main Process] SERIALIZED BODY:`, requestData?.toString?.() || requestData)
    console.log(`[Main Process] <<< RESPONSE STATUS: ${response.status}\n`)

    const timing = Date.now() - startTime
    
    // Normalize headers to Record<string, string[]>
    const normalizedHeaders: Record<string, string[]> = {}
    Object.entries(response.headers).forEach(([key, value]) => {
      normalizedHeaders[key.toLowerCase()] = Array.isArray(value) ? value : [String(value)]
    })

    return {
      status: response.status,
      headers: normalizedHeaders,
      data: response.data,
      timing
    }
  } catch (error: any) {
    const timing = Date.now() - startTime
    return {
      status: error.response?.status || 0,
      headers: {},
      data: { 
        error: error.message,
        details: error.response?.data 
      },
      timing
    }
  }
})

// ──────────────────────────────────────────────────────────────────────────────

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'Wapbolt',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('io.wapbolt.desktop')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()
  autoUpdater.checkForUpdatesAndNotify()

  ipcMain.handle('wapbolt:get-version', () => {
    return app.getVersion()
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
