import type Database from 'better-sqlite3'
import { Row, getString, markDirty, nowIso, notTombstonedSql, LOCAL_USER_ID } from './helpers'
import { teamToJson } from './serializers'

// Port dari backend/internal/api/team.go (ListTeams, CreateTeam).
// Akses lokal = single user pemilik semua team, jadi cek membership Go
// (JOIN team_members) tidak relevan — semua team dikembalikan.

export function listTeams(db: Database.Database): { status: number; data: unknown } {
  const rows = db
    .prepare(`SELECT * FROM teams WHERE ${notTombstonedSql('team')} ORDER BY id`)
    .all() as Row[]
  return { status: 200, data: rows.map(teamToJson) }
}

export function createTeam(db: Database.Database, body: Row | null): { status: number; data: unknown } {
  if (!body) {
    return { status: 400, data: { error: 'Invalid request body', code: 'BAD_REQUEST' } }
  }
  const name = getString(body, 'name')
  if (name === '') {
    return { status: 400, data: { error: 'Team name is required', code: 'BAD_REQUEST' } }
  }

  const result = db
    .prepare('INSERT INTO teams (name, description, created_by, created_at) VALUES (?, ?, ?, ?)')
    .run(name, getString(body, 'description'), LOCAL_USER_ID, nowIso())
  const id = Number(result.lastInsertRowid)
  markDirty(db, 'team', id)

  const row = db.prepare('SELECT * FROM teams WHERE id = ?').get(id) as Row
  return { status: 201, data: teamToJson(row) }
}
