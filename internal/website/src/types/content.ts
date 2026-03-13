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
