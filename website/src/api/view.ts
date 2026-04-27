import client from './client'
import type { ListContentViewUsersResponse, ListMyContentViewsParams, ListMyContentViewsResponse } from 'src/types/view'

// recordContentView stores the current user's browsing record for a content item.
export function recordContentView(contentID: string, data?: { trigger?: string }) {
  return client.post<{ ok: boolean }>(`/contents/${contentID}/view`, data)
}

// listMyContentViews fetches the current user's browsing history.
export function listMyContentViews(params?: ListMyContentViewsParams) {
  const normalized = params?.type === 'all' ? { ...params, type: undefined } : params
  return client.get<ListMyContentViewsResponse>('/views/mine', { params: normalized })
}

// listContentViewUsers fetches the viewer list for a content item (admin only).
export function listContentViewUsers(contentID: string, params?: { limit?: number; cursor?: string }) {
  return client.get<ListContentViewUsersResponse>(`/admin/contents/${contentID}/views`, { params })
}
