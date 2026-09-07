import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import https from 'https'
import axios from 'axios'
import log from 'electron-log'
import { openDb } from './local/db'
import { seedIfEmpty } from './local/seed'
import { registerIpcHandlers } from './ipc'

// SEGERA matikan validasi SSL sebelum modul lain (axios) diinisialisasi —
// dibutuhkan agar tombol "Send" bisa menjangkau target API internal dengan
// sertifikat self-signed, sama seperti apps/desktop.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
app.commandLine.appendSwitch('ignore-certificate-errors')
axios.defaults.httpsAgent = new https.Agent({ rejectUnauthorized: false })

const isDev = !app.isPackaged

// User data terpisah dari apps/desktop (app id berbeda, lihat §11.4) dan dari
// dev (menghindari lock file bentrok dengan build production).
if (isDev) {
  app.setPath('userData', `${app.getPath('userData')}-dev`)
}

log.transports.file.level = 'info'
log.info('Wapbolt Local starting...')

app.on('certificate-error', (event, _webContents, _url, _error, _certificate, callback) => {
  event.preventDefault()
  callback(true)
})

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'Wapbolt Local',
    autoHideMenuBar: true,
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

app.whenReady().then(() => {
  const dbPath = join(app.getPath('userData'), 'wapbolt-local.db')
  const db = openDb(dbPath)
  seedIfEmpty(db)
  log.info(`Local DB ready at ${dbPath}`)

  registerIpcHandlers(db)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
