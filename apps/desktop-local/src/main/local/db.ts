import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import initSql from './migrations/001_init.sql?raw'
import commentsUpdatedAtSql from './migrations/002_comments_updated_at.sql?raw'
import syncExclusionSql from './migrations/003_sync_exclusion.sql?raw'

// Migrasi bernomor per docs/local-app-design.md §3 (main/local/migrations/).
// Ditulis sebagai daftar tetap, bukan glob dari filesystem, supaya urutan
// penerapan eksplisit dan dapat direview per commit.
const MIGRATIONS: Array<{ id: string; sql: string }> = [
  { id: '001_init', sql: initSql },
  { id: '002_comments_updated_at', sql: commentsUpdatedAtSql },
  { id: '003_sync_exclusion', sql: syncExclusionSql }
]

const KEEP_BACKUPS = 5

export function openDb(dbPath: string): Database.Database {
  // Dicek SEBELUM new Database() — constructor better-sqlite3 langsung
  // membuat file fisik walau kosong, jadi fs.existsSync sesudahnya akan
  // selalu true dan backup "first run" jadi tidak pernah benar-benar skip.
  const alreadyExisted = fs.existsSync(dbPath)

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  if (alreadyExisted) backupDb(db, dbPath)
  runMigrations(db)
  return db
}

// §10 (risiko "SQLite corrupt/terhapus"): backup bernomor sebelum migrasi
// (dipanggil dari openDb) dan sebelum sync (dipanggil dari ipc.ts via
// backupDb(db, db.name) — better-sqlite3 expose path asli lewat `.name`).
// wal_checkpoint dulu supaya salinan konsisten (bukan cuma file utama tanpa
// perubahan yang masih di -wal).
export function backupDb(db: Database.Database, dbPath: string): void {
  if (!fs.existsSync(dbPath)) return // first run — belum ada apa pun utk di-backup

  try {
    db.pragma('wal_checkpoint(FULL)')

    const dir = path.dirname(dbPath)
    const base = path.basename(dbPath)
    const backupDir = path.join(dir, 'backups')
    fs.mkdirSync(backupDir, { recursive: true })

    // Suffix acak: ISO timestamp saja beresolusi milidetik, bisa tabrakan
    // kalau backup terpanggil berkali-kali sangat cepat berurutan.
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const unique = Math.random().toString(36).slice(2, 8)
    fs.copyFileSync(dbPath, path.join(backupDir, `${base}.${stamp}-${unique}.bak`))

    pruneOldBackups(backupDir, base)
  } catch (err) {
    // Backup gagal tidak boleh menghentikan app — data asli tetap utuh.
    console.error('[backup] gagal membuat salinan:', err)
  }
}

function pruneOldBackups(backupDir: string, base: string): void {
  const prefix = `${base}.`
  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith(prefix))
    .sort() // nama file diawali timestamp ISO → urut string = urut waktu

  const excess = files.length - KEEP_BACKUPS
  for (let i = 0; i < excess; i++) {
    fs.unlinkSync(path.join(backupDir, files[i]))
  }
}

function runMigrations(db: Database.Database): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )`
  )

  const appliedRows = db.prepare('SELECT id FROM schema_migrations').all() as Array<{ id: string }>
  const applied = new Set(appliedRows.map((row) => row.id))

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue

    const applyMigration = db.transaction(() => {
      db.exec(migration.sql)
      db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(
        migration.id,
        new Date().toISOString()
      )
    })
    applyMigration()
  }
}
