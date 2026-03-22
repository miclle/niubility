import client from './client'
import type { Content, ListContentsArgs, ListContentsResponse, CreateContentArgs, UpdateContentArgs, ImportContentsArgs, ImportResult, ListCommentsResponse, CreateCommentArgs, Comment, LikeResponse } from 'src/types/content'

// listContents fetches a paginated list of contents with optional filters.
export function listContents(params?: ListContentsArgs) {
  return client.get<ListContentsResponse>('/contents', { params })
}

// getContent fetches a single content by ID.
export function getContent(id: string) {
  return client.get<Content>(`/contents/${id}`)
}

// createContent creates a new content.
export function createContent(data: CreateContentArgs) {
  return client.post<Content>('/contents', data)
}

// updateContent updates an existing content.
export function updateContent(id: string, data: UpdateContentArgs) {
  return client.put<Content>(`/contents/${id}`, data)
}

// deleteContent deletes a content by ID.
export function deleteContent(id: string) {
  return client.delete(`/contents/${id}`)
}

// importContents imports contents from the legacy platform (admin only).
export function importContents(data: ImportContentsArgs) {
  return client.post<ImportResult>('/import', data)
}

// listComments fetches comments for a content item, optionally filtered by attachment.
export function listComments(contentID: string, params?: { page?: number; limit?: number; attachment_id?: string }) {
  return client.get<ListCommentsResponse>(`/contents/${contentID}/comments`, { params })
}

// createComment creates a new comment on a content item.
export function createComment(contentID: string, data: CreateCommentArgs) {
  return client.post<Comment>(`/contents/${contentID}/comments`, data)
}

// likeContent toggles like on a content item.
export function likeContent(contentID: string) {
  return client.post<LikeResponse>(`/contents/${contentID}/like`)
}

// likeComment toggles like on a comment.
export function likeComment(commentID: string) {
  return client.post<LikeResponse>(`/comments/${commentID}/like`)
}

// likeAttachment toggles like (favorite) on an attachment.
export function likeAttachment(attachmentID: string) {
  return client.post<LikeResponse>(`/attachments/${attachmentID}/like`)
}
