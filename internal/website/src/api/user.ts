import client from './client'
import type { BootResponse, ListUsersResponse, UpdateUserArgs, User } from 'src/types/user'

// boot fetches the current user's authentication state.
export function boot() {
  return client.get<BootResponse>('/boot')
}

// listUsers fetches a paginated list of users (admin only).
export function listUsers(params?: { page?: number; limit?: number }) {
  return client.get<ListUsersResponse>('/users', { params })
}

// updateUser updates a user's role or status (admin only).
export function updateUser(id: string, data: UpdateUserArgs) {
  return client.patch<User>(`/users/${id}`, data)
}
