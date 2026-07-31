import type Database from 'better-sqlite3'
import { Row, notTombstonedSql } from './helpers'

// Port dari backend/internal/api/search.go (getSearchSummary).
// User lokal = super admin → semua team terlihat. Shape: RequestMinimal /
// CollectionMinimal (search.go), selalu array walau kosong.

type Res = { status: number; data: unknown }

export function getSearchSummary(db: Database.Database): Res {
  const collections = db
    .prepare(`SELECT id, name, team_id FROM collections WHERE ${notTombstonedSql('collection')} ORDER BY id`)
    .all() as Row[]

  const requests = db
    .prepare(
      `SELECT r.id, r.name, r.url, r.method, c.team_id, r.collection_id
       FROM requests r
       JOIN collections c ON c.id = r.collection_id
       WHERE r.${notTombstonedSql('request')} AND c.${notTombstonedSql('collection')}
       ORDER BY r.id`
    )
    .all() as Row[]

  return { status: 200, data: { requests, collections } }
}
