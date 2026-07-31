import { parseJsonColumn, Row } from './helpers'

// Serializer per entity — field & bentuk mengikuti struct tags `json:"..."`
// di backend/internal/repository/models.go (aturan §5.2 no.1).

export function teamToJson(row: Row): Row {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    created_by: row.created_by,
    created_at: row.created_at
  }
}

export function collectionToJson(row: Row): Row {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    team_id: row.team_id,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    confluence_page_id: row.confluence_page_id,
    chaos_mode: !!row.chaos_mode
  }
}

export function folderToJson(row: Row): Row {
  return {
    id: row.id,
    name: row.name,
    collection_id: row.collection_id,
    parent_folder_id: row.parent_folder_id,
    order_index: row.order_index
  }
}

export function exampleToJson(row: Row): Row {
  return {
    id: row.id,
    request_id: row.request_id,
    name: row.name,
    request_method: row.request_method,
    request_url: row.request_url,
    request_headers: parseJsonColumn(row.request_headers, {}),
    request_body: parseJsonColumn(row.request_body, {}),
    response_status: row.response_status,
    response_headers: parseJsonColumn(row.response_headers, {}),
    response_body: row.response_body,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

// `examples`: Go mengembalikan [] saat di-Preload (list/get) dan null saat
// tidak (create/update/move) — mirror keduanya via parameter.
export function requestToJson(row: Row, examples: Row[] | null): Row {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    method: row.method,
    url: row.url,
    headers: parseJsonColumn(row.headers, {}),
    body: parseJsonColumn(row.body, {}),
    body_type: row.body_type,
    body_variants: parseJsonColumn(row.body_variants, {}),
    auth_config: parseJsonColumn(row.auth_config, {}),
    field_validations: parseJsonColumn(row.field_validations, {}),
    collection_id: row.collection_id,
    folder_id: row.folder_id,
    created_by: row.created_by,
    order_index: row.order_index,
    pre_request_script: row.pre_request_script,
    post_request_script: row.post_request_script,
    created_at: row.created_at,
    updated_at: row.updated_at,
    examples: examples === null ? null : examples.map(exampleToJson)
  }
}
