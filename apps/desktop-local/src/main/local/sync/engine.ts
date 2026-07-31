import type Database from 'better-sqlite3'
import { contentHash, syncedFields, SyncEntityName } from './hash'
import { setLastFullSyncAt } from './session'

// SyncEngine — docs/local-app-design.md §6. Urutan satu klik "Sync Now":
// PRE-FLIGHT → PULL (server menang utk row bersih; konflik kalau dua sisi
// berubah) → PUSH (tombstone dulu, lalu dirty POST/PUT) → FINALIZE.
// Semua deteksi konflik 3-way via base_hash; id lokal vs remote dua ruang
// penomoran terpisah, di-map hanya lewat sync_meta (§6.4).
//
// HTTP di-inject supaya engine bisa dites tanpa server sungguhan; caller
// (ipc.ts) membungkus axios + access token.

export interface HttpResult {
  status: number
  data: unknown
}

export type HttpFn = (method: string, path: string, body?: unknown) => Promise<HttpResult>

export interface SyncSummary {
  pulled: number
  pushed: number
  conflicts: number
  errors: string[]
}

type Row = Record<string, unknown>

interface MetaRow {
  entity: string
  local_id: number
  remote_id: number | null
  dirty: number
  deleted_at: string | null
  base_hash: string | null
}

const JSON_COLUMNS: Record<string, string[]> = {
  request: ['headers', 'body', 'body_variants', 'auth_config', 'field_validations'],
  environment: ['variables'],
  example: ['request_headers', 'request_body', 'response_headers']
}

const TABLE: Record<SyncEntityName, string> = {
  team: 'teams',
  collection: 'collections',
  folder: 'folders',
  request: 'requests',
  environment: 'environments',
  example: 'request_examples'
}

export function createSyncEngine(db: Database.Database, http: HttpFn) {
  const summary: SyncSummary = { pulled: 0, pushed: 0, conflicts: 0, errors: [] }

  // ─── sync_meta helpers ────────────────────────────────────────────────────

  function metaByRemote(entity: SyncEntityName, remoteId: number): MetaRow | undefined {
    return db
      .prepare('SELECT * FROM sync_meta WHERE entity = ? AND remote_id = ?')
      .get(entity, remoteId) as MetaRow | undefined
  }

  function metaByLocal(entity: SyncEntityName, localId: number): MetaRow | undefined {
    return db
      .prepare('SELECT * FROM sync_meta WHERE entity = ? AND local_id = ?')
      .get(entity, localId) as MetaRow | undefined
  }

  function upsertMeta(
    entity: SyncEntityName,
    localId: number,
    patch: { remote_id?: number | null; dirty?: number; base_hash?: string | null; deleted_at?: string | null }
  ): void {
    const existing = metaByLocal(entity, localId)
    if (!existing) {
      db.prepare(
        `INSERT INTO sync_meta (entity, local_id, remote_id, dirty, deleted_at, base_hash, last_synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        entity,
        localId,
        patch.remote_id ?? null,
        patch.dirty ?? 0,
        patch.deleted_at ?? null,
        patch.base_hash ?? null,
        new Date().toISOString()
      )
      return
    }
    db.prepare(
      `UPDATE sync_meta SET
         remote_id = ?, dirty = ?, deleted_at = ?, base_hash = ?, last_synced_at = ?
       WHERE entity = ? AND local_id = ?`
    ).run(
      patch.remote_id !== undefined ? patch.remote_id : existing.remote_id,
      patch.dirty !== undefined ? patch.dirty : existing.dirty,
      patch.deleted_at !== undefined ? patch.deleted_at : existing.deleted_at,
      patch.base_hash !== undefined ? patch.base_hash : existing.base_hash,
      new Date().toISOString(),
      entity,
      localId
    )
  }

  function localIdForRemote(entity: SyncEntityName, remoteId: number | null | undefined): number | null {
    if (remoteId === null || remoteId === undefined) return null
    return metaByRemote(entity, remoteId)?.local_id ?? null
  }

  function remoteIdForLocal(entity: SyncEntityName, localId: number | null | undefined): number | null {
    if (localId === null || localId === undefined) return null
    return metaByLocal(entity, localId)?.remote_id ?? null
  }

  // ─── conflicts ────────────────────────────────────────────────────────────

  function recordConflict(
    entity: SyncEntityName,
    kind: 'content' | 'delete_edit',
    localId: number,
    remoteId: number | null,
    localSnapshot: unknown,
    remoteSnapshot: unknown
  ): void {
    // Satu konflik pending per row — yang lama (belum resolved) diganti snapshot terbaru.
    db.prepare(
      'DELETE FROM sync_conflicts WHERE entity = ? AND local_id = ? AND resolved_at IS NULL'
    ).run(entity, localId)
    db.prepare(
      `INSERT INTO sync_conflicts (entity, kind, local_id, remote_id, local_snapshot, remote_snapshot, detected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      entity,
      kind,
      localId,
      remoteId,
      JSON.stringify(localSnapshot ?? null),
      JSON.stringify(remoteSnapshot ?? null),
      new Date().toISOString()
    )
    summary.conflicts += 1
  }

  function hasPendingConflict(entity: SyncEntityName, localId: number): boolean {
    return !!db
      .prepare('SELECT id FROM sync_conflicts WHERE entity = ? AND local_id = ? AND resolved_at IS NULL')
      .get(entity, localId)
  }

  // ─── row helpers ──────────────────────────────────────────────────────────

  function localRow(entity: SyncEntityName, localId: number): Row | undefined {
    return db.prepare(`SELECT * FROM ${TABLE[entity]} WHERE id = ?`).get(localId) as Row | undefined
  }

  // Row lokal disimpan dengan kolom JSON sebagai string — parse dulu supaya
  // sebanding dengan row server (object) saat hashing/snapshot.
  function parseLocal(entity: SyncEntityName, row: Row): Row {
    const parsed = { ...row }
    for (const col of JSON_COLUMNS[entity] ?? []) {
      if (typeof parsed[col] === 'string') {
        try {
          parsed[col] = JSON.parse(parsed[col] as string)
        } catch {
          /* biarkan string */
        }
      }
    }
    return parsed
  }

  function serverHash(entity: SyncEntityName, serverRow: Row): string {
    return contentHash(syncedFields(entity, serverRow))
  }

  // ─── PULL (§6.2 langkah 2) ────────────────────────────────────────────────

  // Terapkan satu row server ke lokal. insertFn/updateFn spesifik entity
  // (mapping FK remote→local terjadi di sana).
  function applyServerRow(
    entity: SyncEntityName,
    serverRow: Row,
    insertFn: (srv: Row) => number,
    updateFn: (localId: number, srv: Row) => void
  ): void {
    const remoteId = Number(serverRow.id)
    const srvHash = serverHash(entity, serverRow)
    const meta = metaByRemote(entity, remoteId)

    if (!meta) {
      // (a) baru dari server → INSERT lokal + meta
      const localId = insertFn(serverRow)
      upsertMeta(entity, localId, { remote_id: remoteId, dirty: 0, base_hash: srvHash })
      summary.pulled += 1
      return
    }

    if (meta.deleted_at) {
      // Lokal sudah dihapus (tombstone). Server tidak berubah sejak base →
      // biarkan, tombstone dipush nanti. Server BERUBAH → konflik delete-edit.
      if (srvHash !== meta.base_hash) {
        recordConflict(entity, 'delete_edit', meta.local_id, remoteId, null, serverRow)
      }
      return
    }

    if (!meta.dirty) {
      // (b) lokal bersih → server menang
      if (srvHash !== meta.base_hash) {
        updateFn(meta.local_id, serverRow)
        upsertMeta(entity, meta.local_id, { base_hash: srvHash })
        summary.pulled += 1
      }
      return
    }

    // (c) lokal dirty
    if (srvHash === meta.base_hash) return // server tidak berubah; nanti dipush

    const local = localRow(entity, meta.local_id)
    recordConflict(
      entity,
      'content',
      meta.local_id,
      remoteId,
      local ? parseLocal(entity, local) : null,
      serverRow
    )
  }

  // Row yang pernah sync tapi hilang dari server (§6.2 akhir langkah 2).
  function handleServerMissing(
    entity: SyncEntityName,
    scopedLocalIds: number[],
    seenRemoteIds: Set<number>,
    hardDeleteFn: (localId: number) => void
  ): void {
    for (const localId of scopedLocalIds) {
      const meta = metaByLocal(entity, localId)
      if (!meta || meta.remote_id === null || seenRemoteIds.has(meta.remote_id)) continue
      if (meta.deleted_at) {
        // dua sisi sama-sama menghapus → selesai, bersihkan
        hardDeleteFn(localId)
        db.prepare('DELETE FROM sync_meta WHERE entity = ? AND local_id = ?').run(entity, localId)
        continue
      }
      if (!meta.dirty) {
        hardDeleteFn(localId)
        db.prepare('DELETE FROM sync_meta WHERE entity = ? AND local_id = ?').run(entity, localId)
        summary.pulled += 1
      } else {
        const local = localRow(entity, localId)
        recordConflict(entity, 'delete_edit', localId, meta.remote_id, local ? parseLocal(entity, local) : null, null)
        // remote hilang → kalau user pilih "punya saya", harus di-POST ulang
        upsertMeta(entity, localId, { remote_id: null })
      }
    }
  }

  async function fetchList(path: string): Promise<Row[] | null> {
    const res = await http('GET', path)
    if (res.status !== 200 || !Array.isArray(res.data)) {
      summary.errors.push(`GET ${path} → ${res.status}`)
      return null
    }
    return res.data as Row[]
  }

  async function pull(): Promise<void> {
    // teams
    const teams = await fetchList('/api/v1/teams')
    if (teams === null) return

    for (const srv of teams) {
      applyServerRow(
        'team',
        srv,
        (s) =>
          Number(
            db
              .prepare('INSERT INTO teams (name, description, created_by, created_at) VALUES (?, ?, ?, ?)')
              .run(s.name, s.description ?? '', s.created_by ?? null, s.created_at).lastInsertRowid
          ),
        (localId, s) =>
          db.prepare('UPDATE teams SET name = ?, description = ? WHERE id = ?').run(s.name, s.description ?? '', localId)
      )
    }
    handleServerMissing(
      'team',
      (db.prepare('SELECT id FROM teams').all() as Array<{ id: number }>).map((r) => r.id),
      new Set(teams.map((t) => Number(t.id))),
      (localId) => cascadeHardDeleteTeam(localId)
    )

    // per team yang ter-map: collections + environments
    const mappedTeams = db
      .prepare("SELECT local_id, remote_id FROM sync_meta WHERE entity = 'team' AND remote_id IS NOT NULL AND deleted_at IS NULL")
      .all() as Array<{ local_id: number; remote_id: number }>

    for (const team of mappedTeams) {
      await pullCollections(team.local_id, team.remote_id)
      await pullEnvironments(team.local_id, team.remote_id)
    }

    setLastFullSyncAt(db, new Date().toISOString())
  }

  async function pullCollections(localTeamId: number, remoteTeamId: number): Promise<void> {
    const cols = await fetchList(`/api/v1/teams/${remoteTeamId}/collections`)
    if (cols === null) return

    for (const srv of cols) {
      applyServerRow(
        'collection',
        srv,
        (s) =>
          Number(
            db
              .prepare(
                `INSERT INTO collections (name, description, team_id, created_by, confluence_page_id, chaos_mode, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
              )
              .run(
                s.name,
                s.description ?? '',
                localTeamId,
                s.created_by ?? null,
                s.confluence_page_id ?? '',
                s.chaos_mode ? 1 : 0,
                s.created_at,
                s.updated_at
              ).lastInsertRowid
          ),
        (localId, s) =>
          db
            .prepare(
              'UPDATE collections SET name = ?, description = ?, confluence_page_id = ?, chaos_mode = ?, updated_at = ? WHERE id = ?'
            )
            .run(s.name, s.description ?? '', s.confluence_page_id ?? '', s.chaos_mode ? 1 : 0, s.updated_at, localId)
      )
    }

    handleServerMissing(
      'collection',
      (db.prepare('SELECT id FROM collections WHERE team_id = ?').all(localTeamId) as Array<{ id: number }>).map(
        (r) => r.id
      ),
      new Set(cols.map((c) => Number(c.id))),
      (localId) => cascadeHardDeleteCollection(localId)
    )

    const mappedCols = db
      .prepare(
        `SELECT m.local_id, m.remote_id FROM sync_meta m
         JOIN collections c ON c.id = m.local_id
         WHERE m.entity = 'collection' AND m.remote_id IS NOT NULL AND m.deleted_at IS NULL AND c.team_id = ?`
      )
      .all(localTeamId) as Array<{ local_id: number; remote_id: number }>

    for (const col of mappedCols) {
      await pullFolders(col.local_id, col.remote_id)
      await pullRequests(col.local_id, col.remote_id)
    }
  }

  async function pullFolders(localColId: number, remoteColId: number): Promise<void> {
    const folders = await fetchList(`/api/v1/collections/${remoteColId}/folders`)
    if (folders === null) return

    // Induk harus ter-map sebelum anak — proses berulang sampai tidak ada progres.
    const pending = [...folders]
    let progressed = true
    while (pending.length > 0 && progressed) {
      progressed = false
      for (let i = pending.length - 1; i >= 0; i--) {
        const srv = pending[i]
        const remoteParent = srv.parent_folder_id as number | null
        const localParent = remoteParent === null ? null : localIdForRemote('folder', remoteParent)
        if (remoteParent !== null && localParent === null && !metaByRemote('folder', remoteParent)) {
          continue // induk belum diproses — coba lagi putaran berikutnya
        }
        applyServerRow(
          'folder',
          srv,
          (s) =>
            Number(
              db
                .prepare(
                  'INSERT INTO folders (name, collection_id, parent_folder_id, order_index) VALUES (?, ?, ?, ?)'
                )
                .run(s.name, localColId, localParent, s.order_index ?? 0).lastInsertRowid
            ),
          (localId, s) =>
            db
              .prepare('UPDATE folders SET name = ?, parent_folder_id = ?, order_index = ? WHERE id = ?')
              .run(s.name, localParent, s.order_index ?? 0, localId)
        )
        pending.splice(i, 1)
        progressed = true
      }
    }
    if (pending.length > 0) {
      summary.errors.push(`collection ${remoteColId}: ${pending.length} folder dilewati (induk tidak ter-map)`)
    }

    handleServerMissing(
      'folder',
      (db.prepare('SELECT id FROM folders WHERE collection_id = ?').all(localColId) as Array<{ id: number }>).map(
        (r) => r.id
      ),
      new Set(folders.map((f) => Number(f.id))),
      (localId) => {
        db.prepare('DELETE FROM requests WHERE folder_id = ?').run(localId)
        db.prepare('DELETE FROM folders WHERE id = ?').run(localId)
      }
    )
  }

  async function pullRequests(localColId: number, remoteColId: number): Promise<void> {
    const requests = await fetchList(`/api/v1/collections/${remoteColId}/requests`)
    if (requests === null) return

    for (const srv of requests) {
      const localFolder =
        srv.folder_id === null || srv.folder_id === undefined
          ? null
          : localIdForRemote('folder', Number(srv.folder_id))

      applyServerRow(
        'request',
        srv,
        (s) =>
          Number(
            db
              .prepare(
                `INSERT INTO requests
                   (name, description, method, url, headers, body, body_type, body_variants, auth_config,
                    field_validations, collection_id, folder_id, created_by, order_index,
                    pre_request_script, post_request_script, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
              )
              .run(
                s.name,
                s.description ?? '',
                s.method,
                s.url,
                JSON.stringify(s.headers ?? {}),
                JSON.stringify(s.body ?? {}),
                s.body_type ?? 'raw-json',
                JSON.stringify(s.body_variants ?? {}),
                JSON.stringify(s.auth_config ?? {}),
                JSON.stringify(s.field_validations ?? {}),
                localColId,
                localFolder,
                s.created_by ?? null,
                s.order_index ?? 0,
                s.pre_request_script ?? '',
                s.post_request_script ?? '',
                s.created_at,
                s.updated_at
              ).lastInsertRowid
          ),
        (localId, s) =>
          db
            .prepare(
              `UPDATE requests SET
                 name = ?, description = ?, method = ?, url = ?, headers = ?, body = ?, body_type = ?,
                 body_variants = ?, auth_config = ?, field_validations = ?, folder_id = ?, order_index = ?,
                 pre_request_script = ?, post_request_script = ?, updated_at = ?
               WHERE id = ?`
            )
            .run(
              s.name,
              s.description ?? '',
              s.method,
              s.url,
              JSON.stringify(s.headers ?? {}),
              JSON.stringify(s.body ?? {}),
              s.body_type ?? 'raw-json',
              JSON.stringify(s.body_variants ?? {}),
              JSON.stringify(s.auth_config ?? {}),
              JSON.stringify(s.field_validations ?? {}),
              localFolder,
              s.order_index ?? 0,
              s.pre_request_script ?? '',
              s.post_request_script ?? '',
              s.updated_at,
              localId
            )
      )

      // examples ikut ter-preload di response list requests
      const localReqId = localIdForRemote('request', Number(srv.id))
      if (localReqId !== null && Array.isArray(srv.examples)) {
        pullExamplesForRequest(localReqId, srv.examples as Row[])
      }
    }

    handleServerMissing(
      'request',
      (db.prepare('SELECT id FROM requests WHERE collection_id = ?').all(localColId) as Array<{ id: number }>).map(
        (r) => r.id
      ),
      new Set(requests.map((r) => Number(r.id))),
      (localId) => db.prepare('DELETE FROM requests WHERE id = ?').run(localId)
    )
  }

  function pullExamplesForRequest(localReqId: number, serverExamples: Row[]): void {
    for (const srv of serverExamples) {
      applyServerRow(
        'example',
        srv,
        (s) =>
          Number(
            db
              .prepare(
                `INSERT INTO request_examples
                   (request_id, name, request_method, request_url, request_headers, request_body,
                    response_status, response_headers, response_body, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
              )
              .run(
                localReqId,
                s.name,
                s.request_method,
                s.request_url,
                JSON.stringify(s.request_headers ?? {}),
                JSON.stringify(s.request_body ?? {}),
                s.response_status ?? 0,
                JSON.stringify(s.response_headers ?? {}),
                s.response_body ?? '',
                s.created_at,
                s.updated_at
              ).lastInsertRowid
          ),
        (localId, s) =>
          db
            .prepare(
              `UPDATE request_examples SET
                 name = ?, request_method = ?, request_url = ?, request_headers = ?, request_body = ?,
                 response_status = ?, response_headers = ?, response_body = ?, updated_at = ?
               WHERE id = ?`
            )
            .run(
              s.name,
              s.request_method,
              s.request_url,
              JSON.stringify(s.request_headers ?? {}),
              JSON.stringify(s.request_body ?? {}),
              s.response_status ?? 0,
              JSON.stringify(s.response_headers ?? {}),
              s.response_body ?? '',
              s.updated_at,
              localId
            )
      )
    }

    handleServerMissing(
      'example',
      (
        db.prepare('SELECT id FROM request_examples WHERE request_id = ?').all(localReqId) as Array<{ id: number }>
      ).map((r) => r.id),
      new Set(serverExamples.map((e) => Number(e.id))),
      (localId) => db.prepare('DELETE FROM request_examples WHERE id = ?').run(localId)
    )
  }

  async function pullEnvironments(localTeamId: number, remoteTeamId: number): Promise<void> {
    const envs = await fetchList(`/api/v1/teams/${remoteTeamId}/environments`)
    if (envs === null) return

    // Env global lintas-team = keputusan terbuka §11.2 → local-only, tidak disync.
    const teamEnvs = envs.filter((e) => !e.is_global)

    for (const srv of teamEnvs) {
      applyServerRow(
        'environment',
        srv,
        (s) =>
          Number(
            db
              .prepare(
                'INSERT INTO environments (name, variables, team_id, is_global, created_at) VALUES (?, ?, ?, 0, ?)'
              )
              .run(s.name, JSON.stringify(s.variables ?? {}), localTeamId, s.created_at).lastInsertRowid
          ),
        (localId, s) =>
          db
            .prepare('UPDATE environments SET name = ?, variables = ? WHERE id = ?')
            .run(s.name, JSON.stringify(s.variables ?? {}), localId)
      )
    }

    handleServerMissing(
      'environment',
      (
        db.prepare('SELECT id FROM environments WHERE team_id = ? AND is_global = 0').all(localTeamId) as Array<{
          id: number
        }>
      ).map((r) => r.id),
      new Set(teamEnvs.map((e) => Number(e.id))),
      (localId) => db.prepare('DELETE FROM environments WHERE id = ?').run(localId)
    )
  }

  // Cascade hard delete lokal (server sudah menghapus; mirror cascade FK server).
  function cascadeHardDeleteCollection(localColId: number): void {
    const reqs = db.prepare('SELECT id FROM requests WHERE collection_id = ?').all(localColId) as Array<{ id: number }>
    for (const r of reqs) {
      db.prepare("DELETE FROM sync_meta WHERE entity = 'request' AND local_id = ?").run(r.id)
    }
    db.prepare('DELETE FROM requests WHERE collection_id = ?').run(localColId)
    const folders = db.prepare('SELECT id FROM folders WHERE collection_id = ?').all(localColId) as Array<{
      id: number
    }>
    for (const f of folders) {
      db.prepare("DELETE FROM sync_meta WHERE entity = 'folder' AND local_id = ?").run(f.id)
    }
    db.prepare('DELETE FROM folders WHERE collection_id = ?').run(localColId)
    db.prepare('DELETE FROM collections WHERE id = ?').run(localColId)
  }

  function cascadeHardDeleteTeam(localTeamId: number): void {
    const cols = db.prepare('SELECT id FROM collections WHERE team_id = ?').all(localTeamId) as Array<{ id: number }>
    for (const c of cols) {
      db.prepare("DELETE FROM sync_meta WHERE entity = 'collection' AND local_id = ?").run(c.id)
      cascadeHardDeleteCollection(c.id)
    }
    db.prepare("DELETE FROM sync_meta WHERE entity = 'environment' AND local_id IN (SELECT id FROM environments WHERE team_id = ?)").run(localTeamId)
    db.prepare('DELETE FROM environments WHERE team_id = ?').run(localTeamId)
    db.prepare('DELETE FROM teams WHERE id = ?').run(localTeamId)
  }

  // ─── PUSH (§6.2 langkah 3) ────────────────────────────────────────────────

  async function pushTombstones(): Promise<void> {
    // Anak dulu baru induk supaya tidak menghapus parent yang masih dirujuk.
    const order: SyncEntityName[] = ['example', 'request', 'folder', 'collection', 'environment', 'team']
    const deletePath: Record<SyncEntityName, (remoteId: number) => string> = {
      example: (id) => `/api/v1/examples/${id}`,
      request: (id) => `/api/v1/requests/${id}`,
      folder: (id) => `/api/v1/folders/${id}`,
      collection: (id) => `/api/v1/collections/${id}`,
      environment: (id) => `/api/v1/environments/${id}`,
      team: (id) => `/api/v1/teams/${id}`
    }

    for (const entity of order) {
      const tombstones = db
        .prepare('SELECT * FROM sync_meta WHERE entity = ? AND deleted_at IS NOT NULL')
        .all(entity) as MetaRow[]
      for (const meta of tombstones) {
        if (hasPendingConflict(entity, meta.local_id)) continue
        if (meta.remote_id === null) {
          // tidak pernah ada di server — cukup bersihkan
          db.prepare(`DELETE FROM ${TABLE[entity]} WHERE id = ?`).run(meta.local_id)
          db.prepare('DELETE FROM sync_meta WHERE entity = ? AND local_id = ?').run(entity, meta.local_id)
          continue
        }
        const res = await http('DELETE', deletePath[entity](meta.remote_id))
        // 404 = sudah tidak ada di server → sama saja sukses
        if (res.status === 200 || res.status === 204 || res.status === 404) {
          db.prepare(`DELETE FROM ${TABLE[entity]} WHERE id = ?`).run(meta.local_id)
          db.prepare('DELETE FROM sync_meta WHERE entity = ? AND local_id = ?').run(entity, meta.local_id)
          summary.pushed += 1
        } else {
          summary.errors.push(`DELETE ${entity} remote ${meta.remote_id} → ${res.status}`)
        }
      }
    }
  }

  // Terapkan hasil POST/PUT server: simpan remote_id + base_hash baru, dirty=0.
  function markPushed(entity: SyncEntityName, localId: number, serverRow: Row): void {
    upsertMeta(entity, localId, {
      remote_id: Number(serverRow.id),
      dirty: 0,
      base_hash: serverHash(entity, serverRow)
    })
    summary.pushed += 1
  }

  async function pushEntity(
    entity: SyncEntityName,
    createReq: (local: Row) => { path: string; body: Row } | null,
    updateReq: (local: Row, remoteId: number) => Array<{ method: string; path: string; body: Row }>
  ): Promise<void> {
    const dirtyRows = db
      .prepare('SELECT * FROM sync_meta WHERE entity = ? AND dirty = 1 AND deleted_at IS NULL')
      .all(entity) as MetaRow[]

    for (const meta of dirtyRows) {
      if (hasPendingConflict(entity, meta.local_id)) continue
      const raw = localRow(entity, meta.local_id)
      if (!raw) continue
      const local = parseLocal(entity, raw)

      if (meta.remote_id === null) {
        const req = createReq(local)
        if (!req) {
          summary.errors.push(`${entity} ${meta.local_id}: parent belum punya remote_id — dilewati`)
          continue
        }
        const res = await http('POST', req.path, req.body)
        if (res.status === 201 && res.data && typeof res.data === 'object') {
          markPushed(entity, meta.local_id, res.data as Row)
        } else {
          summary.errors.push(`POST ${req.path} → ${res.status}`)
        }
      } else {
        const calls = updateReq(local, meta.remote_id)
        let ok = true
        let lastRow: Row | null = null
        for (const call of calls) {
          const res = await http(call.method, call.path, call.body)
          if (res.status !== 200) {
            ok = false
            summary.errors.push(`${call.method} ${call.path} → ${res.status}`)
            break
          }
          if (res.data && typeof res.data === 'object') lastRow = res.data as Row
        }
        if (ok && lastRow) markPushed(entity, meta.local_id, lastRow)
      }
    }
  }

  async function push(): Promise<void> {
    await pushTombstones()

    await pushEntity(
      'team',
      (local) => ({ path: '/api/v1/teams', body: { name: local.name, description: local.description } }),
      (local, remoteId) => [
        { method: 'PUT', path: `/api/v1/teams/${remoteId}`, body: { name: local.name, description: local.description } }
      ]
    )

    await pushEntity(
      'collection',
      (local) => {
        const remoteTeam = remoteIdForLocal('team', Number(local.team_id))
        if (remoteTeam === null) return null
        return {
          path: `/api/v1/teams/${remoteTeam}/collections`,
          body: {
            name: local.name,
            description: local.description,
            confluence_page_id: local.confluence_page_id
          } as Row
        }
      },
      (local, remoteId) => [
        {
          method: 'PUT',
          path: `/api/v1/collections/${remoteId}`,
          body: {
            name: local.name,
            description: local.description,
            confluence_page_id: local.confluence_page_id
          } as Row
        }
      ]
    )

    await pushEntity(
      'folder',
      (local) => {
        const remoteCol = remoteIdForLocal('collection', Number(local.collection_id))
        if (remoteCol === null) return null
        const remoteParent =
          local.parent_folder_id === null ? null : remoteIdForLocal('folder', Number(local.parent_folder_id))
        if (local.parent_folder_id !== null && remoteParent === null) return null
        return {
          path: `/api/v1/collections/${remoteCol}/folders`,
          body: { name: local.name, parent_folder_id: remoteParent, order_index: local.order_index } as Row
        }
      },
      (local, remoteId) => {
        const remoteCol = remoteIdForLocal('collection', Number(local.collection_id))
        const remoteParent =
          local.parent_folder_id === null ? null : remoteIdForLocal('folder', Number(local.parent_folder_id))
        const calls: Array<{ method: string; path: string; body: Row }> = [
          { method: 'PUT', path: `/api/v1/folders/${remoteId}`, body: { name: local.name } }
        ]
        if (remoteCol !== null) {
          calls.push({
            method: 'PATCH',
            path: `/api/v1/folders/${remoteId}/move`,
            body: { collection_id: remoteCol, parent_folder_id: remoteParent, order_index: local.order_index } as Row
          })
        }
        return calls
      }
    )

    const requestBody = (local: Row): Row => ({
      name: local.name,
      description: local.description,
      method: local.method,
      url: local.url,
      headers: local.headers,
      body: local.body,
      body_type: local.body_type,
      body_variants: local.body_variants,
      auth_config: local.auth_config,
      field_validations: local.field_validations,
      order_index: local.order_index,
      pre_request_script: local.pre_request_script,
      post_request_script: local.post_request_script
    })

    await pushEntity(
      'request',
      (local) => {
        const remoteCol = remoteIdForLocal('collection', Number(local.collection_id))
        if (remoteCol === null) return null
        const remoteFolder =
          local.folder_id === null ? null : remoteIdForLocal('folder', Number(local.folder_id))
        if (local.folder_id !== null && remoteFolder === null) return null
        return {
          path: `/api/v1/collections/${remoteCol}/requests`,
          body: { ...requestBody(local), folder_id: remoteFolder } as Row
        }
      },
      (local, remoteId) => {
        const remoteCol = remoteIdForLocal('collection', Number(local.collection_id))
        const remoteFolder = local.folder_id === null ? null : remoteIdForLocal('folder', Number(local.folder_id))
        const calls: Array<{ method: string; path: string; body: Row }> = [
          { method: 'PUT', path: `/api/v1/requests/${remoteId}`, body: requestBody(local) }
        ]
        if (remoteCol !== null) {
          calls.push({
            method: 'PATCH',
            path: `/api/v1/requests/${remoteId}/move`,
            body: { collection_id: remoteCol, folder_id: remoteFolder, order_index: local.order_index } as Row
          })
        }
        return calls
      }
    )

    await pushEntity(
      'example',
      (local) => {
        const remoteReq = remoteIdForLocal('request', Number(local.request_id))
        if (remoteReq === null) return null
        return {
          path: `/api/v1/requests/${remoteReq}/examples`,
          body: {
            name: local.name,
            request_method: local.request_method,
            request_url: local.request_url,
            request_headers: local.request_headers,
            request_body: local.request_body,
            response_status: local.response_status,
            response_headers: local.response_headers,
            response_body: local.response_body
          } as Row
        }
      },
      (local, remoteId) => [
        {
          method: 'PUT',
          path: `/api/v1/examples/${remoteId}`,
          body: {
            name: local.name,
            request_method: local.request_method,
            request_url: local.request_url,
            request_headers: local.request_headers,
            request_body: local.request_body,
            response_status: local.response_status,
            response_headers: local.response_headers,
            response_body: local.response_body
          } as Row
        }
      ]
    )

    await pushEntity(
      'environment',
      (local) => {
        const remoteTeam = remoteIdForLocal('team', Number(local.team_id))
        if (remoteTeam === null) return null
        return {
          path: `/api/v1/teams/${remoteTeam}/environments`,
          body: { name: local.name, variables: local.variables } as Row
        }
      },
      (local, remoteId) => [
        {
          method: 'PUT',
          path: `/api/v1/environments/${remoteId}`,
          body: { name: local.name, variables: local.variables } as Row
        }
      ]
    )
  }

  // ─── entry point: satu klik "Sync Now" (§6.2) ─────────────────────────────

  async function syncNow(): Promise<SyncSummary> {
    // PRE-FLIGHT: validasi konektivitas & token
    const preflight = await http('GET', '/api/v1/teams')
    if (preflight.status !== 200) {
      summary.errors.push(`Pre-flight gagal: GET /api/v1/teams → ${preflight.status}`)
      return summary
    }

    await pull()
    await push()
    return summary
  }

  return { syncNow, pull, push }
}

export type SyncEngine = ReturnType<typeof createSyncEngine>

// ─── Resolusi konflik (§6.3) — dipanggil dari IPC ────────────────────────────

export function listConflicts(db: Database.Database): Row[] {
  return db
    .prepare('SELECT * FROM sync_conflicts WHERE resolved_at IS NULL ORDER BY detected_at')
    .all() as Row[]
}

export function resolveConflict(
  db: Database.Database,
  conflictId: number,
  resolution: 'local' | 'remote'
): { ok: boolean; error?: string } {
  const conflict = db.prepare('SELECT * FROM sync_conflicts WHERE id = ? AND resolved_at IS NULL').get(conflictId) as
    | (Row & { entity: SyncEntityName; kind: string; local_id: number; remote_id: number | null })
    | undefined
  if (!conflict) return { ok: false, error: 'Conflict not found' }

  const entity = conflict.entity
  const table = TABLE[entity]
  const remoteSnapshot = JSON.parse(String(conflict.remote_snapshot)) as Row | null

  const finish = db.transaction(() => {
    if (resolution === 'local') {
      // "Pakai punya saya": row lokal tetap dirty → terpush di sync berikutnya.
      // delete_edit dgn remote hilang: remote_id sudah di-NULL-kan saat pull → POST ulang.
      // delete_edit dgn lokal terhapus (tombstone): biarkan tombstone → DELETE server.
      db.prepare(
        "UPDATE sync_conflicts SET resolved_at = ?, resolution = 'local' WHERE id = ?"
      ).run(new Date().toISOString(), conflictId)
      return
    }

    // "Pakai punya server"
    if (remoteSnapshot === null) {
      // server sudah menghapus → ikut hapus lokal
      db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(conflict.local_id)
      db.prepare('DELETE FROM sync_meta WHERE entity = ? AND local_id = ?').run(entity, conflict.local_id)
    } else {
      // terapkan snapshot server ke row lokal, hidupkan lagi kalau tadinya tombstone
      applySnapshotToLocal(db, entity, conflict.local_id, remoteSnapshot)
      db.prepare(
        'UPDATE sync_meta SET dirty = 0, deleted_at = NULL, base_hash = ? WHERE entity = ? AND local_id = ?'
      ).run(contentHash(syncedFields(entity, remoteSnapshot)), entity, conflict.local_id)
    }
    db.prepare(
      "UPDATE sync_conflicts SET resolved_at = ?, resolution = 'remote' WHERE id = ?"
    ).run(new Date().toISOString(), conflictId)
  })
  finish()
  return { ok: true }
}

function applySnapshotToLocal(
  db: Database.Database,
  entity: SyncEntityName,
  localId: number,
  snap: Row
): void {
  switch (entity) {
    case 'team':
      db.prepare('UPDATE teams SET name = ?, description = ? WHERE id = ?').run(snap.name, snap.description ?? '', localId)
      break
    case 'collection':
      db.prepare(
        'UPDATE collections SET name = ?, description = ?, confluence_page_id = ?, chaos_mode = ? WHERE id = ?'
      ).run(snap.name, snap.description ?? '', snap.confluence_page_id ?? '', snap.chaos_mode ? 1 : 0, localId)
      break
    case 'folder':
      db.prepare('UPDATE folders SET name = ?, order_index = ? WHERE id = ?').run(snap.name, snap.order_index ?? 0, localId)
      break
    case 'request':
      db.prepare(
        `UPDATE requests SET name = ?, description = ?, method = ?, url = ?, headers = ?, body = ?,
           body_type = ?, body_variants = ?, auth_config = ?, field_validations = ?, order_index = ?,
           pre_request_script = ?, post_request_script = ? WHERE id = ?`
      ).run(
        snap.name,
        snap.description ?? '',
        snap.method,
        snap.url,
        JSON.stringify(snap.headers ?? {}),
        JSON.stringify(snap.body ?? {}),
        snap.body_type ?? 'raw-json',
        JSON.stringify(snap.body_variants ?? {}),
        JSON.stringify(snap.auth_config ?? {}),
        JSON.stringify(snap.field_validations ?? {}),
        snap.order_index ?? 0,
        snap.pre_request_script ?? '',
        snap.post_request_script ?? '',
        localId
      )
      break
    case 'environment':
      db.prepare('UPDATE environments SET name = ?, variables = ? WHERE id = ?').run(
        snap.name,
        JSON.stringify(snap.variables ?? {}),
        localId
      )
      break
    case 'example':
      db.prepare(
        `UPDATE request_examples SET name = ?, request_method = ?, request_url = ?, request_headers = ?,
           request_body = ?, response_status = ?, response_headers = ?, response_body = ? WHERE id = ?`
      ).run(
        snap.name,
        snap.request_method,
        snap.request_url,
        JSON.stringify(snap.request_headers ?? {}),
        JSON.stringify(snap.request_body ?? {}),
        snap.response_status ?? 0,
        JSON.stringify(snap.response_headers ?? {}),
        snap.response_body ?? '',
        localId
      )
      break
  }
}
