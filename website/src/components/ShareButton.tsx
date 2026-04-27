import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Check, Copy, Link2, Share2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { buildShareDescription, copyShareLink, copyText, getShareURL, type ShareOptions } from 'src/lib/share'

interface ShareButtonProps extends ShareOptions {
  className?: string
  style?: CSSProperties
}

// Renders the share dialog with quick actions for link and message copying.
function ShareButton({ title, text, url, className, style }: ShareButtonProps) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [messageCopied, setMessageCopied] = useState(false)
  const copiedTimerRef = useRef<number | null>(null)
  const messageCopiedTimerRef = useRef<number | null>(null)
  const shareURL = useMemo(() => getShareURL(url), [url])
  const shareDescription = useMemo(() => buildShareDescription(text), [text])
  const shareMessage = useMemo(() => {
    const messageTitle = title?.trim() || t('common:currentContent')
    return shareDescription
      ? `${messageTitle}\n${shareDescription}\n${shareURL}`
      : `${messageTitle}\n${shareURL}`
  }, [shareDescription, shareURL, title, t])

  // Resets the copied state after a short success feedback window.
  const resetCopiedLater = useCallback(() => {
    if (copiedTimerRef.current !== null) {
      window.clearTimeout(copiedTimerRef.current)
    }
    copiedTimerRef.current = window.setTimeout(() => {
      setCopied(false)
      copiedTimerRef.current = null
    }, 2200)
  }, [])

  // Copies the current share URL and updates the button success state.
  const handleCopy = useCallback(async () => {
    try {
      await copyShareLink(shareURL)
      setCopied(true)
      resetCopiedLater()
    } catch {
      setCopied(false)
    }
  }, [resetCopiedLater, shareURL])

  // Copies the formatted share message and shows temporary feedback.
  const handleCopyMessage = useCallback(async () => {
    try {
      await copyText(shareMessage)
      setMessageCopied(true)
      if (messageCopiedTimerRef.current !== null) {
        window.clearTimeout(messageCopiedTimerRef.current)
      }
      messageCopiedTimerRef.current = window.setTimeout(() => {
        setMessageCopied(false)
        messageCopiedTimerRef.current = null
      }, 2200)
    } catch {
      setMessageCopied(false)
    }
  }, [shareMessage])

  // Clears pending timers on unmount to avoid stale state updates.
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current)
      }
      if (messageCopiedTimerRef.current !== null) {
        window.clearTimeout(messageCopiedTimerRef.current)
      }
    }
  }, [])

  // Opens the dialog and pre-copies the link to reduce user effort.
  const handleOpen = useCallback(async () => {
    setOpen(true)
    await handleCopy()
  }, [handleCopy])

  return (
    <>
      <button
        type="button"
        className={className}
        style={style}
        onClick={() => {
          void handleOpen()
        }}
      >
        <Share2 size={18} />
        <span>{t('common:share')}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] overflow-hidden rounded-3xl border-0 p-0 shadow-2xl sm:max-w-xl">
          <div className="bg-white">
            <DialogHeader className="gap-1 px-6 pt-6">
              <DialogTitle className="text-xl font-semibold" style={{ color: '#0f0f0f' }}>
                {t('common:share')}
              </DialogTitle>
              <DialogDescription style={{ color: '#606060' }}>
                {t('common:linkCopied')}
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-6 pt-5">
              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex flex-col items-center gap-2 rounded-2xl px-3 py-4 transition-colors"
                  style={{ background: copied ? 'rgba(6,95,212,0.12)' : '#f5f5f5', color: '#0f0f0f' }}
                >
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ background: copied ? '#065fd4' : '#e5e5e5', color: copied ? '#fff' : '#0f0f0f' }}
                  >
                    {copied ? <Check size={20} /> : <Copy size={20} />}
                  </span>
                  <span className="text-sm font-medium">{copied ? t('common:linkCopied') : t('common:copyLink')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="flex flex-col items-center gap-2 rounded-2xl px-3 py-4"
                  style={{ background: messageCopied ? 'rgba(6,95,212,0.12)' : '#f5f5f5', color: '#0f0f0f' }}
                >
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ background: messageCopied ? '#065fd4' : '#e5e5e5', color: messageCopied ? '#fff' : '#0f0f0f' }}
                  >
                    {messageCopied ? <Check size={20} /> : <Share2 size={20} />}
                  </span>
                  <span className="text-sm font-medium">{messageCopied ? t('common:shareMessageCopied') : t('common:copyShareMessage')}</span>
                </button>
              </div>

              <div className="rounded-2xl border px-4 py-4" style={{ borderColor: '#e5e5e5', background: '#fafafa' }}>
                <div className="mb-3 flex items-center gap-3">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-2xl"
                    style={{ background: 'linear-gradient(135deg, #111827 0%, #4b5563 100%)', color: '#fff' }}
                  >
                    <Link2 size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-sm font-medium leading-5" style={{ color: '#0f0f0f' }}>
                      {title || t('common:currentContent')}
                    </div>
                    <div className="mt-1 break-words text-xs leading-5" style={{ color: '#606060' }}>
                      {shareDescription || t('common:sharePageLink')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Input
                    readOnly
                    value={shareURL}
                    onFocus={(event) => event.currentTarget.select()}
                    className="h-11 min-w-0 flex-1 rounded-full border-0 bg-white px-4 text-sm shadow-none ring-1"
                    style={{ ['--tw-ring-color' as string]: 'rgba(0,0,0,0.08)' }}
                  />
                  <Button
                    type="button"
                    onClick={handleCopy}
                    className="h-11 rounded-full px-5 text-sm font-medium"
                    style={{ background: copied ? '#065fd4' : '#0f0f0f', color: '#fff' }}
                  >
                    {copied ? t('common:copied') : t('common:copy')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default ShareButton
