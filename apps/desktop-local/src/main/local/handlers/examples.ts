import type Database from 'better-sqlite3'
import {
  Row,
  getString,
  getFloat,
  markDirty,
  nowIso,
  isTombstoned,
  deleteWithTombstone
} from './helpers'
import { exampleToJson } from './serializers'

// Port dari backend/internal/api/example.go.
// request_body adalah JSONBAny (boleh object/array/raw), bukan JSONB map.

type Res = { status: number; data: unknown }

const exampleNotFound: Res = { status: 404, data: { error: 'Example not found', code: 'NOT_FOUND' } }
const requestNotFound: Res = { status: 404, data: { error: 'Request not found', code: 'NOT_FOUND' } }
const badRequest: Res = { status: 400, data: { error: 'Invalid request body', code: 'BAD_REQUEST' } }

function findExample(db: Database.Database, id: string): Row | null {
  const row = db.prepare('SELECT * FROM request_examples WHERE id = ?').get(id) as Row | undefined
  if (!row || isTombstoned(db, 'example', Number(row.id))) return null
  return row
}

export function createExample(db: Database.Database, requestId: string, body: Row | null): Res {
  if (!body) return badRequest
  const request = db.prepare('SELECT id FROM requests WHERE id = ?').get(requestId) as Row | undefined
  if (!request || isTombstoned(db, 'request', Number(request.id))) return requestNotFound

  const result = db
    .prepare(
      `INSERT INTO request_examples
        (request_id, name, request_method, request_url, request_headers, request_body,
         response_status, response_headers, response_body, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      request.id,
      getString(body, 'name'),
      getString(body, 'request_method'),
      getString(body, 'request_url'),
      JSON.stringify(body.request_headers ?? {}),
      JSON.stringify(body.request_body ?? {}),
      getFloat(body, 'response_status'),
      JSON.stringify(body.response_headers ?? {}),
      getString(body, 'response_body'),
      nowIso(),
      nowIso()
    )
  const id = Number(result.lastInsertRowid)
  markDirty(db, 'example', id)

  const row = db.prepare('SELECT * FROM request_examples WHERE id = ?').get(id) as Row
  return { status: 201, data: exampleToJson(row) }
}

export function updateExample(db: Database.Database, id: string, body: Row | null): Res {
  if (!body) return badRequest
  const example = findExample(db, id)
  if (!example) return exampleNotFound

  // Semantik field-per-field Go: string non-kosong, JSON non-nil, status != 0.
  const updated: Row = { ...example }
  const name = getString(body, 'name')
  if (name !== '') updated.name = name
  const method = getString(body, 'request_method')
  if (method !== '') updated.request_method = method
  const url = getString(body, 'request_url')
  if (url !== '') updated.request_url = url
  if (body.request_headers !== null && body.request_headers !== undefined) {
    updated.request_headers = JSON.stringify(body.request_headers)
  }
  if (body.request_body !== null && body.request_body !== undefined) {
    updated.request_body = JSON.stringify(body.request_body)
  }
  if (getFloat(body, 'response_status') !== 0) updated.response_status = getFloat(body, 'response_status')
  if (body.response_headers !== null && body.response_headers !== undefined) {
    updated.response_headers = JSON.stringify(body.response_headers)
  }
  const responseBody = getString(body, 'response_body')
  if (responseBody !== '') updated.response_body = responseBody

  db.prepare(
    `UPDATE request_examples SET
       name = ?, request_method = ?, request_url = ?, request_headers = ?, request_body = ?,
       response_status = ?, response_headers = ?, response_body = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    updated.name,
    updated.request_method,
    updated.request_url,
    updated.request_headers,
    updated.request_body,
    updated.response_status,
    updated.response_headers,
    updated.response_body,
    nowIso(),
    example.id
  )
  markDirty(db, 'example', Number(example.id))

  const fresh = db.prepare('SELECT * FROM request_examples WHERE id = ?').get(example.id) as Row
  return { status: 200, data: exampleToJson(fresh) }
}

export function deleteExample(db: Database.Database, id: string): Res {
  const example = findExample(db, id)
  if (!example) return exampleNotFound
  deleteWithTombstone(db, 'example', 'request_examples', Number(example.id))
  return { status: 200, data: { message: 'Example deleted successfully' } }
}
