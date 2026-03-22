import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react'

import { fileURL } from 'src/api/upload'
import type { Attachment } from 'src/types/content'

// MediaCarouselProps defines the props for the MediaCarousel component.
interface MediaCarouselProps {
  items: Attachment[]
}

// MediaCarousel displays a carousel of images and short videos.
function MediaCarousel({ items }: MediaCarouselProps) {
  const [current, setCurrent] = useState(0)
  const [muted, setMuted] = useState(true)
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map())

  const total = items.length
  const currentItem = total > 0 ? items[current] : null
  const resolvedUrl = currentItem ? fileURL(currentItem.url) : ''

  // Auto-play video when it becomes current
  useEffect(() => {
    if (currentItem?.type === 'video') {
      const video = videoRefs.current.get(current)
      if (video) {
        video.currentTime = 0
        video.play().catch(() => {})
      }
    }
  }, [current, currentItem])

  if (!currentItem) return null

  const goTo = (index: number) => {
    // Pause current video if any
    const currentVideo = videoRefs.current.get(current)
    if (currentVideo) currentVideo.pause()
    setCurrent(index)
  }

  const goPrev = () => goTo((current - 1 + total) % total)
  const goNext = () => goTo((current + 1) % total)

  return (
    <div className="relative bg-black rounded-xl overflow-hidden">
      {/* Main display area */}
      <div className="relative" style={{ aspectRatio: '4/3' }}>
        {currentItem.type === 'video' ? (
          <video
            ref={(el) => { if (el) videoRefs.current.set(current, el) }}
            src={resolvedUrl}
            className="w-full h-full object-contain"
            muted={muted}
            loop
            playsInline
            autoPlay
          />
        ) : (
          <img
            src={resolvedUrl}
            alt={currentItem.title || `图片 ${current + 1}`}
            className="w-full h-full object-contain"
          />
        )}

        {/* Navigation arrows */}
        {total > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'rgba(0,0,0,0.5)' }}
            >
              <ChevronLeft size={24} className="text-white" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'rgba(0,0,0,0.5)' }}
            >
              <ChevronRight size={24} className="text-white" />
            </button>
          </>
        )}

        {/* Video mute toggle */}
        {currentItem.type === 'video' && (
          <button
            onClick={() => setMuted(!muted)}
            className="absolute bottom-3 right-3 p-2 rounded-full transition-colors"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            {muted ? <VolumeX size={18} className="text-white" /> : <Volume2 size={18} className="text-white" />}
          </button>
        )}

        {/* Counter badge */}
        {total > 1 && (
          <div
            className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
          >
            {current + 1} / {total}
          </div>
        )}
      </div>

      {/* Dot indicators */}
      {total > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-3">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="rounded-full transition-all"
              style={{
                width: i === current ? 20 : 6,
                height: 6,
                background: i === current ? 'white' : 'rgba(255,255,255,0.4)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default MediaCarousel
