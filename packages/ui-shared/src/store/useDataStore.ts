import { create } from 'zustand'
import { persist, createJSONStorage, subscribeWithSelector } from 'zustand/middleware'
import { apiClient } from '../api/client'
import { wsClient } from '../api/websocket'
import type {
  Team,
  Collection,
  Folder,
  ApiRequest,
  RequestExample,
  Environment,
  IpcResponse,
  RequestHistory,
  FieldValidations,
  ExtractionRule,
  SchemaAssertion,
  AuthConfig
} from '../types'
export type { AuthConfig } from '../types'
import { toast } from 'sonner'
import moment from 'moment'
import _ from 'lodash'
import Ajv from 'ajv'

const ajv = new Ajv({ allErrors: true })

const PROTO_POLLUTION_RE = /(__proto__|constructor|prototype)/i
const isSafeJsonPath = (path: string): boolean => !PROTO_POLLUTION_RE.test(path)

// ─── Pre/Post-request script sandbox (pm/wap) ──────────────────────────────
// Postman collections imported from real Postman commonly use a handful of
// globals/patterns our `pm` shim didn't cover, which made imported scripts
// throw partway through instead of running: `require('moment'|'lodash')`,
// `CryptoJS.enc.Base64/Utf8` (typically used to build a Basic-Auth header by
// hand), the legacy `responseBody` global, `pm.response.code`/`.responseTime`,
// and chai matchers beyond `.to.equal` (`.eql`, `.be.above/below`,
// `.have.property`, and the getter-style `.not.null`/`.not.undefined`).
// This is still a minimal shim, not a full chai/crypto-js port — see
// docs/releases/2026-08-02-collection-settings-parity.md for the exact scope.

// Only the Base64(Utf8(...)) idiom is supported (no MD5/SHA/HMAC) — that
// covers the common "hand-roll a Basic Auth header" pattern, not general
// cryptography.
const CryptoJSShim = {
  enc: {
    Utf8: {
      parse: (s: string) => String(s),
      stringify: (s: string) => String(s)
    },
    Base64: {
      stringify: (s: string) => {
        try {
          return btoa(unescape(encodeURIComponent(String(s))))
        } catch {
          return btoa(String(s))
        }
      },
      parse: (s: string) => {
        try {
          return decodeURIComponent(escape(atob(String(s))))
        } catch {
          return atob(String(s))
        }
      }
    }
  }
}

function wapboltScriptRequire(moduleName: string): unknown {
  switch (moduleName) {
    case 'moment':
      return moment
    case 'lodash':
      return _
    case 'crypto-js':
      return CryptoJSShim
    default:
      throw new Error(
        `require('${moduleName}') is not supported in Wapbolt scripts. Supported: 'moment', 'lodash', 'crypto-js'.`
      )
  }
}

// Small chai-like matcher set — covers what Postman-exported test scripts
// actually use, not the full chai API.
function createScriptExpect(val: unknown): Record<string, unknown> {
  const notNullCheck = (): void => {
    if (val === null || val === undefined) throw new Error('Expected value to not be null/undefined')
  }
  return {
    to: {
      equal: (expected: unknown) => {
        if (val !== expected) throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(val)}`)
      },
      eql: (expected: unknown) => {
        if (!_.isEqual(val, expected)) {
          throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(val)}`)
        }
      },
      be: {
        a: (type: string) => {
          if (typeof val !== type) throw new Error(`Expected type ${type} but got ${typeof val}`)
        },
        above: (n: number) => {
          if (!(Number(val) > n)) throw new Error(`Expected ${val} to be above ${n}`)
        },
        below: (n: number) => {
          if (!(Number(val) < n)) throw new Error(`Expected ${val} to be below ${n}`)
        },
        null: () => {
          if (val !== null && val !== undefined) throw new Error('Expected value to be null')
        }
      },
      include: (substring: unknown) => {
        if (typeof val === 'string' && typeof substring === 'string' && !val.includes(substring)) {
          throw new Error(`Expected "${val}" to include "${substring}"`)
        } else if (Array.isArray(val) && !val.includes(substring)) {
          throw new Error(`Expected array to include ${JSON.stringify(substring)}`)
        }
      },
      have: {
        property: (name: string) => {
          if (!val || typeof val !== 'object' || !(name in (val as object))) {
            throw new Error(`Expected object to have property "${name}"`)
          }
        }
      }
    },
    not: {
      to: {
        be: {
          null: notNullCheck
        }
      },
      // Chai's getter-style assertions (`pm.expect(x).not.null`, no call) —
      // real Postman scripts use both the call and getter forms.
      get null() {
        notNullCheck()
        return true
      },
      get undefined() {
        notNullCheck()
        return true
      }
    }
  }
}

// response.data may already be parsed JSON (object) — `responseBody` in real
// Postman is always the raw text, so re-stringify when needed.
function pmResponseBodyText(data: unknown): string {
  return typeof data === 'string' ? data : JSON.stringify(data)
}

function createPmResponseContext(response: {
  status: number
  data: unknown
  headers?: Record<string, unknown>
  timing?: number
}): Record<string, unknown> {
  const bodyText = pmResponseBodyText(response.data)
  return {
    status: response.status,
    code: response.status,
    data: response.data,
    responseTime: typeof response.timing === 'number' ? response.timing : 0,
    headers: {
      get: (key: string) => {
        const h = (response.headers || {})[key.toLowerCase()]
        return Array.isArray(h) ? h[0] : h
      }
    },
    json: () => response.data,
    text: () => bodyText,
    to: {
      have: {
        status: (code: number) => {
          if (response.status !== code) throw new Error(`Expected status ${code} but got ${response.status}`)
        }
      }
    }
  }
}

// `moment`/`_` are intentionally NOT bound as bare parameters (only reachable
// via `require('moment'|'lodash')`) — real Postman scripts routinely do
// `const moment = require('moment')`, and a `const`/`let` can't redeclare an
// identifier that's already a function parameter (SyntaxError), so binding
// `moment` as a bare global would break every such script at parse time.
// `responseBody` is bound as a real parameter (not a `wap.responseBody`
// property) for the same reason — scripts reference it as a bare identifier.
async function runPmScript(
  script: string,
  wap: Record<string, unknown>,
  consoleImpl: Console,
  responseBodyText?: string
): Promise<void> {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
  const fn = new AsyncFunction('wap', 'pm', 'console', 'require', 'CryptoJS', 'responseBody', script)
  await fn(wap, wap, consoleImpl, wapboltScriptRequire, CryptoJSShim, responseBodyText)
}

/**
 * Ensures a request object has the correct data structure for UI.
 */
const normalizeRequest = (req: ApiRequest): ApiRequest => {
  if (!req) return req

  const inferBodyType = (body: unknown, headers: Record<string, string> | undefined): string => {
    // Detect from body structure first (most reliable)
    const isArrayBody = Array.isArray(body) ||
      (typeof body === 'object' && body !== null && 'array' in body && Array.isArray((body as any).array))
    if (isArrayBody) {
      const ct = Object.entries(headers || {}).find(([k]) => k.toLowerCase() === 'content-type')?.[1] || ''
      return ct.includes('multipart/form-data') ? 'form-data' : 'x-www-form-urlencoded'
    }
    // Fallback: infer from Content-Type header
    const ct = Object.entries(headers || {}).find(([k]) => k.toLowerCase() === 'content-type')?.[1] || ''
    if (ct.includes('application/x-www-form-urlencoded')) return 'x-www-form-urlencoded'
    if (ct.includes('multipart/form-data')) return 'form-data'
    if (ct.includes('application/xml') || ct.includes('text/xml')) return 'raw-xml'
    if (ct.includes('text/html')) return 'raw-html'
    return 'raw-json'
  }

  const bodyType = (!req.body_type || req.body_type === 'raw-json')
    ? inferBodyType(req.body, req.headers as Record<string, string>)
    : req.body_type
  let body = req.body

  if (bodyType.startsWith('raw-')) {
    if (typeof body === 'object' && body !== null) {
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
  } else if (bodyType === 'form-data' || bodyType === 'x-www-form-urlencoded') {
    // Handle wrapped array from backend: { "array": [...] }
    if (typeof body === 'object' && body !== null && 'array' in body && Array.isArray((body as any).array)) {
      body = (body as any).array
    } else if (!Array.isArray(body)) {
      body = []
    }
  } else if (bodyType === 'graphql') {
    // Normalize graphql body to JSON string with expected shape
    if (typeof body !== 'string') {
      body = JSON.stringify({ query: '', variables: '{}', operationName: '' })
    } else {
      try {
        const parsed = JSON.parse(body)
        if (typeof parsed !== 'object' || !('query' in parsed)) {
          body = JSON.stringify({ query: String(body), variables: '{}', operationName: '' })
        }
      } catch {
        body = JSON.stringify({ query: '', variables: '{}', operationName: '' })
      }
    }
  }

  return {
    ...req,
    body,
    body_type: bodyType,
    body_variants: (req.body_variants as Record<string, unknown>) || {},
    headers: req.headers || {},
    auth_config: (req.auth_config as AuthConfig) || { type: 'No Auth' },
    pre_request_script: req.pre_request_script || '',
    post_request_script: req.post_request_script || '',
    extraction_rules: Array.isArray(req.extraction_rules) ? req.extraction_rules : [],
    schema_assertions: Array.isArray(req.schema_assertions) ? req.schema_assertions : []
  }
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
  body: string | any[] // Bisa string untuk raw, atau array untuk form-data/urlencoded
  body_type: string
  /** Body tersimpan per tipe (raw-json, form-data, x-www-form-urlencoded, dst) agar pindah tab body tidak kehilangan isi tipe lain */
  body_variants: Record<string, unknown>
  auth_config: AuthConfig
  pre_request_script: string
  post_request_script: string
  /** Validation metadata per field — stored separately, never sent to target API */
  field_validations: FieldValidations
  /** Request protocol type: 'http' for normal HTTP requests, 'ws' for WebSocket, 'sse' for Server-Sent Events */
  request_type?: 'http' | 'ws' | 'sse'
  extraction_rules: ExtractionRule[]
  schema_assertions: SchemaAssertion[]
}

export interface LogEntry {
  id: string
  timestamp: string
  level: 'log' | 'info' | 'warn' | 'error' | 'network'
  message: string
  requestId?: number | string
  details?: any
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
  kind: 'request'
  requestId: number | string
  name: string
  method: string
  workingRequest: WorkingRequest
  lastResponse: IpcResponse | null
  isSending: boolean
  pendingRequestId: string | null
  isDirty: boolean
  testResults: { name: string; status: 'passed' | 'failed'; error?: string }[]
}

export interface CollectionSettingsData {
  name: string
  description: string
  confluence_page_id: string
  auth_config: AuthConfig
  pre_request_script: string
  post_request_script: string
  variables: Record<string, string>
}

export interface CollectionTab {
  kind: 'collection'
  requestId: string // `collection-${collectionId}` — reuses the same unifying tab key as request tabs
  name: string
  isDirty: boolean
  collectionId: number
  draft: CollectionSettingsData
}

export type TabItem = RequestTab | CollectionTab

const collectionToDraft = (c: Collection): CollectionSettingsData => ({
  name: c.name,
  description: c.description,
  confluence_page_id: c.confluence_page_id || '',
  auth_config: c.auth_config || { type: 'No Auth' },
  pre_request_script: c.pre_request_script || '',
  post_request_script: c.post_request_script || '',
  variables: c.variables || {}
})

export interface ResponseSnapshot {
  id: string
  label: string
  timestamp: number
  status: number
  timing: number
  data: unknown
  headers: Record<string, string[]>
}

export interface CollectionRunResult {
  requestId: number
  name: string
  method: string
  url: string
  status: number
  time: number
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
  tabs: TabItem[]
  activeTabId: number | string | null // refers to requestId

  // Environments (for active team)
  environments: Environment[]
  activeEnvironmentId: number | null
  logs: LogEntry[]

  // Collection Runner last results
  lastRunCollectionId: number | null
  lastRunResults: CollectionRunResult[]

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

  // Confluence
  confluenceEnabled: boolean
  fetchConfluenceEnabled: () => Promise<void>

  // Searchable Data (Cross-team)
  searchableRequests: { id: number; name: string; url: string; method: string; team_id: number; collection_id: number }[]
  searchableCollections: { id: number; name: string; team_id: number }[]

  fetchSearchableData: () => Promise<void>
  
  // Actions
  fetchTeams: () => Promise<void>
  setActiveTeam: (teamId: number) => Promise<void>
  createTeam: (name: string, description: string) => Promise<void>
  fetchCollections: (teamId: number) => Promise<Collection[] | null>
  fetchCollectionContents: (collectionId: number) => Promise<void>

  // Tab Actions
  openRequestInTab: (request: ApiRequest) => void
  openDraftRequest: (initialData: Partial<ApiRequest>, name?: string) => void
  openExample: (example: RequestExample) => void
  deleteExample: (id: number) => Promise<void>
  renameRequest: (id: number, name: string) => Promise<void>
  setActiveTab: (requestId: number | string) => void
  closeTab: (requestId: number | string) => void
  forceCloseTab: (requestId: number | string) => void
  closeOtherTabs: (keepRequestId: number | string) => void
  closeAllTabs: () => void
  forceCloseAllTabs: () => void
  duplicateTab: (requestId: number | string) => void
  setWorkingRequest: (update: Partial<WorkingRequest>) => void
  openCollectionInTab: (collectionId: number, name: string) => void
  setCollectionTabDraft: (collectionId: number, update: Partial<CollectionSettingsData>) => void
  saveCollectionTab: (collectionId: number) => Promise<void>

  // CRUD Actions
  saveActiveRequest: () => Promise<void>
  createCollection: (name: string, description?: string, confluence_page_id?: string) => Promise<void>
  updateCollection: (
    id: number,
    name: string,
    description: string,
    confluence_page_id: string,
    extra?: {
      auth_config?: AuthConfig
      pre_request_script?: string
      post_request_script?: string
      variables?: Record<string, string>
    }
  ) => Promise<void>
  updateCollectionVariable: (collectionId: number, key: string, value: string) => Promise<void>
  importCollection: (jsonContent: string, mode?: 'new' | 'overwrite', confirmName?: string) => Promise<void>
  importOpenAPI: (jsonContent: string, mode?: 'new' | 'overwrite', confirmName?: string) => Promise<void>
  importInsomnia: (jsonContent: string, mode?: 'new' | 'overwrite', confirmName?: string) => Promise<void>
  createRequest: (
    collectionId: number,
    folderId: number | null,
    name: string,
    data?: Partial<ApiRequest>
  ) => Promise<ApiRequest | null>
  createFolder: (collectionId: number, parentFolderId: number | null, name: string) => Promise<void>

  // Environment Actions
  fetchEnvironments: (teamId: number) => Promise<void>
  setActiveEnvironment: (envId: number | null) => void
  createEnvironment: (name: string) => Promise<void>
  createGlobalEnvironment: (name: string) => Promise<void>
  updateEnvironment: (id: number, name: string, variables: Record<string, string>, isGlobal?: boolean, teamId?: number | null) => Promise<void>
  deleteEnvironment: (id: number) => Promise<void>

  // History Actions
  fetchHistory: () => Promise<void>
  clearHistory: () => Promise<void>

  // Expansion State
  expandedItems: Record<string, boolean>
  toggleExpand: (id: string) => void
  collapseAll: () => void

  // Execution Actions
  executeActiveRequest: () => Promise<void>
  cancelActiveRequest: () => void
  clearResponse: () => void
  updateActiveEnvironmentVariable: (key: string, value: string) => Promise<void>
  deleteCollection: (id: number) => Promise<void>
  deleteFolder: (id: number) => Promise<void>
  deleteRequest: (id: number) => Promise<void>
  duplicateRequest: (id: number) => Promise<void>
  moveRequest: (id: number, collectionId: number, folderId: number | null, orderIndex: number) => Promise<void>
  moveFolder: (id: number, collectionId: number, parentFolderId: number | null, orderIndex: number) => Promise<void>
  exportCollection: (id: number) => Promise<void>
  clearLogs: () => void

  saveExample: (requestId: number, name: string) => Promise<void>

  // Response Snapshots
  responseSnapshots: Record<string, ResponseSnapshot[]>
  saveResponseSnapshot: (requestId: number | string, label?: string) => void
  deleteResponseSnapshot: (requestId: number | string, snapshotId: string) => void

  runCollection: (
    collectionId: number,
    onProgress?: (result: CollectionRunResult) => void,
    options?: { selectedIds?: Set<number>; iterations?: number; delayMs?: number; stopOnFailure?: boolean }
  ) => Promise<CollectionRunResult[]>
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

    // Postman dynamic variable — fresh random UUID per occurrence, not a lookup.
    if (trimmedKey === '$guid') return crypto.randomUUID()

    const resolved = lowerVars[trimmedKey]

    console.log(
      `[Wapbolt] Matching variable: "${key.trim()}" -> ${resolved !== undefined ? 'FOUND' : 'NOT FOUND'}`
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
  subscribeWithSelector(
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

        lastRunCollectionId: null,
        lastRunResults: [],
        responseSnapshots: {},

        presenceByRequest: {},
        locksByRequest: {},
        requestVersions: {},
        requestComments: {},
        activities: [],

        confluenceEnabled: false,

        fetchConfluenceEnabled: async () => {
          try {
            const res = await apiClient.get('/api/v1/confluence/config')
            set({ confluenceEnabled: res.status === 200 && (res.data as any).enabled === true })
          } catch {
            set({ confluenceEnabled: false })
          }
        },

        searchableRequests: [],
        searchableCollections: [],

        fetchSearchableData: async () => {
          try {
            // Get data from all accessible teams for global search
            const res = await apiClient.get<{ 
              requests: { id: number; name: string; url: string; method: string; team_id: number; collection_id: number }[],
              collections: { id: number; name: string; team_id: number }[]
            }>('/api/v1/search/summary')
            
            if (res.status === 200) {
              set({ 
                searchableRequests: res.data.requests,
                searchableCollections: res.data.collections
              })
            }
          } catch {
            // silent fail
          }
        },

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
            if (response.status === 200 && Array.isArray(response.data)) {
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
            if (response.status === 200 && Array.isArray(response.data)) {
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

        collapseAll: () => {
          set({ expandedItems: {} })
        },

        fetchTeams: async () => {
          set({ teamsLoading: true })
          try {
            const response = await apiClient.get<Team[]>('/api/v1/teams')
            if (response.status === 200 && Array.isArray(response.data)) {
              const teams = response.data as Team[]
              set({ teams, teamsLoading: false })

              const currentTeamId = get().activeTeamId
              if (currentTeamId && teams.some((t) => t.id === currentTeamId)) {
                // Team already selected from previous session — re-fetch data without resetting selection
                await Promise.all([get().fetchCollections(currentTeamId), get().fetchEnvironments(currentTeamId)])
                await get().fetchHistory()
              } else if (teams.length > 0) {
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
            if (response.status === 200 && Array.isArray(response.data)) {
              set({ collections: response.data as Collection[], collectionsLoading: false })
              return response.data as Collection[]
            } else {
              set({ collectionsLoading: false })
              return null
            }
          } catch {
            set({ collectionsLoading: false })
            return null
          }
        },

        fetchCollectionContents: async (collectionId: number) => {
          try {
            const [foldersRes, requestsRes] = await Promise.all([
              apiClient.get<Folder[]>(`/api/v1/collections/${collectionId}/folders`),
              apiClient.get<ApiRequest[]>(`/api/v1/collections/${collectionId}/requests`)
            ])

            const folders = foldersRes.status === 200 && Array.isArray(foldersRes.data)
              ? (foldersRes.data as Folder[]).sort((a, b) => (a.order_index - b.order_index) || (a.id - b.id))
              : []
            const allRequestsRaw = requestsRes.status === 200 && Array.isArray(requestsRes.data)
              ? (requestsRes.data as ApiRequest[]).sort((a, b) => (a.order_index - b.order_index) || (a.id - b.id))
              : []
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
          } catch (err) {
            console.error(`[Wapbolt] Failed to fetch collection ${collectionId} contents:`, err)
            throw err
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
            kind: 'request',
            requestId: normalizedRequest.id,
            name: normalizedRequest.name,
            method: normalizedRequest.method,
            workingRequest: {
              method: normalizedRequest.method,
              url: normalizedRequest.url,
              headers: normalizedRequest.headers || {},
              body: normalizedRequest.body as any,
              body_type: normalizedRequest.body_type,
              body_variants: (normalizedRequest.body_variants as Record<string, unknown>) || {},
              auth_config: (normalizedRequest.auth_config as AuthConfig) || { type: 'No Auth' },
              pre_request_script: normalizedRequest.pre_request_script || '',
              post_request_script: normalizedRequest.post_request_script || '',
              field_validations: (normalizedRequest.field_validations as FieldValidations) || { headers: {}, body: {} },
              extraction_rules: (normalizedRequest as any).extraction_rules || [],
              schema_assertions: (normalizedRequest as any).schema_assertions || []
            },
            lastResponse: null,
            isSending: false,
            pendingRequestId: null,
            isDirty: false,
            testResults: []
          }
          set({
            tabs: [...tabs, newTab],
            activeTabId: normalizedRequest.id
          })
        },

        openDraftRequest: (initialData, name = 'Draft Request') => {
          const { tabs } = get()
          const draftId = `draft-${Date.now()}`
          const normalizedDraft = normalizeRequest(initialData as ApiRequest)

          const newTab: RequestTab = {
            kind: 'request',
            requestId: draftId,
            name: name,
            method: normalizedDraft.method || 'GET',
            workingRequest: {
              method: normalizedDraft.method || 'GET',
              url: normalizedDraft.url || '',
              headers: (normalizedDraft.headers as Record<string, string>) || (
                (!normalizedDraft.body_type || normalizedDraft.body_type === 'raw-json')
                  ? { 'Content-Type': 'application/json' }
                  : {}
              ),
              body: (normalizedDraft.body as any) || '',
              body_type: normalizedDraft.body_type || 'raw-json',
              body_variants: (normalizedDraft.body_variants as Record<string, unknown>) || {},
              auth_config: (initialData.auth_config as AuthConfig) || { type: 'No Auth' },
              pre_request_script: normalizedDraft.pre_request_script || '',
              post_request_script: normalizedDraft.post_request_script || '',
              field_validations: { headers: {}, body: {} },
              extraction_rules: normalizedDraft.extraction_rules || [],
              schema_assertions: normalizedDraft.schema_assertions || []
            }, lastResponse: null,
            isSending: false,
            pendingRequestId: null,
            isDirty: true,
            testResults: []
          }

          set({
            tabs: [...tabs, newTab],
            activeTabId: draftId
          })
        },

        openExample: (example) => {
          const { tabs } = get()
          const exampleId = `example-${example.id}`
          const existingTab = tabs.find((t) => t.requestId === exampleId)

          if (existingTab) {
            set({ activeTabId: exampleId })
            return
          }

          const normalizedExample = normalizeRequest({
            body: example.request_body ?? '',
            body_type: '',
            headers: (example.request_headers as Record<string, string>) || {},
          } as ApiRequest)

          const newTab: RequestTab = {
            kind: 'request',
            requestId: exampleId,
            name: example.name,
            method: example.request_method as any,
            workingRequest: {
              method: example.request_method as any,
              url: example.request_url,
              headers: normalizedExample.headers as Record<string, string> || {},
              body: normalizedExample.body as any,
              body_type: normalizedExample.body_type,
              body_variants: {},
              auth_config: { type: 'No Auth' },
              pre_request_script: '',
              post_request_script: '',
              field_validations: { headers: {}, body: {} },
              extraction_rules: [],
              schema_assertions: []
            },
            lastResponse: {
              status: example.response_status,
              headers: (example.response_headers as Record<string, string[]>) || {},
              data: typeof example.response_body === 'string' ? example.response_body : JSON.stringify(example.response_body, null, 2),
              timing: 0
            },
            isSending: false,
            pendingRequestId: null,
            isDirty: false,
            testResults: []
          }

          set({
            tabs: [...tabs, newTab],
            activeTabId: exampleId
          })
        },

        setActiveTab: (requestId) => {
          set({ activeTabId: requestId })
        },

        closeTab: (requestId) => {
          const { tabs, activeTabId } = get()
          const newTabs = tabs.filter((t) => t.requestId !== requestId)

          let newActiveTabId = activeTabId
          if (activeTabId === requestId) {
            newActiveTabId = newTabs.length > 0 ? newTabs[newTabs.length - 1].requestId : null
          }

          set({ tabs: newTabs, activeTabId: newActiveTabId })
        },

        forceCloseTab: (requestId) => {
          const { tabs, activeTabId } = get()
          const newTabs = tabs.filter((t) => t.requestId !== requestId)
          let newActiveTabId = activeTabId
          if (activeTabId === requestId) {
            newActiveTabId = newTabs.length > 0 ? newTabs[newTabs.length - 1].requestId : null
          }
          set({ tabs: newTabs, activeTabId: newActiveTabId })
        },

        closeOtherTabs: (keepRequestId) => {
          const { tabs } = get()
          const newTabs = tabs.filter((t) => t.requestId === keepRequestId)
          set({ tabs: newTabs, activeTabId: keepRequestId })
        },

        closeAllTabs: () => {
          set({ tabs: [], activeTabId: null })
        },

        forceCloseAllTabs: () => {
          set({ tabs: [], activeTabId: null })
        },

        duplicateTab: (requestId) => {
          const { tabs } = get()
          const tab = tabs.find((t) => t.requestId === requestId)
          if (!tab || tab.kind !== 'request') return
          const draftId = `draft-${Date.now()}`
          const newTab = {
            ...tab,
            requestId: draftId,
            name: `${tab.name} (Copy)`,
            isDirty: true,
            workingRequest: { ...tab.workingRequest }
          }
          const idx = tabs.findIndex((t) => t.requestId === requestId)
          const newTabs = [...tabs.slice(0, idx + 1), newTab, ...tabs.slice(idx + 1)]
          set({ tabs: newTabs, activeTabId: draftId })
        },

        setWorkingRequest: (update) => {
          const { activeTabId, tabs } = get()
          if (!activeTabId) return

          const newTabs = tabs.map((tab) => {
            if (tab.requestId === activeTabId && tab.kind === 'request') {
              // Jika ada update headers, GUNAKAN seluruhnya (jangan di-merge)
              // agar header yang dihapus oleh user benar-benar hilang dari state.
              let newHeaders = update.headers ? { ...update.headers } : { ...tab.workingRequest.headers }
              const newBodyType = update.body_type || tab.workingRequest.body_type

              // Auto-update Content-Type if body_type changed
              if (update.body_type && update.body_type !== tab.workingRequest.body_type) {
                const contentTypeMap: Record<string, string | null> = {
                  'raw-json': 'application/json',
                  'raw-xml': 'application/xml',
                  'raw-html': 'text/html',
                  'raw-text': 'text/plain',
                  'x-www-form-urlencoded': 'application/x-www-form-urlencoded',
                  'form-data': null, // Browser/Executor will set boundary
                  'graphql': 'application/json',
                  none: null,
                  binary: 'application/octet-stream'
                }

                const newCT = contentTypeMap[update.body_type]
                if (newCT) {
                  newHeaders['Content-Type'] = newCT
                } else {
                  delete newHeaders['Content-Type']
                }
              }

              return {
                ...tab,
                workingRequest: {
                  ...tab.workingRequest,
                  ...update,
                  headers: newHeaders,
                  body_type: newBodyType
                },
                isDirty: true
              }
            }
            return tab
          })

          set({ tabs: newTabs })

          // Broadcast lock intent over WS if not draft
          if (typeof activeTabId === 'number') {
            wsClient.send({ type: 'LOCK_REQUEST', request_id: activeTabId })
          }
        },

        openCollectionInTab: (collectionId, name) => {
          const { tabs, collections } = get()
          const tabId = `collection-${collectionId}`
          const existingTab = tabs.find((t) => t.requestId === tabId)
          if (existingTab) {
            set({ activeTabId: tabId })
            return
          }
          const collection = collections.find((c) => c.id === collectionId)
          const newTab: CollectionTab = {
            kind: 'collection',
            requestId: tabId,
            name,
            isDirty: false,
            collectionId,
            draft: collection
              ? collectionToDraft(collection)
              : { name, description: '', confluence_page_id: '', auth_config: { type: 'No Auth' }, pre_request_script: '', post_request_script: '', variables: {} }
          }
          set({ tabs: [...tabs, newTab], activeTabId: tabId })
        },

        setCollectionTabDraft: (collectionId, update) => {
          const { tabs } = get()
          const tabId = `collection-${collectionId}`
          const newTabs = tabs.map((tab) => {
            if (tab.requestId === tabId && tab.kind === 'collection') {
              return { ...tab, draft: { ...tab.draft, ...update }, isDirty: true }
            }
            return tab
          })
          set({ tabs: newTabs })
        },

        saveCollectionTab: async (collectionId) => {
          const { tabs } = get()
          const tabId = `collection-${collectionId}`
          const tab = tabs.find((t) => t.requestId === tabId)
          if (!tab || tab.kind !== 'collection') return
          if (!tab.draft.name.trim()) return

          await get().updateCollection(collectionId, tab.draft.name, tab.draft.description, tab.draft.confluence_page_id, {
            auth_config: tab.draft.auth_config,
            pre_request_script: tab.draft.pre_request_script,
            post_request_script: tab.draft.post_request_script,
            variables: tab.draft.variables
          })

          const updated = get().collections.find((c) => c.id === collectionId)
          set((state) => ({
            tabs: state.tabs.map((t) =>
              t.requestId === tabId && t.kind === 'collection'
                ? { ...t, name: tab.draft.name, isDirty: false, draft: updated ? collectionToDraft(updated) : t.draft }
                : t
            )
          }))
        },

        saveActiveRequest: async () => {
          const { activeTabId, tabs } = get()
          const activeTab = tabs.find((t) => t.requestId === activeTabId)
          if (!activeTab || activeTab.kind !== 'request') return

          if (typeof activeTabId === 'string' && (activeTabId.startsWith('draft-') || activeTabId.startsWith('example-'))) {
            // If it's a draft or an example, we trigger the "Save to Collection" modal via the UI component.
            // The UI (MainArea.tsx) handles the modal trigger for string IDs starting with these prefixes.
            window.dispatchEvent(new CustomEvent('wapbolt:trigger-save-modal'))
            return
          }

          const { workingRequest } = activeTab

          try {
            // Parse body string back to object if possible
            let bodyObj: unknown = {}
            if (workingRequest.body) {
              if (Array.isArray(workingRequest.body)) {
                bodyObj = workingRequest.body
              } else {
                try {
                  bodyObj = JSON.parse(workingRequest.body)
                } catch {
                  // If not valid JSON, send as a raw string wrapped in an object
                  bodyObj = { raw: workingRequest.body }
                }
              }
            }

            // Sinkronkan body aktif ke variants sebelum disimpan, supaya tipe yang sedang
            // dipakai juga ikut ter-persist di body_variants.
            const bodyVariants = {
              ...(workingRequest.body_variants || {}),
              [workingRequest.body_type]: workingRequest.body
            }

            const response = await apiClient.put(`/api/v1/requests/${activeTab.requestId}`, {
              id: activeTab.requestId,
              method: workingRequest.method,
              url: workingRequest.url,
              headers: workingRequest.headers,
              body: bodyObj,
              body_type: workingRequest.body_type,
              body_variants: bodyVariants,
              auth_config: workingRequest.auth_config,
              pre_request_script: workingRequest.pre_request_script,
              post_request_script: workingRequest.post_request_script,
              field_validations: workingRequest.field_validations || { headers: {}, body: {} }
            })

            if (response.status === 200) {
              const updatedReq = response.data as ApiRequest

              // Update tab info
              const updatedTabs = tabs.map((t) => {
                if (t.requestId === updatedReq.id && t.kind === 'request') {
                  return { ...t, name: updatedReq.name, method: updatedReq.method, isDirty: false }
                }
                return t
              })

              set({ tabs: updatedTabs })
              await get().fetchCollectionContents(updatedReq.collection_id)

              // Create a version automatically for history
              try {
                await apiClient.post(`/api/v1/requests/${updatedReq.id}/versions`, {
                  name: `Auto-save ${new Date().toLocaleString()}`
                })
                await get().fetchRequestVersions(updatedReq.id)
              } catch (vErr) {
                console.error('Failed to create version during save:', vErr)
              }

              toast.success('Request saved successfully')
            } else {
              toast.error('Failed to save request')
            }
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error'
            toast.error('Error saving request: ' + message)
          }
        },

        createCollection: async (name: string, description: string = '', confluence_page_id: string = '') => {
          const { activeTeamId } = get()
          if (!activeTeamId) return

          try {
            const response = await apiClient.post(`/api/v1/teams/${activeTeamId}/collections`, {
              name,
              description,
              confluence_page_id
            })
            if (response.status === 201) {
              const newCol = response.data as Collection
              // The backend's WS "TEAM" broadcast can trigger a fetchCollections()
              // refetch that lands before this response does, so `newCol` may
              // already be in state by the time we get here — don't append twice.
              set((state) => ({
                collections: state.collections.some((c) => c.id === newCol.id)
                  ? state.collections
                  : [...state.collections, newCol],
                requestsByCollection: { ...state.requestsByCollection, [newCol.id]: [] },
                foldersByCollection: { ...state.foldersByCollection, [newCol.id]: [] }
              }))
              toast.success('Collection created')
            }
          } catch {
            toast.error('Failed to create collection')
          }
        },

        updateCollection: async (id, name, description, confluence_page_id, extra) => {
          try {
            const response = await apiClient.put(`/api/v1/collections/${id}`, {
              name,
              description,
              confluence_page_id,
              ...extra
            })
            if (response.status === 200) {
              const updated = response.data as Collection
              set((state) => ({
                collections: state.collections.map(c => c.id === id ? updated : c)
              }))
              toast.success('Collection updated')
            }
          } catch {
            toast.error('Failed to update collection')
          }
        },

        updateCollectionVariable: async (collectionId, key, value) => {
          const collection = get().collections.find((c) => c.id === collectionId)
          if (!collection) return
          const variables = { ...(collection.variables || {}), [key]: value }
          // Update is "always overwrite" for settings fields (mirrors the settings
          // modal submitting full state) — send the collection's current auth_config
          // and scripts back unchanged so this variable-only write doesn't wipe them.
          try {
            const response = await apiClient.put(`/api/v1/collections/${collectionId}`, {
              name: collection.name,
              description: collection.description,
              confluence_page_id: collection.confluence_page_id || '',
              auth_config: collection.auth_config || { type: 'No Auth' },
              pre_request_script: collection.pre_request_script || '',
              post_request_script: collection.post_request_script || '',
              variables
            })
            if (response.status === 200) {
              const updated = response.data as Collection
              set((state) => ({
                collections: state.collections.map(c => c.id === collectionId ? updated : c)
              }))
            }
          } catch {
            /* silent — mirrors updateActiveEnvironmentVariable's best-effort persistence */
          }
        },

        importCollection: async (jsonContent: string, mode: 'new' | 'overwrite' = 'new', confirmName?: string) => {
          const { activeTeamId } = get()
          if (!activeTeamId) return

          try {
            const data = JSON.parse(jsonContent)
            let url = `/api/v1/teams/${activeTeamId}/import?mode=${mode}`
            if (mode === 'overwrite' && confirmName) {
              url += `&confirm_name=${encodeURIComponent(confirmName)}`
            }

            const response = await apiClient.post(url, data)
            if (response.status === 201 || response.status === 200) {
              await get().fetchCollections(activeTeamId)
              toast.success(mode === 'overwrite' ? 'Collection overwritten successfully' : 'Collection imported successfully')
              const unsupportedAuthCount = (response.data as { unsupported_auth_count?: number })?.unsupported_auth_count
              if (unsupportedAuthCount) {
                toast(
                  `${unsupportedAuthCount} request${unsupportedAuthCount !== 1 ? 's' : ''}/collection used an Authorization type Wapbolt doesn't support yet (e.g. OAuth 2.0) — set to No Auth, please configure manually.`,
                  { duration: 8000 }
                )
              }
            } else {
              toast.error('Failed to import collection')
            }
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Invalid JSON'
            toast.error(message.toLowerCase().includes('json') ? 'Invalid JSON — please check your file and try again.' : 'Import failed. Please try again.')
          }
        },

        importOpenAPI: async (jsonContent: string, mode: 'new' | 'overwrite' = 'new', confirmName?: string) => {
          const { activeTeamId } = get()
          if (!activeTeamId) return

          try {
            const data = JSON.parse(jsonContent)
            let url = `/api/v1/teams/${activeTeamId}/import-openapi?mode=${mode}`
            if (mode === 'overwrite' && confirmName) {
              url += `&confirm_name=${encodeURIComponent(confirmName)}`
            }

            const response = await apiClient.post(url, data)
            if (response.status === 201 || response.status === 200) {
              await get().fetchCollections(activeTeamId)
              const count = (response.data as any)?.request_count
              toast.success(`OpenAPI imported — ${count ?? 0} endpoint${count !== 1 ? 's' : ''} added`)
            } else {
              toast.error('Failed to import OpenAPI spec')
            }
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Invalid JSON'
            toast.error(message.toLowerCase().includes('json') ? 'Invalid JSON — please check your file and try again.' : 'Import failed. Please try again.')
          }
        },

        importInsomnia: async (jsonContent: string, mode: 'new' | 'overwrite' = 'new', confirmName?: string) => {
          const { activeTeamId } = get()
          if (!activeTeamId) return

          try {
            const insomnia = JSON.parse(jsonContent)
            if (!insomnia.resources || insomnia.__export_format !== 4) {
              toast.error('Not a valid Insomnia v4 export file.')
              return
            }

            const resources: any[] = insomnia.resources
            const workspace = resources.find((r) => r._type === 'workspace')
            const collectionName = workspace?.name || 'Insomnia Import'

            // Build folder map: id → { name, parentId }
            const folderMap: Record<string, { name: string; parentId: string }> = {}
            for (const r of resources) {
              if (r._type === 'request_group' && typeof r._id === 'string' && typeof r.name === 'string') {
                folderMap[r._id] = { name: r.name, parentId: typeof r.parentId === 'string' ? r.parentId : '' }
              }
            }

            // Convert a single Insomnia request → Postman v2.1 item
            const convertRequest = (r: any): any => {
              const headers = (r.headers || []).map((h: any) => ({ key: h.name, value: h.value, disabled: !h.enabled }))
              let body: any = { mode: 'raw', raw: '' }
              if (r.body) {
                const mime = r.body.mimeType || ''
                if (mime.includes('json')) {
                  body = { mode: 'raw', raw: r.body.text || '', options: { raw: { language: 'json' } } }
                } else if (mime.includes('x-www-form-urlencoded')) {
                  body = { mode: 'urlencoded', urlencoded: (r.body.params || []).map((p: any) => ({ key: p.name, value: p.value, disabled: !p.enabled })) }
                } else if (mime.includes('form-data') || mime.includes('multipart')) {
                  body = { mode: 'formdata', formdata: (r.body.params || []).map((p: any) => ({ key: p.name, value: p.value, disabled: !p.enabled })) }
                } else if (r.body.text) {
                  body = { mode: 'raw', raw: r.body.text }
                }
              }

              let auth: any = { type: 'noauth' }
              if (r.authentication?.type === 'bearer') {
                auth = { type: 'bearer', bearer: [{ key: 'token', value: r.authentication.token || '' }] }
              } else if (r.authentication?.type === 'basic') {
                auth = { type: 'basic', basic: [{ key: 'username', value: r.authentication.username || '' }, { key: 'password', value: r.authentication.password || '' }] }
              } else if (r.authentication?.type === 'apikey') {
                auth = { type: 'apikey', apikey: [{ key: 'key', value: r.authentication.key || '' }, { key: 'value', value: r.authentication.value || '' }] }
              }

              return {
                name: r.name,
                request: {
                  method: (r.method || 'GET').toUpperCase(),
                  url: { raw: r.url || '' },
                  header: headers,
                  body,
                  auth,
                  description: r.description || '',
                },
              }
            }

            // Build Postman v2.1 structure: folders → items recursively
            const MAX_DEPTH = 20
            const buildItems = (parentId: string, depth = 0): any[] => {
              if (depth >= MAX_DEPTH) return []
              const items: any[] = []
              for (const [fId, f] of Object.entries(folderMap)) {
                if (f.parentId === parentId) {
                  items.push({ name: f.name, item: buildItems(fId, depth + 1) })
                }
              }
              for (const r of resources) {
                if (r._type === 'request' && typeof r.parentId === 'string' && r.parentId === parentId) {
                  items.push(convertRequest(r))
                }
              }
              return items
            }

            const postman = {
              info: {
                name: collectionName,
                schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
              },
              item: buildItems(workspace?._id || ''),
            }

            let url = `/api/v1/teams/${activeTeamId}/import?mode=${mode}`
            if (mode === 'overwrite' && confirmName) url += `&confirm_name=${encodeURIComponent(confirmName)}`

            const response = await apiClient.post(url, postman)
            if (response.status === 201 || response.status === 200) {
              await get().fetchCollections(activeTeamId)
              toast.success(mode === 'overwrite' ? 'Collection overwritten successfully' : `Insomnia collection "${collectionName}" imported successfully`)
            } else {
              toast.error('Failed to import Insomnia collection')
            }
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Invalid JSON'
            toast.error(message.toLowerCase().includes('json') ? 'Invalid JSON — please check your file and try again.' : 'Import failed. Please try again.')
          }
        },

        createRequest: async (
          collectionId: number,
          folderId: number | null,
          name: string,
          data?: Partial<ApiRequest>
        ): Promise<ApiRequest | null> => {
          try {
            const url = folderId
              ? `/api/v1/folders/${folderId}/requests`
              : `/api/v1/collections/${collectionId}/requests`

            const payload = {
              name,
              description: data?.description || '',
              method: data?.method || 'GET',
              url: data?.url || 'https://api.example.com',
              headers: data?.headers || { 'Content-Type': 'application/json' },
              body: data?.body || {},
              body_type: data?.body_type || 'raw-json',
              auth_config: data?.auth_config || { type: 'No Auth' },
              folder_id: folderId,
              order_index: data?.order_index || Date.now(),
              pre_request_script: data?.pre_request_script || '',
              post_request_script: data?.post_request_script || ''
            }
            const response = await apiClient.post(url, payload)

            if (response.status === 201) {
              const newReq = response.data as ApiRequest
              const normalizedReq = normalizeRequest(newReq)

              // Sync Sidebar with server data
              await get().fetchCollectionContents(collectionId)

              const currentTabs = get().tabs
              const draftTab = currentTabs.find(t => typeof t.requestId === 'string' && t.requestId.startsWith('draft-'))

              if (draftTab && get().activeTabId === draftTab.requestId) {
                // Replace draft logic
                const newTabs = currentTabs.map(t => {
                  if (t.requestId === draftTab.requestId && t.kind === 'request') {
                    return {
                      ...t,
                      requestId: normalizedReq.id,
                      name: normalizedReq.name,
                      method: normalizedReq.method,
                      workingRequest: {
                        method: normalizedReq.method,
                        url: normalizedReq.url,
                        headers: normalizedReq.headers || {},
                        body: normalizedReq.body as any,
                        body_type: normalizedReq.body_type,
                        body_variants: (normalizedReq.body_variants as Record<string, unknown>) || {},
                        auth_config: (normalizedReq.auth_config as AuthConfig) || { type: 'No Auth' },
                        pre_request_script: normalizedReq.pre_request_script || '',
                        post_request_script: normalizedReq.post_request_script || '',
                        field_validations: (normalizedReq.field_validations as FieldValidations) || { headers: {}, body: {} },
                        extraction_rules: (normalizedReq as any).extraction_rules || [],
                        schema_assertions: (normalizedReq as any).schema_assertions || []
                      },
                      isDirty: false
                    }
                  }
                  return t
                })
                set({ tabs: newTabs, activeTabId: normalizedReq.id })
              } else {
                // ADD NEW TAB DIRECTLY
                const newTab: RequestTab = {
                  kind: 'request',
                  requestId: normalizedReq.id,
                  name: normalizedReq.name,
                  method: normalizedReq.method,
                  workingRequest: {
                    method: normalizedReq.method,
                    url: normalizedReq.url,
                    headers: normalizedReq.headers || {},
                    body: normalizedReq.body as any,
                    body_type: normalizedReq.body_type,
                    body_variants: (normalizedReq.body_variants as Record<string, unknown>) || {},
                    auth_config: (normalizedReq.auth_config as AuthConfig) || { type: 'No Auth' },
                    pre_request_script: normalizedReq.pre_request_script || '',
                    post_request_script: normalizedReq.post_request_script || '',
                    field_validations: (normalizedReq.field_validations as FieldValidations) || { headers: {}, body: {} },
                    extraction_rules: (normalizedReq as any).extraction_rules || [],
                    schema_assertions: (normalizedReq as any).schema_assertions || []
                  },
                  lastResponse: null,
                  isSending: false,
                  pendingRequestId: null,
                  isDirty: false,
                  testResults: []
                }
                set({
                  tabs: [...currentTabs, newTab],
                  activeTabId: normalizedReq.id
                })
              }

              toast.success(`Request "${name}" created successfully`)
              return newReq
            }
            return null
          } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
              ? (err as any).response?.data?.error
              : err instanceof Error
                ? err.message
                : 'Unknown network error'
            toast.error(`Failed to create request: ${msg}`)
            return null
          }
        },

        createFolder: async (collectionId: number, parentFolderId: number | null, name: string) => {
          try {
            const response = await apiClient.post(`/api/v1/collections/${collectionId}/folders`, {
              name,
              parent_folder_id: parentFolderId,
              order_index: Date.now()
            })

            if (response.status === 201) {
              const newFolder = response.data as Folder
              // The backend's WS "COLLECTION" broadcast can trigger a
              // fetchCollectionContents() refetch that lands before this
              // response does, so don't append newFolder if it's already there.
              set((state) => {
                const colId = collectionId
                const colFolders = state.foldersByCollection[colId] || []
                if (colFolders.some((f) => f.id === newFolder.id)) return state
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
            if (response.status === 200 && Array.isArray(response.data)) {
              const envs = response.data as Environment[]
              const currentActiveId = get().activeEnvironmentId
              const stillExists = currentActiveId === null || envs.some((e) => e.id === currentActiveId)

              set({
                environments: envs,
                activeEnvironmentId: stillExists ? currentActiveId : null
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

        createGlobalEnvironment: async (name: string) => {
          const { activeTeamId } = get()
          try {
            const response = await apiClient.post(`/api/v1/environments/global`, {
              name,
              variables: {}
            })
            if (response.status === 201) {
              if (activeTeamId) await get().fetchEnvironments(activeTeamId)
              toast.success('Global environment created')
            }
          } catch {
            toast.error('Failed to create global environment')
          }
        },

        updateEnvironment: async (id: number, name: string, variables: Record<string, string>, isGlobal?: boolean, teamId?: number | null) => {
          const { activeTeamId } = get()
          if (!activeTeamId) return

          try {
            console.log(`[Store] Updating environment ${id}...`, { name, variables, isGlobal, teamId })
            const response = await apiClient.put(`/api/v1/environments/${id}`, {
              name,
              variables,
              is_global: isGlobal,
              team_id: teamId
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
              const data = response.data
              set({ history: Array.isArray(data) ? data : [], historyLoading: false })
            } else {
              set({ historyLoading: false })
            }
          } catch {
            set({ historyLoading: false })
          }
        },

        clearHistory: async () => {
          const { activeTeamId } = get()
          if (!activeTeamId) return

          try {
            const response = await apiClient.delete(`/api/v1/history?team_id=${activeTeamId}`)
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
            const reqToDelete = get().requests.find((r) => r.id === id)
            await apiClient.delete(`/api/v1/requests/${id}`)

            set((state) => ({
              requests: state.requests.filter((r) => r.id !== id),
              tabs: state.tabs.filter((t) => t.requestId !== id)
            }))

            // Sync sidebar immediately
            if (reqToDelete) {
              await get().fetchCollectionContents(reqToDelete.collection_id)
            }

            toast.success('Request deleted')
          } catch (err: unknown) {
            toast.error('Failed to delete request')
          }
        },

        duplicateRequest: async (id: number) => {
          try {
            const response = await apiClient.post(`/api/v1/requests/${id}/duplicate`, {})
            if (response.status === 201) {
              const newReq = response.data as ApiRequest
              toast.success('Request duplicated')
              await get().fetchCollectionContents(newReq.collection_id)
              get().openRequestInTab(newReq)
            }
          } catch {
            toast.error('Failed to duplicate request')
          }
        },

        moveRequest: async (id: number, collectionId: number, folderId: number | null, orderIndex: number) => {
          const originalRequests = [...get().requests]
          const req = get().requests.find(r => r.id === id)
          const oldCollectionId = req?.collection_id

          // Optimistic Update
          set((state) => ({
            requests: state.requests.map((r) =>
              r.id === id ? { ...r, collection_id: collectionId, folder_id: folderId, order_index: orderIndex } : r
            )
          }))

          try {
            await apiClient.patch(`/api/v1/requests/${id}/move`, {
              collection_id: collectionId,
              folder_id: folderId,
              order_index: orderIndex
            })

            // Refresh target and source if different
            await get().fetchCollectionContents(collectionId)
            if (oldCollectionId && oldCollectionId !== collectionId) {
              await get().fetchCollectionContents(oldCollectionId)
            }
          } catch (err) {
            console.error(err)
            set({ requests: originalRequests })
            toast.error('Failed to move request')
          }
        },

        moveFolder: async (id: number, collectionId: number, parentFolderId: number | null, orderIndex: number) => {
          const originalFolders = { ...get().foldersByCollection }
          const allFolders = Object.values(originalFolders).flat()
          const folder = allFolders.find(f => f.id === id)
          const oldCollectionId = folder?.collection_id

          try {
            await apiClient.patch(`/api/v1/folders/${id}/move`, {
              collection_id: collectionId,
              parent_folder_id: parentFolderId,
              order_index: orderIndex
            })

            await get().fetchCollectionContents(collectionId)
            if (oldCollectionId && oldCollectionId !== collectionId) {
              await get().fetchCollectionContents(oldCollectionId)
            }
          } catch (err) {
            set({ foldersByCollection: originalFolders })
            toast.error('Failed to move folder')
          }
        },

        exportCollection: async (id: number) => {
          try {
            await get().fetchCollectionContents(id)
            const collection = get().collections.find((c) => c.id === id)
            if (!collection) return

            const { foldersByCollection, requestsByCollection, requestsByFolder } = get()
            const allFolders = foldersByCollection[id] || []
            const rootRequests = requestsByCollection[id] || []

            const buildPostmanUrl = (rawUrl: string) => {
              try {
                const u = new URL(rawUrl)
                return {
                  raw: rawUrl,
                  protocol: u.protocol.replace(':', ''),
                  host: u.hostname.split('.'),
                  port: u.port || undefined,
                  path: u.pathname.split('/').filter(Boolean),
                  query: u.search
                    ? [...u.searchParams.entries()].map(([key, value]) => ({ key, value }))
                    : undefined
                }
              } catch {
                return { raw: rawUrl }
              }
            }

            const buildPostmanAuth = (authConfig: Record<string, unknown>) => {
              if (!authConfig || authConfig.type === 'No Auth') return undefined
              const type = String(authConfig.type || '').toLowerCase()
              if (type === 'bearer' || type === 'bearer token') {
                return { type: 'bearer', bearer: [{ key: 'token', value: String(authConfig.token || ''), type: 'string' }] }
              }
              if (type === 'basic') {
                return {
                  type: 'basic',
                  basic: [
                    { key: 'username', value: String(authConfig.username || ''), type: 'string' },
                    { key: 'password', value: String(authConfig.password || ''), type: 'string' }
                  ]
                }
              }
              if (type === 'api key' || type === 'apikey') {
                return {
                  type: 'apikey',
                  apikey: [
                    { key: 'key', value: String(authConfig.key || ''), type: 'string' },
                    { key: 'value', value: String(authConfig.value || ''), type: 'string' },
                    { key: 'in', value: String(authConfig.in || 'header'), type: 'string' }
                  ]
                }
              }
              return undefined
            }

            const buildPostmanBody = (req: ApiRequest) => {
              const bodyType = req.body_type || 'raw-json'
              if (bodyType === 'none') return undefined
              if (bodyType === 'raw-json' || bodyType === 'raw') {
                const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body, null, 2)
                return { mode: 'raw', raw, options: { raw: { language: 'json' } } }
              }
              if (bodyType === 'form-data') {
                const formdata = Array.isArray(req.body)
                  ? req.body.map((item: any) => ({ key: item.key, value: item.value, type: 'text' }))
                  : []
                return { mode: 'formdata', formdata }
              }
              if (bodyType === 'x-www-form-urlencoded') {
                const urlencoded = Array.isArray(req.body)
                  ? req.body.map((item: any) => ({ key: item.key, value: item.value }))
                  : []
                return { mode: 'urlencoded', urlencoded }
              }
              return { mode: 'raw', raw: typeof req.body === 'string' ? req.body : JSON.stringify(req.body) }
            }

            const buildPostmanEvents = (req: ApiRequest) => {
              const events: { listen: string; script: { type: string; exec: string[] } }[] = []
              if (req.pre_request_script?.trim()) {
                events.push({
                  listen: 'prerequest',
                  script: { type: 'text/javascript', exec: req.pre_request_script.split('\n') }
                })
              }
              if (req.post_request_script?.trim()) {
                events.push({
                  listen: 'test',
                  script: { type: 'text/javascript', exec: req.post_request_script.split('\n') }
                })
              }
              return events.length > 0 ? events : undefined
            }

            const requestToPostmanItem = (req: ApiRequest) => {
              const auth = buildPostmanAuth(req.auth_config as Record<string, unknown>)
              const body = buildPostmanBody(req)
              const event = buildPostmanEvents(req)
              const item: Record<string, unknown> = {
                name: req.name,
                request: {
                  method: req.method,
                  header: Object.entries(req.headers || {}).map(([key, value]) => ({ key, value })),
                  url: buildPostmanUrl(req.url),
                  description: req.description || undefined,
                  ...(auth && { auth }),
                  ...(body && { body })
                }
              }
              if (event) item.event = event
              return item
            }

            const buildFolderItems = (parentId: number | null): unknown[] => {
              const folders = allFolders.filter((f) => f.parent_folder_id === parentId)
              const requests = parentId === null ? rootRequests : (requestsByFolder[parentId] || [])

              const folderItems = folders.map((folder) => ({
                name: folder.name,
                item: buildFolderItems(folder.id)
              }))

              const requestItems = requests.map(requestToPostmanItem)
              return [...folderItems, ...requestItems]
            }

            const exportData = {
              info: {
                name: collection.name,
                description: collection.description,
                schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
              },
              item: buildFolderItems(null)
            }

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${collection.name}.postman_collection.json`
            a.click()
            URL.revokeObjectURL(url)
            toast.success('Collection exported as Postman v2.1')
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
            updateActiveEnvironmentVariable,
            collections,
            updateCollectionVariable
          } = get()
          const activeTab = tabs.find((t) => t.requestId === activeTabId)
          if (!activeTab || activeTab.kind !== 'request' || activeTab.isSending || !activeTab.workingRequest.url) return

          const addLog = (level: LogEntry['level'], message: string, details?: any) => {
            set((state) => ({
              logs: [
                {
                  id: Math.random().toString(36).substr(2, 9),
                  timestamp: new Date().toLocaleTimeString(),
                  level,
                  message,
                  requestId: activeTab.requestId,
                  details
                },
                ...state.logs
              ].slice(0, 100)
            }))
          }

          const { workingRequest } = activeTab
          const activeEnv = environments.find((e) => e.id === activeEnvironmentId)
          const collectionId = typeof activeTab.requestId === 'number'
            ? get().requests.find((r) => r.id === activeTab.requestId)?.collection_id
            : undefined
          const collection = collectionId !== undefined ? collections.find((c) => c.id === collectionId) : undefined
          // collectionVars: scope terpisah dari environment (§ Collection Variables).
          // Environment menang saat konflik key — sama seperti precedence Postman.
          const collectionVars = { ...(collection?.variables || {}) }
          // Gunakan shallow copy agar tidak mutasi state langsung
          const vars = { ...collectionVars, ...(activeEnv?.variables || {}) }
          const effectiveAuth: AuthConfig = workingRequest.auth_config?.type === 'Inherit'
            ? (collection?.auth_config || { type: 'No Auth' })
            : workingRequest.auth_config

          // --- 1. Pre-request Script Execution ---
          if (collection?.pre_request_script || workingRequest.pre_request_script) {
            try {
              const scriptLog = (level: LogEntry['level'], ...args: unknown[]) => {
                const message = args
                  .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
                  .join(' ')
                addLog(level, message)
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
                    collectionVars[key] = strVal
                    vars[key] = strVal
                    if (collection) updateCollectionVariable(collection.id, key, strVal)
                  },
                  get: (key: string) => collectionVars[key]
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
                  console.log(`[Wapbolt] Pre-script setting env: ${key}=${strVal}`)
                  vars[key] = strVal
                  updateActiveEnvironmentVariable(key, strVal)
                },
                setEnv: (key: string, val: unknown) => {
                  const strVal = String(val)
                  console.log(`[Wapbolt] Pre-script setting env: ${key}=${strVal}`)
                  vars[key] = strVal
                  updateActiveEnvironmentVariable(key, strVal)
                }
              }

              const mockConsole = {
                log: (...args: unknown[]) => {
                  console.log(...args)
                  scriptLog('log', ...args)
                },
                info: (...args: unknown[]) => {
                  console.info(...args)
                  scriptLog('info', ...args)
                },
                warn: (...args: unknown[]) => {
                  console.warn(...args)
                  scriptLog('warn', ...args)
                },
                error: (...args: unknown[]) => {
                  console.error(...args)
                  scriptLog('error', ...args)
                }
              } as unknown as Console

              const runScript = (script: string): Promise<void> => runPmScript(script, wap, mockConsole)

              // Collection script runs first, before the request's own — sama urutan Postman.
              if (collection?.pre_request_script) await runScript(collection.pre_request_script)
              if (workingRequest.pre_request_script) await runScript(workingRequest.pre_request_script)
            } catch (err: unknown) {
              toast.error(`Pre-request Error: ${err instanceof Error ? err.message : String(err)}`)
              return
            }
          }

          // variables are already updated in 'vars' by the script

          // Substitusi variabel di URL
          console.log('[Wapbolt] Current vars for replacement:', vars)
          let substitutedUrl = replaceVariables(workingRequest.url, vars)

          // Jangan blokir jika ada {{, biarkan saja agar user bisa debug sendiri (seperti Postman)
          if (substitutedUrl.includes('{{')) {
            console.warn('[Wapbolt] Some variables in URL could not be resolved:', substitutedUrl)
          }

          // Inject Auth into Headers
          const finalHeaders = injectAuth(workingRequest.headers, effectiveAuth, vars)

          // Substitusi variabel di Headers
          const substitutedHeaders: Record<string, string> = {}
          Object.entries(finalHeaders).forEach(([key, value]) => {
            const resolved = replaceVariables(value, vars)
            substitutedHeaders[key] = resolved
          })

          const substitutedBody = Array.isArray(workingRequest.body)
            ? workingRequest.body.map((item) => ({
              ...item,
              key: replaceVariables(item.key, vars),
              value: replaceVariables(String(item.value), vars)
            }))
            : replaceVariables(workingRequest.body, vars)

          // GraphQL: override method to POST and serialize body as { query, variables, operationName }
          const isGraphQL = workingRequest.body_type === 'graphql'
          const finalMethod = isGraphQL ? 'POST' : workingRequest.method
          const finalBodyType = isGraphQL ? 'raw-json' : workingRequest.body_type
          const finalBody: any = (() => {
            if (!isGraphQL) return substitutedBody
            try {
              const gql = JSON.parse(typeof substitutedBody === 'string' ? substitutedBody : '{}')
              const variables = (() => {
                try { return JSON.parse(gql.variables || '{}') } catch { return {} }
              })()
              const payload: Record<string, unknown> = { query: gql.query || '' }
              if (Object.keys(variables).length > 0) payload.variables = variables
              if (gql.operationName) payload.operationName = gql.operationName
              return JSON.stringify(payload)
            } catch {
              return JSON.stringify({ query: '' })
            }
          })()
          if (isGraphQL && !substitutedHeaders['Content-Type']) {
            substitutedHeaders['Content-Type'] = 'application/json'
          }

          // Inject Auth into URL if type is API Key and addTo is query
          if (
            effectiveAuth.type === 'API Key' &&
            effectiveAuth.addTo === 'query'
          ) {
            const key = replaceVariables(effectiveAuth.key || '', vars)
            const value = replaceVariables(effectiveAuth.value || '', vars)
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
          const requestId = Math.random().toString(36).slice(2)
          set({
            tabs: tabs.map((t) =>
              t.requestId === activeTabId
                ? { ...t, isSending: true, lastResponse: null, pendingRequestId: requestId }
                : t
            )
          })

          try {
            const response = await apiClient.executeRequest(
              finalMethod,
              substitutedUrl,
              substitutedHeaders,
              finalBody,
              finalBodyType,
              requestId
            )

            if (response.cancelled) {
              set((state) => ({
                tabs: state.tabs.map((t) =>
                  t.requestId === activeTabId
                    ? { ...t, isSending: false, pendingRequestId: null, lastResponse: null }
                    : t
                )
              }))
              return
            }

            // Log network activity to console
            addLog('network', `${finalMethod} ${substitutedUrl}`, {
              request: {
                method: finalMethod,
                url: substitutedUrl,
                headers: substitutedHeaders,
                body: finalBody,
                body_type: finalBodyType
              },
              response: {
                status: response.status,
                timing: response.timing,
                headers: response.headers,
                data: response.data
              }
            })

            // --- 2a. Variable Extraction Rules ---
            const extractionRules = workingRequest.extraction_rules || []
            if (extractionRules.length > 0) {
              for (const rule of extractionRules) {
                if (!rule.enabled || !rule.variableName || !rule.jsonPath) continue
                if (!isSafeJsonPath(rule.jsonPath)) {
                  addLog('warn', `[Extract] Blocked unsafe path: "${rule.jsonPath}"`)
                  continue
                }
                try {
                  const extracted = _.get(response.data, rule.jsonPath)
                  if (extracted !== undefined) {
                    const strVal = String(extracted)
                    vars[rule.variableName] = strVal
                    updateActiveEnvironmentVariable(rule.variableName, strVal)
                    addLog('info', `[Extract] ${rule.variableName} = ${strVal}`)
                  } else {
                    addLog('warn', `[Extract] Path "${rule.jsonPath}" returned undefined`)
                  }
                } catch (err: unknown) {
                  addLog('error', `[Extract] Failed for "${rule.jsonPath}": ${err instanceof Error ? err.message : String(err)}`)
                }
              }
            }

            // --- 2b. Schema Assertions ---
            const schemaAssertions = workingRequest.schema_assertions || []
            const schemaTestResults: { name: string; status: 'passed' | 'failed'; error?: string }[] = []
            if (schemaAssertions.length > 0) {
              for (const assertion of schemaAssertions) {
                if (!assertion.enabled) continue
                try {
                  const schema = JSON.parse(assertion.schema)
                  const validate = ajv.compile(schema)
                  const valid = validate(response.data)
                  if (valid) {
                    schemaTestResults.push({ name: assertion.name || 'Schema Assertion', status: 'passed' })
                  } else {
                    const errors = (validate.errors || [])
                      .map((e) => `${e.dataPath || '(root)'} ${e.message}`)
                      .join('; ')
                    schemaTestResults.push({ name: assertion.name || 'Schema Assertion', status: 'failed', error: errors })
                  }
                } catch (err: unknown) {
                  schemaTestResults.push({
                    name: assertion.name || 'Schema Assertion',
                    status: 'failed',
                    error: `Invalid schema: ${err instanceof Error ? err.message : String(err)}`
                  })
                }
              }
              if (schemaTestResults.some((r) => r.status === 'failed')) {
                schemaTestResults.filter((r) => r.status === 'failed').forEach((r) =>
                  toast.error(`Schema Failed: ${r.name} — ${r.error}`)
                )
              }
            }

            // --- 2. Post-request Script (Tests) Execution ---
            if (collection?.post_request_script || workingRequest.post_request_script) {
              try {
                console.log('[Wapbolt] Starting post-request script execution...')
                const testResults: { name: string; status: 'passed' | 'failed'; error?: string }[] =
                  []

                const scriptLog = (level: LogEntry['level'], ...args: unknown[]) => {
                  const message = args
                    .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
                    .join(' ')
                  addLog(level, message)
                }

                const wap = {
                  set: (key: string, val: unknown) => {
                    const strVal = String(val)
                    console.log(`[Wapbolt] Script setting env: ${key}=${strVal}`)
                    vars[key] = strVal
                    updateActiveEnvironmentVariable(key, strVal)
                  },
                  environment: {
                    set: (key: string, val: unknown) => {
                      const strVal = String(val)
                      console.log(`[Wapbolt] Script setting env: ${key}=${strVal}`)
                      vars[key] = strVal
                      updateActiveEnvironmentVariable(key, strVal)
                    },
                    get: (key: string) => vars[key]
                  },
                  collectionVariables: {
                    set: (key: string, val: unknown) => {
                      const strVal = String(val)
                      collectionVars[key] = strVal
                      vars[key] = strVal
                      if (collection) updateCollectionVariable(collection.id, key, strVal)
                    },
                    get: (key: string) => collectionVars[key]
                  },
                  setEnvironmentVariable: (key: string, val: unknown) => {
                    const strVal = String(val)
                    console.log(`[Wapbolt] Script setting env (alias): ${key}=${strVal}`)
                    vars[key] = strVal
                    updateActiveEnvironmentVariable(key, strVal)
                  },
                  setEnv: (key: string, val: unknown) => {
                    const strVal = String(val)
                    console.log(`[Wapbolt] Script setting env (alias): ${key}=${strVal}`)
                    vars[key] = strVal
                    updateActiveEnvironmentVariable(key, strVal)
                  },
                  response: createPmResponseContext(response),
                  expect: createScriptExpect,
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

                const mockConsole = {
                  log: (...args: unknown[]): void => {
                    console.log(...args)
                    scriptLog('log', ...args)
                  },
                  info: (...args: unknown[]): void => {
                    console.info(...args)
                    scriptLog('info', ...args)
                  },
                  warn: (...args: unknown[]): void => {
                    console.warn(...args)
                    scriptLog('warn', ...args)
                  },
                  error: (...args: unknown[]): void => {
                    console.error(...args)
                    scriptLog('error', ...args)
                  }
                } as unknown as Console

                // `responseBody` is a legacy Postman v1 global some scripts still use.
                const runScript = (script: string): Promise<void> =>
                  runPmScript(script, wap, mockConsole, pmResponseBodyText(response.data))

                // Request's own test runs first, collection test after — sama urutan Postman.
                if (workingRequest.post_request_script) await runScript(workingRequest.post_request_script)
                if (collection?.post_request_script) await runScript(collection.post_request_script)

                // Update tab with results (merge script results + schema assertions)
                const allTestResults = [...testResults, ...schemaTestResults]
                set((state) => ({
                  tabs: state.tabs.map((t) =>
                    t.requestId === activeTabId ? { ...t, testResults: allTestResults } : t
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
            } else if (schemaTestResults.length > 0) {
              // No post-request script but schema assertions exist
              set((state) => ({
                tabs: state.tabs.map((t) =>
                  t.requestId === activeTabId ? { ...t, testResults: schemaTestResults } : t
                )
              }))
            }

            // Update tab with response
            set((state) => ({
              tabs: state.tabs.map((t) =>
                t.requestId === activeTabId
                  ? { ...t, isSending: false, pendingRequestId: null, lastResponse: response }
                  : t
              )
            }))

            // Prepare body for history: Show exactly what was sent over the wire
            let historyBody = substitutedBody
            if (
              (workingRequest.body_type === 'x-www-form-urlencoded' ||
                workingRequest.body_type === 'form-data') &&
              Array.isArray(substitutedBody)
            ) {
              const params = new URLSearchParams()
              substitutedBody.forEach((item: any) => {
                if (item.enabled && item.key) params.append(item.key, item.value || '')
              })
              historyBody = params.toString()
            } else if (typeof substitutedBody !== 'string') {
              historyBody = JSON.stringify(substitutedBody, null, 2)
            }

            // Save to history
            await apiClient.post('/api/v1/history', {
              team_id: get().activeTeamId,
              request_id: activeTab.requestId,
              method: workingRequest.method,
              url: substitutedUrl,
              request_headers: substitutedHeaders,
              request_body: historyBody,
              response_headers: response.headers,
              response_body:
                typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2),
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
                    pendingRequestId: null,
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

        cancelActiveRequest: () => {
          const { tabs, activeTabId } = get()
          const activeTab = tabs.find((t) => t.requestId === activeTabId)
          if (activeTab?.kind !== 'request' || !activeTab.pendingRequestId) return
          apiClient.cancelRequest(activeTab.pendingRequestId)
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
            tabs: tabs.map((t) => (t.requestId === activeTabId && t.kind === 'request' ? { ...t, lastResponse: null } : t))
          })
        },

        clearLogs: () => {
          set({ logs: [] })
        },

        saveExample: async (requestId: number, name: string) => {
          const { tabs } = get()
          const tab = tabs.find((t) => t.requestId === requestId)
          if (!tab || tab.kind !== 'request' || !tab.lastResponse) {
            toast.error('No response available to save as example')
            return
          }

          const payload = {
            name: name,
            request_method: tab.workingRequest.method,
            request_url: tab.workingRequest.url,
            request_headers: tab.workingRequest.headers,
            request_body: Array.isArray(tab.workingRequest.body)
              ? tab.workingRequest.body
              : (typeof tab.workingRequest.body === 'string' ? { raw: tab.workingRequest.body } : tab.workingRequest.body),
            response_status: tab.lastResponse.status,
            response_headers: tab.lastResponse.headers,
            response_body: typeof tab.lastResponse.data === 'string' ? tab.lastResponse.data : JSON.stringify(tab.lastResponse.data)
          }

          try {
            const res = await apiClient.post(`/api/v1/requests/${requestId}/examples`, payload)
            if (res.status === 201) {
              toast.success('Response saved as example')
              // refresh the collection so the examples array is updated
              const req = get().requests.find(r => r.id === requestId)
              if (req) {
                await get().fetchCollectionContents(req.collection_id)
              }
            }
          } catch (err: unknown) {
            toast.error('Failed to save example')
          }
        },

        saveResponseSnapshot: (requestId, label) => {
          const { tabs, responseSnapshots } = get()
          const tab = tabs.find((t) => t.requestId === requestId)
          if (tab?.kind !== 'request' || !tab.lastResponse) {
            toast.error('No response to snapshot')
            return
          }
          const MAX_SNAPSHOTS = 10
          const key = String(requestId)
          const existing = responseSnapshots[key] || []
          if (existing.length >= MAX_SNAPSHOTS) {
            toast.error(`Max ${MAX_SNAPSHOTS} snapshots per request`)
            return
          }
          const snapshot: ResponseSnapshot = {
            id: crypto.randomUUID(),
            label: label || `Snapshot ${existing.length + 1} — ${tab.lastResponse.status}`,
            timestamp: Date.now(),
            status: tab.lastResponse.status,
            timing: tab.lastResponse.timing,
            data: tab.lastResponse.data,
            headers: tab.lastResponse.headers
          }
          set({ responseSnapshots: { ...responseSnapshots, [key]: [...existing, snapshot] } })
          toast.success('Snapshot saved')
        },

        deleteResponseSnapshot: (requestId, snapshotId) => {
          const { responseSnapshots } = get()
          const key = String(requestId)
          const existing = responseSnapshots[key] || []
          set({ responseSnapshots: { ...responseSnapshots, [key]: existing.filter((s) => s.id !== snapshotId) } })
        },

        deleteExample: async (id: number) => {
          try {
            const res = await apiClient.delete(`/api/v1/examples/${id}`)
            if (res.status === 200) {
              toast.success('Example deleted')
              const req = get().requests.find(r => r.examples?.some(e => e.id === id))
              if (req) {
                await get().fetchCollectionContents(req.collection_id)
              }
            }
          } catch {
            toast.error('Failed to delete example')
          }
        },

        renameRequest: async (id: number, name: string) => {
          try {
            const res = await apiClient.put(`/api/v1/requests/${id}`, { name })
            if (res.status === 200) {
              toast.success('Request renamed')
              const req = get().requests.find(r => r.id === id)
              if (req) {
                await get().fetchCollectionContents(req.collection_id)
              }

              // Also update the name in tabs if open
              const { tabs } = get()
              set({
                tabs: tabs.map(t => t.requestId === id ? { ...t, name } : t)
              })
            }
          } catch {
            toast.error('Failed to rename request')
          }
        },

        runCollection: async (collectionId, onProgress, options = {}) => {
          const { selectedIds, iterations = 1, delayMs = 0, stopOnFailure = false } = options
          const { fetchCollectionContents, environments, activeEnvironmentId, updateActiveEnvironmentVariable, updateCollectionVariable } = get()
          const collection = get().collections.find((c) => c.id === collectionId)

          await fetchCollectionContents(collectionId)

          const { requestsByCollection, requestsByFolder, foldersByCollection } = get()

          const allRequests: ApiRequest[] = []
          const rootRequests = requestsByCollection[collectionId] || []
          allRequests.push(...rootRequests)

          const addFolderRequests = (folderId: number) => {
            const folderRequests = requestsByFolder[folderId] || []
            allRequests.push(...folderRequests)
            const subfolders = (foldersByCollection[collectionId] || []).filter(f => f.parent_folder_id === folderId)
            subfolders.forEach(f => addFolderRequests(f.id))
          }

          const rootFolders = (foldersByCollection[collectionId] || []).filter(f => f.parent_folder_id === null)
          rootFolders.forEach(f => addFolderRequests(f.id))

          const requestsToRun = selectedIds && selectedIds.size > 0
            ? allRequests.filter(r => selectedIds.has(r.id))
            : allRequests

          if (requestsToRun.length === 0) {
            toast.error('No requests found in this collection')
            return []
          }

          const activeEnv = environments.find(e => e.id === activeEnvironmentId)
          const collectionVars = { ...(collection?.variables || {}) }
          const vars = { ...collectionVars, ...(activeEnv?.variables || {}) }
          const results: CollectionRunResult[] = []

          let shouldStop = false
          for (let iter = 0; iter < iterations && !shouldStop; iter++) {
          for (const req of requestsToRun) {
            const normalizedReq = normalizeRequest(req)
            const workingRequest = {
              method: normalizedReq.method,
              url: normalizedReq.url,
              headers: normalizedReq.headers || {},
              body: normalizedReq.body as string,
              auth_config: (normalizedReq.auth_config as AuthConfig) || { type: 'No Auth' },
              pre_request_script: normalizedReq.pre_request_script || '',
              post_request_script: normalizedReq.post_request_script || '',
              extraction_rules: (normalizedReq as any).extraction_rules || [],
              schema_assertions: (normalizedReq as any).schema_assertions || []
            }
            const effectiveAuth: AuthConfig = workingRequest.auth_config?.type === 'Inherit'
              ? (collection?.auth_config || { type: 'No Auth' })
              : workingRequest.auth_config

            // 1. Pre-request Script (collection script first, then the request's own)
            if (collection?.pre_request_script || workingRequest.pre_request_script) {
              try {
                const wap = {
                  set: (key: string, val: unknown) => { vars[key] = String(val) },
                  environment: {
                    set: (key: string, val: unknown) => {
                      const strVal = String(val)
                      vars[key] = strVal
                      updateActiveEnvironmentVariable(key, strVal)
                    },
                    get: (key: string) => vars[key]
                  },
                  collectionVariables: {
                    set: (key: string, val: unknown) => {
                      const strVal = String(val)
                      collectionVars[key] = strVal
                      vars[key] = strVal
                      if (collection) updateCollectionVariable(collection.id, key, strVal)
                    },
                    get: (key: string) => collectionVars[key]
                  },
                  request: workingRequest,
                  setEnv: (key: string, val: unknown) => {
                    const strVal = String(val)
                    vars[key] = strVal
                    updateActiveEnvironmentVariable(key, strVal)
                  }
                }
                const runScript = (script: string): Promise<void> => runPmScript(script, wap, console)
                if (collection?.pre_request_script) await runScript(collection.pre_request_script)
                if (workingRequest.pre_request_script) await runScript(workingRequest.pre_request_script)
              } catch (err) {
                console.error(`Runner Pre-request Error for ${req.name}:`, err)
              }
            }

            // Substitutions
            let substitutedUrl = replaceVariables(workingRequest.url, vars)
            const finalHeaders = injectAuth(workingRequest.headers, effectiveAuth, vars)
            const substitutedHeaders: Record<string, string> = {}
            Object.entries(finalHeaders).forEach(([k, v]) => { substitutedHeaders[k] = replaceVariables(v, vars) })
            const substitutedBody = Array.isArray(workingRequest.body)
              ? workingRequest.body.map((item) => ({
                ...item,
                key: replaceVariables(item.key, vars),
                value: replaceVariables(String(item.value), vars)
              }))
              : replaceVariables(workingRequest.body, vars)

            try {
              const start = Date.now()
              const response = await apiClient.executeRequest(
                workingRequest.method,
                substitutedUrl,
                substitutedHeaders,
                substitutedBody
              )
              const time = Date.now() - start

              // 2a. Variable Extraction Rules (Runner)
              for (const rule of (workingRequest.extraction_rules || [])) {
                if (!rule.enabled || !rule.variableName || !rule.jsonPath) continue
                if (!isSafeJsonPath(rule.jsonPath)) continue
                try {
                  const extracted = _.get(response.data, rule.jsonPath)
                  if (extracted !== undefined) {
                    vars[rule.variableName] = String(extracted)
                    updateActiveEnvironmentVariable(rule.variableName, String(extracted))
                  }
                } catch { /* ignore */ }
              }

              // 2b. Schema Assertions (Runner)
              const runnerSchemaResults: { name: string; status: 'passed' | 'failed'; error?: string }[] = []
              if ((workingRequest.schema_assertions || []).length > 0) {
                for (const assertion of (workingRequest.schema_assertions || [])) {
                  if (!assertion.enabled) continue
                  try {
                    const schema = JSON.parse(assertion.schema)
                    const validate = ajv.compile(schema)
                    const valid = validate(response.data)
                    if (valid) {
                      runnerSchemaResults.push({ name: assertion.name || 'Schema Assertion', status: 'passed' })
                    } else {
                      const errors = (validate.errors || []).map((e) => `${e.dataPath || '(root)'} ${e.message}`).join('; ')
                      runnerSchemaResults.push({ name: assertion.name || 'Schema Assertion', status: 'failed', error: errors })
                    }
                  } catch (err: unknown) {
                    runnerSchemaResults.push({ name: assertion.name || 'Schema Assertion', status: 'failed', error: `Invalid schema: ${err instanceof Error ? err.message : String(err)}` })
                  }
                }
              }

              // 2. Post-request Script (Tests)
              const testResults: { name: string; status: 'passed' | 'failed'; error?: string }[] = []
              if (collection?.post_request_script || workingRequest.post_request_script) {
                try {
                  const wap = {
                    response: { ...createPmResponseContext(response), responseTime: response.timing ?? time },
                    expect: createScriptExpect,
                    test: (name: string, fn: () => void) => {
                      try { fn(); testResults.push({ name, status: 'passed' }) }
                      catch (err: any) { testResults.push({ name, status: 'failed', error: err.message || String(err) }) }
                    },
                    environment: {
                      set: (key: string, val: unknown) => {
                        const strVal = String(val)
                        vars[key] = strVal
                        updateActiveEnvironmentVariable(key, strVal)
                      },
                      get: (key: string) => vars[key]
                    },
                    collectionVariables: {
                      set: (key: string, val: unknown) => {
                        const strVal = String(val)
                        collectionVars[key] = strVal
                        vars[key] = strVal
                        if (collection) updateCollectionVariable(collection.id, key, strVal)
                      },
                      get: (key: string) => collectionVars[key]
                    },
                    set: (key: string, val: unknown) => {
                      const strVal = String(val)
                      vars[key] = strVal
                      updateActiveEnvironmentVariable(key, strVal)
                    },
                    setEnv: (key: string, val: unknown) => {
                      const strVal = String(val)
                      vars[key] = strVal
                      updateActiveEnvironmentVariable(key, strVal)
                    }
                  }
                  const runScript = (script: string): Promise<void> =>
                    runPmScript(script, wap, console, pmResponseBodyText(response.data))
                  // Request's own test first, collection test after — sama urutan Postman.
                  if (workingRequest.post_request_script) await runScript(workingRequest.post_request_script)
                  if (collection?.post_request_script) await runScript(collection.post_request_script)
                } catch (err) {
                  console.error(`Runner Post-request Error for ${req.name}:`, err)
                }
              }

              const result: CollectionRunResult = {
                requestId: req.id,
                name: req.name,
                method: req.method,
                url: substitutedUrl,
                status: response.status,
                time,
                testResults: [...testResults, ...runnerSchemaResults]
              }
              results.push(result)
              if (onProgress) onProgress(result)

              // Save History (Async)
              apiClient.post('/api/v1/history', {
                team_id: get().activeTeamId,
                request_id: req.id,
                method: req.method,
                url: substitutedUrl,
                status_code: response.status,
                response_time: time,
                response_size: JSON.stringify(response.data).length,
                test_results: testResults
              }).catch(err => console.error('Failed to save runner history:', err))

              const isFailed = result.status >= 400 ||
                (result.testResults ?? []).some((t) => t.status === 'failed')
              if (stopOnFailure && isFailed) { shouldStop = true; break }

            } catch (err: any) {
              const result: CollectionRunResult = {
                requestId: req.id,
                name: req.name,
                method: req.method,
                url: substitutedUrl,
                status: 0,
                time: 0,
                testResults: [{ name: 'Request execution', status: 'failed', error: err.message || String(err) }]
              }
              results.push(result)
              if (onProgress) onProgress(result)
              if (stopOnFailure) { shouldStop = true; break }
            }

            if (delayMs > 0 && !shouldStop) {
              await new Promise<void>((resolve) => setTimeout(resolve, delayMs))
            }
          }
          } // end outer iterations loop

          set({ lastRunCollectionId: collectionId, lastRunResults: results })
          toast.success(`Run completed — ${results.length} request${results.length !== 1 ? 's' : ''} executed`)
          return results
        }
      }),
      {
        name: 'wapbolt-data-storage',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          activeTeamId: state.activeTeamId,
          activeTabId: state.activeTabId,
          tabs: state.tabs,
          activeEnvironmentId: state.activeEnvironmentId,
          expandedItems: state.expandedItems
        })
      }
    ))
)
