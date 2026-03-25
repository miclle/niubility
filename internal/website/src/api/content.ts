import client from './client'
import type { Content, ListContentsArgs, ListContentsResponse, CreateContentArgs, UpdateContentArgs, ListCommentsResponse, CreateCommentArgs, Comment, LikeResponse, FavoriteResponse } from 'src/types/content'

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

// listComments fetches comments for a content item, optionally filtered by attachment.
export function listComments(contentID: string, params?: { limit?: number; cursor?: string; attachment_id?: string }) {
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

// favoriteContent toggles favorite on a content item.
export function favoriteContent(contentID: string) {
  return client.post<FavoriteResponse>(`/contents/${contentID}/favorite`)
}

// listFavorites fetches a paginated list of the current user's favorited contents.
export function listFavorites(params?: { limit?: number; cursor?: string }) {
  return client.get<ListContentsResponse>('/favorites', { params })
}
