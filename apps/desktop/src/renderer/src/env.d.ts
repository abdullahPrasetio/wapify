/// <reference types="vite/client" />
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
  reloadApp: () => void
  openFileDialog: () => Promise<{ path: string; name: string; size: number } | null>
  parseCurl: (curlCommand: string) => Promise<any>
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  openGoogleAuth: (url: string) => Promise<void>
  onGoogleAuthCallback: (
    callback: (data: { token: string; refreshToken: string }) => void
  ) => () => void
  getConfluencePage: (config: { 
    baseUrl: string, 
    email?: string, 
    pat?: string,
    apiToken?: string,
    authMethod?: 'pat' | 'cloud',
    pageId: string 
  }) => Promise<any>
  updateConfluencePage: (config: {
    baseUrl: string
    email?: string
    pat?: string
    apiToken?: string
    authMethod?: 'pat' | 'cloud'
    pageId: string
    title: string
    content: string
    version: number
  }) => Promise<any>
  uploadConfluenceAttachment: (config: {
    baseUrl: string
    email?: string
    pat?: string
    apiToken?: string
    authMethod?: string
    pageId: string
    filename: string
    content: string
  }) => Promise<any>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: WapboltAPI
  }
}

export {}
