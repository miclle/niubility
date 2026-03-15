// Role represents a user's role in the system.
export type Role = 'admin' | 'user'

// UserStatus represents the status of a user account.
export type UserStatus = 'activated' | 'deactivated'

// User represents a user in the system.
export interface User {
  id: string
  username: string
  name: string
  email: string
  mobile: string
  avatar: string
  department_ids: string
  role: Role
  status: UserStatus
  created_at: string
  updated_at: string
}

// Department represents a department synced from WeChat Work.
export interface Department {
  id: number
  name: string
  name_en: string
  parent_id: number
  order: number
  created_at: string
  updated_at: string
}

// Pagination represents pagination parameters for list queries.
export interface Pagination {
  page: number
  limit: number
  total: number
}

// BootResponse represents the boot response.
export interface BootResponse {
  authentication: 'authorized' | 'unauthorized'
  user?: User
}

// ListUsersResponse represents the response for listing users.
export interface ListUsersResponse {
  users: User[]
  pagination: Pagination
}

// UpdateUserArgs represents the fields that can be updated for a user.
export interface UpdateUserArgs {
  role?: Role
  status?: UserStatus
}

// SyncWechatResponse represents the response for syncing from WeChat.
export interface SyncWechatResponse {
  departments_synced: number
  users_synced: number
  users_failed: number
}

// ListDepartmentsResponse represents the response for listing departments.
export interface ListDepartmentsResponse {
  departments: Department[]
}
