import type { User, PaginatedList } from './user'

// ContentType represents the type of content.
export type ContentType = 'video' | 'gallery' | 'article' | 'podcast'

// ContentStatus represents the publication status of content.
export type ContentStatus = 'draft' | 'published'
export type ContentReviewStatus = 'pending' | 'approved' | 'rejected'
export type ContentVisibility = 'private' | 'unlisted' | 'public' | 'blocked'

// ContentCategory represents the category of content (dynamic, stored as slug string).
export type ContentCategory = string

// Category represents a content category managed in the database.
export interface Category {
  id: string
  name: string
  slug: string
  icon: string
  visible: boolean
  sort_order: number
  content_count: number
  created_at: string
  updated_at: string
}

// SortField represents the field to sort by.
export type SortField = 'created_at' | 'like_count'

// AttachmentType represents the type of an attachment.
export type AttachmentType = 'video' | 'image' | 'document' | 'audio'

// Attachment represents a file (video, image, etc.) attached to a content.
export interface Attachment {
  id: string
  content_id: string
  title: string
  description: string
  filename: string
  url: string
  cover_url: string
  mime_type: string
  checksum: string
  type: AttachmentType
  sort_order: number
  is_cover: boolean
  width: number
  height: number
  file_size: number
  duration: number
  like_count: number
  created_at: string
  updated_at: string
}

// CreateAttachmentArgs represents the fields required to create an attachment.
export interface CreateAttachmentArgs {
  title?: string
  description?: string
  filename?: string
  url: string
  cover_url?: string
  mime_type?: string
  checksum?: string
  type: AttachmentType
  sort_order: number
  is_cover?: boolean
  width?: number
  height?: number
  file_size?: number
  duration?: number
}

// Content represents a piece of content in the system.
export interface Content {
  id: string
  author_id: string
  title: string
  summary: string
  body: string
  cover_url: string
  type: ContentType
  status: ContentStatus
  review_status: ContentReviewStatus
  visibility: ContentVisibility
  category: ContentCategory
  tags: string[]
  speaker_id: string
  speaker_name: string
  speaker_bio: string
  reviewed_by: string
  reviewed_at?: string
  review_note: string
  like_count: number
  favorite_count: number
  comment_count: number
  created_at: string
  updated_at: string
  author?: User
  speaker?: User
  attachments?: Attachment[]
  liked?: boolean
  favorited?: boolean
  liked_attachment_ids?: string[]
}

// ListContentsArgs represents the query parameters for listing contents.
export interface ListContentsArgs {
  limit?: number
  cursor?: string
  category?: ContentCategory
  type?: ContentType
  status?: ContentStatus | 'all'
  review_status?: ContentReviewStatus | 'all'
  visibility?: ContentVisibility | 'all'
  keyword?: string
  tag?: string
  sort?: SortField
  author_id?: string
  speaker_id?: string
  profile_user_id?: string
  followed_by_user_id?: string
}

// ListContentsResponse represents the response for listing contents.
export type ListContentsResponse = PaginatedList<Content>

// CreateContentArgs represents the fields required to create content.
export interface CreateContentArgs {
  title: string
  summary?: string
  body?: string
  cover_url?: string
  type: ContentType
  status?: ContentStatus
  review_status?: ContentReviewStatus
  visibility?: ContentVisibility
  category: ContentCategory
  tags?: string[]
  author_id?: string
  speaker_id?: string
  speaker_name?: string
  speaker_bio?: string
  attachments?: CreateAttachmentArgs[]
}

// UpdateContentArgs represents the fields that can be updated for content.
export interface UpdateContentArgs {
  title?: string
  summary?: string
  body?: string
  cover_url?: string
  type?: ContentType
  status?: ContentStatus
  review_status?: ContentReviewStatus
  visibility?: ContentVisibility
  category?: ContentCategory
  tags?: string[]
  author_id?: string
  speaker_id?: string
  speaker_name?: string
  speaker_bio?: string
  attachments?: CreateAttachmentArgs[]
}

export interface ModerateContentArgs {
  review_status: ContentReviewStatus
  visibility: ContentVisibility
  review_note?: string
}

// Comment represents a comment on a content item.
export interface Comment {
  id: string
  content_id: string
  attachment_id: string
  user_id: string
  parent_id: string
  reply_to_id: string
  body: string
  like_count: number
  pinned_at?: string
  created_at: string
  updated_at: string
  user?: User
  reply_to?: Comment
  replies?: Comment[]
}

// ListCommentsResponse represents the response for listing comments.
export interface ListCommentsResponse extends PaginatedList<Comment> {
  liked_comment_ids: string[]
}

// CreateCommentArgs represents the fields required to create a comment.
export interface CreateCommentArgs {
  body: string
  parent_id?: string
  reply_to_id?: string
  attachment_id?: string
}

// CommentWithContent extends Comment with the associated content it belongs to.
export interface CommentWithContent extends Comment {
  content?: Content
}

// ListMyCommentsResponse represents the response for listing the current user's comments.
export interface ListMyCommentsResponse {
  items: CommentWithContent[]
  next_cursor?: string
  total: number
}

// MyLikeItem represents the current user's like activity grouped by content.
export interface MyLikeItem {
  content: Content
  last_liked_at: string
  liked_content: boolean
  liked_comment_count: number
  liked_attachment_count: number
  recent_target_type: 'content' | 'comment' | 'attachment'
  recent_target_id: string
  recent_attachment_id: string
}

// ListMyLikesResponse represents the response for listing the current user's likes.
export interface ListMyLikesResponse {
  items: MyLikeItem[]
  next_cursor?: string
  total: number
}

// LikeResponse represents the response after toggling a like.
export interface LikeResponse {
  liked: boolean
  like_count: number
}

// FavoriteResponse represents the response after toggling a favorite.
export interface FavoriteResponse {
  favorited: boolean
  favorite_count: number
}
