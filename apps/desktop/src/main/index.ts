import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { URL } from 'url'

// SEGERA matikan validasi SSL sebelum modul lain (seperti axios) diinisialisasi
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
app.commandLine.appendSwitch('ignore-certificate-errors')

// Register custom protocol for Google OAuth deep link (wapbolt://auth/callback)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('wapbolt', process.execPath, [process.argv[1]])
  }
} else {
  app.setAsDefaultProtocolClient('wapbolt')
}

import { autoUpdater } from 'electron-updater'

const isDev = !app.isPackaged

// Use separate user data directory in dev to avoid lock conflicts with production app
if (isDev) {
  app.setPath('userData', `${app.getPath('userData')}-dev`)
}

function setAppUserModelId(id: string): void {
  if (process.platform === 'win32') app.setAppUserModelId(isDev ? process.execPath : id)
}

function watchWindowShortcuts(window: BrowserWindow): void {
  const { webContents } = window
  webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      if (!isDev) {
        if (input.code === 'KeyR' && (input.control || input.meta)) event.preventDefault()
      } else {
        if (input.code === 'F12') {
          if (webContents.isDevToolsOpened()) webContents.closeDevTools()
          else webContents.openDevTools({ mode: 'undocked' })
        }
      }
    }
  })
}
import log from 'electron-log'
import icon from '../../resources/icon.png?asset'
import keytar from 'keytar'
import axios from 'axios'
import FormData from 'form-data'
import https from 'https'
import fs from 'fs'
import path from 'path'

// Set default axios agent secara global
axios.defaults.httpsAgent = new https.Agent({
  rejectUnauthorized: false
})

// Konfigurasi logger
autoUpdater.logger = log
log.transports.file.level = 'info'
log.info('App starting...')

// Handle SSL/TLS certificate errors (for self-signed certs in OCP/Internal environments)
app.on('certificate-error', (event, _webContents, _url, _error, _certificate, callback) => {
  // Prevent default behavior and trust the certificate
  event.preventDefault()
  callback(true)
})

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

    // Use raw headers directly since validation is now stored in field_validations
    const finalHeaders: Record<string, string> = { ...(config.headers || {}) }

    // Serialize body based on body_type
    if (config.body_type === 'form-data' && Array.isArray(config.body)) {
      const form = new FormData()
      config.body.forEach((item: any) => {
        if (item.enabled && item.key) {
          if (item.type === 'file' && item.value && fs.existsSync(item.value)) {
            form.append(item.key, fs.createReadStream(item.value), {
              filename: path.basename(item.value)
            })
          } else {
            form.append(item.key, String(item.value || ''))
          }
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
          params.append(item.key, String(item.value || ''))
        }
      })
      requestData = params // Pass object directly, Axios handles serialization and Content-Type

      // If user hasn't set Content-Type, or it's wrong, we force it or let Axios handle it
      // Standard practice: if we pass URLSearchParams, Axios sets application/x-www-form-urlencoded
    } else if (config.body_type?.startsWith('raw-')) {
      // Body is stored as a JSON string in raw mode, use as is since validation is separated.
    }

    const response = await axios({
      method: config.method as any,
      url: config.url,
      data: requestData,
      headers: finalHeaders,
      timeout: 30000,
      validateStatus: () => true, // Don't throw on 4xx/500
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
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

// ─── IPC: Confluence Integration ───────────────────────────────────────────

ipcMain.handle('confluence:get-page', async (_event, config: {
  baseUrl: string,
  email?: string,
  pat?: string,
  apiToken?: string,
  authMethod?: 'pat' | 'cloud',
  pageId: string
}) => {
  try {
    const cleanBaseUrl = config.baseUrl.replace(/\/+$/, '')
    const url = `${cleanBaseUrl}/rest/api/content/${config.pageId}?expand=version`
    let authHeader = ''
    if (config.authMethod === 'pat') {
      authHeader = `Bearer ${config.pat}`
      console.log(`[Confluence] Auth: Using PAT (Bearer)`)
    } else {
      const credentials = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')
      authHeader = `Basic ${credentials}`
      console.log(`[Confluence] Auth: Using Email + API Token (Basic)`)
    }

    if (!authHeader) {
      throw new Error('No authentication configured. Set either PAT or Email + API Token.')
    }

    console.log(`[Confluence] Fetching: ${url}`)

    const response = await axios({
      method: 'GET',
      url,
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'User-Agent': 'Wapbolt'
      },
      timeout: 10000
    })

    console.log(`[Confluence] Response: ${response.status}`)
    // console.log(`[Confluence] GET Data Sample:`, JSON.stringify(response.data).substring(0, 200))
    
    if (typeof response.data === 'string' && response.data.includes('<html')) {
      console.error('[Confluence] Received HTML instead of JSON. Authentication might have failed or been redirected.')
      return { success: false, error: 'Received HTML response (possible SSO redirect). Check your Base URL and Credentials.' }
    }

    return { success: true, data: response.data }
  } catch (error: any) {
    console.error(`[Confluence] Error: ${error.message}`)
    if (error.response) {
      console.error(`[Confluence] Status: ${error.response.status}`)
      console.error(`[Confluence] Data:`, error.response.data)
    }
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    }
  }
})

ipcMain.handle('confluence:update-page', async (_event, config: {
  baseUrl: string,
  email?: string,
  pat?: string,
  apiToken?: string,
  authMethod?: 'pat' | 'cloud',
  pageId: string,
  title: string,
  content: string,
  version: number
}) => {
  try {
    const cleanBaseUrl = config.baseUrl.replace(/\/+$/, '')
    const url = `${cleanBaseUrl}/rest/api/content/${config.pageId}`

    let authHeader = ''
    if (config.authMethod === 'pat') {
      authHeader = `Bearer ${config.pat}`
      console.log(`[Confluence] Auth: Using PAT (Bearer)`)
    } else {
      const credentials = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')
      authHeader = `Basic ${credentials}`
      console.log(`[Confluence] Auth: Using Email + API Token (Basic)`)
    }

    if (!authHeader) {
      throw new Error('No authentication configured. Set either PAT or Email + API Token.')
    }

    console.log(`[Confluence] Updating: ${url}`)

    const response = await axios({
      method: 'PUT',
      url,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Atlassian-Token': 'no-check',
        'User-Agent': 'Wapbolt'
      },
      timeout: 10000,
      data: {
        id: config.pageId,
        type: 'page',
        title: config.title,
        body: {
          storage: {
            value: config.content,
            representation: 'storage'
          }
        },
        version: {
          number: config.version
        }
      }
    })

    console.log(`[Confluence] Update Response Status: ${response.status}`)
    console.log(`[Confluence] Update Response Data:`, JSON.stringify(response.data).substring(0, 500) + '...')
    
    return { success: true, data: response.data }
  } catch (error: any) {
    console.error(`[Confluence] Update Error: ${error.message}`)
    if (error.response) {
      console.error(`[Confluence] Status: ${error.response.status}`)
      console.error(`[Confluence] Data:`, error.response.data)
    }
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    }
  }
})

ipcMain.handle('confluence:upload-attachment', async (_event, config: {
  baseUrl: string,
  email?: string,
  pat?: string,
  apiToken?: string,
  authMethod?: 'pat' | 'cloud',
  pageId: string,
  filename: string,
  content: string // file content as string (JSON)
}) => {
  try {
    const cleanBaseUrl = config.baseUrl.replace(/\/+$/, '')
    const url = `${cleanBaseUrl}/rest/api/content/${config.pageId}/child/attachment`

    let authHeader = ''
    if (config.authMethod === 'pat') {
      authHeader = `Bearer ${config.pat}`
    } else {
      const credentials = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')
      authHeader = `Basic ${credentials}`
    }

    const form = new FormData()
    form.append('file', Buffer.from(config.content, 'utf-8'), {
      filename: config.filename,
      contentType: 'application/json'
    })
    form.append('comment', 'Uploaded by Wapbolt')
    form.append('minorEdit', 'true')

    console.log(`[Confluence] Uploading attachment to: ${url}`)

    const response = await axios({
      method: 'POST',
      url,
      headers: {
        'Authorization': authHeader,
        'X-Atlassian-Token': 'no-check',
        'Accept': 'application/json',
        'User-Agent': 'Wapbolt',
        ...form.getHeaders()
      },
      data: form,
      timeout: 15000
    })

    console.log(`[Confluence] Attachment upload response: ${response.status}`)
    const results = response.data?.results
    const attachment = Array.isArray(results) ? results[0] : response.data
    return { success: true, data: attachment }
  } catch (error: any) {
    // 400 with "already exists" means we need to PUT (update) instead
    if (error.response?.status === 400 || error.response?.status === 409) {
      // Try updating existing attachment
      try {
        const cleanBaseUrl = config.baseUrl.replace(/\/+$/, '')
        let authHeader = ''
        if (config.authMethod === 'pat') {
          authHeader = `Bearer ${config.pat}`
        } else {
          const credentials = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')
          authHeader = `Basic ${credentials}`
        }

        // Find existing attachment ID
        const listRes = await axios.get(
          `${cleanBaseUrl}/rest/api/content/${config.pageId}/child/attachment?filename=${encodeURIComponent(config.filename)}`,
          { headers: { 'Authorization': authHeader, 'Accept': 'application/json' } }
        )
        const existingId = listRes.data?.results?.[0]?.id
        if (!existingId) throw new Error('Attachment not found for update')

        const form2 = new FormData()
        form2.append('file', Buffer.from(config.content, 'utf-8'), {
          filename: config.filename,
          contentType: 'application/json'
        })
        form2.append('minorEdit', 'true')

        const updateRes = await axios({
          method: 'POST',
          url: `${cleanBaseUrl}/rest/api/content/${config.pageId}/child/attachment/${existingId}/data`,
          headers: {
            'Authorization': authHeader,
            'X-Atlassian-Token': 'no-check',
            'User-Agent': 'Wapbolt',
            ...form2.getHeaders()
          },
          data: form2,
          timeout: 15000
        })
        return { success: true, data: updateRes.data }
      } catch (retryError: any) {
        return { success: false, error: retryError.message }
      }
    }
    console.error(`[Confluence] Attachment upload error: ${error.message}`)
    return { success: false, error: error.message, details: error.response?.data }
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
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 14 } }
      : { frame: false }),
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

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Handle deep link on macOS (open-url event fires when wapbolt:// is clicked)
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleDeepLink(url)
})

// Handle deep link on Windows/Linux (second-instance via argv)
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const deepLinkUrl = argv.find((arg) => arg.startsWith('wapbolt://'))
    if (deepLinkUrl) handleDeepLink(deepLinkUrl)
    // Focus main window
    const win = BrowserWindow.getAllWindows()[0]
    if (win) { if (win.isMinimized()) win.restore(); win.focus() }
  })
}

function handleDeepLink(url: string): void {
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'auth' && parsed.pathname === '/callback') {
      const token = parsed.searchParams.get('token')
      const refreshToken = parsed.searchParams.get('refresh_token')
      if (token && refreshToken) {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) {
          win.webContents.send('wapbolt:google-auth-callback', { token, refreshToken })
        }
      }
    }
  } catch {
    // ignore malformed URLs
  }
}

app.whenReady().then(() => {
  setAppUserModelId('io.wapbolt.desktop')

  app.on('browser-window-created', (_, window) => {
    watchWindowShortcuts(window)
  })

  createWindow()
  autoUpdater.checkForUpdatesAndNotify()

  // Aktifkan shortcut DevTools (Ctrl+Shift+I / Cmd+Option+I) di build production untuk debugging
  app.on('browser-window-focus', () => {
    const { globalShortcut } = require('electron')
    globalShortcut.register('CommandOrControl+Shift+I', () => {
      const win = BrowserWindow.getFocusedWindow()
      if (win) win.webContents.toggleDevTools()
    })
  })

  app.on('browser-window-blur', () => {
    const { globalShortcut } = require('electron')
    globalShortcut.unregister('CommandOrControl+Shift+I')
  })

  ipcMain.handle('wapbolt:get-version', () => {
    return app.getVersion()
  })

  ipcMain.handle('wapbolt:open-file-dialog', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      title: 'Select File'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    try {
      const stat = fs.statSync(filePath)
      return { path: filePath, name: path.basename(filePath), size: stat.size }
    } catch {
      return { path: filePath, name: path.basename(filePath), size: 0 }
    }
  })

  ipcMain.on('wapbolt:reload', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) win.webContents.reloadIgnoringCache()
  })

  ipcMain.handle('wapbolt:open-google-auth', async (_event, googleAuthUrl: string) => {
    shell.openExternal(googleAuthUrl)
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

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
