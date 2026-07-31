import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// ─── Type definitions ─────────────────────────────────────────────────────────
// Kontrak identik dengan apps/desktop/src/preload — window.api.wapboltRequest
// adalah titik potong: di sini main process me-route ke LocalRouter/HTTP,
// bukan renderer yang berbeda. Lihat docs/local-app-design.md §2.
interface RequestConfig {
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
// ─────────────────────────────────────────────────────────────────────────────

const api = {
  wapboltRequest: (config: RequestConfig): Promise<IpcResponse> => {
    return ipcRenderer.invoke('wapbolt:request', config)
  },
  getAppVersion: (): Promise<string> => {
    return ipcRenderer.invoke('wapbolt:get-version')
  },
  reloadApp: (): void => {
    ipcRenderer.send('wapbolt:reload')
  },
  minimizeWindow: (): void => ipcRenderer.send('wapbolt:minimize'),
  maximizeWindow: (): void => ipcRenderer.send('wapbolt:maximize'),
  closeWindow: (): void => ipcRenderer.send('wapbolt:close')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
