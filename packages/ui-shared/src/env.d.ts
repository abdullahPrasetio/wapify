/// <reference types="vite/client" />
import { ElectronAPI } from '@electron-toolkit/preload'

interface RequestConfig {
  method: string
  url: string
  headers?: Record<string, string>
  body?: any
  requestId?: string
  baseUrl?: string
}

interface IpcResponse {
  status: number
  headers: Record<string, string[]>
  data: unknown
  timing: number
  cancelled?: boolean
}

interface WapboltAPI {
  wapboltRequest: (config: RequestConfig) => Promise<IpcResponse>
  cancelRequest: (requestId: string) => void
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
  // ─── Khusus Wapbolt Local (mode 'local', docs/local-app-design.md §6/§8) ──
  saveSyncSession?: (session: { serverUrl: string; user: unknown }) => Promise<void>
  getSyncSession?: () => Promise<{ serverUrl: string; user: unknown } | null>
  syncNow?: (serverUrl: string) => Promise<{
    pulled: number
    pushed: number
    conflicts: number
    errors: string[]
  }>
  syncStatus?: () => Promise<{
    pendingChanges: number
    pendingConflicts: number
    lastFullSyncAt: string | null
  }>
  syncListConflicts?: () => Promise<unknown[]>
  syncResolveConflict?: (id: number, resolution: 'local' | 'remote') => Promise<{ ok: boolean }>
  // Login opsional + consent push data pra-login (§8.2-8.3)
  syncLoginPull?: (serverUrl: string) => Promise<{
    pullSummary: { pulled: number; pushed: number; conflicts: number; errors: string[] }
    pending: Array<{ entity: string; count: number }>
  }>
  syncLoginFinish?: (
    serverUrl: string,
    decision: 'push' | 'exclude'
  ) => Promise<{ pulled: number; pushed: number; conflicts: number; errors: string[] }>
  // Hapus data lokal (§8.4) — terpisah dari logout
  localDataPendingSummary?: () => Promise<Array<{ entity: string; count: number }>>
  wipeLocalData?: () => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: WapboltAPI
  }
}

export {}
