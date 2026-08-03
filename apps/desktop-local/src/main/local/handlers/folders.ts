import type Database from 'better-sqlite3'
import {
  Row,
  getString,
  getFloat,
  markDirty,
  notTombstonedSql,
  isTombstoned,
  deleteWithTombstone,
  LOCAL_USER_ID
} from './helpers'
import { folderToJson } from './serializers'

// Port dari backend/internal/api/folder.go
// (ListFolders, CreateFolder, UpdateFolder, MoveFolder, DeleteFolder).

type Res = { status: number; data: unknown }

const folderNotFound: Res = { status: 404, data: { error: 'Folder not found', code: 'NOT_FOUND' } }
const collectionNotFound: Res = {
  status: 404,
  data: { error: 'Collection not found', code: 'NOT_FOUND' }
}
const badRequest: Res = { status: 400, data: { error: 'Invalid request body', code: 'BAD_REQUEST' } }

function findFolder(db: Database.Database, id: string): Row | null {
  const row = db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as Row | undefined
  if (!row || isTombstoned(db, 'folder', Number(row.id))) return null
  return row
}

function collectionExists(db: Database.Database, id: unknown): boolean {
  const row = db.prepare('SELECT id FROM collections WHERE id = ?').get(id) as Row | undefined
  return !!row && !isTombstoned(db, 'collection', Number(row.id))
}

export function listFolders(db: Database.Database, collectionId: string): Res {
  if (!collectionExists(db, collectionId)) return collectionNotFound
  const rows = db
    .prepare(`SELECT * FROM folders WHERE collection_id = ? AND ${notTombstonedSql('folder')} ORDER BY id`)
    .all(collectionId) as Row[]
  return { status: 200, data: rows.map(folderToJson) }
}

export function createFolder(db: Database.Database, collectionId: string, body: Row | null): Res {
  if (!collectionExists(db, collectionId)) return collectionNotFound
  if (!body) return badRequest

  const parentId = typeof body.parent_folder_id === 'number' ? body.parent_folder_id : null
  const result = db
    .prepare(
      'INSERT INTO folders (name, collection_id, parent_folder_id, order_index) VALUES (?, ?, ?, ?)'
    )
    .run(getString(body, 'name'), collectionId, parentId, getFloat(body, 'order_index'))
  const id = Number(result.lastInsertRowid)
  markDirty(db, 'folder', id)

  const row = db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as Row
  return { status: 201, data: folderToJson(row) }
}

export function updateFolder(db: Database.Database, id: string, body: Row | null): Res {
  const folder = findFolder(db, id)
  if (!folder) return folderNotFound
  if (!body) return badRequest

  // Semantik Go: hanya name, dan hanya jika non-kosong.
  const name = getString(body, 'name')
  if (name !== '') {
    db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(name, folder.id)
  }
  markDirty(db, 'folder', Number(folder.id))

  const row = db.prepare('SELECT * FROM folders WHERE id = ?').get(folder.id) as Row
  return { status: 200, data: folderToJson(row) }
}

// Kumpulkan folder + seluruh keturunannya (BFS, sama seperti loop frontier di Go).
function descendantFolderIds(db: Database.Database, rootId: number): number[] {
  const ids = [rootId]
  let frontier = [rootId]
  while (frontier.length > 0) {
    const placeholders = frontier.map(() => '?').join(',')
    const children = db
      .prepare(`SELECT id FROM folders WHERE parent_folder_id IN (${placeholders})`)
      .all(...frontier) as Array<{ id: number }>
    frontier = children.map((c) => c.id)
    ids.push(...frontier)
  }
  return ids
}

export function moveFolder(db: Database.Database, id: string, body: Row | null): Res {
  const folder = findFolder(db, id)
  if (!folder) return folderNotFound
  if (!body) return badRequest

  const targetCollectionId = typeof body.collection_id === 'number' ? body.collection_id : 0
  const parentId = typeof body.parent_folder_id === 'number' ? body.parent_folder_id : null
  const orderIndex = getFloat(body, 'order_index')

  // Cycle check dasar Go: tidak boleh pindah ke dalam dirinya sendiri.
  if (parentId !== null && parentId === Number(folder.id)) {
    return { status: 400, data: { error: 'Cannot move folder into itself', code: 'BAD_REQUEST' } }
  }

  const movingToNewCollection = targetCollectionId !== Number(folder.collection_id)
  if (movingToNewCollection && !collectionExists(db, targetCollectionId)) {
    return { status: 400, data: { error: 'Target collection not found', code: 'BAD_REQUEST' } }
  }

  const run = db.transaction(() => {
    db.prepare(
      'UPDATE folders SET collection_id = ?, parent_folder_id = ?, order_index = ? WHERE id = ?'
    ).run(targetCollectionId, parentId, orderIndex, folder.id)

    // Cascade collection_id ke sub-folder & request di dalamnya (mirror Go).
    if (movingToNewCollection) {
      const ids = descendantFolderIds(db, Number(folder.id))
      const placeholders = ids.map(() => '?').join(',')
      db.prepare(`UPDATE folders SET collection_id = ? WHERE id IN (${placeholders})`).run(
        targetCollectionId,
        ...ids
      )
      db.prepare(`UPDATE requests SET collection_id = ? WHERE folder_id IN (${placeholders})`).run(
        targetCollectionId,
        ...ids
      )
      for (const fid of ids) markDirty(db, 'folder', fid)
      const reqs = db
        .prepare(`SELECT id FROM requests WHERE folder_id IN (${placeholders})`)
        .all(...ids) as Array<{ id: number }>
      for (const r of reqs) markDirty(db, 'request', r.id)
    } else {
      markDirty(db, 'folder', Number(folder.id))
    }
  })
  run()

  const row = db.prepare('SELECT * FROM folders WHERE id = ?').get(folder.id) as Row
  return { status: 200, data: folderToJson(row) }
}

// Salin folder (opsional rename) + seluruh request langsung di dalamnya,
// lalu rekursif ke sub-folder. Dipakai untuk "Duplicate Folder" berdiri
// sendiri maupun sebagai building block "Duplicate Collection".
// Mirror Go: duplicateFolderTree di backend/internal/api/folder.go.
export function duplicateFolderTree(
  db: Database.Database,
  originalFolderId: number,
  targetCollectionId: number,
  targetParentFolderId: number | null,
  nameSuffix: string
): Row {
  const original = db.prepare('SELECT * FROM folders WHERE id = ?').get(originalFolderId) as Row

  const result = db
    .prepare('INSERT INTO folders (name, collection_id, parent_folder_id, order_index) VALUES (?, ?, ?, ?)')
    .run(`${original.name}${nameSuffix}`, targetCollectionId, targetParentFolderId, original.order_index)
  const newFolderId = Number(result.lastInsertRowid)
  markDirty(db, 'folder', newFolderId)

  const requests = db.prepare('SELECT * FROM requests WHERE folder_id = ?').all(originalFolderId) as Row[]
  for (const r of requests) {
    const now = new Date().toISOString()
    const reqResult = db
      .prepare(
        `INSERT INTO requests
          (name, description, method, url, headers, body, body_type, body_variants, auth_config,
           field_validations, collection_id, folder_id, created_by, order_index,
           pre_request_script, post_request_script, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        r.name,
        r.description,
        r.method,
        r.url,
        r.headers,
        r.body,
        r.body_type,
        r.body_variants,
        r.auth_config,
        r.field_validations,
        targetCollectionId,
        newFolderId,
        LOCAL_USER_ID,
        r.order_index,
        r.pre_request_script,
        r.post_request_script,
        now,
        now
      )
    markDirty(db, 'request', Number(reqResult.lastInsertRowid))
  }

  const subfolders = db
    .prepare('SELECT id FROM folders WHERE parent_folder_id = ?')
    .all(originalFolderId) as Array<{ id: number }>
  for (const sf of subfolders) {
    duplicateFolderTree(db, sf.id, targetCollectionId, newFolderId, '')
  }

  return db.prepare('SELECT * FROM folders WHERE id = ?').get(newFolderId) as Row
}

export function duplicateFolder(db: Database.Database, id: string): Res {
  const folder = findFolder(db, id)
  if (!folder) return folderNotFound

  const run = db.transaction(() =>
    duplicateFolderTree(
      db,
      Number(folder.id),
      Number(folder.collection_id),
      folder.parent_folder_id === null || folder.parent_folder_id === undefined
        ? null
        : Number(folder.parent_folder_id),
      ' Copy'
    )
  )
  const newFolder = run()

  db.prepare('UPDATE folders SET order_index = ? WHERE id = ?').run(
    Number(folder.order_index) + 1,
    newFolder.id
  )
  markDirty(db, 'folder', Number(newFolder.id))

  const row = db.prepare('SELECT * FROM folders WHERE id = ?').get(newFolder.id) as Row
  return { status: 201, data: folderToJson(row) }
}

export function deleteFolder(db: Database.Database, id: string): Res {
  const folder = findFolder(db, id)
  if (!folder) return folderNotFound

  // Server cascade (folders.parent_folder_id / requests.folder_id ON DELETE
  // CASCADE) → lokal: cascade eksplisit dengan tombstone.
  const ids = descendantFolderIds(db, Number(folder.id))
  const placeholders = ids.map(() => '?').join(',')
  const reqs = db
    .prepare(`SELECT id FROM requests WHERE folder_id IN (${placeholders})`)
    .all(...ids) as Array<{ id: number }>

  const run = db.transaction(() => {
    for (const r of reqs) deleteWithTombstone(db, 'request', 'requests', r.id)
    // Anak dulu baru induk supaya hard-delete tidak melanggar FK parent_folder_id.
    for (const fid of ids.reverse()) deleteWithTombstone(db, 'folder', 'folders', fid)
  })
  run()

  return { status: 200, data: { message: 'Folder deleted successfully' } }
}
