import type { User, Pagination } from './user'

// ContentType represents the type of content.
export type ContentType = 'video' | 'gallery' | 'article'

// ContentStatus represents the publication status of content.
export type ContentStatus = 'draft' | 'published'

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
export type AttachmentType = 'video' | 'image'

// Attachment represents a file (video, image, etc.) attached to a content.
export interface Attachment {
  id: string
  content_id: string
  title: string
  description: string
  url: string
  type: AttachmentType
  sort_order: number
  is_cover: boolean
  file_size: number
  duration: number
  created_at: string
  updated_at: string
}

// CreateAttachmentArgs represents the fields required to create an attachment.
export interface CreateAttachmentArgs {
  title?: string
  description?: string
  url: string
  type: AttachmentType
  sort_order: number
  is_cover?: boolean
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
  category: ContentCategory
  tags: string[]
  speaker_id: string
  speaker_name: string
  speaker_bio: string
  like_count: number
  comment_count: number
  created_at: string
  updated_at: string
  author?: User
  speaker?: User
  attachments?: Attachment[]
  liked?: boolean
}

// ListContentsArgs represents the query parameters for listing contents.
export interface ListContentsArgs {
  page?: number
  limit?: number
  category?: ContentCategory
  type?: ContentType
  status?: ContentStatus | 'all'
  keyword?: string
  tag?: string
  sort?: SortField
  author_id?: string
  speaker_id?: string
  followed_by_user_id?: string
}

// ListContentsResponse represents the response for listing contents.
export interface ListContentsResponse {
  contents: Content[]
  pagination: Pagination
}

// CreateContentArgs represents the fields required to create content.
export interface CreateContentArgs {
  title: string
  summary?: string
  body?: string
  cover_url?: string
  type: ContentType
  status?: ContentStatus
  category: ContentCategory
  tags?: string[]
  speaker_id?: string
  speaker_name?: string
  speaker_bio?: string
  media_items?: CreateAttachmentArgs[]
}

// UpdateContentArgs represents the fields that can be updated for content.
export interface UpdateContentArgs {
  title?: string
  summary?: string
  body?: string
  cover_url?: string
  type?: ContentType
  status?: ContentStatus
  category?: ContentCategory
  tags?: string[]
  speaker_id?: string
  speaker_name?: string
  speaker_bio?: string
  media_items?: CreateAttachmentArgs[]
}

// LegacyTalk represents the data structure from the old platform.
export interface LegacyTalk {
  id: string
  title: string
  cover: string
  start_at: string
  description: string
  tags: string[]
  speaker: string
  staff: string
  bio: string
  avatar: string
  broadcast: string
  playback: string
  type: string      // "sharing" or "training"
  volume: string    // e.g., "AI 赋能组织分享会"
  created_at: string
  updated_at: string
}

// ImportContentsArgs represents the request body for importing contents.
export interface ImportContentsArgs {
  contents: LegacyTalk[]
}

// ImportResult represents the result of an import operation.
export interface ImportResult {
  total: number
  imported: number
  skipped: number
  errors: string[]
}

// Comment represents a comment on a content item.
export interface Comment {
  id: string
  content_id: string
  user_id: string
  parent_id: string
  reply_to_id: string
  body: string
  like_count: number
  created_at: string
  updated_at: string
  user?: User
  reply_to?: Comment
  replies?: Comment[]
}

// ListCommentsResponse represents the response for listing comments.
export interface ListCommentsResponse {
  comments: Comment[]
  pagination: Pagination
  liked_comment_ids: string[]
}

// CreateCommentArgs represents the fields required to create a comment.
export interface CreateCommentArgs {
  body: string
  parent_id?: string
  reply_to_id?: string
}

// LikeResponse represents the response after toggling a like.
export interface LikeResponse {
  liked: boolean
  like_count: number
}
