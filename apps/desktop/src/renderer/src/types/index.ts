// ─── API Response Wrapper ─────────────────────────────────────────────────────
export interface IpcResponse<T = unknown> {
  status: number
  headers: Record<string, string[]>
  data: T
  timing: number
}

// ─── Auth Types ───────────────────────────────────────────────────────────────
export interface User {
  id: number
  email: string
  name: string
  is_super_admin: boolean
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

// ─── Collection Types ─────────────────────────────────────────────────────────
export interface Collection {
  id: number
  name: string
  description: string
  team_id: number
  created_by: number
  created_at: string
  updated_at: string
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

export interface ApiRequest {
  id: number
  name: string
  description: string
  method: HttpMethod
  url: string
  headers: Record<string, string>
  body: any
  auth_config: Record<string, unknown>
  collection_id: number
  folder_id: number | null
  created_by: number | null
  order_index: number
  created_at: string
  updated_at: string
}

export interface RequestHistory {
  id: number
  user_id: number
  request_id: number | null
  method: string
  url: string
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
  team_id: number
  created_at: string
}

// ─── Sidebar Tree ─────────────────────────────────────────────────────────────
export interface SidebarItem {
  type: 'team' | 'collection' | 'folder' | 'request'
  id: number
  name: string
  children?: SidebarItem[]
  data?: Team | Collection | Folder | ApiRequest
}
