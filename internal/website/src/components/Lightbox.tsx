import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut, Share2, Info, Heart, X } from 'lucide-react'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'

import { fileDownloadURL, fileURL, stripImageStyle } from 'src/api/upload'
import { toggleLike } from 'src/api/content'
import CommentSection from 'src/components/CommentSection'
import { useAppContext } from 'src/context/app'
import { formatFileSize } from 'src/lib/utils'
import type { Attachment } from 'src/types/content'

// LightboxProps defines the props for the Lightbox component.
interface LightboxProps {
  items: Attachment[]
  initialIndex: number
  open: boolean
  onClose: () => void
  onIndexChange?: (index: number) => void
  contentId?: string
  commentCount?: number
  onCommentCountChange?: (count: number) => void
  likedAttachmentIds?: Set<string>
  onAttachmentLikeChange?: (attachmentId: string, liked: boolean, likeCount: number) => void
}

// THUMB_SIZE is the thumbnail size in the bottom strip.
const THUMB_SIZE = 56
// THUMB_GAP is the gap between thumbnails.
const THUMB_GAP = 4
// ZOOM_LEVELS defines available zoom levels.
const ZOOM_LEVELS = [1, 1.5, 2, 3]

// InfoPanelProps defines the props for the InfoPanel sub-component.
interface InfoPanelProps {
  attachment: Attachment
  isVideo: boolean
  filename: string
  onDownload: () => void
  contentId?: string
  commentCount: number
  onCommentCountChange?: (count: number) => void
  onClose: () => void
  open: boolean
  width: number
}

// InfoPanel renders the slide-in details panel for the lightbox.
function InfoPanel({ attachment, isVideo, filename, onDownload, contentId, commentCount, onCommentCountChange, onClose, open, width }: InfoPanelProps) {
  const { t } = useTranslation('common')
  return (
    <div
      className="fixed top-0 bottom-0 overflow-y-auto overflow-x-hidden transition-[right] duration-300 ease-in-out"
      style={{
        width,
        right: open ? 0 : -width,
        zIndex: 103,
        background: '#fff',
        borderLeft: '1px solid #e5e5e5',
      }}
    >
      {/* Panel header */}
      <div className="sticky top-0 flex items-center justify-between px-4 h-12 border-b border-gray-200 bg-white">
        <h3 className="text-sm font-medium text-gray-900">{t('common:info')}</h3>
        <button onClick={onClose} className="p-1.5 rounded-full cursor-pointer transition-colors hover:bg-gray-100 focus:outline-none" title={t('common:close')}>
          <X size={18} className="text-gray-500" />
        </button>
      </div>
      <div className="p-4">
        {/* Media details */}
        <div className="space-y-2 text-sm mb-6" style={{ color: '#606060' }}>
          {attachment.title && (
            <div className="text-gray-900 text-sm font-medium mb-2">{attachment.title}</div>
          )}
          {attachment.description && (
            <div className="mb-3 text-xs text-gray-500">{attachment.description}</div>
          )}
          <div className="flex justify-between">
            <span>{t('common:type')}</span>
            <span className="text-gray-900">{isVideo ? t('common:video') : t('common:image')}</span>
          </div>
          {attachment.width > 0 && attachment.height > 0 && (
            <div className="flex justify-between">
              <span>{t('common:dimensions')}</span>
              <span className="text-gray-900">{attachment.width} × {attachment.height}</span>
            </div>
          )}
          {attachment.file_size > 0 && (
            <div className="flex justify-between">
              <span>{t('common:size')}</span>
              <span className="text-gray-900">{formatFileSize(attachment.file_size)}</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span>{t('common:filename')}</span>
            <button
              type="button"
              onClick={onDownload}
              className="text-right text-gray-900 break-all underline underline-offset-4 transition-opacity hover:opacity-80"
            >
              {filename}
            </button>
          </div>
          {isVideo && attachment.duration > 0 && (
            <div className="flex justify-between">
              <span>{t('common:duration')}</span>
              <span className="text-gray-900">{Math.round(attachment.duration)}s</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>{t('common:uploadTime')}</span>
            <span className="text-gray-900">{dayjs(attachment.created_at).format('YYYY-MM-DD HH:mm')}</span>
          </div>
          {attachment.like_count > 0 && (
            <div className="flex justify-between">
              <span>{t('common:favoriteCount')}</span>
              <span className="text-gray-900">{attachment.like_count}</span>
            </div>
          )}
        </div>

        {/* Comments */}
        {contentId && (
          <div className="pt-4 border-t border-gray-200">
            <CommentSection
              contentID={contentId}
              attachmentID={attachment.id}
              commentCount={commentCount}
              onCommentCountChange={onCommentCountChange}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ThumbnailStripProps defines the props for the ThumbnailStrip sub-component.
interface ThumbnailStripProps {
  items: Attachment[]
  current: number
  siteImageStyle: string | undefined
  onThumbClick: (index: number) => void
  onMouseDown: (e: React.MouseEvent) => void
  stripRef: React.RefObject<HTMLDivElement>
  infoPanelOpen: boolean
  infoPanelWidth: number
}

// ThumbnailStrip renders the bottom scrollable thumbnail navigation.
function ThumbnailStrip({ items, current, siteImageStyle, onThumbClick, onMouseDown, stripRef, infoPanelOpen, infoPanelWidth }: ThumbnailStripProps) {
  const { t } = useTranslation('common')
  return (
    <div className="fixed bottom-0 left-0 py-3 px-4 overflow-hidden transition-[right] duration-300 ease-in-out" style={{ zIndex: 101, height: 80, right: infoPanelOpen ? infoPanelWidth : 0 }}>
      <div ref={stripRef} className="flex gap-1 overflow-x-auto select-none" style={{ scrollbarWidth: 'none', cursor: 'grab' }} onMouseDown={onMouseDown}>
        {items.map((item, i) => {
          const thumbSrc = item.type === 'video'
            ? fileURL(item.url)
            : fileURL(item.url, siteImageStyle)
          const isActive = i === current
          return (
            <button
              key={item.id || i}
              className="relative flex-shrink-0 rounded overflow-hidden cursor-pointer transition-opacity focus:outline-none"
              style={{
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                opacity: isActive ? 1 : 0.5,
                outline: isActive ? '2px solid white' : '2px solid transparent',
                outlineOffset: -2,
              }}
              onClick={() => onThumbClick(i)}
            >
              {item.type === 'video' ? (
                <video src={thumbSrc} className="w-full h-full object-cover" muted preload="metadata" />
              ) : (
                <img src={thumbSrc} alt="" className="w-full h-full object-cover" loading="lazy" draggable={false} />
              )}
              {item.type === 'video' && (
                <div className="absolute bottom-0.5 right-0.5 px-1 rounded text-[9px]" style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}>
                  {t('common:video')}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Lightbox displays a fullscreen image/video viewer with toolbar and info panel.
function Lightbox({
  items, initialIndex, open, onClose, onIndexChange,
  contentId, commentCount, onCommentCountChange,
  likedAttachmentIds, onAttachmentLikeChange,
}: LightboxProps) {
  const { t } = useTranslation('common')
  const { siteConfig } = useAppContext()
  const [current, setCurrent] = useState(initialIndex)
  const [zoom, setZoom] = useState(1)
  const [infoPanelOpen, setInfoPanelOpen] = useState(false)
  const thumbStripRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const dragState = useRef({ isDragging: false, startX: 0, scrollLeft: 0, moved: false })

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setCurrent(initialIndex)
      setZoom(1)
    }
  }, [open, initialIndex])

  // Reset zoom when switching images
  useEffect(() => { setZoom(1) }, [current])

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const goTo = useCallback((index: number) => {
    const next = (index + items.length) % items.length
    setCurrent(next)
    onIndexChange?.(next)
  }, [items.length, onIndexChange])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (infoPanelOpen) setInfoPanelOpen(false)
        else onClose()
      } else if (e.key === 'ArrowLeft') goTo(current - 1)
      else if (e.key === 'ArrowRight') goTo(current + 1)
      else if (e.key === 'i') setInfoPanelOpen((v) => !v)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, current, goTo, onClose, infoPanelOpen])

  // Auto-scroll thumbnail strip
  useEffect(() => {
    if (!thumbStripRef.current) return
    const el = thumbStripRef.current
    const thumbCenter = current * (THUMB_SIZE + THUMB_GAP) + THUMB_SIZE / 2
    el.scrollTo({ left: thumbCenter - el.clientWidth / 2, behavior: 'smooth' })
  }, [current])

  // Auto-play video
  useEffect(() => {
    if (!open) return
    if (items[current]?.type === 'video' && videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => {})
    }
  }, [open, current, items])

  // Drag-to-scroll for thumbnail strip
  const handleThumbMouseDown = useCallback((e: React.MouseEvent) => {
    const el = thumbStripRef.current
    if (!el) return
    dragState.current = { isDragging: true, startX: e.clientX, scrollLeft: el.scrollLeft, moved: false }
    el.style.cursor = 'grabbing'
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const ds = dragState.current
      if (!ds.isDragging || !thumbStripRef.current) return
      const dx = e.clientX - ds.startX
      if (Math.abs(dx) > 3) ds.moved = true
      thumbStripRef.current.scrollLeft = ds.scrollLeft - dx
    }
    const onUp = () => {
      if (!dragState.current.isDragging) return
      dragState.current.isDragging = false
      if (thumbStripRef.current) thumbStripRef.current.style.cursor = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const handleThumbClick = useCallback((i: number) => {
    if (dragState.current.moved) return
    goTo(i)
  }, [goTo])

  const handleZoomIn = useCallback(() => {
    setZoom((z) => {
      const idx = ZOOM_LEVELS.indexOf(z)
      return idx < ZOOM_LEVELS.length - 1 ? ZOOM_LEVELS[idx + 1] : z
    })
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((z) => {
      const idx = ZOOM_LEVELS.indexOf(z)
      return idx > 0 ? ZOOM_LEVELS[idx - 1] : z
    })
  }, [])

  const handleShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({ url: window.location.href }).catch(() => {})
    } else {
      navigator.clipboard.writeText(window.location.href).catch(() => {})
    }
  }, [])

  const handleFavorite = useCallback(() => {
    const att = items[current]
    if (!att?.id) return
    toggleLike('attachment', att.id).then((res) => {
      onAttachmentLikeChange?.(att.id, res.data.liked, res.data.like_count)
    })
  }, [current, items, onAttachmentLikeChange])

  const handleDownload = useCallback(() => {
    const attachment = items[current]
    if (!attachment) return
    const originalSourceURL = stripImageStyle(attachment.url)
    const previewSourceURL = attachment.type === 'video'
      ? fileURL(originalSourceURL)
      : fileURL(originalSourceURL, siteConfig?.gallery_original_image_style)
    const downloadURL = fileDownloadURL(previewSourceURL, attachment.filename || attachment.title || '')
    const name = attachment.filename || attachment.title || attachment.url.split('/').pop() || 'download'
    if (!downloadURL) return
    fetch(downloadURL)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Download failed: ${res.status}`)
        const blob = await res.blob()
        const objectURL = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = objectURL
        link.download = name
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(objectURL)
      })
      .catch(() => {
        window.location.assign(downloadURL)
      })
  }, [current, items, siteConfig?.gallery_original_image_style])

  if (!open || items.length === 0) return null

  const attachment = items[current]
  const originalSourceURL = stripImageStyle(attachment.url)
  const isVideo = attachment.type === 'video'
  const src = isVideo ? fileURL(originalSourceURL) : fileURL(originalSourceURL, siteConfig?.gallery_original_image_style)
  const filename = attachment.filename || attachment.title || attachment.url.split('/').pop() || 'download'
  const isFavorited = likedAttachmentIds?.has(attachment.id) || false

  const THUMB_STRIP_H = items.length > 1 ? 80 : 0
  const INFO_PANEL_W = 360

  // Icon button helper
  const iconBtn = (onClick: () => void, children: React.ReactNode, title?: string) => (
    <button onClick={onClick} title={title} className="p-2 rounded-full cursor-pointer transition-colors hover:bg-white/10 focus:outline-none">
      {children}
    </button>
  )

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: 100, background: 'rgba(0,0,0,0.95)' }}>
      {/* Top bar */}
      <div className="fixed top-0 left-0 flex items-center justify-between px-3 h-12 transition-[right] duration-300 ease-in-out" style={{ zIndex: 102, right: infoPanelOpen ? INFO_PANEL_W : 0, background: 'linear-gradient(rgba(0,0,0,0.6), transparent)' }}>
        <div className="flex items-center gap-2">
          {iconBtn(onClose, <ArrowLeft size={20} className="text-white" />, t('common:back'))}
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {current + 1} / {items.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!isVideo && (
            <>
              {iconBtn(handleZoomOut, <ZoomOut size={20} className="text-white" />, t('common:zoomOut'))}
              {zoom !== 1 && <span className="text-xs text-white/60 min-w-[32px] text-center">{zoom}x</span>}
              {iconBtn(handleZoomIn, <ZoomIn size={20} className="text-white" />, t('common:zoomIn'))}
            </>
          )}
          {iconBtn(handleDownload, <Download size={20} className="text-white" />, t('common:download'))}
          {iconBtn(handleShare, <Share2 size={20} className="text-white" />, t('common:share'))}
          {iconBtn(() => setInfoPanelOpen((v) => !v),
            <Info size={20} className={infoPanelOpen ? 'text-white' : 'text-white/70'} />, t('common:detail')
          )}
          {iconBtn(handleFavorite,
            <Heart size={20} className={isFavorited ? 'text-red-500' : 'text-white'} fill={isFavorited ? 'currentColor' : 'none'} />, t('common:favorite')
          )}
        </div>
      </div>

      {/* Media area */}
      <div
        className="absolute left-0 flex items-center justify-center overflow-hidden transition-[right] duration-300 ease-in-out"
        style={{ top: 48, bottom: THUMB_STRIP_H, right: infoPanelOpen ? INFO_PANEL_W : 0 }}
        onClick={(e) => { if (e.target === e.currentTarget && !infoPanelOpen) onClose() }}
      >
        {isVideo ? (
          <video
            ref={videoRef}
            key={current}
            src={src}
            className="max-w-full max-h-full object-contain select-none"
            controls
            autoPlay
            playsInline
          />
        ) : (
          <img
            key={`${current}-${zoom}`}
            src={src}
            alt={attachment.title || `${current + 1}`}
            className="max-h-full object-contain select-none transition-transform duration-200"
            style={{ transform: `scale(${zoom})`, maxWidth: '100%' }}
            draggable={false}
          />
        )}

        {/* Navigation arrows for images */}
        {items.length > 1 && !isVideo && (
          <>
            <button onClick={() => goTo(current - 1)} className="absolute left-0 top-0 h-full flex items-center justify-start pl-4 cursor-pointer focus:outline-none" style={{ width: '33%' }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
                <ChevronLeft size={28} className="text-white" />
              </div>
            </button>
            <button onClick={() => goTo(current + 1)} className="absolute right-0 top-0 h-full flex items-center justify-end pr-4 cursor-pointer focus:outline-none" style={{ width: '33%' }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
                <ChevronRight size={28} className="text-white" />
              </div>
            </button>
          </>
        )}
        {/* Navigation arrows for videos */}
        {items.length > 1 && isVideo && (
          <>
            <button onClick={() => goTo(current - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-colors hover:bg-white/10 focus:outline-none">
              <ChevronLeft size={28} className="text-white" />
            </button>
            <button onClick={() => goTo(current + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-colors hover:bg-white/10 focus:outline-none">
              <ChevronRight size={28} className="text-white" />
            </button>
          </>
        )}
      </div>

      {/* Info panel */}
      <InfoPanel
        attachment={attachment}
        isVideo={isVideo}
        filename={filename}
        onDownload={handleDownload}
        contentId={contentId}
        commentCount={commentCount || 0}
        onCommentCountChange={onCommentCountChange}
        onClose={() => setInfoPanelOpen(false)}
        open={infoPanelOpen}
        width={INFO_PANEL_W}
      />

      {/* Thumbnail strip */}
      {items.length > 1 && (
        <ThumbnailStrip
          items={items}
          current={current}
          siteImageStyle={siteConfig?.gallery_detail_image_style}
          onThumbClick={handleThumbClick}
          onMouseDown={handleThumbMouseDown}
          stripRef={thumbStripRef}
          infoPanelOpen={infoPanelOpen}
          infoPanelWidth={INFO_PANEL_W}
        />
      )}
    </div>,
    document.body,
  )
}

export default Lightbox
