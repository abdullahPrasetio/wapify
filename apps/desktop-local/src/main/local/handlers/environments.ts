import type Database from 'better-sqlite3'
import {
  Row,
  getString,
  markDirty,
  nowIso,
  notTombstonedSql,
  isTombstoned,
  deleteWithTombstone
} from './helpers'
import { environmentToJson } from './serializers'

// Port dari backend/internal/api/environment.go. User lokal = super admin,
// jadi cabang "Only Super Admin" selalu lolos (global env boleh dikelola).

type Res = { status: number; data: unknown }

const notFound: Res = { status: 404, data: { error: 'Environment not found', code: 'NOT_FOUND' } }
const badRequest: Res = { status: 400, data: { error: 'Invalid request body', code: 'BAD_REQUEST' } }

function findEnv(db: Database.Database, id: string): Row | null {
  const row = db.prepare('SELECT * FROM environments WHERE id = ?').get(id) as Row | undefined
  if (!row || isTombstoned(db, 'environment', Number(row.id))) return null
  return row
}

// Go: WHERE team_id = ? OR is_global = true
export function listEnvironments(db: Database.Database, teamId: string): Res {
  const rows = db
    .prepare(
      `SELECT * FROM environments WHERE (team_id = ? OR is_global = 1) AND ${notTombstonedSql('environment')} ORDER BY id`
    )
    .all(teamId) as Row[]
  return { status: 200, data: rows.map(environmentToJson) }
}

export function createEnvironment(db: Database.Database, teamId: string, body: Row | null): Res {
  if (!body) return badRequest
  const result = db
    .prepare('INSERT INTO environments (name, variables, team_id, is_global, created_at) VALUES (?, ?, ?, 0, ?)')
    .run(getString(body, 'name'), JSON.stringify(body.variables ?? {}), teamId, nowIso())
  const id = Number(result.lastInsertRowid)
  markDirty(db, 'environment', id)
  const row = db.prepare('SELECT * FROM environments WHERE id = ?').get(id) as Row
  return { status: 201, data: environmentToJson(row) }
}

export function createGlobalEnvironment(db: Database.Database, body: Row | null): Res {
  if (!body) return badRequest
  const result = db
    .prepare('INSERT INTO environments (name, variables, team_id, is_global, created_at) VALUES (?, ?, NULL, 1, ?)')
    .run(getString(body, 'name'), JSON.stringify(body.variables ?? {}), nowIso())
  const id = Number(result.lastInsertRowid)
  markDirty(db, 'environment', id)
  const row = db.prepare('SELECT * FROM environments WHERE id = ?').get(id) as Row
  return { status: 201, data: environmentToJson(row) }
}

export function getEnvironment(db: Database.Database, id: string): Res {
  const row = findEnv(db, id)
  if (!row) return notFound
  return { status: 200, data: environmentToJson(row) }
}

export function updateEnvironment(db: Database.Database, id: string, body: Row | null): Res {
  const env = findEnv(db, id)
  if (!env) return notFound
  if (!body) return badRequest

  // Semantik Go: name jika non-kosong, variables jika non-nil; super admin
  // (selalu, lokal) boleh mengubah is_global/team_id.
  const updated: Row = { ...env }
  const name = getString(body, 'name')
  if (name !== '') updated.name = name
  if (body.variables !== null && body.variables !== undefined) {
    updated.variables = JSON.stringify(body.variables)
  }
  if (typeof body.is_global === 'boolean') {
    updated.is_global = body.is_global ? 1 : 0
    if (body.is_global) {
      updated.team_id = null
    } else if (typeof body.team_id === 'number') {
      updated.team_id = body.team_id
    }
  } else if (typeof body.team_id === 'number' && !updated.is_global) {
    updated.team_id = body.team_id
  }

  db.prepare('UPDATE environments SET name = ?, variables = ?, team_id = ?, is_global = ? WHERE id = ?').run(
    updated.name,
    updated.variables,
    updated.team_id,
    updated.is_global,
    env.id
  )
  markDirty(db, 'environment', Number(env.id))

  const fresh = db.prepare('SELECT * FROM environments WHERE id = ?').get(env.id) as Row
  return { status: 200, data: environmentToJson(fresh) }
}

export function deleteEnvironment(db: Database.Database, id: string): Res {
  const env = findEnv(db, id)
  if (!env) return notFound
  deleteWithTombstone(db, 'environment', 'environments', Number(env.id))
  return { status: 200, data: { message: 'Environment deleted successfully' } }
}
