import { ElectronAPI } from '@electron-toolkit/preload'

interface RequestConfig {
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

interface WapifyAPI {
  wapifyRequest: (config: RequestConfig) => Promise<IpcResponse>
  setToken: (token: string) => Promise<void>
  getToken: () => Promise<string | null>
  deleteToken: () => Promise<void>
  getAppVersion: () => Promise<string>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: WapifyAPI
  }
}
