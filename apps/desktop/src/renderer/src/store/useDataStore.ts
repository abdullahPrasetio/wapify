import { create } from 'zustand'
import { apiClient } from '../api/client'
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
    auth_config: req.auth_config || { type: 'No Auth' }
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

export interface WorkingRequest {
  method: string
  url: string
  headers: Record<string, string>
  body: string
  auth_config: AuthConfig
}

export interface RequestTab {
  requestId: number
  name: string
  method: string
  workingRequest: WorkingRequest
  lastResponse: IpcResponse | null
  isSending: boolean
  isDirty: boolean
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

  // History
  history: RequestHistory[]
  historyLoading: boolean

  // Multi-Tab System
  tabs: RequestTab[]
  activeTabId: number | null // refers to requestId

  // Environments (for active team)
  environments: Environment[]
  activeEnvironmentId: number | null

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
  createRequest: (collectionId: number, folderId: number | null, name: string) => Promise<void>
  createFolder: (collectionId: number, parentFolderId: number | null, name: string) => Promise<void>

  // Environment Actions
  fetchEnvironments: (teamId: number) => Promise<void>
  setActiveEnvironment: (envId: number) => void
  createEnvironment: (name: string) => Promise<void>
  updateEnvironment: (id: number, name: string, variables: Record<string, string>) => Promise<void>
  deleteEnvironment: (id: number) => Promise<void>

  // History Actions
  fetchHistory: () => Promise<void>
  clearHistory: () => Promise<void>

  // Execution Actions
  executeActiveRequest: () => Promise<void>
  clearResponse: () => void
}

const replaceVariables = (text: string, variables: Record<string, string>): string => {
  if (typeof text !== 'string') return text
  return text.replace(/\{\{(.+?)\}\}/g, (match, key) => {
    const trimmedKey = key.trim()
    return variables[trimmedKey] !== undefined ? String(variables[trimmedKey]) : match
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

export const useDataStore = create<DataState>((set, get) => ({
  teams: [],
  teamsLoading: false,
  activeTeamId: null,
  collections: [],
  collectionsLoading: false,
  foldersByCollection: {},
  requestsByCollection: {},
  requestsByFolder: {},
  history: [],
  historyLoading: false,

  tabs: [],
  activeTabId: null,

  environments: [],
  activeEnvironmentId: null,

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
    await Promise.all([
      get().fetchCollections(teamId),
      get().fetchEnvironments(teamId)
    ])
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
      } else {
        set({ collectionsLoading: false })
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
      const allRequestsRaw = requestsRes.status === 200 ? (requestsRes.data as ApiRequest[]) : []
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
        requestsByFolder: { ...state.requestsByFolder, ...folderRequests }
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
        auth_config: (normalizedRequest.auth_config as AuthConfig) || { type: 'No Auth' }
      },
      lastResponse: null,
      isDirty: false,
      isSending: false
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
  },

  saveActiveRequest: async () => {
    const { activeTabId, tabs } = get()
    const activeTab = tabs.find((t) => t.requestId === activeTabId)
    if (!activeTab) return

    const { workingRequest } = activeTab

    try {
      // Parse body string back to object if possible
      let bodyObj: any = {}
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
        auth_config: workingRequest.auth_config
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
        await get().fetchCollections(activeTeamId)
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

  createRequest: async (collectionId: number, folderId: number | null, name: string) => {
    try {
      const response = await apiClient.post(`/api/v1/collections/${collectionId}/requests`, {
        name,
        collection_id: collectionId,
        folder_id: folderId,
        method: 'GET',
        url: 'https://api.example.com',
        headers: {},
        body: {},
        auth_config: { type: 'No Auth' }
      })

      if (response.status === 201) {
        await get().fetchCollectionContents(collectionId)
        const newReq = response.data as ApiRequest
        get().openRequestInTab(newReq)
        toast.success('Request created')
      }
    } catch {
      toast.error('Failed to create request')
    }
  },

  createFolder: async (collectionId: number, parentFolderId: number | null, name: string) => {
    try {
      const response = await apiClient.post(`/api/v1/collections/${collectionId}/folders`, {
        name,
        parent_folder_id: parentFolderId
      })

      if (response.status === 201) {
        await get().fetchCollectionContents(collectionId)
        toast.success('Folder created')
      }
    } catch {
      toast.error('Failed to create folder')
    }
  },

  fetchEnvironments: async (teamId: number) => {
    try {
      const response = await apiClient.get<Environment[]>(`/api/v1/teams/${teamId}/environments`)
      if (response.status === 200) {
        const envs = response.data as Environment[]
        const currentActiveId = get().activeEnvironmentId
        
        set({
          environments: envs,
          // Preserve active ID if it still exists in the new list, otherwise default to first or null
          activeEnvironmentId: envs.some(e => e.id === currentActiveId) 
            ? currentActiveId 
            : (envs.length > 0 ? envs[0].id : null)
        })
      }
    } catch {
      // silent fail
    }
  },

  setActiveEnvironment: (envId: number) => {
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
      const response = await apiClient.put(`/api/v1/environments/${id}`, {
        name,
        variables
      })
      if (response.status === 200) {
        await get().fetchEnvironments(activeTeamId)
        toast.success('Environment updated')
      }
    } catch {
      toast.error('Failed to update environment')
    }
  },

  deleteEnvironment: async (id: number) => {
    const { activeTeamId } = get()
    if (!activeTeamId) return

    try {
      const response = await apiClient.delete(`/api/v1/environments/${id}`)
      if (response.status === 200) {
        await get().fetchEnvironments(activeTeamId)
        toast.success('Environment deleted')
      }
    } catch {
      toast.error('Failed to delete environment')
    }
  },

  fetchHistory: async () => {
    const { activeTeamId } = get()
    if (!activeTeamId) return
    set({ historyLoading: true })
    try {
      const response = await apiClient.get<RequestHistory[]>(`/api/v1/history?team_id=${activeTeamId}`)
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

  executeActiveRequest: async () => {
    const { tabs, activeTabId, environments, activeEnvironmentId } = get()
    const activeTab = tabs.find((t) => t.requestId === activeTabId)
    if (!activeTab || activeTab.isSending || !activeTab.workingRequest.url) return

    const { workingRequest } = activeTab
    const activeEnv = environments.find((e) => e.id === activeEnvironmentId)
    const vars = activeEnv?.variables || {}

    // Substitusi variabel di URL
    let substitutedUrl = replaceVariables(workingRequest.url, vars)
    
    if (substitutedUrl.includes('{{')) {
      toast.error('Gagal memproses variabel URL. Pastikan Environment sudah dipilih dan variabel tersedia.')
      return
    }

    // Inject Auth into Headers
    const finalHeaders = injectAuth(workingRequest.headers, workingRequest.auth_config, vars)

    // Substitusi variabel di Headers
    const substitutedHeaders: Record<string, string> = {}
    Object.entries(finalHeaders).forEach(([key, value]) => {
      substitutedHeaders[key] = replaceVariables(value, vars)
    })

    // Substitusi variabel di Body
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

  clearResponse: () => {
    const { activeTabId, tabs } = get()
    if (!activeTabId) return

    set({
      tabs: tabs.map((t) => (t.requestId === activeTabId ? { ...t, lastResponse: null } : t))
    })
  }
}))
