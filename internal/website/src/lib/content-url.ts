import type { ContentType } from 'src/types/content'

const typePrefix: Record<ContentType, string> = {
  video: 'video',
  gallery: 'gallery',
  article: 'article',
  podcast: 'podcast',
}

// contentDetailPath returns the detail page path for a content item.
export function contentDetailPath(content: { id: string; type: ContentType }, hash?: string): string {
  return `/${typePrefix[content.type]}/${content.id}${hash ? `#${hash}` : ''}`
}

// contentEditPath returns the edit page path for a content item.
export function contentEditPath(content: { id: string; type: ContentType }): string {
  return `/${typePrefix[content.type]}/${content.id}/edit`
}

// contentNewPath returns the create page path for a content type.
export function contentNewPath(type: ContentType): string {
  return `/${typePrefix[type]}/new`
}
