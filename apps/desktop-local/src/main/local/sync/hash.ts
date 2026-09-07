import { createHash } from 'crypto'

// base_hash (§6.3): hash konten field yang disync saat terakhir kali sinkron,
// untuk deteksi konflik 3-way. Kanonikalisasi: object di-serialize dengan key
// terurut rekursif supaya hash stabil lintas JS/Go ordering.

export type SyncEntityName = 'team' | 'collection' | 'folder' | 'request' | 'environment' | 'example'

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = canonicalize((value as Record<string, unknown>)[key])
    }
    return sorted
  }
  return value
}

export function contentHash(fields: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(fields))).digest('hex')
}

// Field per entity yang ikut dibandingkan saat deteksi konflik. Hanya konten
// yang bisa diedit user — FK/id/timestamp tidak ikut (id beda ruang penomoran
// §6.4; updated_at berubah oleh server sendiri).
export function syncedFields(entity: SyncEntityName, row: Record<string, unknown>): Record<string, unknown> {
  switch (entity) {
    case 'team':
      return { name: row.name, description: row.description }
    case 'collection':
      return {
        name: row.name,
        description: row.description,
        confluence_page_id: row.confluence_page_id,
        chaos_mode: !!row.chaos_mode,
        auth_config: row.auth_config,
        pre_request_script: row.pre_request_script,
        post_request_script: row.post_request_script,
        variables: row.variables
      }
    case 'folder':
      return { name: row.name, order_index: row.order_index }
    case 'request':
      return {
        name: row.name,
        description: row.description,
        method: row.method,
        url: row.url,
        headers: row.headers,
        body: row.body,
        body_type: row.body_type,
        body_variants: row.body_variants,
        auth_config: row.auth_config,
        field_validations: row.field_validations,
        order_index: row.order_index,
        pre_request_script: row.pre_request_script,
        post_request_script: row.post_request_script
      }
    case 'environment':
      return { name: row.name, variables: row.variables }
    case 'example':
      return {
        name: row.name,
        request_method: row.request_method,
        request_url: row.request_url,
        request_headers: row.request_headers,
        request_body: row.request_body,
        response_status: row.response_status,
        response_headers: row.response_headers,
        response_body: row.response_body
      }
  }
}
