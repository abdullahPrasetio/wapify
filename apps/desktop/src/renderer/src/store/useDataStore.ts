import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { apiClient } from '../api/client'
import { wsClient } from '../api/websocket'
import type {
  Team,
  Collection,
  Folder,
  ApiRequest,
  Environment,
  IpcResponse,
  RequestHistory
} from '../types'
import { toast } from 'sonner'
import moment from 'moment'
import _ from 'lodash'

/**
 * Ensures a request object has a string body for the Monaco Editor.
 */
const normalizeRequest = (req: ApiRequest): ApiRequest => {
  if (!req) return req

  let body = req.body
  if (typeof body === 'object' && body !== null) {
    // If it's a Postman-style raw body object
    if ('raw' in body && typeof body.raw === 'string') {
      body = body.raw
    } else {
      try {
        body = JSON.stringify(body, null, 2)
      } catch {
        body = ''
      }
    }
  }

  // Handle case where body is null/undefined or stringified "{}"
  if (!body || body === '{}') {
    body = ''
  }

  return {
    ...req,
    body,
    headers: req.headers || {},
    auth_config: req.auth_config || { type: 'No Auth' },
    pre_request_script: req.pre_request_script || '',
    post_request_script: req.post_request_script || ''
  }
}

export interface AuthConfig {
  type: string
  token?: string
  username?: string
  password?: string
  key?: string
  value?: string
  addTo?: 'header' | 'query'
  [key: string]: string | undefined
}

export interface PresenceInfo {
  user_id: number
  user_name: string
}

export interface LockInfo {
  user_id: number
  user_name: string
}

export interface WorkingRequest {
  method: string
  url: string
  headers: Record<string, string>
  body: string
  auth_config: AuthConfig
  pre_request_script: string
  post_request_script: string
}

export interface LogEntry {
  id: string
  timestamp: string
  level: 'log' | 'info' | 'warn' | 'error'
  message: string
  requestId?: number
}

export interface RequestVersion {
  id: number
  request_id: number
  created_by: number
  version_number: number
  snapshot: unknown
  created_at: string
}

export interface Comment {
  id: number
  request_id: number
  user_id: number
  user_name?: string
  content: string
  created_at: string
}

export interface Activity {
  id: number
  team_id: number
  user_id: number
  user_name?: string
  action: string
  entity_type: string
  entity_id: number
  details: unknown
  created_at: string
}

export interface RequestTab {
  requestId: number
  name: string
  method: string
  workingRequest: WorkingRequest
  lastResponse: IpcResponse | null
  isSending: boolean
  isDirty: boolean
  testResults: { name: string; status: 'passed' | 'failed'; error?: string }[]
}

interface DataState {
  // Teams
  teams: Team[]
  teamsLoading: boolean

  // Active team
  activeTeamId: number | null

  // Collections (for active team)
  collections: Collection[]
  collectionsLoading: boolean

  // Folders (keyed by collection id)
  foldersByCollection: Record<number, Folder[]>

  // Requests (keyed by collection id)
  requestsByCollection: Record<number, ApiRequest[]>
  requestsByFolder: Record<number, ApiRequest[]>
  requests: ApiRequest[]

  // History
  history: RequestHistory[]
  historyLoading: boolean

  // Multi-Tab System
  tabs: RequestTab[]
  activeTabId: number | null // refers to requestId

  // Environments (for active team)
  environments: Environment[]
  activeEnvironmentId: number | null
  logs: LogEntry[]

  // Collaboration State
  presenceByRequest: Record<number, PresenceInfo[]>
  locksByRequest: Record<number, LockInfo>
  requestVersions: Record<number, RequestVersion[]>
  requestComments: Record<number, Comment[]>
  activities: Activity[]

  setPresence: (requestId: number, presence: PresenceInfo[]) => void
  setLock: (requestId: number, lock: LockInfo | null) => void
  clearPresenceAndLocks: () => void
  fetchRequestVersions: (requestId: number) => Promise<void>
  fetchRequestComments: (requestId: number) => Promise<void>
  addComment: (requestId: number, content: string) => Promise<void>
  restoreVersion: (requestId: number, versionId: number) => Promise<void>
  fetchActivities: (teamId: number) => Promise<void>

  // Actions
  fetchTeams: () => Promise<void>
  setActiveTeam: (teamId: number) => Promise<void>
  createTeam: (name: string, description: string) => Promise<void>
  fetchCollections: (teamId: number) => Promise<void>
  fetchCollectionContents: (collectionId: number) => Promise<void>

  // Tab Actions
  openRequestInTab: (request: ApiRequest) => void
  setActiveTab: (requestId: number) => void
  closeTab: (requestId: number) => void
  setWorkingRequest: (update: Partial<WorkingRequest>) => void

  // CRUD Actions
  saveActiveRequest: () => Promise<void>
  createCollection: (name: string) => Promise<void>
  importCollection: (jsonContent: string) => Promise<void>
  createRequest: (
    collectionId: number,
    folderId: number | null,
    name: string,
    data?: Partial<ApiRequest>
  ) => Promise<void>
  createFolder: (collectionId: number, parentFolderId: number | null, name: string) => Promise<void>

  // Environment Actions
  fetchEnvironments: (teamId: number) => Promise<void>
  setActiveEnvironment: (envId: number | null) => void
  createEnvironment: (name: string) => Promise<void>
  updateEnvironment: (id: number, name: string, variables: Record<string, string>) => Promise<void>
  deleteEnvironment: (id: number) => Promise<void>

  // History Actions
  fetchHistory: () => Promise<void>
  clearHistory: () => Promise<void>

  // Expansion State
  expandedItems: Record<string, boolean>
  toggleExpand: (id: string) => void

  // Execution Actions
  executeActiveRequest: () => Promise<void>
  clearResponse: () => void
  updateActiveEnvironmentVariable: (key: string, value: string) => Promise<void>
  deleteCollection: (id: number) => Promise<void>
  deleteFolder: (id: number) => Promise<void>
  deleteRequest: (id: number) => Promise<void>
  exportCollection: (id: number) => Promise<void>
  clearLogs: () => void
}

const replaceVariables = (text: string, variables: Record<string, string>): string => {
  if (typeof text !== 'string') return text

  // Buat map versi lowercase untuk pencarian case-insensitive
  const lowerVars = Object.keys(variables).reduce(
    (acc, key) => {
      acc[key.toLowerCase()] = String(variables[key])
      return acc
    },
    {} as Record<string, string>
  )

  return text.replace(/\{\{(.+?)\}\}/g, (match, key) => {
    const trimmedKey = key.trim().toLowerCase()
    const resolved = lowerVars[trimmedKey]

    console.log(
      `[Wapify] Matching variable: "${key.trim()}" -> ${resolved !== undefined ? 'FOUND' : 'NOT FOUND'}`
    )

    return resolved !== undefined ? resolved : match
  })
}

const injectAuth = (
  headers: Record<string, string>,
  auth: AuthConfig,
  vars: Record<string, string>
): Record<string, string> => {
  const newHeaders = { ...headers }
  const type = auth.type || 'No Auth'

  if (type === 'Bearer Token') {
    const token = replaceVariables(auth.token || '', vars)
    if (token) newHeaders['Authorization'] = `Bearer ${token}`
  } else if (type === 'Basic Auth') {
    const user = replaceVariables(auth.username || '', vars)
    const pass = replaceVariables(auth.password || '', vars)
    if (user || pass) {
      const credentials = btoa(`${user}:${pass}`)
      newHeaders['Authorization'] = `Basic ${credentials}`
    }
  } else if (type === 'API Key') {
    const key = replaceVariables(auth.key || '', vars)
    const value = replaceVariables(auth.value || '', vars)
    const addTo = auth.addTo || 'header'
    if (key && value && addTo === 'header') {
      newHeaders[key] = value
    }
  }
  return newHeaders
}

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      teams: [],
      teamsLoading: false,
      activeTeamId: null,
      collections: [],
      collectionsLoading: false,
      foldersByCollection: {},
      requestsByCollection: {},
      requestsByFolder: {},
      requests: [],

      history: [],
      historyLoading: false,

      tabs: [],
      activeTabId: null,

      environments: [],
      activeEnvironmentId: null,
      logs: [],
      expandedItems: {},

      presenceByRequest: {},
      locksByRequest: {},
      requestVersions: {},
      requestComments: {},
      activities: [],

      setPresence: (requestId, presence) => {
        set((state) => ({
          presenceByRequest: { ...state.presenceByRequest, [requestId]: presence }
        }))
      },

      setLock: (requestId, lock) => {
        set((state) => {
          const newLocks = { ...state.locksByRequest }
          if (lock) {
            newLocks[requestId] = lock
          } else {
            delete newLocks[requestId]
          }
          return { locksByRequest: newLocks }
        })
      },

      clearPresenceAndLocks: () => {
        set({ presenceByRequest: {}, locksByRequest: {} })
      },

      fetchRequestVersions: async (requestId) => {
        try {
          const response = await apiClient.get<RequestVersion[]>(
            `/api/v1/requests/${requestId}/versions`
          )
          if (response.status === 200) {
            set((state) => ({
              requestVersions: {
                ...state.requestVersions,
                [requestId]: response.data as RequestVersion[]
              }
            }))
          }
        } catch {
          // silent
        }
      },

      fetchRequestComments: async (requestId) => {
        try {
          const response = await apiClient.get<Comment[]>(`/api/v1/requests/${requestId}/comments`)
          if (response.status === 200) {
            set((state) => ({
              requestComments: { ...state.requestComments, [requestId]: response.data as Comment[] }
            }))
          }
        } catch {
          // silent
        }
      },

      addComment: async (requestId, content) => {
        try {
          const response = await apiClient.post(`/api/v1/requests/${requestId}/comments`, {
            content
          })
          if (response.status === 201) {
            await get().fetchRequestComments(requestId)
          }
        } catch {
          toast.error('Failed to add comment')
        }
      },

      restoreVersion: async (requestId, versionId) => {
        try {
          const response = await apiClient.post(
            `/api/v1/requests/${requestId}/versions/${versionId}/rollback`,
            {}
          )
          if (response.status === 200) {
            toast.success('Version restored successfully')
            const collectionId = get().requests.find((r) => r.id === requestId)?.collection_id
            if (collectionId) {
              await get().fetchCollectionContents(collectionId)
            }
          }
        } catch {
          toast.error('Failed to restore version')
        }
      },

      toggleExpand: (id: string) => {
        set((state) => ({
          expandedItems: {
            ...state.expandedItems,
            [id]: !state.expandedItems[id]
          }
        }))
      },

      fetchTeams: async () => {
        set({ teamsLoading: true })
        try {
          const response = await apiClient.get<Team[]>('/api/v1/teams')
          if (response.status === 200) {
            const teams = response.data as Team[]
            set({ teams, teamsLoading: false })

            if (teams.length > 0 && !get().activeTeamId) {
              await get().setActiveTeam(teams[0].id)
            }
          } else {
            set({ teamsLoading: false })
          }
        } catch {
          set({ teamsLoading: false })
        }
      },

      setActiveTeam: async (teamId: number) => {
        set({ activeTeamId: teamId })
        await Promise.all([get().fetchCollections(teamId), get().fetchEnvironments(teamId)])
        await get().fetchHistory()
      },

      createTeam: async (name: string, description: string) => {
        set({ teamsLoading: true })
        try {
          const response = await apiClient.post('/api/v1/teams', { name, description })
          if (response.status === 201) {
            toast.success('Team created successfully')
            await get().fetchTeams()
          } else {
            set({ teamsLoading: false })
          }
        } catch {
          set({ teamsLoading: false })
          toast.error('Failed to create team')
        }
      },

      fetchCollections: async (teamId: number) => {
        set({ collectionsLoading: true })
        try {
          const response = await apiClient.get<Collection[]>(`/api/v1/teams/${teamId}/collections`)
          if (response.status === 200) {
            set({ collections: response.data as Collection[], collectionsLoading: false })
            return response.data as Collection[]
          } else {
            set({ collectionsLoading: false })
            return null
          }
        } catch {
          set({ collectionsLoading: false })
        }
      },

      fetchCollectionContents: async (collectionId: number) => {
        try {
          const [foldersRes, requestsRes] = await Promise.all([
            apiClient.get<Folder[]>(`/api/v1/collections/${collectionId}/folders`),
            apiClient.get<ApiRequest[]>(`/api/v1/collections/${collectionId}/requests`)
          ])

          const folders = foldersRes.status === 200 ? (foldersRes.data as Folder[]) : []
          const allRequestsRaw =
            requestsRes.status === 200 ? (requestsRes.data as ApiRequest[]) : []
          const allRequests = allRequestsRaw.map(normalizeRequest)

          // Group requests by folder
          const rootRequests = allRequests.filter((r) => r.folder_id === null)
          const folderRequests: Record<number, ApiRequest[]> = {}

          // Initialize all folders in this collection with an empty array to clear stale data
          folders.forEach((f) => {
            folderRequests[f.id] = []
          })

          allRequests.forEach((req) => {
            if (req.folder_id !== null) {
              if (!folderRequests[req.folder_id]) {
                folderRequests[req.folder_id] = []
              }
              folderRequests[req.folder_id].push(req)
            }
          })

          set((state) => ({
            foldersByCollection: { ...state.foldersByCollection, [collectionId]: folders },
            requestsByCollection: { ...state.requestsByCollection, [collectionId]: rootRequests },
            requestsByFolder: { ...state.requestsByFolder, ...folderRequests },
            requests: [
              ...state.requests.filter((r) => r.collection_id !== collectionId),
              ...allRequests
            ]
          }))
        } catch {
          // silent fail
        }
      },

      openRequestInTab: (request: ApiRequest) => {
        const { tabs } = get()
        const normalizedRequest = normalizeRequest(request)
        const existingTab = tabs.find((t) => t.requestId === normalizedRequest.id)

        if (existingTab) {
          set({ activeTabId: normalizedRequest.id })
          return
        }

        const newTab: RequestTab = {
          requestId: normalizedRequest.id,
          name: normalizedRequest.name,
          method: normalizedRequest.method,
          workingRequest: {
            method: normalizedRequest.method,
            url: normalizedRequest.url,
            headers: normalizedRequest.headers || {},
            body: normalizedRequest.body as string,
            auth_config: (normalizedRequest.auth_config as AuthConfig) || { type: 'No Auth' },
            pre_request_script: normalizedRequest.pre_request_script || '',
            post_request_script: normalizedRequest.post_request_script || ''
          },
          lastResponse: null,
          isSending: false,
          isDirty: false,
          testResults: []
        }
        set({
          tabs: [...tabs, newTab],
          activeTabId: normalizedRequest.id
        })
      },

      setActiveTab: (requestId: number) => {
        set({ activeTabId: requestId })
      },

      closeTab: (requestId: number) => {
        const { tabs, activeTabId } = get()
        const newTabs = tabs.filter((t) => t.requestId !== requestId)

        let newActiveTabId = activeTabId
        if (activeTabId === requestId) {
          newActiveTabId = newTabs.length > 0 ? newTabs[newTabs.length - 1].requestId : null
        }

        set({ tabs: newTabs, activeTabId: newActiveTabId })
      },

      setWorkingRequest: (update) => {
        const { activeTabId, tabs } = get()
        if (!activeTabId) return

        const newTabs = tabs.map((tab) => {
          if (tab.requestId === activeTabId) {
            return {
              ...tab,
              workingRequest: { ...tab.workingRequest, ...update },
              isDirty: true
            }
          }
          return tab
        })

        set({ tabs: newTabs })

        // Broadcast lock intent over WS
        wsClient.send({ type: 'LOCK_REQUEST', request_id: activeTabId })
      },

      saveActiveRequest: async () => {
        const { activeTabId, tabs } = get()
        const activeTab = tabs.find((t) => t.requestId === activeTabId)
        if (!activeTab) return

        const { workingRequest } = activeTab

        try {
          // Parse body string back to object if possible
          let bodyObj: unknown = {}
          if (workingRequest.body) {
            try {
              bodyObj = JSON.parse(workingRequest.body)
            } catch {
              // If not valid JSON, send as a raw string wrapped in an object
              bodyObj = { raw: workingRequest.body }
            }
          }

          const response = await apiClient.put(`/api/v1/requests/${activeTab.requestId}`, {
            id: activeTab.requestId,
            method: workingRequest.method,
            url: workingRequest.url,
            headers: workingRequest.headers,
            body: bodyObj,
            auth_config: workingRequest.auth_config,
            pre_request_script: workingRequest.pre_request_script,
            post_request_script: workingRequest.post_request_script
          })

          if (response.status === 200) {
            const updatedReq = response.data as ApiRequest

            // Update tab info
            const updatedTabs = tabs.map((t) => {
              if (t.requestId === updatedReq.id) {
                return { ...t, name: updatedReq.name, method: updatedReq.method, isDirty: false }
              }
              return t
            })

            set({ tabs: updatedTabs })
            await get().fetchCollectionContents(updatedReq.collection_id)
            toast.success('Request saved successfully')
          } else {
            toast.error('Failed to save request')
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          toast.error('Error saving request: ' + message)
        }
      },

      createCollection: async (name: string) => {
        const { activeTeamId } = get()
        if (!activeTeamId) return

        try {
          const response = await apiClient.post(`/api/v1/teams/${activeTeamId}/collections`, {
            name,
            description: ''
          })
          if (response.status === 201) {
            const newCol = response.data as Collection
            set((state) => ({
              collections: [...state.collections, newCol],
              requestsByCollection: { ...state.requestsByCollection, [newCol.id]: [] },
              foldersByCollection: { ...state.foldersByCollection, [newCol.id]: [] }
            }))
            toast.success('Collection created')
          }
        } catch {
          toast.error('Failed to create collection')
        }
      },

      importCollection: async (jsonContent: string) => {
        const { activeTeamId } = get()
        if (!activeTeamId) return

        try {
          const data = JSON.parse(jsonContent)
          const response = await apiClient.post(`/api/v1/teams/${activeTeamId}/import`, data)
          if (response.status === 201) {
            await get().fetchCollections(activeTeamId)
            toast.success('Collection imported successfully')
          } else {
            toast.error('Failed to import collection')
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Invalid JSON'
          toast.error('Import Error: ' + message)
        }
      },

      createRequest: async (
        collectionId: number,
        folderId: number | null,
        name: string,
        data?: Partial<ApiRequest>
      ) => {
        try {
          const url = folderId
            ? `/api/v1/folders/${folderId}/requests`
            : `/api/v1/collections/${collectionId}/requests`

          const payload = {
            name,
            description: data?.description || '',
            method: data?.method || 'GET',
            url: data?.url || 'https://api.example.com',
            headers: data?.headers || {},
            body: data?.body || {},
            auth_config: data?.auth_config || { type: 'No Auth' },
            folder_id: folderId,
            order_index: data?.order_index || 0,
            pre_request_script: data?.pre_request_script || '',
            post_request_script: data?.post_request_script || ''
          }

          const response = await apiClient.post(url, payload)

          if (response.status === 201) {
            const newReq = response.data as ApiRequest

            set((state) => {
              const colId = collectionId
              const fId = folderId

              // Update global state
              const updatedRequests = [...state.requests, newReq]

              // Update collection mapping
              const colReqs = state.requestsByCollection[colId] || []
              const updatedByCol = {
                ...state.requestsByCollection,
                [colId]: [...colReqs, newReq]
              }

              // Update folder mapping
              const updatedByFolder = { ...state.requestsByFolder }
              if (fId) {
                const fReqs = state.requestsByFolder[fId] || []
                updatedByFolder[fId] = [...fReqs, newReq]
              }

              return {
                requests: updatedRequests,
                requestsByCollection: updatedByCol,
                requestsByFolder: updatedByFolder
              }
            })

            get().openRequestInTab(newReq)
            toast.success(`Request "${name}" created successfully`)
          }
        } catch (err: unknown) {
          const msg = err.response?.data?.error || err.message || 'Unknown network error'
          toast.error(`Failed to create request: ${msg}`)
        }
      },

      createFolder: async (collectionId: number, parentFolderId: number | null, name: string) => {
        try {
          const response = await apiClient.post(`/api/v1/collections/${collectionId}/folders`, {
            name,
            parent_folder_id: parentFolderId
          })

          if (response.status === 201) {
            const newFolder = response.data as Folder
            set((state) => {
              const colId = collectionId
              const colFolders = state.foldersByCollection[colId] || []
              return {
                foldersByCollection: {
                  ...state.foldersByCollection,
                  [colId]: [...colFolders, newFolder]
                }
              }
            })
            toast.success('Folder created')
          }
        } catch {
          toast.error('Failed to create folder')
        }
      },

      fetchEnvironments: async (teamId: number) => {
        try {
          const response = await apiClient.get<Environment[]>(
            `/api/v1/teams/${teamId}/environments`
          )
          if (response.status === 200) {
            const envs = response.data as Environment[]
            const currentActiveId = get().activeEnvironmentId
            const stillExists = envs.some((e) => e.id === currentActiveId)

            set({
              environments: envs,
              activeEnvironmentId: stillExists
                ? currentActiveId
                : currentActiveId === null
                  ? null
                  : envs.length > 0
                    ? envs[0].id
                    : null
            })
          }
        } catch {
          // silent fail
        }
      },

      setActiveEnvironment: (envId: number | null) => {
        set({ activeEnvironmentId: envId })
      },

      createEnvironment: async (name: string) => {
        const { activeTeamId } = get()
        if (!activeTeamId) return

        try {
          const response = await apiClient.post(`/api/v1/teams/${activeTeamId}/environments`, {
            name,
            variables: {}
          })
          if (response.status === 201) {
            await get().fetchEnvironments(activeTeamId)
            toast.success('Environment created')
          }
        } catch {
          toast.error('Failed to create environment')
        }
      },

      updateEnvironment: async (id: number, name: string, variables: Record<string, string>) => {
        const { activeTeamId } = get()
        if (!activeTeamId) return

        try {
          console.log(`[Store] Updating environment ${id}...`, variables)
          const response = await apiClient.put(`/api/v1/environments/${id}`, {
            name,
            variables
          })
          if (response.status === 200) {
            await get().fetchEnvironments(activeTeamId)
            console.log(`[Store] Environment ${id} updated successfully`)
          } else {
            console.error(`[Store] Failed to update environment ${id}:`, response)
            toast.error('Failed to update environment')
          }
        } catch (err) {
          console.error(`[Store] Error updating environment ${id}:`, err)
          toast.error('Failed to update environment')
        }
      },

      deleteEnvironment: async (id: number) => {
        const { activeTeamId, activeEnvironmentId, fetchEnvironments } = get()
        if (!activeTeamId) return

        console.log(`[Store] Deleting environment ${id}...`)
        try {
          const response = await apiClient.delete(`/api/v1/environments/${id}`)
          if (response.status === 200) {
            console.log(`[Store] Environment ${id} deleted successfully`)
            // If the deleted env was active, clear it
            if (activeEnvironmentId === id) {
              set({ activeEnvironmentId: null })
            }
            await fetchEnvironments(activeTeamId)
            toast.success('Environment deleted')
          } else {
            console.error(`[Store] Failed to delete environment: ${response.status}`)
            toast.error('Failed to delete environment')
          }
        } catch (err) {
          console.error('[Store] Error deleting environment:', err)
          toast.error('Failed to delete environment')
        }
      },

      fetchHistory: async () => {
        const { activeTeamId } = get()
        if (!activeTeamId) return
        set({ historyLoading: true })
        try {
          const response = await apiClient.get<RequestHistory[]>(
            `/api/v1/history?team_id=${activeTeamId}`
          )
          if (response.status === 200) {
            set({ history: response.data as RequestHistory[], historyLoading: false })
          } else {
            set({ historyLoading: false })
          }
        } catch {
          set({ historyLoading: false })
        }
      },

      clearHistory: async () => {
        try {
          const response = await apiClient.delete('/api/v1/history')
          if (response.status === 200) {
            set({ history: [] })
            toast.success('History cleared')
          }
        } catch {
          toast.error('Failed to clear history')
        }
      },

      updateActiveEnvironmentVariable: async (key: string, value: string) => {
        const { activeEnvironmentId, environments, updateEnvironment } = get()
        const activeEnv = environments.find((e) => e.id === activeEnvironmentId)
        if (!activeEnv) return

        const newVars = { ...activeEnv.variables, [key]: value }

        // Update state lokal secara instan agar panggilan berikutnya mendapat data terbaru
        set((state) => ({
          environments: state.environments.map((e) =>
            e.id === activeEnvironmentId ? { ...e, variables: newVars } : e
          )
        }))

        // Kirim ke DB di background
        await updateEnvironment(activeEnv.id, activeEnv.name, newVars)
      },

      deleteCollection: async (id: number) => {
        try {
          await apiClient.delete(`/api/v1/collections/${id}`)
          set((state) => ({ collections: state.collections.filter((c) => c.id !== id) }))
          toast.success('Collection deleted')
        } catch (err: unknown) {
          toast.error('Failed to delete collection')
        }
      },

      deleteFolder: async (id: number) => {
        try {
          await apiClient.delete(`/api/v1/folders/${id}`)
          toast.success('Folder deleted')
          const { collections } = get()
          const col = collections.find((c) =>
            get().requests.some((r) => r.collection_id === c.id && r.folder_id === id)
          )
          if (col) get().fetchCollectionContents(col.id)
        } catch (err: unknown) {
          toast.error('Failed to delete folder')
        }
      },

      deleteRequest: async (id: number) => {
        try {
          await apiClient.delete(`/api/v1/requests/${id}`)
          set((state) => ({
            requests: state.requests.filter((r) => r.id !== id),
            tabs: state.tabs.filter((t) => t.requestId !== id)
          }))
          toast.success('Request deleted')
        } catch (err: unknown) {
          toast.error('Failed to delete request')
        }
      },

      exportCollection: async (id: number) => {
        try {
          const res = await apiClient.get<ApiRequest[]>(`/api/v1/collections/${id}/requests`)
          const collection = get().collections.find((c) => c.id === id)
          if (!collection) return

          const exportData = {
            info: {
              name: collection.name,
              description: collection.description,
              schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
            },
            item: res.data.map((r) => ({
              name: r.name,
              request: {
                method: r.method,
                url: r.url,
                header: Object.entries(r.headers || {}).map(([key, value]) => ({ key, value })),
                body: {
                  mode: 'raw',
                  raw: typeof r.body === 'string' ? r.body : JSON.stringify(r.body)
                }
              }
            }))
          }

          const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${collection.name}.wapify_collection.json`
          a.click()
          URL.revokeObjectURL(url)
          toast.success('Collection exported successfully')
        } catch (err) {
          toast.error('Failed to export collection')
        }
      },

      executeActiveRequest: async () => {
        const {
          tabs,
          activeTabId,
          environments,
          activeEnvironmentId,
          updateActiveEnvironmentVariable
        } = get()
        const activeTab = tabs.find((t) => t.requestId === activeTabId)
        if (!activeTab || activeTab.isSending || !activeTab.workingRequest.url) return

        const { workingRequest } = activeTab
        const activeEnv = environments.find((e) => e.id === activeEnvironmentId)
        // Gunakan shallow copy agar tidak mutasi state langsung
        const vars = { ...(activeEnv?.variables || {}) }

        // --- 1. Pre-request Script Execution ---
        if (workingRequest.pre_request_script) {
          try {
            const addLog = (level: LogEntry['level'], ...args: unknown[]) => {
              const message = args
                .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
                .join(' ')
              set((state) => ({
                logs: [
                  {
                    id: Math.random().toString(36).substr(2, 9),
                    timestamp: new Date().toLocaleTimeString(),
                    level,
                    message,
                    requestId: activeTab.requestId
                  },
                  ...state.logs
                ].slice(0, 100)
              }))
            }

            const wap = {
              // Local/Temporary set (Inject without saving to DB)
              set: (key: string, val: unknown) => {
                vars[key] = String(val)
              },
              environment: {
                set: (key: string, val: unknown) => {
                  const strVal = String(val)
                  vars[key] = strVal // Update local copy for immediate use
                  updateActiveEnvironmentVariable(key, strVal) // Async DB update
                },
                get: (key: string) => vars[key]
              },
              collectionVariables: {
                set: (key: string, val: unknown) => {
                  const strVal = String(val)
                  vars[key] = strVal
                  updateActiveEnvironmentVariable(key, strVal)
                },
                get: (key: string) => vars[key]
              },
              request: workingRequest,
              variables: {
                set: (key: string, val: unknown) => {
                  const strVal = String(val)
                  vars[key] = strVal
                  updateActiveEnvironmentVariable(key, strVal)
                }
              },
              setEnvironmentVariable: (key: string, val: unknown) => {
                const strVal = String(val)
                console.log(`[Wapify] Pre-script setting env: ${key}=${strVal}`)
                vars[key] = strVal
                updateActiveEnvironmentVariable(key, strVal)
              },
              setEnv: (key: string, val: unknown) => {
                const strVal = String(val)
                console.log(`[Wapify] Pre-script setting env: ${key}=${strVal}`)
                vars[key] = strVal
                updateActiveEnvironmentVariable(key, strVal)
              }
            }

            const mockConsole = {
              log: (...args: unknown[]) => {
                console.log(...args)
                addLog('log', ...args)
              },
              info: (...args: unknown[]) => {
                console.info(...args)
                addLog('info', ...args)
              },
              warn: (...args: unknown[]) => {
                console.warn(...args)
                addLog('warn', ...args)
              },
              error: (...args: unknown[]) => {
                console.error(...args)
                addLog('error', ...args)
              }
            }

            // Context with libraries
            const context = { wap, pm: wap, moment, _, console: mockConsole }

            // Use AsyncFunction to support await in scripts
            const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
            const fn = new AsyncFunction(
              'wap',
              'pm',
              'moment',
              '_',
              'console',
              workingRequest.pre_request_script
            )
            await fn(context.wap, context.pm, context.moment, context._, context.console)
          } catch (err: unknown) {
            toast.error(`Pre-request Error: ${err.message}`)
          }
        }

        // variables are already updated in 'vars' by the script

        // Substitusi variabel di URL
        console.log('[Wapify] Current vars for replacement:', vars)
        let substitutedUrl = replaceVariables(workingRequest.url, vars)

        // Jangan blokir jika ada {{, biarkan saja agar user bisa debug sendiri (seperti Postman)
        if (substitutedUrl.includes('{{')) {
          console.warn('[Wapify] Some variables in URL could not be resolved:', substitutedUrl)
        }

        // Inject Auth into Headers
        const finalHeaders = injectAuth(workingRequest.headers, workingRequest.auth_config, vars)

        // Substitusi variabel di Headers
        const substitutedHeaders: Record<string, string> = {}
        Object.entries(finalHeaders).forEach(([key, value]) => {
          const resolved = replaceVariables(value, vars)
          substitutedHeaders[key] = resolved
        })

        const substitutedBody = replaceVariables(workingRequest.body, vars)

        // Inject Auth into URL if type is API Key and addTo is query
        if (
          workingRequest.auth_config.type === 'API Key' &&
          workingRequest.auth_config.addTo === 'query'
        ) {
          const key = replaceVariables(workingRequest.auth_config.key || '', vars)
          const value = replaceVariables(workingRequest.auth_config.value || '', vars)
          if (key && value) {
            try {
              const urlObj = new URL(substitutedUrl)
              urlObj.searchParams.set(key, value)
              substitutedUrl = urlObj.toString()
            } catch {
              // invalid url, skip adding query
            }
          }
        }

        // Set sending state for this tab
        set({
          tabs: tabs.map((t) =>
            t.requestId === activeTabId ? { ...t, isSending: true, lastResponse: null } : t
          )
        })

        try {
          const response = await apiClient.executeRequest(
            workingRequest.method,
            substitutedUrl,
            substitutedHeaders,
            substitutedBody
          )

          // --- 2. Post-request Script (Tests) Execution ---
          if (workingRequest.post_request_script) {
            try {
              console.log('[Wapify] Starting post-request script execution...')
              console.log('[Wapify] Response Data:', response.data)
              const testResults: { name: string; status: 'passed' | 'failed'; error?: string }[] =
                []

              const wap = {
                set: (key: string, val: unknown) => {
                  const strVal = String(val)
                  console.log(`[Wapify] Script setting env: ${key}=${strVal}`)
                  vars[key] = strVal
                  updateActiveEnvironmentVariable(key, strVal)
                },
                environment: {
                  set: (key: string, val: unknown) => {
                    const strVal = String(val)
                    console.log(`[Wapify] Script setting env: ${key}=${strVal}`)
                    vars[key] = strVal
                    updateActiveEnvironmentVariable(key, strVal)
                  },
                  get: (key: string) => vars[key]
                },
                collectionVariables: {
                  set: (key: string, val: unknown) => {
                    const strVal = String(val)
                    vars[key] = strVal
                    updateActiveEnvironmentVariable(key, strVal)
                  },
                  get: (key: string) => vars[key]
                },
                setEnvironmentVariable: (key: string, val: unknown) => {
                  const strVal = String(val)
                  console.log(`[Wapify] Script setting env (alias): ${key}=${strVal}`)
                  vars[key] = strVal
                  updateActiveEnvironmentVariable(key, strVal)
                },
                setEnv: (key: string, val: unknown) => {
                  const strVal = String(val)
                  console.log(`[Wapify] Script setting env (alias): ${key}=${strVal}`)
                  vars[key] = strVal
                  updateActiveEnvironmentVariable(key, strVal)
                },
                response: {
                  status: response.status,
                  data: response.data,
                  headers: {
                    get: (key: string) => {
                      const h = response.headers[key.toLowerCase()]
                      return Array.isArray(h) ? h[0] : h
                    }
                  },
                  json: () => response.data,
                  to: {
                    have: {
                      status: (code: number) => {
                        if (response.status !== code)
                          throw new Error(`Expected status ${code} but got ${response.status}`)
                      }
                    }
                  }
                },
                expect: (val: unknown) => ({
                  to: {
                    equal: (expected: unknown) => {
                      if (val !== expected) throw new Error(`Expected ${expected} but got ${val}`)
                    },
                    be: {
                      a: (type: string) => {
                        if (typeof val !== type)
                          throw new Error(`Expected type ${type} but got ${typeof val}`)
                      }
                    },
                    include: (substring: string) => {
                      if (typeof val === 'string' && !val.includes(substring))
                        throw new Error(`Expected "${val}" to include "${substring}"`)
                    }
                  },
                  not: {
                    to: {
                      be: {
                        null: () => {
                          if (val === null || val === undefined)
                            throw new Error(`Expected value to not be null`)
                        }
                      }
                    }
                  }
                }),
                test: (name: string, fn: () => void) => {
                  try {
                    fn()
                    testResults.push({ name, status: 'passed' })
                  } catch (err: unknown) {
                    const errorMessage = err instanceof Error ? err.message : String(err)
                    testResults.push({ name, status: 'failed', error: errorMessage })
                  }
                }
              }

              const addLog = (level: LogEntry['level'], ...args: unknown[]): void => {
                const message = args
                  .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
                  .join(' ')
                set((state) => ({
                  logs: [
                    {
                      id: Math.random().toString(36).substr(2, 9),
                      timestamp: new Date().toLocaleTimeString(),
                      level,
                      message,
                      requestId: activeTab.requestId
                    },
                    ...state.logs
                  ].slice(0, 100)
                }))
              }

              const mockConsole = {
                log: (...args: unknown[]): void => {
                  console.log(...args)
                  addLog('log', ...args)
                },
                info: (...args: unknown[]): void => {
                  console.info(...args)
                  addLog('info', ...args)
                },
                warn: (...args: unknown[]): void => {
                  console.warn(...args)
                  addLog('warn', ...args)
                },
                error: (...args: unknown[]): void => {
                  console.error(...args)
                  addLog('error', ...args)
                }
              }

              const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
              const fn = new AsyncFunction(
                'wap',
                'pm',
                'moment',
                '_',
                'console',
                workingRequest.post_request_script
              )
              await fn(wap, wap, moment, _, mockConsole)

              // Update tab with results
              set((state) => ({
                tabs: state.tabs.map((t) =>
                  t.requestId === activeTabId ? { ...t, testResults } : t
                )
              }))

              // Log results (future: show in UI)
              testResults.forEach((r) => {
                if (r.status === 'failed') toast.error(`Test Failed: ${r.name} - ${r.error}`)
              })
            } catch (err: unknown) {
              const errorMessage = err instanceof Error ? err.message : String(err)
              toast.error(`Test Script Error: ${errorMessage}`)
            }
          }

          // Update tab with response
          set((state) => ({
            tabs: state.tabs.map((t) =>
              t.requestId === activeTabId ? { ...t, isSending: false, lastResponse: response } : t
            )
          }))

          // Save to history
          await apiClient.post('/api/v1/history', {
            team_id: get().activeTeamId,
            request_id: activeTab.requestId,
            method: workingRequest.method,
            url: substitutedUrl,
            request_headers: substitutedHeaders,
            request_body: substitutedBody,
            response_headers: response.headers,
            response_body:
              typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
            status_code: response.status,
            response_time: Math.round(response.timing)
          })
          await get().fetchHistory()

          if (response.status >= 200 && response.status < 300) {
            toast.success(`Request success: ${response.status}`)
          } else {
            toast.error(`Request failed: ${response.status}`)
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Request failed'

          set((state) => ({
            tabs: state.tabs.map((t) =>
              t.requestId === activeTabId
                ? {
                    ...t,
                    isSending: false,
                    lastResponse: {
                      status: 0,
                      headers: {},
                      data: { error: message },
                      timing: 0
                    }
                  }
                : t
            )
          }))

          toast.error('Network Error: ' + message)
        }
      },

      fetchActivities: async (teamId: number) => {
        try {
          const response = await apiClient.get<Activity[]>(`/api/v1/teams/${teamId}/activities`)
          if (response.status === 200) {
            // Normalize user names for display
            const logs = (response.data as any[]).map((log) => ({
              ...log,
              user_name: log.user?.name || 'Unknown'
            }))
            set({ activities: logs })
          }
        } catch (err: unknown) {
          console.error('Failed to fetch activities:', err)
        }
      },

      clearResponse: () => {
        const { activeTabId, tabs } = get()
        if (!activeTabId) return

        set({
          tabs: tabs.map((t) => (t.requestId === activeTabId ? { ...t, lastResponse: null } : t))
        })
      },

      clearLogs: () => set({ logs: [] })
    }),
    {
      name: 'wapify-data-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeTeamId: state.activeTeamId,
        activeTabId: state.activeTabId,
        activeEnvironmentId: state.activeEnvironmentId,
        expandedItems: state.expandedItems
      })
    }
  )
)
