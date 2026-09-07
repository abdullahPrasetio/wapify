import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type Database from 'better-sqlite3'
import { openDb, backupDb } from '../db'
import { seedIfEmpty } from '../seed'
import { createLocalRouter, LocalRouter } from '../router'
import { getPendingLocalOnlySummary, excludePendingLocalOnly } from '../sync/engine'

// §8.2-8.3: deteksi data pra-login belum tersync + consent exclude.
// §10: auto-backup .db.

let db: Database.Database
let router: LocalRouter
let dbPath: string

function localCall(method: string, urlPath: string, body?: unknown) {
  return router.handle({
    method,
    url: `http://localhost:8000${urlPath}`,
    body: body === undefined ? undefined : JSON.stringify(body)
  })
}

let testDir: string

beforeEach(() => {
  // Direktori unik per test — backupDb menaruh salinan di
  // <dirname(dbPath)>/backups, dan nama foldernya literal "backups" (bukan
  // per-dbPath), jadi harus diisolasi per test lewat direktori induknya.
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wapbolt-consent-test-'))
  dbPath = path.join(testDir, 'db.sqlite')
  db = openDb(dbPath)
  seedIfEmpty(db)
  router = createLocalRouter(db)
})

afterEach(() => {
  db.close()
  fs.rmSync(testDir, { recursive: true, force: true })
})

describe('pending local-only detection (§8.2)', () => {
  it('seed team is dirty by default — detected as pending pra-login data', () => {
    const pending = getPendingLocalOnlySummary(db)
    expect(pending).toEqual([{ entity: 'team', count: 1 }])
  })

  it('content created offline (before any login) adds to the summary', () => {
    localCall('POST', '/api/v1/teams/1/collections', { name: 'Koleksi Offline' })

    const pending = getPendingLocalOnlySummary(db)
    const byEntity = Object.fromEntries(pending.map((p) => [p.entity, p.count]))
    expect(byEntity.team).toBe(1)
    expect(byEntity.collection).toBe(1)
  })

  it('excludePendingLocalOnly clears the summary and is permanent (not re-flagged by mere pull)', () => {
    localCall('POST', '/api/v1/teams/1/collections', { name: 'Koleksi Offline' })
    expect(getPendingLocalOnlySummary(db).length).toBeGreaterThan(0)

    excludePendingLocalOnly(db)
    expect(getPendingLocalOnlySummary(db)).toEqual([])

    // Baris masih dirty=1 (belum berubah statusnya), tapi excluded — tidak
    // muncul lagi di summary walau masih "secara teknis" belum tersync.
    const stillDirty = db
      .prepare("SELECT dirty, excluded_from_sync FROM sync_meta WHERE entity = 'team' AND local_id = 1")
      .get() as { dirty: number; excluded_from_sync: number }
    expect(stillDirty).toEqual({ dirty: 1, excluded_from_sync: 1 })
  })

  it('rows created AFTER exclusion are new dirty+unexcluded rows — do reappear in summary', () => {
    excludePendingLocalOnly(db)
    expect(getPendingLocalOnlySummary(db)).toEqual([])

    localCall('POST', '/api/v1/teams/1/collections', { name: 'Dibuat setelah consent' })

    const pending = getPendingLocalOnlySummary(db)
    expect(pending.find((p) => p.entity === 'collection')).toMatchObject({ count: 1 })
  })
})

describe('auto-backup .db (§10)', () => {
  function backupDir(): string {
    return path.join(path.dirname(dbPath), 'backups')
  }

  it('does nothing on a brand new db path (nothing to back up yet)', () => {
    const freshDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wapbolt-fresh-'))
    const freshPath = path.join(freshDir, 'db.sqlite')
    const freshDb = openDb(freshPath) // openDb skips backup — file belum ada sebelum dibuka
    try {
      expect(fs.existsSync(path.join(freshDir, 'backups'))).toBe(false)
    } finally {
      freshDb.close()
      fs.rmSync(freshDir, { recursive: true, force: true })
    }
  })

  it('creates a timestamped copy of an existing db file', () => {
    backupDb(db, dbPath)
    expect(fs.existsSync(backupDir())).toBe(true)
    const files = fs.readdirSync(backupDir())
    expect(files.length).toBe(1)
    expect(files[0]).toContain(path.basename(dbPath))
  })

  it('keeps only the 5 most recent backups', () => {
    for (let i = 0; i < 7; i++) {
      backupDb(db, dbPath)
    }
    const files = fs.readdirSync(backupDir())
    expect(files.length).toBe(5)
  })
})
