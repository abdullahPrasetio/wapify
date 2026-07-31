import type Database from 'better-sqlite3'
import { parseBody } from './handlers/helpers'
import { listTeams, createTeam } from './handlers/teams'
import {
  listCollections,
  createCollection,
  getCollection,
  updateCollection,
  deleteCollection
} from './handlers/collections'
import {
  listFolders,
  createFolder,
  updateFolder,
  moveFolder,
  deleteFolder
} from './handlers/folders'
import {
  listRequestsInFolder,
  createRequestInFolder,
  listRequestsInCollection,
  createRequestInCollection,
  getRequest,
  updateRequest,
  moveRequest,
  deleteRequest,
  duplicateRequest
} from './handlers/requests'
import {
  listEnvironments,
  createEnvironment,
  createGlobalEnvironment,
  getEnvironment,
  updateEnvironment,
  deleteEnvironment
} from './handlers/environments'
import { getTeamHistory, createHistory, deleteHistory, clearTeamHistory } from './handlers/history'
import { createExample, updateExample, deleteExample } from './handlers/examples'
import {
  createRequestVersion,
  getRequestVersions,
  rollbackRequestVersion,
  createComment,
  getComments,
  deleteComment
} from './handlers/collaboration'
import { getSearchSummary } from './handlers/search'

// LocalRouter — docs/local-app-design.md §5. Response shape identik dengan
// IpcResponse dari HTTP (Go backend) supaya useDataStore tidak bisa membedakan.
// Fase 2: teams/collections/folders/requests. Fase 3: environments, history,
// examples, versions, comments, search + stub activities/confluence.
// Path yang tidak dikenal balik 501 eksplisit, bukan pura-pura sukses.

export interface LocalRequestConfig {
  method: string
  url: string
  headers?: Record<string, string>
  body?: unknown
  body_type?: string
}

export interface LocalResponse {
  status: number
  headers: Record<string, string[]>
  data: unknown
  timing: number
}

// Request Wapbolt sendiri selalu berpola `/api/v1/...`. Request ke target API
// arbitrary (tombol "Send") memakai URL bebas dan TIDAK ke sini — tetap
// httpExecute (§2). Pengecualian §5.1: /api/v1/auth/* tidak pernah di-route
// lokal — dipakai login-sekali/SyncEngine langsung ke server.
export function isWapboltApiUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname
    if (path.startsWith('/api/v1/auth/')) return false
    return path.startsWith('/api/v1/')
  } catch {
    return false
  }
}

type Res = { status: number; data: unknown }
type RouteHandler = (
  db: Database.Database,
  params: string[],
  body: ReturnType<typeof parseBody>,
  query: URLSearchParams
) => Res

const routes: Array<{ method: string; pattern: RegExp; handler: RouteHandler }> = [
  // Teams (team.go)
  { method: 'GET', pattern: /^\/api\/v1\/teams\/?$/, handler: (db) => listTeams(db) },
  { method: 'POST', pattern: /^\/api\/v1\/teams\/?$/, handler: (db, _p, b) => createTeam(db, b) },

  // Collections (collection.go)
  {
    method: 'GET',
    pattern: /^\/api\/v1\/teams\/(\d+)\/collections$/,
    handler: (db, [teamId]) => listCollections(db, teamId)
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/teams\/(\d+)\/collections$/,
    handler: (db, [teamId], b) => createCollection(db, teamId, b)
  },
  { method: 'GET', pattern: /^\/api\/v1\/collections\/(\d+)$/, handler: (db, [id]) => getCollection(db, id) },
  {
    method: 'PUT',
    pattern: /^\/api\/v1\/collections\/(\d+)$/,
    handler: (db, [id], b) => updateCollection(db, id, b)
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/v1\/collections\/(\d+)$/,
    handler: (db, [id]) => deleteCollection(db, id)
  },

  // Folders (folder.go)
  {
    method: 'GET',
    pattern: /^\/api\/v1\/collections\/(\d+)\/folders$/,
    handler: (db, [id]) => listFolders(db, id)
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/collections\/(\d+)\/folders$/,
    handler: (db, [id], b) => createFolder(db, id, b)
  },
  { method: 'PUT', pattern: /^\/api\/v1\/folders\/(\d+)$/, handler: (db, [id], b) => updateFolder(db, id, b) },
  {
    method: 'PATCH',
    pattern: /^\/api\/v1\/folders\/(\d+)\/move$/,
    handler: (db, [id], b) => moveFolder(db, id, b)
  },
  { method: 'DELETE', pattern: /^\/api\/v1\/folders\/(\d+)$/, handler: (db, [id]) => deleteFolder(db, id) },

  // Requests (request.go)
  {
    method: 'GET',
    pattern: /^\/api\/v1\/folders\/(\d+)\/requests$/,
    handler: (db, [id]) => listRequestsInFolder(db, id)
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/folders\/(\d+)\/requests$/,
    handler: (db, [id], b) => createRequestInFolder(db, id, b)
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/collections\/(\d+)\/requests$/,
    handler: (db, [id]) => listRequestsInCollection(db, id)
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/collections\/(\d+)\/requests$/,
    handler: (db, [id], b) => createRequestInCollection(db, id, b)
  },
  { method: 'GET', pattern: /^\/api\/v1\/requests\/(\d+)$/, handler: (db, [id]) => getRequest(db, id) },
  { method: 'PUT', pattern: /^\/api\/v1\/requests\/(\d+)$/, handler: (db, [id], b) => updateRequest(db, id, b) },
  {
    method: 'PATCH',
    pattern: /^\/api\/v1\/requests\/(\d+)\/move$/,
    handler: (db, [id], b) => moveRequest(db, id, b)
  },
  { method: 'DELETE', pattern: /^\/api\/v1\/requests\/(\d+)$/, handler: (db, [id]) => deleteRequest(db, id) },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/requests\/(\d+)\/duplicate$/,
    handler: (db, [id]) => duplicateRequest(db, id)
  },

  // Environments (environment.go)
  {
    method: 'GET',
    pattern: /^\/api\/v1\/teams\/(\d+)\/environments$/,
    handler: (db, [teamId]) => listEnvironments(db, teamId)
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/teams\/(\d+)\/environments$/,
    handler: (db, [teamId], b) => createEnvironment(db, teamId, b)
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/environments\/global$/,
    handler: (db, _p, b) => createGlobalEnvironment(db, b)
  },
  { method: 'GET', pattern: /^\/api\/v1\/environments\/(\d+)$/, handler: (db, [id]) => getEnvironment(db, id) },
  {
    method: 'PUT',
    pattern: /^\/api\/v1\/environments\/(\d+)$/,
    handler: (db, [id], b) => updateEnvironment(db, id, b)
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/v1\/environments\/(\d+)$/,
    handler: (db, [id]) => deleteEnvironment(db, id)
  },

  // History (history.go) — group route Fiber cocok dengan/atau tanpa trailing slash.
  { method: 'GET', pattern: /^\/api\/v1\/history\/?$/, handler: (db, _p, _b, q) => getTeamHistory(db, q) },
  { method: 'POST', pattern: /^\/api\/v1\/history\/?$/, handler: (db, _p, b) => createHistory(db, b) },
  { method: 'DELETE', pattern: /^\/api\/v1\/history\/(\d+)$/, handler: (db, [id]) => deleteHistory(db, id) },
  {
    method: 'DELETE',
    pattern: /^\/api\/v1\/history\/?$/,
    handler: (db, _p, _b, q) => clearTeamHistory(db, q)
  },

  // Examples (example.go)
  {
    method: 'POST',
    pattern: /^\/api\/v1\/requests\/(\d+)\/examples$/,
    handler: (db, [id], b) => createExample(db, id, b)
  },
  { method: 'PUT', pattern: /^\/api\/v1\/examples\/(\d+)$/, handler: (db, [id], b) => updateExample(db, id, b) },
  { method: 'DELETE', pattern: /^\/api\/v1\/examples\/(\d+)$/, handler: (db, [id]) => deleteExample(db, id) },

  // Versions & comments (collaboration.go)
  {
    method: 'POST',
    pattern: /^\/api\/v1\/requests\/(\d+)\/versions$/,
    handler: (db, [id], b) => createRequestVersion(db, id, b)
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/requests\/(\d+)\/versions$/,
    handler: (db, [id]) => getRequestVersions(db, id)
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/requests\/(\d+)\/versions\/(\d+)\/rollback$/,
    handler: (db, [id, versionId]) => rollbackRequestVersion(db, id, versionId)
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/requests\/(\d+)\/comments$/,
    handler: (db, [id], b) => createComment(db, id, b)
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/requests\/(\d+)\/comments$/,
    handler: (db, [id]) => getComments(db, id)
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/v1\/comments\/(\d+)$/,
    handler: (db, [id]) => deleteComment(db, id)
  },

  // Search (search.go)
  { method: 'GET', pattern: /^\/api\/v1\/search\/summary$/, handler: (db) => getSearchSummary(db) },

  // Stubs (§5.1): endpoint yang di mode local memang tidak punya isi.
  {
    method: 'GET',
    pattern: /^\/api\/v1\/teams\/(\d+)\/activities$/,
    handler: () => ({ status: 200, data: [] })
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/confluence\/config$/,
    handler: () => ({ status: 200, data: { enabled: false } })
  }
]

export function createLocalRouter(db: Database.Database) {
  function handle(config: LocalRequestConfig): LocalResponse {
    const start = Date.now()
    let path: string
    let query: URLSearchParams
    try {
      const parsed = new URL(config.url)
      path = parsed.pathname
      query = parsed.searchParams
    } catch {
      return { status: 400, headers: {}, data: { error: 'Invalid URL' }, timing: 0 }
    }

    for (const route of routes) {
      if (route.method !== config.method.toUpperCase()) continue
      const match = path.match(route.pattern)
      if (!match) continue
      try {
        const { status, data } = route.handler(db, match.slice(1), parseBody(config.body), query)
        return { status, headers: {}, data, timing: Date.now() - start }
      } catch (err) {
        return {
          status: 500,
          headers: {},
          data: { error: err instanceof Error ? err.message : 'Internal error', code: 'INTERNAL_SERVER_ERROR' },
          timing: Date.now() - start
        }
      }
    }

    return {
      status: 501,
      headers: {},
      data: { error: `LocalRouter: ${config.method} ${path} belum diimplementasikan` },
      timing: Date.now() - start
    }
  }

  return { handle }
}

export type LocalRouter = ReturnType<typeof createLocalRouter>
