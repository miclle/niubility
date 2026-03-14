import type { User, Pagination } from './user'

// ContentType represents the type of content.
export type ContentType = 'article' | 'video'

// ContentCategory represents the category of content.
export type ContentCategory = 'learning' | 'culture'

// SortField represents the field to sort by.
export type SortField = 'created_at' | 'like_count'

// Content represents a piece of content in the system.
export interface Content {
  id: string
  author_id: string
  title: string
  summary: string
  body: string
  cover_url: string
  video_url: string
  type: ContentType
  category: ContentCategory
  tags: string[]
  speaker: string
  speaker_bio: string
  like_count: number
  created_at: string
  updated_at: string
  author?: User
}

// ListContentsArgs represents the query parameters for listing contents.
export interface ListContentsArgs {
  page?: number
  limit?: number
  category?: ContentCategory
  type?: ContentType
  keyword?: string
  tag?: string
  sort?: SortField
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
  video_url?: string
  type: ContentType
  category: ContentCategory
  tags?: string[]
  speaker?: string
  speaker_bio?: string
}

// UpdateContentArgs represents the fields that can be updated for content.
export interface UpdateContentArgs {
  title?: string
  summary?: string
  body?: string
  cover_url?: string
  video_url?: string
  type?: ContentType
  category?: ContentCategory
  tags?: string[]
  speaker?: string
  speaker_bio?: string
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
