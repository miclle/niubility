import client from './client'
import type { BootResponse, ListUsersResponse, UpdateUserArgs, User, SyncWechatResponse, ListDepartmentsResponse } from 'src/types/user'

// boot fetches the current user's authentication state.
export function boot() {
  return client.get<BootResponse>('/boot')
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
