import type Database from 'better-sqlite3'

// First-run seed per docs/local-app-design.md §8. User lokal TIDAK punya
// tabel — dia konstanta { id: 1, name: <os username>, email: 'local@wapbolt' }
// yang nanti dikembalikan oleh endpoint profil di LocalRouter (Fase 2).
// Di sini kita hanya menjamin ada satu local team untuk dipetakan requests/
// collections nanti.
export function seedIfEmpty(db: Database.Database): void {
  const { count } = db.prepare('SELECT COUNT(*) as count FROM teams').get() as { count: number }
  if (count > 0) return

  db.prepare(
    `INSERT INTO teams (id, name, description, created_by, created_at)
     VALUES (1, ?, '', 1, ?)`
  ).run('My Workspace', new Date().toISOString())
}
