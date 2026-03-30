export type ShareResult = 'shared' | 'copied' | 'prompted' | 'cancelled'

export interface ShareOptions {
  title?: string
  text?: string
  url?: string
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function canUseNativeShare(): boolean {
  return typeof navigator !== 'undefined' && 'share' in navigator && typeof navigator.share === 'function'
}

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

export function getShareURL(url?: string): string {
  return url || window.location.href
}

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

export async function shareContent(options: ShareOptions): Promise<ShareResult> {
  const result = await shareNative(options)
  if (result === 'shared') return result
  if (result === 'cancelled' && canUseNativeShare()) return result
  return copyShareLink(options.url)
}
