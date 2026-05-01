import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// ─── Type definitions ─────────────────────────────────────────────────────────
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

// Custom APIs for renderer
const api = {
  /**
   * Kirim HTTP request via Electron Main Process.
   * Ini memastikan request BEBAS CORS karena dikirim dari Node.js, bukan browser.
   */
  wapboltRequest: (config: RequestConfig): Promise<IpcResponse> => {
    return ipcRenderer.invoke('wapbolt:request', config)
  },
  setToken: (token: string): Promise<void> => {
    return ipcRenderer.invoke('wapbolt:set-token', token)
  },
  getToken: (): Promise<string | null> => {
    return ipcRenderer.invoke('wapbolt:get-token')
  },
  deleteToken: (): Promise<void> => {
    return ipcRenderer.invoke('wapbolt:delete-token')
  },
  getAppVersion: (): Promise<string> => {
    return ipcRenderer.invoke('wapbolt:get-version')
  },
  parseCurl: (curlCommand: string): Promise<any> => {
    return ipcRenderer.invoke('wapbolt:parse-curl', curlCommand)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
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
