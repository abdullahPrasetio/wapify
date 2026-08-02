import type Database from 'better-sqlite3'
import { Row, getString, markDirty, nowIso, deleteWithTombstone, LOCAL_USER_ID } from './helpers'

// Port dari backend/internal/api/collection.go (ImportPostman, processPostmanItems,
// resolvePostmanBody, postmanParamsToFields) — hanya Postman v2.1 (bukan OpenAPI/Insomnia,
// yang belum di-port ke LocalRouter).

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

interface PostmanRequest {
  method?: string
  url?: string | { raw?: string }
  header?: PostmanHeader[]
  body?: PostmanBody
  description?: string
  field_validations?: Record<string, unknown>
  auth_config?: Record<string, unknown>
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
}

interface PostmanCollectionJson {
  info?: { name?: string; description?: string }
  item?: PostmanItem[]
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

function processPostmanItems(
  db: Database.Database,
  items: PostmanItem[],
  collectionId: number,
  folderId: number | null
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
      processPostmanItems(db, item.item, collectionId, newFolderId)
      continue
    }

    if (!item.request) continue

    const req = item.request
    const headers: Record<string, string> = {}
    for (const h of req.header ?? []) headers[h.key] = h.value

    const [bodyVal, bodyType] = resolvePostmanBody(req.body)
    const urlStr = resolveUrl(req.url)
    const authConfig = req.auth_config ?? { type: 'No Auth' }

    const result = db
      .prepare(
        `INSERT INTO requests
          (name, description, method, url, headers, body, body_type, body_variants, auth_config,
           field_validations, collection_id, folder_id, created_by, order_index,
           pre_request_script, post_request_script, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, '{}', ?, ?, ?, ?, ?, 0, '', '', ?, ?)`
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

      db.prepare('UPDATE collections SET description = ?, updated_at = ? WHERE id = ?').run(
        description,
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
           VALUES (?, ?, ?, ?, '', '{}', '', '', '{}', ?, ?)`
        )
        .run(name, description, teamId, LOCAL_USER_ID, now, now)
      collectionId = Number(result.lastInsertRowid)
      markDirty(db, 'collection', collectionId)
    }

    processPostmanItems(db, postman.item ?? [], collectionId, null)
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

  return { status: 201, data: { message: 'Import successful', collection_id: collectionId } }
}
