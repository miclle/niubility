import { useCallback } from 'react'
import { ArrowLeft, Download, ZoomIn, ZoomOut, Share2, Info, Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { fileDownloadURL, fileURL, stripImageStyle } from 'src/api/upload'
import { toggleLike } from 'src/api/content'
import type { Attachment } from 'src/types/content'

interface LightboxToolbarProps {
  current: number
  total: number
  zoom: number
  isVideo: boolean
  isFavorited: boolean
  infoPanelOpen: boolean
  infoPanelWidth: number
  items: Attachment[]
  galleryOriginalImageStyle: string | undefined
  onClose: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onToggleInfoPanel: () => void
  onAttachmentLikeChange?: (attachmentId: string, liked: boolean, likeCount: number) => void
}

// iconBtn renders a toolbar icon button.
function iconBtn(onClick: () => void, children: React.ReactNode, title?: string) {
  return (
    <button onClick={onClick} title={title} className="p-2 rounded-full cursor-pointer transition-colors hover:bg-white/10 focus:outline-none">
      {children}
    </button>
  )
}

// LightboxToolbar renders the top toolbar for the lightbox.
function LightboxToolbar({
  current, total, zoom, isVideo, isFavorited, infoPanelOpen, infoPanelWidth,
  items, galleryOriginalImageStyle,
  onClose, onZoomIn, onZoomOut, onToggleInfoPanel, onAttachmentLikeChange,
}: LightboxToolbarProps) {
  const { t } = useTranslation('common')

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
      : fileURL(originalSourceURL, galleryOriginalImageStyle)
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
  }, [current, items, galleryOriginalImageStyle])

  return (
    <div className="fixed top-0 left-0 flex items-center justify-between px-3 h-12 transition-[right] duration-300 ease-in-out" style={{ zIndex: 102, right: infoPanelOpen ? infoPanelWidth : 0, background: 'linear-gradient(rgba(0,0,0,0.6), transparent)' }}>
      <div className="flex items-center gap-2">
        {iconBtn(onClose, <ArrowLeft size={20} className="text-white" />, t('common:back'))}
        <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
          {current + 1} / {total}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {!isVideo && (
          <>
            {iconBtn(onZoomOut, <ZoomOut size={20} className="text-white" />, t('common:zoomOut'))}
            {zoom !== 1 && <span className="text-xs text-white/60 min-w-[32px] text-center">{zoom}x</span>}
            {iconBtn(onZoomIn, <ZoomIn size={20} className="text-white" />, t('common:zoomIn'))}
          </>
        )}
        {iconBtn(handleDownload, <Download size={20} className="text-white" />, t('common:download'))}
        {iconBtn(handleShare, <Share2 size={20} className="text-white" />, t('common:share'))}
        {iconBtn(onToggleInfoPanel,
          <Info size={20} className={infoPanelOpen ? 'text-white' : 'text-white/70'} />, t('common:detail')
        )}
        {iconBtn(handleFavorite,
          <Heart size={20} className={isFavorited ? 'text-red-500' : 'text-white'} fill={isFavorited ? 'currentColor' : 'none'} />, t('common:favorite')
        )}
      </div>
    </div>
  )
}

export default LightboxToolbar
