import { appendImageStyle, siteResourceURL } from 'src/api/upload'
import type { Content } from 'src/types/content'
import type { SiteConfig } from 'src/types/user'

// getDefaultContentCover returns the configured fallback cover for the given content type.
export function getDefaultContentCover(type: Content['type'], siteConfig: SiteConfig | null): string {
  if (type === 'video') {
    return siteConfig?.video_default_cover_url ? siteResourceURL(siteConfig.video_default_cover_url) : '/default-cover.svg'
  }
  return '/default-cover.svg'
}

// getContentCover returns the best available cover URL for a content item.
export function getContentCover(content: Content, siteConfig: SiteConfig | null): string {
  if (content.cover_url) return content.cover_url

  const items = content.attachments || []
  const coverItem = items.find((item) => item.is_cover)
  if (coverItem) {
    if (coverItem.cover_url) return coverItem.cover_url
    if (content.type !== 'video' && coverItem.url) return coverItem.url
  }

  if (content.type === 'video') {
    const firstAttachmentCover = items.find((item) => item.cover_url)?.cover_url
    if (firstAttachmentCover) return firstAttachmentCover
    return getDefaultContentCover(content.type, siteConfig)
  }

  const firstVisual = items.find((item) => item.cover_url || item.url)
  if (firstVisual) return firstVisual.cover_url || firstVisual.url

  return getDefaultContentCover(content.type, siteConfig)
}

// getStyledContentCardCover applies the configured list/card image style to content covers.
export function getStyledContentCardCover(content: Content, siteConfig: SiteConfig | null): string {
  const styleFragment = content.type === 'video'
    ? siteConfig?.video_card_image_style
    : siteConfig?.gallery_card_image_style
  return appendImageStyle(getContentCover(content, siteConfig), styleFragment)
}

// getSpeakerDisplayName returns the best available speaker label for a content item.
// Optionally accepts a translator function to return a translated fallback.
export function getSpeakerDisplayName(content: Content, unknownAuthor?: string): string {
  return content.speaker?.name || content.speaker_name || content.author?.name || unknownAuthor || 'Unknown Author'
}

// getVideoSpeakerDisplayName returns the primary speaker label for video contexts.
export function getVideoSpeakerDisplayName(content: Content, unknownSpeaker?: string): string {
  return content.speaker?.name || content.speaker_name || unknownSpeaker || 'Unknown Speaker'
}

// getSpeakerAvatar returns the best available avatar for speaker display.
export function getSpeakerAvatar(content: Content, siteConfig: SiteConfig | null): string {
  if (content.speaker?.avatar) return content.speaker.avatar
  if (content.author?.avatar) return content.author.avatar
  if (siteConfig?.video_speaker_default_avatar_url) {
    return siteResourceURL(siteConfig.video_speaker_default_avatar_url)
  }
  return ''
}

// getVideoSpeakerAvatar returns the primary speaker avatar for video contexts.
export function getVideoSpeakerAvatar(content: Content, siteConfig: SiteConfig | null): string {
  if (content.speaker?.avatar) return content.speaker.avatar
  if (siteConfig?.video_speaker_default_avatar_url) {
    return siteResourceURL(siteConfig.video_speaker_default_avatar_url)
  }
  return ''
}

// getStyledAvatar applies the configured avatar style fragment to a resolved avatar URL.
export function getStyledAvatar(url: string, siteConfig: SiteConfig | null): string {
  return appendImageStyle(url, siteConfig?.avatar_image_style)
}
