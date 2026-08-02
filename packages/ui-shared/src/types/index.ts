// ─── API Response Wrapper ─────────────────────────────────────────────────────
export interface IpcResponse<T = unknown> {
  status: number
  headers: Record<string, string[]>
  data: T
  timing: number
  cancelled?: boolean
}

// ─── Auth Types ───────────────────────────────────────────────────────────────
export interface User {
  id: number
  email: string
  name: string
  is_super_admin: boolean
  is_premium: boolean
  has_password: boolean
  premium_since: string | null
  created_at: string
  updated_at: string
}

export interface LoginResponse {
  token: string
  refresh_token: string
  user: User
}

// ─── Team Types ───────────────────────────────────────────────────────────────
export type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer'

export interface Team {
  id: number
  name: string
  description: string
  created_by: number
  created_at: string
  role?: TeamRole // injected from team_members
}

export interface TeamMember {
  id: number
  team_id: number
  user_id: number
  user?: User
  role: string
  joined_at: string
}

// ─── Auth Config Types ────────────────────────────────────────────────────────
export interface AuthConfig {
  type: string
  token?: string
  username?: string
  password?: string
  key?: string
  value?: string
  addTo?: 'header' | 'query'
  [key: string]: string | undefined
}

// ─── Collection Types ─────────────────────────────────────────────────────────
export interface Collection {
  id: number
  name: string
  description: string
  team_id: number
  created_by: number
  created_at: string
  updated_at: string
  confluence_page_id?: string
  auth_config?: AuthConfig
  pre_request_script?: string
  post_request_script?: string
  variables?: Record<string, string>
}

// ─── Folder Types ─────────────────────────────────────────────────────────────
export interface Folder {
  id: number
  name: string
  collection_id: number
  parent_folder_id: number | null
  order_index: number
}

// ─── Request Types ────────────────────────────────────────────────────────────
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export interface RequestExample {
  id: number
  request_id: number
  name: string
  request_method: string
  request_url: string
  request_headers: Record<string, unknown>
  request_body: unknown
  response_status: number
  response_headers: Record<string, unknown>
  response_body: string
  created_at: string
  updated_at: string
}

// ─── Extraction Rule Types ────────────────────────────────────────────────────

export interface ExtractionRule {
  id: string
  variableName: string
  jsonPath: string
  enabled: boolean
}

export interface SchemaAssertion {
  id: string
  name: string
  schema: string
  enabled: boolean
}

// ─── Field Validation Types ───────────────────────────────────────────────────

/** Rules that can be applied to a header or body field */
export type ValidationRule =
  | 'required'
  | 'nullable'
  | 'email'
  | 'url'
  | 'string'
  | 'integer'
  | 'numeric'
  | 'boolean'
  | 'array'
  | 'object'
  | 'unique'
  | string // allow custom rules like "max:100"

export interface FieldValidationRule {
  /** Validation rules list, e.g. ["required", "email"] */
  rules: ValidationRule[]
  /** Min length/value, 0 means not set */
  min: number
  /** Max length/value, 0 means not set */
  max: number
  /** Optional description / custom error message */
  description: string
}

/**
 * Map of field validations, keyed by section ("headers" | "body"),
 * then by field name.
 *
 * Example:
 * {
 *   headers: { Authorization: { rules: ["required"], min: 0, max: 0, description: "" } },
 *   body: { email: { rules: ["required", "email"], min: 0, max: 100, description: "Must be valid" } }
 * }
 */
export interface FieldValidations {
  headers: Record<string, FieldValidationRule>
  body: Record<string, FieldValidationRule>
}

export interface ApiRequest {
  id: number
  name: string
  description: string
  method: HttpMethod
  url: string
  headers: Record<string, string>
  body: unknown
  body_type: string
  /** Body tersimpan per tipe (raw-json, form-data, x-www-form-urlencoded, dst) agar pindah tab body tidak kehilangan isi tipe lain */
  body_variants?: Record<string, unknown>
  auth_config: Record<string, unknown>
  field_validations: FieldValidations
  collection_id: number
  folder_id: number | null
  created_by: number | null
  order_index: number
  pre_request_script: string
  post_request_script: string
  extraction_rules?: ExtractionRule[]
  schema_assertions?: SchemaAssertion[]
  created_at: string
  updated_at: string
  examples?: RequestExample[]
}

export interface RequestHistory {
  id: number
  user_id: number
  team_id: number
  request_id: number | null
  method: string
  url: string
  request_headers: Record<string, string | string[]>
  request_body: string
  response_headers: Record<string, string[]>
  response_body: string
  status_code: number
  response_time: number
  created_at: string
  user?: User
}

// ─── Environment Types ────────────────────────────────────────────────────────
export interface Environment {
  id: number
  name: string
  variables: Record<string, string>
  team_id: number | null
  is_global: boolean
  created_at: string
}

// ─── Sidebar Tree ─────────────────────────────────────────────────────────────
export interface SidebarItem {
  type: 'team' | 'collection' | 'folder' | 'request' | 'example'
  id: number
  name: string
  children?: SidebarItem[]
  data?: Team | Collection | Folder | ApiRequest | RequestExample
}

// ─── Documentation Types ──────────────────────────────────────────────────────
export interface DocRequest {
  id: number
  name: string
  description: string
  method: string
  url: string
  headers: Record<string, unknown>
  body: Record<string, unknown>
  body_type?: string
  field_validations: FieldValidations
  examples?: RequestExample[]
}

export interface DocFolder {
  id: number
  name: string
  parent_id: number | null
  requests: DocRequest[]
}

export interface CollectionDocs {
  collection_id: number
  collection_name: string
  description: string
  folders: DocFolder[]
  root_requests: DocRequest[]
}

// ─── Mock Server Types ────────────────────────────────────────────────────────
export interface MockEndpoint {
  id: number
  name?: string
  collection_id: number | null
  team_id?: number | null
  request_id: number | null
  method: string
  path: string
  status_code: number
  response_headers: Record<string, string>
  response_body: string
  delay_ms: number
  delay_max_ms: number
  error_rate: number
  error_status_code: number
  is_active: boolean
  evaluation_mode: 'auto' | 'manual'
  active_scenario_id: number | null
  created_at: string
  updated_at: string
  scenarios?: MockScenario[]
}

export interface MockRequestLog {
  id: number
  endpoint_id: number | null
  collection_id: number | null
  method: string
  path: string
  matched: boolean
  injected_error: boolean
  status_code: number
  latency_ms: number
  created_at: string
}

export interface MockScenario {
  id: number
  mock_endpoint_id: number
  name: string
  status_code: number
  response_headers: Record<string, string>
  response_body: string
  conditions: MockCondition[]
  response_type: 'text' | 'file'
  file_name?: string
  file_base64?: string
  is_default: boolean
  order_index: number
  created_at: string
  updated_at: string
}

export interface MockCondition {
  source: 'query' | 'body' | 'header' | 'path'
  key: string
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'exists' | 'not_exists' | 'regex'
  value: any
}

export interface License {
  id: number
  client_name: string
  email: string
  license_key: string
  valid_until: string
  is_active: boolean
  created_by: number
  created_at: string
  updated_at: string
}

