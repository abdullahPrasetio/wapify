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
  reloadApp: (): void => {
    ipcRenderer.send('wapbolt:reload')
  },
  openFileDialog: (): Promise<{ path: string; name: string; size: number } | null> => {
    return ipcRenderer.invoke('wapbolt:open-file-dialog')
  },
  parseCurl: (curlCommand: string): Promise<any> => {
    return ipcRenderer.invoke('wapbolt:parse-curl', curlCommand)
  },
  openGoogleAuth: (url: string): Promise<void> => {
    return ipcRenderer.invoke('wapbolt:open-google-auth', url)
  },
  minimizeWindow: (): void => ipcRenderer.send('wapbolt:minimize'),
  maximizeWindow: (): void => ipcRenderer.send('wapbolt:maximize'),
  closeWindow: (): void => ipcRenderer.send('wapbolt:close'),
  onGoogleAuthCallback: (
    callback: (data: { token: string; refreshToken: string }) => void
  ): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { token: string; refreshToken: string }): void =>
      callback(data)
    ipcRenderer.on('wapbolt:google-auth-callback', handler)
    return () => ipcRenderer.removeListener('wapbolt:google-auth-callback', handler)
  },
  getConfluencePage: (config: { 
    baseUrl: string, 
    email?: string, 
    pat?: string,
    apiToken?: string,
    pageId: string 
  }): Promise<any> => {
    return ipcRenderer.invoke('confluence:get-page', config)
  },
  updateConfluencePage: (config: {
    baseUrl: string,
    email?: string,
    pat?: string,
    apiToken?: string,
    pageId: string,
    title: string,
    content: string,
    version: number
  }): Promise<any> => {
    return ipcRenderer.invoke('confluence:update-page', config)
  },
  uploadConfluenceAttachment: (config: {
    baseUrl: string,
    email?: string,
    pat?: string,
    apiToken?: string,
    authMethod?: string,
    pageId: string,
    filename: string,
    content: string
  }): Promise<any> => {
    return ipcRenderer.invoke('confluence:upload-attachment', config)
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
