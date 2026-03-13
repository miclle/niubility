import client from './client'
import type { Content, ListContentsArgs, ListContentsResponse, CreateContentArgs, UpdateContentArgs } from 'src/types/content'

// listContents fetches a paginated list of contents with optional filters.
export function listContents(params?: ListContentsArgs) {
  return client.get<ListContentsResponse>('/contents', { params })
}

// getContent fetches a single content by ID.
export function getContent(id: string) {
  return client.get<Content>(`/contents/${id}`)
}

// createContent creates a new content (admin only).
export function createContent(data: CreateContentArgs) {
  return client.post<Content>('/contents', data)
}

// updateContent updates an existing content (admin only).
export function updateContent(id: string, data: UpdateContentArgs) {
  return client.put<Content>(`/contents/${id}`, data)
}

// deleteContent deletes a content by ID (admin only).
export function deleteContent(id: string) {
  return client.delete(`/contents/${id}`)
}
