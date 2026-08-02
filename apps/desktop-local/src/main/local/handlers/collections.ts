import type Database from 'better-sqlite3'
import {
  Row,
  getString,
  markDirty,
  nowIso,
  notTombstonedSql,
  isTombstoned,
  deleteWithTombstone,
  toJsonbMap,
  LOCAL_USER_ID
} from './helpers'
import { collectionToJson, folderToJson, requestToJson } from './serializers'

// Port dari backend/internal/api/collection.go
// (ListCollections, CreateCollection, GetCollection, UpdateCollection, DeleteCollection).

type Res = { status: number; data: unknown }

function findCollection(db: Database.Database, id: string): Row | null {
  const row = db.prepare('SELECT * FROM collections WHERE id = ?').get(id) as Row | undefined
  if (!row || isTombstoned(db, 'collection', Number(row.id))) return null
  return row
}

const notFound: Res = { status: 404, data: { error: 'Collection not found', code: 'NOT_FOUND' } }

export function listCollections(db: Database.Database, teamId: string): Res {
  const rows = db
    .prepare(`SELECT * FROM collections WHERE team_id = ? AND ${notTombstonedSql('collection')} ORDER BY id`)
    .all(teamId) as Row[]
  return { status: 200, data: rows.map(collectionToJson) }
}

export function createCollection(db: Database.Database, teamId: string, body: Row | null): Res {
  if (!body) {
    return { status: 400, data: { error: 'Invalid request body', code: 'BAD_REQUEST' } }
  }
  const now = nowIso()
  const result = db
    .prepare(
      `INSERT INTO collections (name, description, team_id, created_by, confluence_page_id, auth_config, pre_request_script, post_request_script, variables, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      getString(body, 'name'),
      getString(body, 'description'),
      teamId,
      LOCAL_USER_ID,
      getString(body, 'confluence_page_id'),
      JSON.stringify(toJsonbMap(body.auth_config) ?? {}),
      getString(body, 'pre_request_script'),
      getString(body, 'post_request_script'),
      JSON.stringify(toJsonbMap(body.variables) ?? {}),
      now,
      now
    )
  const id = Number(result.lastInsertRowid)
  markDirty(db, 'collection', id)

  const row = db.prepare('SELECT * FROM collections WHERE id = ?').get(id) as Row
  return { status: 201, data: collectionToJson(row) }
}

// GetCollection Go: {collection, folders(root: parent_folder_id IS NULL), requests(root: folder_id IS NULL)}
export function getCollection(db: Database.Database, id: string): Res {
  const collection = findCollection(db, id)
  if (!collection) return notFound

  const folders = db
    .prepare(
      `SELECT * FROM folders WHERE collection_id = ? AND parent_folder_id IS NULL AND ${notTombstonedSql('folder')} ORDER BY id`
    )
    .all(collection.id) as Row[]
  const requests = db
    .prepare(
      `SELECT * FROM requests WHERE collection_id = ? AND folder_id IS NULL AND ${notTombstonedSql('request')} ORDER BY id`
    )
    .all(collection.id) as Row[]

  return {
    status: 200,
    data: {
      collection: collectionToJson(collection),
      folders: folders.map(folderToJson),
      requests: requests.map((r) => requestToJson(r, null))
    }
  }
}

export function updateCollection(db: Database.Database, id: string, body: Row | null): Res {
  const collection = findCollection(db, id)
  if (!collection) return notFound
  if (!body) {
    return { status: 400, data: { error: 'Invalid request body', code: 'BAD_REQUEST' } }
  }

  // Semantik Go: name/description hanya jika non-kosong, confluence_page_id
  // dan settings (auth/scripts/variables) selalu ditimpa penuh (modal settings
  // selalu mengirim state lengkap — lihat UpdateCollection Go).
  const name = getString(body, 'name')
  const description = getString(body, 'description')
  const updated = {
    name: name !== '' ? name : (collection.name as string),
    description: description !== '' ? description : (collection.description as string),
    confluence_page_id: getString(body, 'confluence_page_id'),
    auth_config: JSON.stringify(toJsonbMap(body.auth_config) ?? {}),
    pre_request_script: getString(body, 'pre_request_script'),
    post_request_script: getString(body, 'post_request_script'),
    variables: JSON.stringify(toJsonbMap(body.variables) ?? {})
  }

  db.prepare(
    `UPDATE collections SET name = ?, description = ?, confluence_page_id = ?,
     auth_config = ?, pre_request_script = ?, post_request_script = ?, variables = ?,
     updated_at = ? WHERE id = ?`
  ).run(
    updated.name,
    updated.description,
    updated.confluence_page_id,
    updated.auth_config,
    updated.pre_request_script,
    updated.post_request_script,
    updated.variables,
    nowIso(),
    collection.id
  )
  markDirty(db, 'collection', Number(collection.id))

  const row = db.prepare('SELECT * FROM collections WHERE id = ?').get(collection.id) as Row
  return { status: 200, data: collectionToJson(row) }
}

export function deleteCollection(db: Database.Database, id: string): Res {
  const collection = findCollection(db, id)
  if (!collection) return notFound

  // Server: ON DELETE CASCADE ke folders/requests (000001_init_schema.up.sql).
  // Lokal: cascade eksplisit karena row yang sudah tersync jadi tombstone,
  // bukan hard delete (§5.2 aturan 4).
  const cid = collection.id
  const requests = db
    .prepare('SELECT id FROM requests WHERE collection_id = ?')
    .all(cid) as Array<{ id: number }>
  const folders = db
    .prepare('SELECT id FROM folders WHERE collection_id = ?')
    .all(cid) as Array<{ id: number }>

  const run = db.transaction(() => {
    for (const r of requests) deleteWithTombstone(db, 'request', 'requests', r.id)
    for (const f of folders) deleteWithTombstone(db, 'folder', 'folders', f.id)
    deleteWithTombstone(db, 'collection', 'collections', Number(cid))
  })
  run()

  return { status: 200, data: { message: 'Collection deleted successfully' } }
}
