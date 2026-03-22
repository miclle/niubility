import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

import { fileURL } from 'src/api/upload'
import type { Attachment } from 'src/types/content'

// LightboxProps defines the props for the Lightbox component.
interface LightboxProps {
  items: Attachment[]
  initialIndex: number
  open: boolean
  onClose: () => void
}

// THUMB_SIZE is the thumbnail size in the bottom strip.
const THUMB_SIZE = 56
// THUMB_GAP is the gap between thumbnails.
const THUMB_GAP = 4

// Lightbox displays a fullscreen image/video viewer with navigation and thumbnail strip.
function Lightbox({ items, initialIndex, open, onClose }: LightboxProps) {
  const [current, setCurrent] = useState(initialIndex)
  const thumbStripRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const dragState = useRef({ isDragging: false, startX: 0, scrollLeft: 0, moved: false })

  // Reset current index when opened with a new initialIndex
  useEffect(() => {
    if (open) setCurrent(initialIndex)
  }, [open, initialIndex])

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const goTo = useCallback((index: number) => {
    setCurrent((index + items.length) % items.length)
  }, [items.length])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') goTo(current - 1)
      else if (e.key === 'ArrowRight') goTo(current + 1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, current, goTo, onClose])

  // Auto-scroll thumbnail strip to keep current visible
  useEffect(() => {
    if (!thumbStripRef.current) return
    const el = thumbStripRef.current
    const thumbCenter = current * (THUMB_SIZE + THUMB_GAP) + THUMB_SIZE / 2
    const scrollTarget = thumbCenter - el.clientWidth / 2
    el.scrollTo({ left: scrollTarget, behavior: 'smooth' })
  }, [current])

  // Auto-play video when switching to a video item
  useEffect(() => {
    if (!open) return
    if (items[current]?.type === 'video' && videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => {})
    }
  }, [open, current, items])

  // Drag-to-scroll handlers for thumbnail strip
  const handleThumbMouseDown = useCallback((e: React.MouseEvent) => {
    const el = thumbStripRef.current
    if (!el) return
    dragState.current = { isDragging: true, startX: e.clientX, scrollLeft: el.scrollLeft, moved: false }
    el.style.cursor = 'grabbing'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const ds = dragState.current
      if (!ds.isDragging || !thumbStripRef.current) return
      const dx = e.clientX - ds.startX
      if (Math.abs(dx) > 3) ds.moved = true
      thumbStripRef.current.scrollLeft = ds.scrollLeft - dx
    }
    const handleMouseUp = () => {
      if (!dragState.current.isDragging) return
      dragState.current.isDragging = false
      if (thumbStripRef.current) thumbStripRef.current.style.cursor = ''
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const handleThumbClick = useCallback((i: number) => {
    // Ignore click if it was a drag gesture
    if (dragState.current.moved) return
    setCurrent(i)
  }, [])

  if (!open || items.length === 0) return null

  const attachment = items[current]
  const src = fileURL(attachment.url)
  const isVideo = attachment.type === 'video'

  return createPortal(
    <div className="fixed inset-0 flex flex-col" style={{ zIndex: 100, background: 'rgba(0,0,0,0.95)' }}>
      {/* Top bar: counter + close */}
      <div className="flex items-center justify-between px-4 h-12 flex-shrink-0">
        <div className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
          {current + 1} / {items.length}
        </div>
        <button onClick={onClose} className="p-2 rounded-full transition-colors hover:bg-white/10">
          <X size={22} className="text-white" />
        </button>
      </div>

      {/* Main media area */}
      <div className="flex-1 relative flex items-center justify-center min-h-0 px-16" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
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
            key={current}
            src={src}
            alt={attachment.title || `${current + 1}`}
            className="max-w-full max-h-full object-contain select-none"
            draggable={false}
          />
        )}

        {/* Navigation arrows */}
        {items.length > 1 && (
          <>
            <button
              onClick={() => goTo(current - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
            >
              <ChevronLeft size={28} className="text-white" />
            </button>
            <button
              onClick={() => goTo(current + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
            >
              <ChevronRight size={28} className="text-white" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip — horizontally scrollable */}
      {items.length > 1 && (
        <div className="flex-shrink-0 py-3 px-4 overflow-hidden">
          <div ref={thumbStripRef} className="flex gap-1 overflow-x-auto select-none" style={{ scrollbarWidth: 'none', cursor: 'grab' }} onMouseDown={handleThumbMouseDown}>
            {items.map((item, i) => {
              const thumbSrc = fileURL(item.url)
              const isActive = i === current
              return (
                <button
                  key={item.id || i}
                  className="relative flex-shrink-0 rounded overflow-hidden transition-opacity"
                  style={{
                    width: THUMB_SIZE,
                    height: THUMB_SIZE,
                    opacity: isActive ? 1 : 0.5,
                    outline: isActive ? '2px solid white' : '2px solid transparent',
                    outlineOffset: -2,
                  }}
                  onClick={() => handleThumbClick(i)}
                >
                  {item.type === 'video' ? (
                    <video src={thumbSrc} className="w-full h-full object-cover" muted preload="metadata" />
                  ) : (
                    <img src={thumbSrc} alt="" className="w-full h-full object-cover" loading="lazy" draggable={false} />
                  )}
                  {item.type === 'video' && (
                    <div className="absolute bottom-0.5 right-0.5 px-1 rounded text-[9px]" style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}>
                      视频
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}

export default Lightbox
