import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type Database from 'better-sqlite3'
import { openDb } from '../db'
import { seedIfEmpty } from '../seed'
import { createLocalRouter, isWapboltApiUrl, LocalRouter } from '../router'

// Fase 2 (docs §9): CRUD teams/collections/folders/requests via LocalRouter.
// Perilaku diverifikasi terhadap semantik handler Go (team.go / collection.go /
// folder.go / request.go), bukan asumsi.

const BASE = 'http://localhost:8000'

let db: Database.Database
let router: LocalRouter
let dbPath: string

function call(method: string, urlPath: string, body?: unknown) {
  return router.handle({
    method,
    url: `${BASE}${urlPath}`,
    body: body === undefined ? undefined : JSON.stringify(body)
  })
}

beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `wapbolt-router-test-${Date.now()}-${Math.random()}.db`)
  db = openDb(dbPath)
  seedIfEmpty(db)
  router = createLocalRouter(db)
})

afterEach(() => {
  db.close()
  for (const suffix of ['', '-wal', '-shm']) {
    const file = dbPath + suffix
    if (fs.existsSync(file)) fs.rmSync(file)
  }
})

describe('isWapboltApiUrl', () => {
  it('routes only /api/v1 paths', () => {
    expect(isWapboltApiUrl(`${BASE}/api/v1/teams`)).toBe(true)
    expect(isWapboltApiUrl('https://jsonplaceholder.typicode.com/todos/1')).toBe(false)
    expect(isWapboltApiUrl('not-a-url')).toBe(false)
  })
})

describe('teams', () => {
  it('lists the seeded team as an array', () => {
    const res = call('GET', '/api/v1/teams')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)
    expect(res.data).toMatchObject([{ id: 1, name: 'My Workspace', created_by: 1 }])
  })

  it('creates a team (201) and rejects empty name (400, Go message)', () => {
    const created = call('POST', '/api/v1/teams', { name: 'Tim Baru', description: 'desc' })
    expect(created.status).toBe(201)
    expect(created.data).toMatchObject({ name: 'Tim Baru', description: 'desc', created_by: 1 })

    const rejected = call('POST', '/api/v1/teams', { name: '' })
    expect(rejected.status).toBe(400)
    expect(rejected.data).toMatchObject({ error: 'Team name is required', code: 'BAD_REQUEST' })
  })
})

describe('collections', () => {
  it('full CRUD round-trip', () => {
    const created = call('POST', '/api/v1/teams/1/collections', { name: 'Koleksi A', description: 'd' })
    expect(created.status).toBe(201)
    const col = created.data as { id: number; chaos_mode: boolean }
    expect(col.chaos_mode).toBe(false)

    const list = call('GET', '/api/v1/teams/1/collections')
    expect(list.status).toBe(200)
    expect((list.data as unknown[]).length).toBe(1)

    const detail = call('GET', `/api/v1/collections/${col.id}`)
    expect(detail.status).toBe(200)
    expect(detail.data).toMatchObject({
      collection: { id: col.id, name: 'Koleksi A' },
      folders: [],
      requests: []
    })

    // Semantik update Go: name kosong tidak menimpa, confluence_page_id selalu.
    const updated = call('PUT', `/api/v1/collections/${col.id}`, {
      name: '',
      description: 'baru',
      confluence_page_id: 'PAGE-1'
    })
    expect(updated.data).toMatchObject({ name: 'Koleksi A', description: 'baru', confluence_page_id: 'PAGE-1' })

    const deleted = call('DELETE', `/api/v1/collections/${col.id}`)
    expect(deleted.status).toBe(200)
    expect(deleted.data).toMatchObject({ message: 'Collection deleted successfully' })
    expect((call('GET', '/api/v1/teams/1/collections').data as unknown[]).length).toBe(0)
    expect(call('GET', `/api/v1/collections/${col.id}`).status).toBe(404)
  })
})

describe('folders', () => {
  let colId: number

  beforeEach(() => {
    colId = (call('POST', '/api/v1/teams/1/collections', { name: 'K' }).data as { id: number }).id
  })

  it('creates nested folders and lists all folders of the collection', () => {
    const parent = call('POST', `/api/v1/collections/${colId}/folders`, { name: 'Induk', order_index: 1 })
    expect(parent.status).toBe(201)
    const parentId = (parent.data as { id: number }).id

    const child = call('POST', `/api/v1/collections/${colId}/folders`, {
      name: 'Anak',
      parent_folder_id: parentId
    })
    expect(child.data).toMatchObject({ parent_folder_id: parentId, collection_id: colId })

    const list = call('GET', `/api/v1/collections/${colId}/folders`)
    expect((list.data as unknown[]).length).toBe(2)
  })

  it('update only overwrites name when non-empty (Go semantics)', () => {
    const id = (call('POST', `/api/v1/collections/${colId}/folders`, { name: 'X' }).data as { id: number }).id
    expect(call('PUT', `/api/v1/folders/${id}`, { name: '' }).data).toMatchObject({ name: 'X' })
    expect(call('PUT', `/api/v1/folders/${id}`, { name: 'Y' }).data).toMatchObject({ name: 'Y' })
  })

  it('rejects moving a folder into itself', () => {
    const id = (call('POST', `/api/v1/collections/${colId}/folders`, { name: 'X' }).data as { id: number }).id
    const res = call('PATCH', `/api/v1/folders/${id}/move`, {
      collection_id: colId,
      parent_folder_id: id
    })
    expect(res.status).toBe(400)
    expect(res.data).toMatchObject({ error: 'Cannot move folder into itself' })
  })

  it('moving to another collection cascades collection_id to descendants and their requests', () => {
    const col2 = (call('POST', '/api/v1/teams/1/collections', { name: 'K2' }).data as { id: number }).id
    const parent = (call('POST', `/api/v1/collections/${colId}/folders`, { name: 'P' }).data as { id: number }).id
    const child = (
      call('POST', `/api/v1/collections/${colId}/folders`, { name: 'C', parent_folder_id: parent })
        .data as { id: number }
    ).id
    call('POST', `/api/v1/folders/${child}/requests`, { name: 'R', method: 'GET', url: 'http://x' })

    const moved = call('PATCH', `/api/v1/folders/${parent}/move`, { collection_id: col2, order_index: 0 })
    expect(moved.status).toBe(200)

    const foldersInCol2 = call('GET', `/api/v1/collections/${col2}/folders`).data as unknown[]
    expect(foldersInCol2.length).toBe(2)
    const requestsInCol2 = call('GET', `/api/v1/collections/${col2}/requests`).data as unknown[]
    expect(requestsInCol2.length).toBe(1)
  })

  it('delete cascades to child folders and requests inside', () => {
    const parent = (call('POST', `/api/v1/collections/${colId}/folders`, { name: 'P' }).data as { id: number }).id
    const child = (
      call('POST', `/api/v1/collections/${colId}/folders`, { name: 'C', parent_folder_id: parent })
        .data as { id: number }
    ).id
    const reqId = (
      call('POST', `/api/v1/folders/${child}/requests`, { name: 'R', method: 'GET', url: 'http://x' })
        .data as { id: number }
    ).id

    expect(call('DELETE', `/api/v1/folders/${parent}`).status).toBe(200)
    expect((call('GET', `/api/v1/collections/${colId}/folders`).data as unknown[]).length).toBe(0)
    expect(call('GET', `/api/v1/requests/${reqId}`).status).toBe(404)
  })
})

describe('requests', () => {
  let colId: number

  beforeEach(() => {
    colId = (call('POST', '/api/v1/teams/1/collections', { name: 'K' }).data as { id: number }).id
  })

  it('creates in collection root and lists with examples: []', () => {
    const created = call('POST', `/api/v1/collections/${colId}/requests`, {
      name: 'Req',
      method: 'POST',
      url: 'http://x',
      headers: { 'Content-Type': 'application/json' },
      body: { a: 1 },
      body_type: 'raw-json'
    })
    expect(created.status).toBe(201)
    expect(created.data).toMatchObject({
      name: 'Req',
      folder_id: null,
      headers: { 'Content-Type': 'application/json' },
      body: { a: 1 }
    })

    const list = call('GET', `/api/v1/collections/${colId}/requests`)
    expect(list.status).toBe(200)
    expect((list.data as Array<{ examples: unknown[] }>)[0].examples).toEqual([])
  })

  it('wraps array body as {"array": ...} and string body as {"raw": ...} (toJSONB port)', () => {
    const withArray = call('POST', `/api/v1/collections/${colId}/requests`, {
      name: 'A',
      method: 'POST',
      url: 'http://x',
      body: [{ key: 'k', value: 'v', enabled: true }],
      body_type: 'x-www-form-urlencoded'
    })
    expect((withArray.data as { body: unknown }).body).toEqual({
      array: [{ key: 'k', value: 'v', enabled: true }]
    })

    const withRaw = call('POST', `/api/v1/collections/${colId}/requests`, {
      name: 'B',
      method: 'POST',
      url: 'http://x',
      body: 'plain text'
    })
    expect((withRaw.data as { body: unknown }).body).toEqual({ raw: 'plain text' })
  })

  it('update follows Go field-by-field semantics', () => {
    const id = (
      call('POST', `/api/v1/collections/${colId}/requests`, { name: 'R', method: 'GET', url: 'http://x' })
        .data as { id: number }
    ).id

    const res = call('PUT', `/api/v1/requests/${id}`, {
      name: '', // kosong → tidak menimpa
      method: 'PUT',
      body_type: '', // string kosong → tetap menimpa (semantik Go)
      pre_request_script: 'console.log(1)'
    })
    expect(res.data).toMatchObject({
      name: 'R',
      method: 'PUT',
      body_type: '',
      pre_request_script: 'console.log(1)'
    })
  })

  it('duplicate appends " Copy" and order_index + 1', () => {
    const id = (
      call('POST', `/api/v1/collections/${colId}/requests`, {
        name: 'Asli',
        method: 'GET',
        url: 'http://x',
        order_index: 5
      }).data as { id: number }
    ).id

    const dup = call('POST', `/api/v1/requests/${id}/duplicate`)
    expect(dup.status).toBe(201)
    expect(dup.data).toMatchObject({ name: 'Asli Copy', order_index: 6 })
  })

  it('move relocates request to a folder', () => {
    const folderId = (call('POST', `/api/v1/collections/${colId}/folders`, { name: 'F' }).data as { id: number }).id
    const id = (
      call('POST', `/api/v1/collections/${colId}/requests`, { name: 'R', method: 'GET', url: 'http://x' })
        .data as { id: number }
    ).id

    const res = call('PATCH', `/api/v1/requests/${id}/move`, {
      collection_id: colId,
      folder_id: folderId,
      order_index: 2
    })
    expect(res.data).toMatchObject({ folder_id: folderId, order_index: 2 })
    expect((call('GET', `/api/v1/folders/${folderId}/requests`).data as unknown[]).length).toBe(1)
  })

  it('delete returns Go message and hides the request', () => {
    const id = (
      call('POST', `/api/v1/collections/${colId}/requests`, { name: 'R', method: 'GET', url: 'http://x' })
        .data as { id: number }
    ).id
    expect(call('DELETE', `/api/v1/requests/${id}`).data).toMatchObject({
      message: 'Request deleted successfully'
    })
    expect(call('GET', `/api/v1/requests/${id}`).status).toBe(404)
  })
})

describe('sync bookkeeping (§5.2 aturan 4)', () => {
  it('mutations mark sync_meta dirty', () => {
    call('POST', '/api/v1/teams/1/collections', { name: 'K' })
    const meta = db
      .prepare("SELECT * FROM sync_meta WHERE entity = 'collection' AND dirty = 1")
      .all()
    expect(meta.length).toBe(1)
  })

  it('deleting a synced row writes a tombstone instead of hard delete', () => {
    const colId = (call('POST', '/api/v1/teams/1/collections', { name: 'K' }).data as { id: number }).id
    db.prepare("UPDATE sync_meta SET remote_id = 99 WHERE entity = 'collection' AND local_id = ?").run(colId)

    call('DELETE', `/api/v1/collections/${colId}`)

    // Row domain masih ada (menunggu propagasi sync), tapi tersembunyi dari API.
    const domainRow = db.prepare('SELECT id FROM collections WHERE id = ?').get(colId)
    expect(domainRow).toBeTruthy()
    const meta = db
      .prepare("SELECT deleted_at, dirty FROM sync_meta WHERE entity = 'collection' AND local_id = ?")
      .get(colId) as { deleted_at: string | null; dirty: number }
    expect(meta.deleted_at).toBeTruthy()
    expect(meta.dirty).toBe(1)
    expect((call('GET', '/api/v1/teams/1/collections').data as unknown[]).length).toBe(0)
  })

  it('deleting a never-synced row hard-deletes it', () => {
    const colId = (call('POST', '/api/v1/teams/1/collections', { name: 'K' }).data as { id: number }).id
    call('DELETE', `/api/v1/collections/${colId}`)
    expect(db.prepare('SELECT id FROM collections WHERE id = ?').get(colId)).toBeUndefined()
    expect(
      db.prepare("SELECT * FROM sync_meta WHERE entity = 'collection' AND local_id = ?").get(colId)
    ).toBeUndefined()
  })
})

describe('stubs & fallthrough', () => {
  it('activities stub returns 200 []', () => {
    const res = call('GET', '/api/v1/teams/1/activities')
    expect(res.status).toBe(200)
    expect(res.data).toEqual([])
  })

  it('confluence config stub returns enabled: false', () => {
    expect(call('GET', '/api/v1/confluence/config').data).toEqual({ enabled: false })
  })

  it('unimplemented endpoints return explicit 501', () => {
    expect(call('GET', '/api/v1/history').status).toBe(501)
  })
})
