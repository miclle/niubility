import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'

import { fileURL, stripImageStyle } from 'src/api/upload'
import CommentSection from 'src/components/CommentSection'
import LightboxToolbar from 'src/components/LightboxToolbar'
import { useAppContext } from 'src/context/app'
import { useLightbox } from 'src/hooks/useLightbox'
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
  initialInfoPanelOpen?: boolean
  highlightedCommentID?: string
  highlightedAttachmentID?: string
}

// THUMB_SIZE is the thumbnail size in the bottom strip.
const THUMB_SIZE = 56

// InfoPanelProps defines the props for the InfoPanel sub-component.
interface InfoPanelProps {
  attachment: Attachment
  isVideo: boolean
  filename: string
  contentId?: string
  commentCount: number
  onCommentCountChange?: (count: number) => void
  onClose: () => void
  open: boolean
  width: number
  highlightedCommentID?: string
}

// InfoPanel renders the slide-in details panel for the lightbox.
function InfoPanel({ attachment, isVideo, filename, contentId, commentCount, onCommentCountChange, onClose, open, width, highlightedCommentID }: InfoPanelProps) {
  const { t } = useTranslation('common')
  return (
    <div
      className="fixed top-0 bottom-0 overflow-y-auto overflow-x-hidden transition-[right] duration-300 ease-in-out"
      style={{ width, right: open ? 0 : -width, zIndex: 103, background: '#fff', borderLeft: '1px solid #e5e5e5' }}
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
          {attachment.title && <div className="text-gray-900 text-sm font-medium mb-2">{attachment.title}</div>}
          {attachment.description && <div className="mb-3 text-xs text-gray-500">{attachment.description}</div>}
          <div className="flex justify-between">
            <span>{t('common:type')}</span>
            <span className="text-gray-900">{isVideo ? t('common:video') : t('common:image')}</span>
          </div>
          {attachment.width > 0 && attachment.height > 0 && (
            <div className="flex justify-between">
              <span>{t('common:dimensions')}</span>
              <span className="text-gray-900">{attachment.width} &times; {attachment.height}</span>
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
            <span className="text-right text-gray-900 break-all">{filename}</span>
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
              highlightedCommentID={highlightedCommentID}
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
          const thumbSrc = item.type === 'video' ? fileURL(item.url) : fileURL(item.url, siteImageStyle)
          const isActive = i === current
          return (
            <button
              key={item.id || i}
              className="relative flex-shrink-0 rounded overflow-hidden cursor-pointer transition-opacity focus:outline-none"
              style={{ width: THUMB_SIZE, height: THUMB_SIZE, opacity: isActive ? 1 : 0.5, outline: isActive ? '2px solid white' : '2px solid transparent', outlineOffset: -2 }}
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

const INFO_PANEL_W = 360

// Lightbox displays a fullscreen image/video viewer with toolbar and info panel.
function Lightbox({
  items, initialIndex, open, onClose, onIndexChange,
  contentId, commentCount, onCommentCountChange,
  likedAttachmentIds, onAttachmentLikeChange,
  initialInfoPanelOpen = false, highlightedCommentID, highlightedAttachmentID,
}: LightboxProps) {
  const { siteConfig } = useAppContext()
  const thumbStripRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const {
    current, zoom, infoPanelOpen, setInfoPanelOpen,
    goTo, handleThumbMouseDown, handleThumbClick,
    handleZoomIn, handleZoomOut,
  } = useLightbox({
    items, initialIndex, open, onClose, onIndexChange,
    initialInfoPanelOpen, thumbStripRef, videoRef,
  })

  if (!open || items.length === 0) return null

  const attachment = items[current]
  const originalSourceURL = stripImageStyle(attachment.url)
  const isVideo = attachment.type === 'video'
  const src = isVideo ? fileURL(originalSourceURL) : fileURL(originalSourceURL, siteConfig?.gallery_original_image_style)
  const filename = attachment.filename || attachment.title || attachment.url.split('/').pop() || 'download'
  const isFavorited = likedAttachmentIds?.has(attachment.id) || false
  const isHighlightedAttachment = attachment.id === highlightedAttachmentID
  const THUMB_STRIP_H = items.length > 1 ? 80 : 0

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: 100, background: 'rgba(0,0,0,0.95)' }}>
      {/* Top toolbar */}
      <LightboxToolbar
        current={current}
        total={items.length}
        zoom={zoom}
        isVideo={isVideo}
        isFavorited={isFavorited}
        infoPanelOpen={infoPanelOpen}
        infoPanelWidth={INFO_PANEL_W}
        items={items}
        galleryOriginalImageStyle={siteConfig?.gallery_original_image_style}
        onClose={onClose}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onToggleInfoPanel={() => setInfoPanelOpen((v) => !v)}
        onAttachmentLikeChange={onAttachmentLikeChange}
      />

      {/* Media area */}
      <div
        className="absolute left-0 flex items-center justify-center overflow-hidden transition-[right] duration-300 ease-in-out"
        style={{ top: 48, bottom: THUMB_STRIP_H, right: infoPanelOpen ? INFO_PANEL_W : 0 }}
        onClick={(e) => { if (e.target === e.currentTarget && !infoPanelOpen) onClose() }}
      >
        {isVideo ? (
          <video ref={videoRef} key={current} src={src} className="max-w-full max-h-full object-contain select-none" controls autoPlay playsInline />
        ) : (
          <img
            key={`${current}-${zoom}`}
            src={src}
            alt={attachment.title || `${current + 1}`}
            className="max-h-full object-contain select-none transition-transform duration-200"
            style={{ transform: `scale(${zoom})`, maxWidth: '100%', boxShadow: isHighlightedAttachment ? '0 0 0 4px rgba(255,255,255,0.85)' : undefined }}
            draggable={false}
          />
        )}

        {/* Navigation arrows for images */}
        {items.length > 1 && !isVideo && (
          <>
            <button onClick={() => goTo(current - 1)} className="absolute left-0 top-0 h-full flex items-center justify-start pl-4 cursor-pointer focus:outline-none" style={{ width: '33%' }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"><ChevronLeft size={28} className="text-white" /></div>
            </button>
            <button onClick={() => goTo(current + 1)} className="absolute right-0 top-0 h-full flex items-center justify-end pr-4 cursor-pointer focus:outline-none" style={{ width: '33%' }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"><ChevronRight size={28} className="text-white" /></div>
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
        contentId={contentId}
        commentCount={commentCount || 0}
        onCommentCountChange={onCommentCountChange}
        onClose={() => setInfoPanelOpen(false)}
        open={infoPanelOpen}
        width={INFO_PANEL_W}
        highlightedCommentID={highlightedCommentID}
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
