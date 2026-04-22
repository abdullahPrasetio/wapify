import { app, shell, BrowserWindow, ipcMain, net } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import keytar from 'keytar'

const KEYTAR_SERVICE = 'io.wapify.desktop'
const KEYTAR_ACCOUNT = 'refresh_token'

// ─── IPC: Keytar (Secure Storage) ──────────────────────────────────────────
ipcMain.handle('wapify:set-token', async (_event, token: string) => {
  return keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, token)
})

ipcMain.handle('wapify:get-token', async () => {
  return keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
})

ipcMain.handle('wapify:delete-token', async () => {
  return keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
})

// ─── IPC: HTTP Request via Main Process (bebas CORS) ───────────────────────
interface IpcRequestConfig {
  method: string
  url: string
  headers?: Record<string, string>
  body?: string
}

interface IpcResponse {
  status: number
  headers: Record<string, string[]>
  data: unknown
  timing: number
}

ipcMain.handle('wapify:request', async (_event, config: IpcRequestConfig): Promise<IpcResponse> => {
  const startTime = Date.now()
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: config.method,
      url: config.url
    })

    // Set headers
    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        request.setHeader(key, value)
      }
    }

    // Content-Type default untuk body
    if (config.body && !config.headers?.['Content-Type']) {
      request.setHeader('Content-Type', 'application/json')
    }

    request.on('response', (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      response.on('end', () => {
        const timing = Date.now() - startTime
        const raw = Buffer.concat(chunks).toString('utf-8')
        let data: unknown
        try {
          data = JSON.parse(raw)
        } catch {
          data = raw
        }

        const headers: Record<string, string[]> = {}
        for (const [key, value] of Object.entries(response.headers)) {
          headers[key] = Array.isArray(value) ? value : [value as string]
        }

        resolve({ status: response.statusCode, headers, data, timing })
      })
      response.on('error', reject)
    })

    request.on('error', reject)

    if (config.body) {
      request.write(config.body)
    }
    request.end()
  })
})
// ──────────────────────────────────────────────────────────────────────────────

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'Wapify',
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

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('io.wapify.desktop')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  // Handler for getting app version
  ipcMain.handle('wapify:get-version', () => {
    return app.getVersion()
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
