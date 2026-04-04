export type ShareResult = 'shared' | 'copied' | 'prompted' | 'cancelled'

export interface ShareOptions {
  title?: string
  text?: string
  url?: string
}

// Default maximum length for share descriptions.
export const SHARE_DESCRIPTION_LIMIT = 80

// Returns true when the native share sheet was dismissed by the user.
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

// Checks whether the current environment supports the Web Share API.
function canUseNativeShare(): boolean {
  return typeof navigator !== 'undefined' && 'share' in navigator && typeof navigator.share === 'function'
}

// Falls back to the legacy copy command when Clipboard API is unavailable.
function fallbackCopyText(text: string): boolean {
  if (typeof document === 'undefined') return false

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'

  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    return document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }
}

// Resolves the final share URL, defaulting to the current page.
export function getShareURL(url?: string): string {
  return url || window.location.href
}

// Normalizes whitespace and truncates long share descriptions.
export function buildShareDescription(text?: string, limit = SHARE_DESCRIPTION_LIMIT): string {
  const normalizedText = text?.replace(/\s+/g, ' ').trim()
  if (!normalizedText) return ''
  if (normalizedText.length <= limit) return normalizedText
  return `${normalizedText.slice(0, limit).trimEnd()}...`
}

// Uses the native share sheet when the browser supports it.
export async function shareNative({ title, text, url }: ShareOptions): Promise<ShareResult> {
  const shareURL = getShareURL(url)

  if (canUseNativeShare()) {
    try {
      await navigator.share({
        title,
        text,
        url: shareURL,
      })
      return 'shared'
    } catch (error) {
      if (isAbortError(error)) {
        return 'cancelled'
      }
    }
  }

  return 'cancelled'
}

// Copies a shareable URL to the clipboard.
export async function copyShareLink(url?: string): Promise<ShareResult> {
  const shareURL = getShareURL(url)

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(shareURL)
    return 'copied'
  }

  if (fallbackCopyText(shareURL)) {
    return 'copied'
  }

  throw new Error('Copy is not supported in this browser')
}

// Copies arbitrary text using the best available clipboard mechanism.
export async function copyText(text: string): Promise<ShareResult> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return 'copied'
  }

  if (fallbackCopyText(text)) {
    return 'copied'
  }

  throw new Error('Copy is not supported in this browser')
}

// Tries native share first and falls back to copying the link.
export async function shareContent(options: ShareOptions): Promise<ShareResult> {
  const result = await shareNative(options)
  if (result === 'shared') return result
  if (result === 'cancelled' && canUseNativeShare()) return result
  return copyShareLink(options.url)
}
