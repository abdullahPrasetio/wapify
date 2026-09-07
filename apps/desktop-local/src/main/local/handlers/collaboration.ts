import type Database from 'better-sqlite3'
import { Row, getString, markDirty, nowIso, isTombstoned, LOCAL_USER_ID } from './helpers'
import { versionToJson, commentToJson, requestToJson } from './serializers'

// Port dari backend/internal/api/collaboration.go (versions + comments).
// Catatan: error response di file Go ini TIDAK memakai field "code" —
// hanya {"error": "..."} — berbeda dari handler lain. Dimirror apa adanya.
// Versions & comments local-only (§1 non-goal sync) kecuali versions ikut
// request-nya; keduanya tidak menyentuh sync_meta (kecuali rollback yang
// mengubah request → dirty).

type Res = { status: number; data: unknown }

function findRequest(db: Database.Database, id: string): Row | null {
  const row = db.prepare('SELECT * FROM requests WHERE id = ?').get(id) as Row | undefined
  if (!row || isTombstoned(db, 'request', Number(row.id))) return null
  return row
}

export function createRequestVersion(db: Database.Database, requestId: string, body: Row | null): Res {
  const req = findRequest(db, requestId)
  if (!req) return { status: 404, data: { error: 'Request not found' } }

  // Go: snapshot method/url/headers/body/auth_config/scripts; name opsional (null).
  const name = body ? getString(body, 'name') : ''
  const result = db
    .prepare(
      `INSERT INTO request_versions
        (request_id, created_by, name, method, url, headers, body, auth_config,
         pre_request_script, post_request_script, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.id,
      LOCAL_USER_ID,
      name !== '' ? name : null,
      req.method,
      req.url,
      req.headers,
      req.body,
      req.auth_config,
      req.pre_request_script,
      req.post_request_script,
      nowIso()
    )
  const row = db
    .prepare('SELECT * FROM request_versions WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as Row
  return { status: 201, data: versionToJson(row) }
}

export function getRequestVersions(db: Database.Database, requestId: string): Res {
  const rows = db
    .prepare('SELECT * FROM request_versions WHERE request_id = ? ORDER BY created_at DESC')
    .all(requestId) as Row[]
  return { status: 200, data: rows.map(versionToJson) }
}

export function rollbackRequestVersion(db: Database.Database, requestId: string, versionId: string): Res {
  const version = db.prepare('SELECT * FROM request_versions WHERE id = ?').get(versionId) as Row | undefined
  if (!version) return { status: 404, data: { error: 'Version not found' } }
  const req = findRequest(db, requestId)
  if (!req) return { status: 404, data: { error: 'Request not found' } }

  // Go: hanya field snapshot yang dikembalikan — body_type/variants tidak disentuh.
  db.prepare(
    `UPDATE requests SET method = ?, url = ?, headers = ?, body = ?, auth_config = ?,
       pre_request_script = ?, post_request_script = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    version.method,
    version.url,
    version.headers,
    version.body,
    version.auth_config,
    version.pre_request_script,
    version.post_request_script,
    nowIso(),
    req.id
  )
  markDirty(db, 'request', Number(req.id))

  const fresh = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.id) as Row
  return { status: 200, data: requestToJson(fresh, null) }
}

export function createComment(db: Database.Database, requestId: string, body: Row | null): Res {
  if (!body) return { status: 400, data: { error: 'Invalid input' } }
  const req = findRequest(db, requestId)
  if (!req) return { status: 404, data: { error: 'Request not found' } }

  const now = nowIso()
  const result = db
    .prepare('INSERT INTO comments (request_id, user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(req.id, LOCAL_USER_ID, getString(body, 'content'), now, now)
  const row = db.prepare('SELECT * FROM comments WHERE id = ?').get(Number(result.lastInsertRowid)) as Row
  return { status: 201, data: commentToJson(row) }
}

export function getComments(db: Database.Database, requestId: string): Res {
  const rows = db
    .prepare('SELECT * FROM comments WHERE request_id = ? ORDER BY created_at ASC')
    .all(requestId) as Row[]
  return { status: 200, data: rows.map(commentToJson) }
}

export function deleteComment(db: Database.Database, commentId: string): Res {
  const row = db.prepare('SELECT id FROM comments WHERE id = ?').get(commentId) as Row | undefined
  if (!row) return { status: 404, data: { error: 'Comment not found' } }
  db.prepare('DELETE FROM comments WHERE id = ?').run(commentId)
  // Go: 204 No Content tanpa body.
  return { status: 204, data: null }
}
