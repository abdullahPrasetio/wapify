import type Database from 'better-sqlite3'
import { Row, getString, markDirty, nowIso, deleteWithTombstone, LOCAL_USER_ID } from './helpers'

// Port dari backend/internal/api/collection.go (ImportPostman, processPostmanItems,
// resolvePostmanBody, resolvePostmanAuth, resolvePostmanScripts, postmanParamsToFields)
// — hanya Postman v2.1 (bukan OpenAPI/Insomnia, yang belum di-port ke LocalRouter).

type Res = { status: number; data: unknown }

interface PostmanHeader {
  key: string
  value: string
}

interface PostmanFormParam {
  key: string
  value: string
  type?: string
  disabled?: boolean
}

interface PostmanBody {
  mode?: string
  raw?: string
  urlencoded?: PostmanFormParam[]
  formdata?: PostmanFormParam[]
}

interface PostmanAuthParam {
  key: string
  value: unknown
}

// Mirrors Postman v2.1's request.auth / collection.auth object. Only
// bearer/basic/apikey/noauth have a Wapbolt auth_config equivalent — other
// types (oauth2, digest, awsv4, hawk, ntlm, oauth1, ...) have no executable
// equivalent and are reported back as "unsupported" so the caller doesn't
// lose them silently.
interface PostmanAuth {
  type?: string
  bearer?: PostmanAuthParam[]
  basic?: PostmanAuthParam[]
  apikey?: PostmanAuthParam[]
}

interface PostmanVariable {
  key: string
  value?: unknown
}

interface PostmanEvent {
  listen?: string
  script?: { exec?: string[] }
}

interface PostmanRequest {
  method?: string
  url?: string | { raw?: string }
  header?: PostmanHeader[]
  body?: PostmanBody
  description?: string
  field_validations?: Record<string, unknown>
  auth_config?: Record<string, unknown> // Wapbolt's own export round-trip extension
  auth?: PostmanAuth // native Postman request-level Authorization
}

interface PostmanResponse {
  name?: string
  code?: number
  header?: PostmanHeader[]
  body?: string
}

interface PostmanItem {
  name: string
  item?: PostmanItem[]
  request?: PostmanRequest
  response?: PostmanResponse[]
  event?: PostmanEvent[] // request-level pre-request/test scripts (item-level, sibling of request)
}

interface PostmanCollectionJson {
  info?: { name?: string; description?: string }
  item?: PostmanItem[]
  auth?: PostmanAuth // collection-level Authorization
  variable?: PostmanVariable[] // collection-level Variables
  event?: PostmanEvent[] // collection-level pre-request/test scripts
}

class ImportError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function postmanParamsToFields(params: PostmanFormParam[] = []): Row[] {
  return params.map((p) => ({
    key: p.key,
    value: p.value,
    enabled: !p.disabled,
    type: p.type === 'file' ? 'file' : 'text'
  }))
}

function resolvePostmanBody(b?: PostmanBody): [unknown, string] {
  if (!b) return [null, 'raw-json']
  switch (b.mode) {
    case 'raw':
      try {
        return [JSON.parse(b.raw ?? ''), 'raw-json']
      } catch {
        return [null, 'raw-json']
      }
    case 'urlencoded':
      return [{ array: postmanParamsToFields(b.urlencoded) }, 'x-www-form-urlencoded']
    case 'formdata':
      return [{ array: postmanParamsToFields(b.formdata) }, 'form-data']
    default:
      return [null, 'raw-json']
  }
}

function resolveUrl(url: PostmanRequest['url']): string {
  if (typeof url === 'string') return url
  if (url && typeof url === 'object' && typeof url.raw === 'string') return url.raw
  return ''
}

function authParamsToMap(params: PostmanAuthParam[] = []): Record<string, string> {
  const m: Record<string, string> = {}
  for (const p of params) {
    if (typeof p.value === 'string') m[p.key] = p.value
  }
  return m
}

// resolvePostmanAuth converts Postman's native `auth` block into Wapbolt's
// auth_config shape for the types Wapbolt can actually execute. `undefined`
// return means "no Authorization tab data at all" (supported=true — caller
// keeps whatever default applies). A recognized-but-unsupported type
// (oauth2, digest, awsv4, hawk, ntlm, oauth1, ...) returns supported=false so
// the caller can surface a summary instead of silently dropping it.
function resolvePostmanAuth(auth?: PostmanAuth): { config: Row | undefined; supported: boolean } {
  if (!auth || !auth.type) return { config: undefined, supported: true }
  switch (auth.type) {
    case 'noauth':
      return { config: { type: 'No Auth' }, supported: true }
    case 'bearer': {
      const m = authParamsToMap(auth.bearer)
      return { config: { type: 'Bearer Token', token: m.token ?? '' }, supported: true }
    }
    case 'basic': {
      const m = authParamsToMap(auth.basic)
      return { config: { type: 'Basic Auth', username: m.username ?? '', password: m.password ?? '' }, supported: true }
    }
    case 'apikey': {
      const m = authParamsToMap(auth.apikey)
      return {
        config: { type: 'API Key', key: m.key ?? '', value: m.value ?? '', addTo: m.in === 'query' ? 'query' : 'header' },
        supported: true
      }
    }
    default:
      return { config: undefined, supported: false }
  }
}

// resolvePostmanScripts joins a Postman event array's prerequest/test exec
// lines into the single-string scripts Wapbolt stores.
function resolvePostmanScripts(events: PostmanEvent[] = []): { preRequest: string; test: string } {
  let preRequest = ''
  let test = ''
  for (const e of events) {
    const joined = (e.script?.exec ?? []).join('\n')
    if (e.listen === 'prerequest') preRequest = joined
    else if (e.listen === 'test') test = joined
  }
  return { preRequest, test }
}

function processPostmanItems(
  db: Database.Database,
  items: PostmanItem[],
  collectionId: number,
  folderId: number | null,
  unsupportedAuth: { count: number }
): void {
  const now = nowIso()

  for (const item of items) {
    if (Array.isArray(item.item)) {
      // Folder — recurse into children.
      const result = db
        .prepare('INSERT INTO folders (name, collection_id, parent_folder_id, order_index) VALUES (?, ?, ?, 0)')
        .run(item.name, collectionId, folderId)
      const newFolderId = Number(result.lastInsertRowid)
      markDirty(db, 'folder', newFolderId)
      processPostmanItems(db, item.item, collectionId, newFolderId, unsupportedAuth)
      continue
    }

    if (!item.request) continue

    const req = item.request
    const headers: Record<string, string> = {}
    for (const h of req.header ?? []) headers[h.key] = h.value

    const [bodyVal, bodyType] = resolvePostmanBody(req.body)
    const urlStr = resolveUrl(req.url)

    const { config: reqAuth, supported: reqAuthSupported } = resolvePostmanAuth(req.auth)
    if (!reqAuthSupported) unsupportedAuth.count++
    // Fall back to Wapbolt's own export round-trip extension when there's no native auth.
    const authConfig = reqAuth ?? req.auth_config ?? { type: 'No Auth' }
    const { preRequest, test } = resolvePostmanScripts(item.event)

    const result = db
      .prepare(
        `INSERT INTO requests
          (name, description, method, url, headers, body, body_type, body_variants, auth_config,
           field_validations, collection_id, folder_id, created_by, order_index,
           pre_request_script, post_request_script, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, '{}', ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`
      )
      .run(
        item.name,
        req.description ?? '',
        req.method ?? 'GET',
        urlStr,
        JSON.stringify(headers),
        JSON.stringify(bodyVal ?? {}),
        bodyType,
        JSON.stringify(authConfig),
        JSON.stringify(req.field_validations ?? {}),
        collectionId,
        folderId,
        LOCAL_USER_ID,
        preRequest,
        test,
        now,
        now
      )
    const requestId = Number(result.lastInsertRowid)
    markDirty(db, 'request', requestId)

    // Examples — Postman v2.1 keeps saved responses on the item itself.
    const requestBodyJson = req.body?.raw ? { raw: req.body.raw } : {}
    for (const res of item.response ?? []) {
      const resHeaders: Record<string, string> = {}
      for (const h of res.header ?? []) resHeaders[h.key] = h.value

      const exResult = db
        .prepare(
          `INSERT INTO request_examples
            (request_id, name, request_method, request_url, request_headers, request_body,
             response_status, response_headers, response_body, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          requestId,
          res.name ?? '',
          req.method ?? 'GET',
          urlStr,
          JSON.stringify(headers),
          JSON.stringify(requestBodyJson),
          res.code ?? 0,
          JSON.stringify(resHeaders),
          res.body ?? '',
          now,
          now
        )
      markDirty(db, 'example', Number(exResult.lastInsertRowid))
    }
  }
}

export function importPostman(
  db: Database.Database,
  teamId: string,
  body: Row | null,
  query: URLSearchParams
): Res {
  if (!body) return { status: 400, data: { error: 'Invalid Postman JSON', code: 'BAD_REQUEST' } }

  const postman = body as unknown as PostmanCollectionJson
  const name = postman.info?.name ?? ''
  const description = postman.info?.description ?? ''
  const mode = query.get('mode') ?? 'new'
  const confirmName = query.get('confirm_name') ?? ''

  const unsupportedAuth = { count: 0 }
  const { config: collAuth, supported: collAuthSupported } = resolvePostmanAuth(postman.auth)
  if (!collAuthSupported) unsupportedAuth.count++
  const collVars: Record<string, string> = {}
  for (const v of postman.variable ?? []) {
    collVars[v.key] = typeof v.value === 'string' ? v.value : v.value != null ? String(v.value) : ''
  }
  const { preRequest: collPreScript, test: collTestScript } = resolvePostmanScripts(postman.event)

  let collectionId = 0

  const run = db.transaction(() => {
    if (mode === 'overwrite') {
      const existing = db
        .prepare('SELECT * FROM collections WHERE team_id = ? AND name = ?')
        .get(teamId, name) as Row | undefined
      if (!existing) {
        throw new ImportError(400, `collection '${name}' not found for overwrite`)
      }
      if (confirmName !== getString(existing, 'name')) {
        throw new ImportError(400, `confirmation name mismatch: expected '${existing.name}', got '${confirmName}'`)
      }
      collectionId = Number(existing.id)

      const folders = db
        .prepare('SELECT id FROM folders WHERE collection_id = ?')
        .all(collectionId) as Array<{ id: number }>
      const requests = db
        .prepare('SELECT id FROM requests WHERE collection_id = ?')
        .all(collectionId) as Array<{ id: number }>
      for (const r of requests) deleteWithTombstone(db, 'request', 'requests', r.id)
      for (const f of folders) deleteWithTombstone(db, 'folder', 'folders', f.id)

      // Auth stays untouched when the imported file has no Authorization block at
      // all (mirrors Go); scripts/variables always overwrite, same as Go.
      const authConfigJson = collAuth
        ? JSON.stringify(collAuth)
        : typeof existing.auth_config === 'string'
          ? existing.auth_config
          : '{}'

      db.prepare(
        `UPDATE collections SET description = ?, auth_config = ?, pre_request_script = ?,
         post_request_script = ?, variables = ?, updated_at = ? WHERE id = ?`
      ).run(
        description,
        authConfigJson,
        collPreScript,
        collTestScript,
        JSON.stringify(collVars),
        nowIso(),
        collectionId
      )
      markDirty(db, 'collection', collectionId)
    } else {
      const now = nowIso()
      const result = db
        .prepare(
          `INSERT INTO collections
            (name, description, team_id, created_by, confluence_page_id, auth_config,
             pre_request_script, post_request_script, variables, created_at, updated_at)
           VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?)`
        )
        .run(
          name,
          description,
          teamId,
          LOCAL_USER_ID,
          JSON.stringify(collAuth ?? { type: 'No Auth' }),
          collPreScript,
          collTestScript,
          JSON.stringify(collVars),
          now,
          now
        )
      collectionId = Number(result.lastInsertRowid)
      markDirty(db, 'collection', collectionId)
    }

    processPostmanItems(db, postman.item ?? [], collectionId, null, unsupportedAuth)
  })

  try {
    run()
  } catch (err) {
    if (err instanceof ImportError) {
      return { status: err.status, data: { error: err.message, code: 'BAD_REQUEST' } }
    }
    return {
      status: 500,
      data: { error: err instanceof Error ? err.message : 'Internal error', code: 'INTERNAL_SERVER_ERROR' }
    }
  }

  return {
    status: 201,
    data: { message: 'Import successful', collection_id: collectionId, unsupported_auth_count: unsupportedAuth.count }
  }
}
