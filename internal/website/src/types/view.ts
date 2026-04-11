import type { Content, ContentType } from './content'
import type { PaginatedList, User } from './user'

export interface MyContentViewItem {
  content: Content
  first_viewed_at: string
  last_viewed_at: string
  view_count: number
}

export interface ContentViewUserItem {
  user: User
  first_viewed_at: string
  last_viewed_at: string
  view_count: number
}

export interface ListMyContentViewsParams {
  limit?: number
  cursor?: string
  type?: ContentType | 'all'
}

export type ListMyContentViewsResponse = PaginatedList<MyContentViewItem>
export type ListContentViewUsersResponse = PaginatedList<ContentViewUserItem>
