import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Check, Copy, Link2, Share2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { copyShareLink, copyText, getShareURL, type ShareOptions } from 'src/lib/share'

interface ShareButtonProps extends ShareOptions {
  className?: string
  style?: CSSProperties
}

function ShareButton({ title, text, url, className, style }: ShareButtonProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [messageCopied, setMessageCopied] = useState(false)
  const copiedTimerRef = useRef<number | null>(null)
  const messageCopiedTimerRef = useRef<number | null>(null)
  const shareURL = useMemo(() => getShareURL(url), [url])
  const shareMessage = useMemo(() => {
    const messageTitle = title?.trim() || '当前内容'
    return `${messageTitle}\n${shareURL}`
  }, [shareURL, title])

  const resetCopiedLater = useCallback(() => {
    if (copiedTimerRef.current !== null) {
      window.clearTimeout(copiedTimerRef.current)
    }
    copiedTimerRef.current = window.setTimeout(() => {
      setCopied(false)
      copiedTimerRef.current = null
    }, 2200)
  }, [])

  const handleCopy = useCallback(async () => {
    try {
      await copyShareLink(shareURL)
      setCopied(true)
      resetCopiedLater()
    } catch {
      setCopied(false)
    }
  }, [resetCopiedLater, shareURL])

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
        <span>分享</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] overflow-hidden rounded-3xl border-0 p-0 shadow-2xl sm:max-w-xl">
          <div className="bg-white">
            <DialogHeader className="gap-1 px-6 pt-6">
              <DialogTitle className="text-xl font-semibold" style={{ color: '#0f0f0f' }}>
                分享
              </DialogTitle>
              <DialogDescription style={{ color: '#606060' }}>
                链接已经复制好，可以直接发送给同事。
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
                  <span className="text-sm font-medium">{copied ? '已复制链接' : '复制链接'}</span>
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
                  <span className="text-sm font-medium">{messageCopied ? '已复制文案' : '复制分享文案'}</span>
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
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium" style={{ color: '#0f0f0f' }}>
                      {title || '当前内容'}
                    </div>
                    <div className="truncate text-xs" style={{ color: '#606060' }}>
                      {text || '共享当前页面链接'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Input
                    readOnly
                    value={shareURL}
                    onFocus={(event) => event.currentTarget.select()}
                    className="h-11 rounded-full border-0 bg-white px-4 text-sm shadow-none ring-1"
                    style={{ ['--tw-ring-color' as string]: 'rgba(0,0,0,0.08)' }}
                  />
                  <Button
                    type="button"
                    onClick={handleCopy}
                    className="h-11 rounded-full px-5 text-sm font-medium"
                    style={{ background: copied ? '#065fd4' : '#0f0f0f', color: '#fff' }}
                  >
                    {copied ? '已复制' : '复制'}
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
