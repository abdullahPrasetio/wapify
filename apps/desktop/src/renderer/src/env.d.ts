import { ElectronAPI } from '@electron-toolkit/preload'

interface RequestConfig {
  method: string
  url: string
  headers?: Record<string, string>
  body?: any
}

interface IpcResponse {
  status: number
  headers: Record<string, string[]>
  data: unknown
  timing: number
}

interface WapboltAPI {
  wapboltRequest: (config: RequestConfig) => Promise<IpcResponse>
  setToken: (token: string) => Promise<void>
  getToken: () => Promise<string | null>
  deleteToken: () => Promise<void>
  getAppVersion: () => Promise<string>
  parseCurl: (curlCommand: string) => Promise<any>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: WapboltAPI
  }
}

export {}
