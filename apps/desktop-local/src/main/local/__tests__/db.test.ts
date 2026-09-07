import { afterEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { openDb } from '../db'
import { seedIfEmpty } from '../seed'

// Fase 1 DoD (docs/local-app-design.md §9): "App boot, DB terbentuk, local
// team muncul". Ditest di sini terhadap db.ts/seed.ts langsung (bukan lewat
// LocalRouter, yang baru masuk di Fase 2) supaya cepat dan tidak butuh Electron.

function tempDbPath(): string {
  return path.join(os.tmpdir(), `wapbolt-local-test-${Date.now()}-${Math.random()}.db`)
}

function cleanupDbFile(dbPath: string): void {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = dbPath + suffix
    if (fs.existsSync(file)) fs.rmSync(file)
  }
}

describe('local db bootstrap', () => {
  let dbPath: string

  afterEach(() => {
    if (dbPath) cleanupDbFile(dbPath)
  })

  it('creates schema and seeds the local team on first run', () => {
    dbPath = tempDbPath()
    const db = openDb(dbPath)
    seedIfEmpty(db)

    const teams = db.prepare('SELECT * FROM teams').all() as Array<Record<string, unknown>>
    expect(teams).toHaveLength(1)
    expect(teams[0]).toMatchObject({ id: 1, name: 'My Workspace', created_by: 1 })

    db.close()
  })

  it('does not duplicate the seed team on repeated seedIfEmpty calls', () => {
    dbPath = tempDbPath()
    const db = openDb(dbPath)
    seedIfEmpty(db)
    seedIfEmpty(db)

    const { count } = db.prepare('SELECT COUNT(*) as count FROM teams').get() as { count: number }
    expect(count).toBe(1)

    db.close()
  })

  it('re-opening the same db file re-applies migrations safely (idempotent)', () => {
    dbPath = tempDbPath()
    const db1 = openDb(dbPath)
    seedIfEmpty(db1)
    db1.close()

    const db2 = openDb(dbPath)
    const teams = db2.prepare('SELECT * FROM teams').all() as unknown[]
    expect(teams).toHaveLength(1)
    db2.close()
  })

  it('creates all domain and sync-infra tables from docs §4', () => {
    dbPath = tempDbPath()
    const db = openDb(dbPath)

    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as Array<{
        name: string
      }>
    ).map((row) => row.name)

    for (const expected of [
      'teams',
      'collections',
      'folders',
      'requests',
      'request_examples',
      'environments',
      'request_history',
      'request_versions',
      'comments',
      'sync_meta',
      'sync_conflicts',
      'sync_state'
    ]) {
      expect(tables).toContain(expected)
    }

    db.close()
  })
})
