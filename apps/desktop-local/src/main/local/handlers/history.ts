import type Database from 'better-sqlite3'
import { Row, getString, getFloat, nowIso, LOCAL_USER_ID } from './helpers'
import { historyToJson } from './serializers'

// Port dari backend/internal/api/history.go. History local-only (§1 non-goal
// sync) — tidak menyentuh sync_meta, hard delete langsung.

type Res = { status: number; data: unknown }

export function getTeamHistory(db: Database.Database, query: URLSearchParams): Res {
  const teamId = query.get('team_id')
  if (!teamId) {
    return { status: 400, data: { error: 'team_id query param is required' } }
  }
  const rows = db
    .prepare('SELECT * FROM request_history WHERE team_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(teamId) as Row[]
  return { status: 200, data: rows.map(historyToJson) }
}

export function createHistory(db: Database.Database, body: Row | null): Res {
  if (!body) {
    return { status: 400, data: { error: 'Invalid request body', code: 'BAD_REQUEST' } }
  }
  const result = db
    .prepare(
      `INSERT INTO request_history
        (user_id, team_id, request_id, method, url, request_headers, request_body,
         response_headers, response_body, status_code, response_time, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      LOCAL_USER_ID,
      getFloat(body, 'team_id'),
      getFloat(body, 'request_id'),
      getString(body, 'method'),
      getString(body, 'url'),
      JSON.stringify(body.request_headers ?? {}),
      getString(body, 'request_body'),
      JSON.stringify(body.response_headers ?? {}),
      getString(body, 'response_body'),
      getFloat(body, 'status_code'),
      getFloat(body, 'response_time'),
      nowIso()
    )
  const row = db
    .prepare('SELECT * FROM request_history WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as Row
  return { status: 201, data: historyToJson(row) }
}

export function deleteHistory(db: Database.Database, id: string): Res {
  // Go: scoped ke user pemilik — lokal semua milik user 1.
  db.prepare('DELETE FROM request_history WHERE id = ? AND user_id = ?').run(id, LOCAL_USER_ID)
  return { status: 200, data: { message: 'History deleted' } }
}

export function clearTeamHistory(db: Database.Database, query: URLSearchParams): Res {
  const teamId = query.get('team_id')
  if (!teamId) {
    return { status: 400, data: { error: 'team_id query param is required' } }
  }
  db.prepare('DELETE FROM request_history WHERE team_id = ?').run(teamId)
  return { status: 200, data: { message: 'Team history cleared' } }
}
