import client from './client'
import type { Content, ListContentsArgs, ListContentsResponse, CreateContentArgs, UpdateContentArgs, ListCommentsResponse, Comment, LikeResponse, FavoriteResponse, ListMyCommentsResponse } from 'src/types/content'

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

// listCommentsQuery fetches comments using query parameters (new unified endpoint).
export function listCommentsQuery(params: { content_id: string; limit?: number; cursor?: string; attachment_id?: string }) {
  return client.get<ListCommentsResponse>('/comments', { params })
}

// createCommentBody creates a new comment using body parameters (new unified endpoint).
export function createCommentBody(data: { content_id: string; attachment_id?: string; parent_id?: string; reply_to_id?: string; body: string }) {
  return client.post<Comment>('/comments', data)
}

// toggleLike toggles like on any target (content, comment, or attachment).
// Use targetType: "content" | "comment" | "attachment".
export function toggleLike(targetType: string, targetID: string) {
  return client.post<LikeResponse>('/likes', { target_type: targetType, target_id: targetID })
}

// favoriteContent toggles favorite on a content item.
export function favoriteContent(contentID: string) {
  return client.post<FavoriteResponse>(`/contents/${contentID}/favorite`)
}

// listFavorites fetches a paginated list of the current user's favorited contents.
export function listFavorites(params?: { limit?: number; cursor?: string }) {
  return client.get<ListContentsResponse>('/favorites', { params })
}

// listMyComments fetches a paginated list of the current user's comments.
export function listMyComments(params?: { limit?: number; cursor?: string }) {
  return client.get<ListMyCommentsResponse>('/comments/mine', { params })
}

// pinComment pins or unpins a comment (admin only).
export function pinComment(commentID: string, pinned: boolean) {
  return client.post<Comment>(`/admin/comments/${commentID}/pin`, { pinned })
}

// deleteComment deletes a comment by ID. Users can delete their own comments; admins can delete any comment.
export function deleteComment(commentID: string) {
  return client.delete(`/comments/${commentID}`)
}
