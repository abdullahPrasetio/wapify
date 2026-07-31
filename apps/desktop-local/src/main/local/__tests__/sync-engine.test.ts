import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type Database from 'better-sqlite3'
import { openDb } from '../db'
import { seedIfEmpty } from '../seed'
import { createSyncEngine, listConflicts, resolveConflict, HttpFn, HttpResult } from '../sync/engine'
import { createLocalRouter, LocalRouter } from '../router'

// Test SyncEngine (§6.2) dengan server palsu berbasis route-map — tanpa network.
// Skenario matrix §9 Fase 5: lokal saja berubah / server saja / keduanya /
// delete-edit silang.

type Row = Record<string, unknown>

let db: Database.Database
let router: LocalRouter
let dbPath: string

// Server palsu: map "METHOD path" → responder.
let serverRoutes: Record<string, (body?: unknown) => HttpResult>
let serverCalls: string[]

const fakeHttp: HttpFn = async (method, p, body) => {
  const key = `${method} ${p}`
  serverCalls.push(key)
  const responder = serverRoutes[key]
  if (!responder) return { status: 404, data: { error: `no fake route: ${key}` } }
  return responder(body)
}

function localCall(method: string, urlPath: string, body?: unknown) {
  return router.handle({
    method,
    url: `http://localhost:8000${urlPath}`,
    body: body === undefined ? undefined : JSON.stringify(body)
  })
}

const emptyList = (): HttpResult => ({ status: 200, data: [] })

function serverTeam(id: number, name: string): Row {
  return { id, name, description: '', created_by: 9, created_at: '2026-01-01T00:00:00Z' }
}

function serverCollection(id: number, name: string): Row {
  return {
    id,
    name,
    description: '',
    team_id: 7,
    created_by: 9,
    confluence_page_id: '',
    chaos_mode: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  }
}

function serverRequest(id: number, name: string, extra: Row = {}): Row {
  return {
    id,
    name,
    description: '',
    method: 'GET',
    url: 'http://server-api',
    headers: {},
    body: {},
    body_type: 'raw-json',
    body_variants: {},
    auth_config: {},
    field_validations: {},
    collection_id: 55,
    folder_id: null,
    created_by: 9,
    order_index: 0,
    pre_request_script: '',
    post_request_script: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    examples: [],
    ...extra
  }
}

beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `wapbolt-sync-test-${Date.now()}-${Math.random()}.db`)
  db = openDb(dbPath)
  seedIfEmpty(db)
  router = createLocalRouter(db)
  serverCalls = []
  serverRoutes = {
    'GET /api/v1/teams': () => ({ status: 200, data: [serverTeam(7, 'Server Team')] }),
    'GET /api/v1/teams/7/collections': emptyList,
    'GET /api/v1/teams/7/environments': emptyList
  }
})

afterEach(() => {
  db.close()
  for (const suffix of ['', '-wal', '-shm']) {
    const file = dbPath + suffix
    if (fs.existsSync(file)) fs.rmSync(file)
  }
})

describe('pull', () => {
  it('imports server data into fresh local db with independent local ids (§6.4)', async () => {
    serverRoutes['GET /api/v1/teams/7/collections'] = () => ({
      status: 200,
      data: [serverCollection(55, 'API Server')]
    })
    serverRoutes['GET /api/v1/collections/55/folders'] = () => ({
      status: 200,
      data: [
        { id: 21, name: 'Induk', collection_id: 55, parent_folder_id: null, order_index: 1 },
        { id: 22, name: 'Anak', collection_id: 55, parent_folder_id: 21, order_index: 2 }
      ]
    })
    serverRoutes['GET /api/v1/collections/55/requests'] = () => ({
      status: 200,
      data: [
        serverRequest(101, 'Req Root'),
        serverRequest(102, 'Req Dalam Folder', {
          folder_id: 22,
          examples: [
            {
              id: 301,
              request_id: 102,
              name: 'Contoh',
              request_method: 'GET',
              request_url: 'http://server-api',
              request_headers: {},
              request_body: {},
              response_status: 200,
              response_headers: {},
              response_body: 'ok',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z'
            }
          ]
        })
      ]
    })

    const summary = await createSyncEngine(db, fakeHttp).syncNow()
    expect(summary.errors).toEqual([])
    expect(summary.conflicts).toBe(0)
    // 1 team + 1 collection + 2 folder + 2 request + 1 example
    expect(summary.pulled).toBe(7)

    // Renderer melihat data via LocalRouter dengan LOCAL id — seed team id 1
    // tetap ada, team server dapat id lokal baru (2).
    const teams = localCall('GET', '/api/v1/teams').data as Array<{ id: number; name: string }>
    expect(teams.map((t) => t.name)).toEqual(['My Workspace', 'Server Team'])

    const serverTeamLocal = teams.find((t) => t.name === 'Server Team')!
    const cols = localCall('GET', `/api/v1/teams/${serverTeamLocal.id}/collections`).data as Array<{ id: number }>
    expect(cols.length).toBe(1)

    const folders = localCall('GET', `/api/v1/collections/${cols[0].id}/folders`).data as Array<Row>
    expect(folders.length).toBe(2)
    const induk = folders.find((f) => f.name === 'Induk')!
    const anak = folders.find((f) => f.name === 'Anak')!
    expect(anak.parent_folder_id).toBe(induk.id) // FK di-map ke id lokal, bukan remote

    const reqs = localCall('GET', `/api/v1/collections/${cols[0].id}/requests`).data as Array<Row>
    expect(reqs.length).toBe(2)
    const dalamFolder = reqs.find((r) => r.name === 'Req Dalam Folder')!
    expect(dalamFolder.folder_id).toBe(anak.id)
    expect((dalamFolder.examples as Row[]).length).toBe(1)

    // Pull tidak menandai dirty
    const dirty = db.prepare('SELECT COUNT(*) n FROM sync_meta WHERE dirty = 1').get() as { n: number }
    expect(dirty.n).toBe(0)
  })

  it('server-only change updates clean local row; second sync is a no-op', async () => {
    await createSyncEngine(db, fakeHttp).syncNow()
    serverRoutes['GET /api/v1/teams'] = () => ({ status: 200, data: [serverTeam(7, 'Nama Baru')] })

    const s2 = await createSyncEngine(db, fakeHttp).syncNow()
    expect(s2.pulled).toBe(1)
    const teams = localCall('GET', '/api/v1/teams').data as Array<{ name: string }>
    expect(teams.map((t) => t.name)).toContain('Nama Baru')

    const s3 = await createSyncEngine(db, fakeHttp).syncNow()
    expect(s3.pulled).toBe(0)
    expect(s3.pushed).toBe(0)
  })

  it('both sides changed → content conflict, no overwrite either way (§6.3)', async () => {
    await createSyncEngine(db, fakeHttp).syncNow()

    // lokal edit via LocalRouter (menandai dirty)
    const teams = localCall('GET', '/api/v1/teams').data as Array<{ id: number; name: string }>
    const localTeam = teams.find((t) => t.name === 'Server Team')!
    // teams tidak punya endpoint update di LocalRouter — tandai dirty manual via db
    db.prepare('UPDATE teams SET name = ? WHERE id = ?').run('Edit Lokal', localTeam.id)
    db.prepare("UPDATE sync_meta SET dirty = 1 WHERE entity = 'team' AND local_id = ?").run(localTeam.id)

    // server juga berubah
    serverRoutes['GET /api/v1/teams'] = () => ({ status: 200, data: [serverTeam(7, 'Edit Server')] })

    const s = await createSyncEngine(db, fakeHttp).syncNow()
    expect(s.conflicts).toBe(1)

    // tidak ada overwrite: lokal tetap "Edit Lokal", tidak ada PUT ke server
    const after = localCall('GET', '/api/v1/teams').data as Array<{ name: string }>
    expect(after.map((t) => t.name)).toContain('Edit Lokal')
    expect(serverCalls.filter((c) => c.startsWith('PUT'))).toEqual([])

    const pending = listConflicts(db)
    expect(pending.length).toBe(1)
    expect(pending[0]).toMatchObject({ entity: 'team', kind: 'content' })
  })

  it('resolve "remote" applies server snapshot and clears dirty', async () => {
    await createSyncEngine(db, fakeHttp).syncNow()
    const teams = localCall('GET', '/api/v1/teams').data as Array<{ id: number; name: string }>
    const localTeam = teams.find((t) => t.name === 'Server Team')!
    db.prepare('UPDATE teams SET name = ? WHERE id = ?').run('Edit Lokal', localTeam.id)
    db.prepare("UPDATE sync_meta SET dirty = 1 WHERE entity = 'team' AND local_id = ?").run(localTeam.id)
    serverRoutes['GET /api/v1/teams'] = () => ({ status: 200, data: [serverTeam(7, 'Edit Server')] })
    await createSyncEngine(db, fakeHttp).syncNow()

    const conflict = listConflicts(db)[0] as { id: number }
    const res = resolveConflict(db, conflict.id, 'remote')
    expect(res.ok).toBe(true)

    const after = localCall('GET', '/api/v1/teams').data as Array<{ name: string }>
    expect(after.map((t) => t.name)).toContain('Edit Server')
    const meta = db
      .prepare("SELECT dirty FROM sync_meta WHERE entity = 'team' AND local_id = ?")
      .get(localTeam.id) as { dirty: number }
    expect(meta.dirty).toBe(0)
    expect(listConflicts(db).length).toBe(0)
  })

  it('deleted on server + edited locally → delete_edit conflict; remote_id reset for re-POST', async () => {
    serverRoutes['GET /api/v1/teams/7/collections'] = () => ({
      status: 200,
      data: [serverCollection(55, 'API Server')]
    })
    serverRoutes['GET /api/v1/collections/55/folders'] = emptyList
    serverRoutes['GET /api/v1/collections/55/requests'] = emptyList
    await createSyncEngine(db, fakeHttp).syncNow()

    // edit lokal request... pakai collection: edit nama collection via LocalRouter
    const teams = localCall('GET', '/api/v1/teams').data as Array<{ id: number; name: string }>
    const teamLocal = teams.find((t) => t.name === 'Server Team')!
    const cols = localCall('GET', `/api/v1/teams/${teamLocal.id}/collections`).data as Array<{ id: number }>
    localCall('PUT', `/api/v1/collections/${cols[0].id}`, { name: 'Edit Lokal', confluence_page_id: '' })

    // server menghapus collection 55
    serverRoutes['GET /api/v1/teams/7/collections'] = emptyList

    const s = await createSyncEngine(db, fakeHttp).syncNow()
    expect(s.conflicts).toBe(1)
    const pending = listConflicts(db)[0]
    expect(pending).toMatchObject({ entity: 'collection', kind: 'delete_edit' })
    // row lokal masih hidup, siap di-POST ulang kalau user pilih "punya saya"
    const meta = db
      .prepare("SELECT remote_id, dirty FROM sync_meta WHERE entity = 'collection' AND local_id = ?")
      .get(cols[0].id) as { remote_id: number | null; dirty: number }
    expect(meta.remote_id).toBeNull()
    expect(meta.dirty).toBe(1)
  })

  it('deleted on server + clean locally → local row removed', async () => {
    serverRoutes['GET /api/v1/teams/7/collections'] = () => ({
      status: 200,
      data: [serverCollection(55, 'API Server')]
    })
    serverRoutes['GET /api/v1/collections/55/folders'] = emptyList
    serverRoutes['GET /api/v1/collections/55/requests'] = emptyList
    await createSyncEngine(db, fakeHttp).syncNow()

    serverRoutes['GET /api/v1/teams/7/collections'] = emptyList
    await createSyncEngine(db, fakeHttp).syncNow()

    const teams = localCall('GET', '/api/v1/teams').data as Array<{ id: number; name: string }>
    const teamLocal = teams.find((t) => t.name === 'Server Team')!
    const cols = localCall('GET', `/api/v1/teams/${teamLocal.id}/collections`).data as unknown[]
    expect(cols).toEqual([])
  })
})

describe('push', () => {
  it('local-only creation POSTs in dependency order and saves remote ids', async () => {
    await createSyncEngine(db, fakeHttp).syncNow()

    // buat data lokal via LocalRouter di team server (dirty otomatis)
    const teams = localCall('GET', '/api/v1/teams').data as Array<{ id: number; name: string }>
    const teamLocal = teams.find((t) => t.name === 'Server Team')!
    const col = localCall('POST', `/api/v1/teams/${teamLocal.id}/collections`, { name: 'Koleksi Lokal' })
      .data as { id: number }
    const req = localCall('POST', `/api/v1/collections/${col.id}/requests`, {
      name: 'Req Lokal',
      method: 'POST',
      url: 'http://x'
    }).data as { id: number }

    serverRoutes['POST /api/v1/teams/7/collections'] = (body) => ({
      status: 201,
      data: { ...serverCollection(88, (body as Row).name as string) }
    })
    serverRoutes['GET /api/v1/collections/88/folders'] = emptyList
    serverRoutes['GET /api/v1/collections/88/requests'] = emptyList
    serverRoutes['POST /api/v1/collections/88/requests'] = (body) => ({
      status: 201,
      data: serverRequest(202, (body as Row).name as string, { collection_id: 88 })
    })

    const s = await createSyncEngine(db, fakeHttp).syncNow()
    expect(s.errors).toEqual([])
    expect(s.pushed).toBe(2)

    const colMeta = db
      .prepare("SELECT remote_id, dirty FROM sync_meta WHERE entity = 'collection' AND local_id = ?")
      .get(col.id) as { remote_id: number; dirty: number }
    expect(colMeta).toMatchObject({ remote_id: 88, dirty: 0 })
    const reqMeta = db
      .prepare("SELECT remote_id, dirty FROM sync_meta WHERE entity = 'request' AND local_id = ?")
      .get(req.id) as { remote_id: number; dirty: number }
    expect(reqMeta).toMatchObject({ remote_id: 202, dirty: 0 })

    // urutan dependensi: collection dipush sebelum request-nya
    const postCol = serverCalls.indexOf('POST /api/v1/teams/7/collections')
    const postReq = serverCalls.indexOf('POST /api/v1/collections/88/requests')
    expect(postCol).toBeGreaterThanOrEqual(0)
    expect(postReq).toBeGreaterThan(postCol)
  })

  it('local delete of synced row pushes DELETE (tombstone) then cleans up', async () => {
    serverRoutes['GET /api/v1/teams/7/collections'] = () => ({
      status: 200,
      data: [serverCollection(55, 'API Server')]
    })
    serverRoutes['GET /api/v1/collections/55/folders'] = emptyList
    serverRoutes['GET /api/v1/collections/55/requests'] = emptyList
    await createSyncEngine(db, fakeHttp).syncNow()

    const teams = localCall('GET', '/api/v1/teams').data as Array<{ id: number; name: string }>
    const teamLocal = teams.find((t) => t.name === 'Server Team')!
    const cols = localCall('GET', `/api/v1/teams/${teamLocal.id}/collections`).data as Array<{ id: number }>
    localCall('DELETE', `/api/v1/collections/${cols[0].id}`) // tombstone (sudah punya remote_id)

    serverRoutes['GET /api/v1/teams/7/collections'] = () => ({
      status: 200,
      data: [serverCollection(55, 'API Server')] // masih ada di server saat pull
    })
    serverRoutes['DELETE /api/v1/collections/55'] = () => ({ status: 200, data: { message: 'ok' } })

    const s = await createSyncEngine(db, fakeHttp).syncNow()
    expect(serverCalls).toContain('DELETE /api/v1/collections/55')
    expect(s.pushed).toBe(1)
    // row & meta bersih
    expect(db.prepare('SELECT COUNT(*) n FROM collections').get()).toMatchObject({ n: 0 })
    expect(
      db.prepare("SELECT COUNT(*) n FROM sync_meta WHERE entity = 'collection'").get()
    ).toMatchObject({ n: 0 })
  })

  it('interrupted sync resumes without duplicating (idempotent, §6.5)', async () => {
    await createSyncEngine(db, fakeHttp).syncNow()
    const teams = localCall('GET', '/api/v1/teams').data as Array<{ id: number; name: string }>
    const teamLocal = teams.find((t) => t.name === 'Server Team')!
    localCall('POST', `/api/v1/teams/${teamLocal.id}/collections`, { name: 'Koleksi Lokal' })

    // sync pertama: server 503 saat POST → gagal
    serverRoutes['POST /api/v1/teams/7/collections'] = () => ({ status: 503, data: {} })
    const s1 = await createSyncEngine(db, fakeHttp).syncNow()
    expect(s1.errors.length).toBeGreaterThan(0)

    // sync kedua: server pulih → POST sukses persis satu kali
    serverRoutes['POST /api/v1/teams/7/collections'] = (body) => ({
      status: 201,
      data: serverCollection(90, (body as Row).name as string)
    })
    serverRoutes['GET /api/v1/collections/90/folders'] = emptyList
    serverRoutes['GET /api/v1/collections/90/requests'] = emptyList
    serverCalls = []
    const s2 = await createSyncEngine(db, fakeHttp).syncNow()
    expect(s2.pushed).toBe(1)

    // sync ketiga: tidak ada POST lagi
    serverRoutes['GET /api/v1/teams/7/collections'] = () => ({
      status: 200,
      data: [serverCollection(90, 'Koleksi Lokal')]
    })
    serverCalls = []
    const s3 = await createSyncEngine(db, fakeHttp).syncNow()
    expect(s3.pushed).toBe(0)
    expect(serverCalls.filter((c) => c.startsWith('POST'))).toEqual([])
  })
})
