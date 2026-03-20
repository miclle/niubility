import client from './client'
import type { BootResponse, ListUsersResponse, UpdateUserArgs, UpdateProfileArgs, User, SyncWechatResponse, ListDepartmentsResponse, SearchUsersResponse, UserProfileResponse, ChangePasswordArgs, HasPasswordResponse } from 'src/types/user'

// boot fetches the current system and authentication state.
export function boot() {
  return client.get<BootResponse>('/boot')
}

// initSystem sets up the initial super admin account.
export function initSystem(data: { username: string; email: string; password: string }) {
  return client.post<User>('/init', data)
}

// login authenticates with username and password.
export function login(data: { username: string; password: string }) {
  return client.post<{ user: User }>('/login', data)
}

// register creates a new user account.
export function register(data: { username: string; email: string; password: string }) {
  return client.post<User>('/register', data)
}

// listUsers fetches a paginated list of users with optional search (admin only).
export function listUsers(params?: { page?: number; limit?: number; search?: string; department_id?: number }) {
  return client.get<ListUsersResponse>('/admin/users', { params })
}

// updateUser updates a user's role or status (admin only).
export function updateUser(id: string, data: UpdateUserArgs) {
  return client.patch<User>(`/admin/users/${id}`, data)
}

// syncWechat syncs departments and all users from WeChat Work (admin only).
export function syncWechat() {
  return client.post<SyncWechatResponse>('/admin/sync-wechat')
}

// listDepartments fetches all departments (admin only).
export function listDepartments() {
  return client.get<ListDepartmentsResponse>('/admin/departments')
}

// searchUsers searches users by keyword (authenticated users).
export function searchUsers(q: string) {
  return client.get<SearchUsersResponse>('/users/search', { params: { q } })
}

// getUserProfile fetches a user's public profile with stats.
export function getUserProfile(username: string) {
  return client.get<UserProfileResponse>(`/users/${username}/profile`)
}

// getProfile fetches the current authenticated user's profile.
export function getProfile() {
  return client.get<User>('/profile')
}

// updateProfile updates the current authenticated user's profile.
export function updateProfile(data: UpdateProfileArgs) {
  return client.patch<User>('/profile', data)
}

// changePassword changes the current user's password.
export function changePassword(data: ChangePasswordArgs) {
  return client.post<{ message: string }>('/profile/change-password', data)
}

// hasPassword checks if the current user has a password set.
export function hasPassword() {
  return client.get<HasPasswordResponse>('/profile/has-password')
}
