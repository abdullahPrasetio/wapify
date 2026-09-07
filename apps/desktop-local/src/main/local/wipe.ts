import type Database from 'better-sqlite3'
import { seedIfEmpty } from './seed'

// §8.4: "Hapus semua data lokal" — aksi terpisah di Settings, TIDAK bagian
// dari alur logout. Menghapus seluruh tabel domain + bookkeeping sync;
// schema_migrations dan sesi login (sync_state) sengaja tidak disentuh —
// wipe data ≠ logout.
const DOMAIN_TABLES = [
  'comments',
  'request_versions',
  'request_history',
  'request_examples',
  'requests',
  'folders',
  'environments',
  'collections',
  'teams'
]

export function wipeLocalData(db: Database.Database): void {
  const run = db.transaction(() => {
    for (const table of DOMAIN_TABLES) {
      db.prepare(`DELETE FROM ${table}`).run()
    }
    db.prepare('DELETE FROM sync_meta').run()
    db.prepare('DELETE FROM sync_conflicts').run()
    // Kembali ke state first-run (§8.1) supaya UI (yang berasumsi selalu
    // ada ≥1 team) tidak melihat layar kosong sampai app di-restart.
    seedIfEmpty(db)
  })
  run()
}
