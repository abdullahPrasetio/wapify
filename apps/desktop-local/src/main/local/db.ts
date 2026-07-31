import Database from 'better-sqlite3'
import initSql from './migrations/001_init.sql?raw'

// Migrasi bernomor per docs/local-app-design.md §3 (main/local/migrations/).
// Ditulis sebagai daftar tetap, bukan glob dari filesystem, supaya urutan
// penerapan eksplisit dan dapat direview per commit.
const MIGRATIONS: Array<{ id: string; sql: string }> = [{ id: '001_init', sql: initSql }]

export function openDb(dbPath: string): Database.Database {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  return db
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
