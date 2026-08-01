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

interface SyncSummary {
  pulled: number
  pushed: number
  conflicts: number
  errors: string[]
}

interface SyncStatus {
  pendingChanges: number
  pendingConflicts: number
  lastFullSyncAt: string | null
}

interface PendingLocalOnlySummary {
  entity: string
  count: number
}

interface LoginPullResult {
  pullSummary: SyncSummary
  pending: PendingLocalOnlySummary[]
}

const api = {
  wapboltRequest: (config: RequestConfig): Promise<IpcResponse> => {
    return ipcRenderer.invoke('wapbolt:request', config)
  },
  getAppVersion: (): Promise<string> => {
    return ipcRenderer.invoke('wapbolt:get-version')
  },
  // Sesi login-sekali (docs §8 revisi) — kontrak setToken/getToken/deleteToken
  // sama dengan apps/desktop (dipakai useAuthStore), storage-nya safeStorage.
  setToken: (token: string): Promise<void> => ipcRenderer.invoke('wapbolt:set-token', token),
  getToken: (): Promise<string | null> => ipcRenderer.invoke('wapbolt:get-token'),
  deleteToken: (): Promise<void> => ipcRenderer.invoke('wapbolt:delete-token'),
  saveSyncSession: (session: { serverUrl: string; user: unknown }): Promise<void> =>
    ipcRenderer.invoke('wapbolt:save-session', session),
  getSyncSession: (): Promise<{ serverUrl: string; user: unknown } | null> =>
    ipcRenderer.invoke('wapbolt:get-session'),
  // Sync manual (docs §6)
  syncNow: (serverUrl: string): Promise<SyncSummary> => ipcRenderer.invoke('wapbolt:sync-now', serverUrl),
  syncStatus: (): Promise<SyncStatus> => ipcRenderer.invoke('wapbolt:sync-status'),
  syncListConflicts: (): Promise<unknown[]> => ipcRenderer.invoke('wapbolt:sync-list-conflicts'),
  syncResolveConflict: (id: number, resolution: 'local' | 'remote'): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('wapbolt:sync-resolve-conflict', id, resolution),
  // Login opsional + consent push data pra-login (§8.2-8.3)
  syncLoginPull: (serverUrl: string): Promise<LoginPullResult> =>
    ipcRenderer.invoke('wapbolt:sync-login-pull', serverUrl),
  syncLoginFinish: (serverUrl: string, decision: 'push' | 'exclude'): Promise<SyncSummary> =>
    ipcRenderer.invoke('wapbolt:sync-login-finish', serverUrl, decision),
  // Hapus data lokal (§8.4) — terpisah dari logout
  localDataPendingSummary: (): Promise<PendingLocalOnlySummary[]> =>
    ipcRenderer.invoke('wapbolt:local-data-pending-summary'),
  wipeLocalData: (): Promise<void> => ipcRenderer.invoke('wapbolt:wipe-local-data'),
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
