import type Database from 'better-sqlite3'
import {
  Row,
  getString,
  getFloat,
  toJsonbMap,
  markDirty,
  nowIso,
  notTombstonedSql,
  isTombstoned,
  deleteWithTombstone,
  LOCAL_USER_ID
} from './helpers'
import { requestToJson } from './serializers'

// Port dari backend/internal/api/request.go
// (ListRequestsInFolder/Collection, CreateRequestInFolder/Collection,
//  GetRequest, UpdateRequest, MoveRequest, DeleteRequest, DuplicateRequest).

type Res = { status: number; data: unknown }

const requestNotFound: Res = { status: 404, data: { error: 'Request not found', code: 'NOT_FOUND' } }
const folderNotFound: Res = { status: 404, data: { error: 'Folder not found', code: 'NOT_FOUND' } }
const collectionNotFound: Res = {
  status: 404,
  data: { error: 'Collection not found', code: 'NOT_FOUND' }
}
const badRequest: Res = { status: 400, data: { error: 'Invalid request body', code: 'BAD_REQUEST' } }

function findRequest(db: Database.Database, id: string): Row | null {
  const row = db.prepare('SELECT * FROM requests WHERE id = ?').get(id) as Row | undefined
  if (!row || isTombstoned(db, 'request', Number(row.id))) return null
  return row
}

function folderExists(db: Database.Database, id: string): Row | null {
  const row = db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as Row | undefined
  if (!row || isTombstoned(db, 'folder', Number(row.id))) return null
  return row
}

function collectionExists(db: Database.Database, id: unknown): boolean {
  const row = db.prepare('SELECT id FROM collections WHERE id = ?').get(id) as Row | undefined
  return !!row && !isTombstoned(db, 'collection', Number(row.id))
}

function examplesFor(db: Database.Database, requestId: unknown): Row[] {
  return db
    .prepare('SELECT * FROM request_examples WHERE request_id = ? ORDER BY id')
    .all(requestId) as Row[]
}

function serializeJson(v: unknown): string {
  return JSON.stringify(v ?? {})
}

// INSERT bersama untuk CreateRequestInFolder / CreateRequestInCollection —
// keduanya di Go identik kecuali sumber folder_id.
function insertRequest(
  db: Database.Database,
  data: Row,
  collectionId: unknown,
  folderId: number | null
): Res {
  const now = nowIso()
  const headers = 'headers' in data ? toJsonbMap(data.headers) : null
  const bodyCol = 'body' in data ? toJsonbMap(data.body) : null
  const bodyVariants =
    typeof data.body_variants === 'object' && data.body_variants !== null && !Array.isArray(data.body_variants)
      ? (data.body_variants as Row)
      : null
  const authConfig = 'auth_config' in data ? toJsonbMap(data.auth_config) : null

  const result = db
    .prepare(
      `INSERT INTO requests
        (name, description, method, url, headers, body, body_type, body_variants, auth_config,
         collection_id, folder_id, created_by, order_index, pre_request_script, post_request_script,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      getString(data, 'name'),
      getString(data, 'description'),
      getString(data, 'method'),
      getString(data, 'url'),
      serializeJson(headers),
      serializeJson(bodyCol),
      getString(data, 'body_type') || 'raw-json',
      serializeJson(bodyVariants),
      serializeJson(authConfig),
      collectionId,
      folderId,
      LOCAL_USER_ID,
      getFloat(data, 'order_index'),
      getString(data, 'pre_request_script'),
      getString(data, 'post_request_script'),
      now,
      now
    )
  const id = Number(result.lastInsertRowid)
  markDirty(db, 'request', id)

  const row = db.prepare('SELECT * FROM requests WHERE id = ?').get(id) as Row
  return { status: 201, data: requestToJson(row, null) }
}

export function listRequestsInFolder(db: Database.Database, folderId: string): Res {
  if (!folderExists(db, folderId)) return folderNotFound
  const rows = db
    .prepare(`SELECT * FROM requests WHERE folder_id = ? AND ${notTombstonedSql('request')} ORDER BY id`)
    .all(folderId) as Row[]
  return { status: 200, data: rows.map((r) => requestToJson(r, examplesFor(db, r.id))) }
}

export function createRequestInFolder(db: Database.Database, folderId: string, body: Row | null): Res {
  const folder = folderExists(db, folderId)
  if (!folder) return folderNotFound
  if (!body) return badRequest
  return insertRequest(db, body, folder.collection_id, Number(folder.id))
}

// Go: semua request dalam collection, termasuk yang di dalam folder.
export function listRequestsInCollection(db: Database.Database, collectionId: string): Res {
  if (!collectionExists(db, collectionId)) return collectionNotFound
  const rows = db
    .prepare(
      `SELECT * FROM requests WHERE collection_id = ? AND ${notTombstonedSql('request')} ORDER BY id`
    )
    .all(collectionId) as Row[]
  return { status: 200, data: rows.map((r) => requestToJson(r, examplesFor(db, r.id))) }
}

export function createRequestInCollection(
  db: Database.Database,
  collectionId: string,
  body: Row | null
): Res {
  if (!collectionExists(db, collectionId)) return collectionNotFound
  if (!body) return badRequest
  const folderId = typeof body.folder_id === 'number' ? body.folder_id : null
  return insertRequest(db, body, Number(collectionId), folderId)
}

export function getRequest(db: Database.Database, id: string): Res {
  const row = findRequest(db, id)
  if (!row) return requestNotFound
  return { status: 200, data: requestToJson(row, examplesFor(db, row.id)) }
}

export function updateRequest(db: Database.Database, id: string, body: Row | null): Res {
  const row = findRequest(db, id)
  if (!row) return requestNotFound
  if (!body) return badRequest

  // Semantik field-per-field persis UpdateRequest Go:
  // - name/method/url: hanya jika string non-kosong
  // - headers/body/auth_config: jika key ada, via toJSONB (kosong diperbolehkan)
  // - body_type: jika string (termasuk kosong)
  // - body_variants/field_validations: hanya jika object
  // - pre/post script: jika string (termasuk kosong)
  const updated: Row = { ...row }

  const name = getString(body, 'name')
  if (name !== '') updated.name = name
  const method = getString(body, 'method')
  if (method !== '') updated.method = method
  const url = getString(body, 'url')
  if (url !== '') updated.url = url

  if ('headers' in body) {
    const v = toJsonbMap(body.headers)
    if (v !== null) updated.headers = JSON.stringify(v)
  }
  if ('body' in body) {
    const v = toJsonbMap(body.body)
    if (v !== null) updated.body = JSON.stringify(v)
  }
  if (typeof body.body_type === 'string') updated.body_type = body.body_type
  if (typeof body.body_variants === 'object' && body.body_variants !== null && !Array.isArray(body.body_variants)) {
    updated.body_variants = JSON.stringify(body.body_variants)
  }
  if ('auth_config' in body) {
    const v = toJsonbMap(body.auth_config)
    if (v !== null) updated.auth_config = JSON.stringify(v)
  }
  if (typeof body.pre_request_script === 'string') updated.pre_request_script = body.pre_request_script
  if (typeof body.post_request_script === 'string') updated.post_request_script = body.post_request_script
  if (
    typeof body.field_validations === 'object' &&
    body.field_validations !== null &&
    !Array.isArray(body.field_validations)
  ) {
    updated.field_validations = JSON.stringify(body.field_validations)
  }

  db.prepare(
    `UPDATE requests SET
       name = ?, method = ?, url = ?, headers = ?, body = ?, body_type = ?, body_variants = ?,
       auth_config = ?, pre_request_script = ?, post_request_script = ?, field_validations = ?,
       updated_at = ?
     WHERE id = ?`
  ).run(
    updated.name,
    updated.method,
    updated.url,
    updated.headers,
    updated.body,
    updated.body_type,
    updated.body_variants,
    updated.auth_config,
    updated.pre_request_script,
    updated.post_request_script,
    updated.field_validations,
    nowIso(),
    row.id
  )
  markDirty(db, 'request', Number(row.id))

  const fresh = db.prepare('SELECT * FROM requests WHERE id = ?').get(row.id) as Row
  return { status: 200, data: requestToJson(fresh, null) }
}

export function moveRequest(db: Database.Database, id: string, body: Row | null): Res {
  const row = findRequest(db, id)
  if (!row) return requestNotFound
  if (!body) return badRequest

  const targetCollectionId = typeof body.collection_id === 'number' ? body.collection_id : 0
  const folderId = typeof body.folder_id === 'number' ? body.folder_id : null

  if (targetCollectionId !== Number(row.collection_id) && !collectionExists(db, targetCollectionId)) {
    return { status: 400, data: { error: 'Target collection not found', code: 'BAD_REQUEST' } }
  }

  db.prepare(
    'UPDATE requests SET collection_id = ?, folder_id = ?, order_index = ?, updated_at = ? WHERE id = ?'
  ).run(targetCollectionId, folderId, getFloat(body, 'order_index'), nowIso(), row.id)
  markDirty(db, 'request', Number(row.id))

  const fresh = db.prepare('SELECT * FROM requests WHERE id = ?').get(row.id) as Row
  return { status: 200, data: requestToJson(fresh, null) }
}

export function deleteRequest(db: Database.Database, id: string): Res {
  const row = findRequest(db, id)
  if (!row) return requestNotFound
  deleteWithTombstone(db, 'request', 'requests', Number(row.id))
  return { status: 200, data: { message: 'Request deleted successfully' } }
}

export function duplicateRequest(db: Database.Database, id: string): Res {
  const original = findRequest(db, id)
  if (!original) return requestNotFound

  const now = nowIso()
  const result = db
    .prepare(
      `INSERT INTO requests
        (name, description, method, url, headers, body, body_type, body_variants, auth_config,
         field_validations, collection_id, folder_id, created_by, order_index,
         pre_request_script, post_request_script, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      `${original.name} Copy`,
      original.description,
      original.method,
      original.url,
      original.headers,
      original.body,
      original.body_type,
      original.body_variants,
      original.auth_config,
      original.field_validations,
      original.collection_id,
      original.folder_id,
      LOCAL_USER_ID,
      Number(original.order_index) + 1,
      original.pre_request_script,
      original.post_request_script,
      now,
      now
    )
  const newId = Number(result.lastInsertRowid)
  markDirty(db, 'request', newId)

  const fresh = db.prepare('SELECT * FROM requests WHERE id = ?').get(newId) as Row
  return { status: 201, data: requestToJson(fresh, null) }
}
