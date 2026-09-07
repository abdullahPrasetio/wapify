import type Database from 'better-sqlite3'

// Helper bersama untuk semua handler LocalRouter.
// Aturan §5.2 doc: response byte-compatible dengan Go (snake_case, ISO-8601),
// JSON dikembalikan sebagai object/array (bukan string), list selalu array.

export type Row = Record<string, unknown>

export function nowIso(): string {
  return new Date().toISOString()
}

export function parseJsonColumn(value: unknown, fallback: unknown): unknown {
  if (typeof value !== 'string' || value === '') return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

// Port persis dari toJSONB() di backend/internal/api/request.go:
// map → apa adanya; array → {"array": [...]}; string → {"raw": "..."} —
// kolom body JSONB-map-only (bugfix 4ee79c2).
export function toJsonbMap(v: unknown): Record<string, unknown> | null {
  if (v === null || v === undefined) return null
  if (Array.isArray(v)) return { array: v }
  if (typeof v === 'object') return v as Record<string, unknown>
  if (typeof v === 'string') return { raw: v }
  return null
}

export function getString(m: Row, key: string): string {
  const v = m[key]
  return typeof v === 'string' ? v : ''
}

export function getFloat(m: Row, key: string): number {
  const v = m[key]
  return typeof v === 'number' ? v : 0
}

// apiClient selalu mengirim body sebagai JSON string (JSON.stringify di
// api/client.ts); terima object langsung juga untuk jaga-jaga.
export function parseBody(body: unknown): Row | null {
  if (body === null || body === undefined) return null
  if (typeof body === 'object' && !Array.isArray(body)) return body as Row
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body)
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Row)
        : null
    } catch {
      return null
    }
  }
  return null
}

// ─── sync_meta (§5.2 aturan 4) ──────────────────────────────────────────────

export type SyncEntity = 'team' | 'collection' | 'folder' | 'request' | 'environment' | 'example'

export function markDirty(db: Database.Database, entity: SyncEntity, localId: number): void {
  db.prepare(
    `INSERT INTO sync_meta (entity, local_id, dirty) VALUES (?, ?, 1)
     ON CONFLICT(entity, local_id) DO UPDATE SET dirty = 1`
  ).run(entity, localId)
}

// DELETE (§5.2 aturan 4): row yang belum pernah dipush (remote_id NULL) boleh
// langsung dihapus beserta metanya; row yang sudah punya remote_id ditulis
// tombstone dan row domain dibiarkan sampai sync mempropagate.
export function isTombstoned(db: Database.Database, entity: SyncEntity, localId: number): boolean {
  const row = db
    .prepare('SELECT deleted_at FROM sync_meta WHERE entity = ? AND local_id = ?')
    .get(entity, localId) as { deleted_at: string | null } | undefined
  return !!row?.deleted_at
}

export function deleteWithTombstone(
  db: Database.Database,
  entity: SyncEntity,
  table: string,
  localId: number
): void {
  const meta = db
    .prepare('SELECT remote_id FROM sync_meta WHERE entity = ? AND local_id = ?')
    .get(entity, localId) as { remote_id: number | null } | undefined

  if (meta?.remote_id) {
    db.prepare(
      `UPDATE sync_meta SET deleted_at = ?, dirty = 1 WHERE entity = ? AND local_id = ?`
    ).run(nowIso(), entity, localId)
  } else {
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(localId)
    db.prepare('DELETE FROM sync_meta WHERE entity = ? AND local_id = ?').run(entity, localId)
  }
}

// Filter tombstone untuk query list: `id NOT IN (...)`.
export function notTombstonedSql(entity: SyncEntity): string {
  return `id NOT IN (SELECT local_id FROM sync_meta WHERE entity = '${entity}' AND deleted_at IS NOT NULL)`
}

// ─── Konstanta local user (§8) ──────────────────────────────────────────────

export const LOCAL_USER_ID = 1
