// Role represents a user's role in the system.
export type Role = 'super_admin' | 'admin' | 'user'

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
  bio: string
  location: string
  social_accounts: Record<string, string>
  department_ids: string
  role: Role
  status: UserStatus
  follower_count: number
  following_count: number
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
  user_count: number
  created_at: string
  updated_at: string
}

// PaginatedList represents a cursor-paginated list response.
export interface PaginatedList<T> {
  items: T[]
  next_cursor?: string
  total?: number
}

import type { Category } from './content'

// FooterLink represents a custom footer link.
export interface FooterLink {
  label: string
  url: string
}

// SiteConfig represents the site-level configuration.
export interface SiteConfig {
  title: string
  description: string
  keywords: string
  version: string
  favicon_url: string
  logo_url: string
  copyright: string
  force_https: boolean
  footer: string
  video_default_cover_url: string
  video_speaker_default_avatar_url: string
  gallery_card_image_style: string
  gallery_detail_image_style: string
  avatar_image_style: string
}

// BootResponse represents the boot response.
export interface BootResponse {
  initialized: boolean
  authentication: 'authorized' | 'unauthorized'
  user?: User
  categories: Category[]
  registration_enabled: boolean
  sso_enabled: boolean
  sso_login_url?: string
  site?: SiteConfig
}

// ListUsersResponse represents the response for listing users.
export type ListUsersResponse = PaginatedList<User>

// CreateUserArgs represents the fields for admin-side user creation.
export interface CreateUserArgs {
  username: string
  email: string
  password?: string
  name?: string
  mobile?: string
  avatar?: string
  bio?: string
  location?: string
  social_accounts?: Record<string, string>
  department_ids?: string
  role?: Role
  status?: UserStatus
  created_at?: string
  updated_at?: string
}

// UpdateUserArgs represents the fields that can be updated for a user.
export interface UpdateUserArgs {
  username?: string
  email?: string
  password?: string
  name?: string
  mobile?: string
  avatar?: string
  bio?: string
  location?: string
  social_accounts?: Record<string, string>
  department_ids?: string
  role?: Role
  status?: UserStatus
  created_at?: string
  updated_at?: string
}

// UpdateProfileArgs represents the fields that a user can update on their own profile.
export interface UpdateProfileArgs {
  name?: string
  bio?: string
  location?: string
  avatar?: string
  social_accounts?: Record<string, string>
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

// SearchUserItem represents a simplified user item for search results.
export interface SearchUserItem {
  id: string
  name: string
  avatar: string
}

// SearchUsersResponse represents the response for searching users.
export interface SearchUsersResponse {
  users: SearchUserItem[]
}

// UserProfileResponse represents the response for a user's profile page.
export interface UserProfileResponse {
  user: User
  content_count: number
  total_likes: number
  speaker_content_count: number
  following: boolean
}

// FollowResponse represents the response after toggling a follow.
export interface FollowResponse {
  following: boolean
  follower_count: number
  following_count: number
}

// ChangePasswordArgs represents the request body for changing password.
export interface ChangePasswordArgs {
  old_password: string
  new_password: string
}

// HasPasswordResponse represents the response for checking if user has a password.
export interface HasPasswordResponse {
  has_password: boolean
}
