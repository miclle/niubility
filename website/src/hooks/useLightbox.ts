import { useState, useEffect, useCallback, useRef } from 'react'

const THUMB_SIZE = 56
const THUMB_GAP = 4
const ZOOM_LEVELS = [1, 1.5, 2, 3]

interface UseLightboxOptions {
  items: { type?: string }[]
  initialIndex: number
  open: boolean
  onClose: () => void
  onIndexChange?: (index: number) => void
  initialInfoPanelOpen: boolean
  thumbStripRef: React.RefObject<HTMLDivElement>
  videoRef: React.RefObject<HTMLVideoElement>
}

// useLightbox manages navigation, zoom, keyboard, scroll-lock and drag-scroll for the Lightbox.
export function useLightbox({
  items, initialIndex, open, onClose, onIndexChange,
  initialInfoPanelOpen, thumbStripRef, videoRef,
}: UseLightboxOptions) {
  const [current, setCurrent] = useState(initialIndex)
  const [zoom, setZoom] = useState(1)
  const [infoPanelOpen, setInfoPanelOpen] = useState(false)
  const dragState = useRef({ isDragging: false, startX: 0, scrollLeft: 0, moved: false })

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setCurrent(initialIndex)
      setZoom(1)
      setInfoPanelOpen(initialInfoPanelOpen)
    }
  }, [open, initialIndex, initialInfoPanelOpen])

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
  }, [current, thumbStripRef])

  // Auto-play video
  useEffect(() => {
    if (!open) return
    if (items[current]?.type === 'video' && videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => {})
    }
  }, [open, current, items, videoRef])

  // Drag-to-scroll for thumbnail strip
  const handleThumbMouseDown = useCallback((e: React.MouseEvent) => {
    const el = thumbStripRef.current
    if (!el) return
    dragState.current = { isDragging: true, startX: e.clientX, scrollLeft: el.scrollLeft, moved: false }
    el.style.cursor = 'grabbing'
  }, [thumbStripRef])

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
  }, [thumbStripRef])

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

  return {
    current, zoom, infoPanelOpen, setInfoPanelOpen,
    goTo, handleThumbMouseDown, handleThumbClick,
    handleZoomIn, handleZoomOut,
  }
}
