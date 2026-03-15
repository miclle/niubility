import { useEffect, useRef } from 'react'
import videojs from 'video.js'
import type Player from 'video.js/dist/types/player'
import 'video.js/dist/video-js.css'

interface VideoPlayerProps {
  src: string
  poster?: string
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
}

// VideoPlayer wraps Video.js for video playback with HLS support.
function VideoPlayer({ src, poster, autoplay = false, loop = false, muted = false }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Create video element programmatically
    const videoElement = document.createElement('video')
    videoElement.className = 'video-js vjs-big-play-centered vjs-fluid'
    videoElement.setAttribute('playsinline', 'true')
    containerRef.current.appendChild(videoElement)

    // Initialize Video.js
    const player = videojs(videoElement, {
      controls: true,
      autoplay,
      loop,
      muted,
      poster: poster || '',
      responsive: true,
      playbackRates: [0.5, 1, 1.25, 1.5, 2],
      controlBar: {
        children: [
          'playToggle',
          'volumePanel',
          'currentTimeDisplay',
          'timeDivider',
          'durationDisplay',
          'progressControl',
          'playbackRateMenuButton',
          'fullscreenToggle',
        ],
      },
      sources: [{ src }],
    })

    playerRef.current = player

    return () => {
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose()
        playerRef.current = null
      }
    }
  }, [src, poster, autoplay, loop, muted])

  return <div ref={containerRef} className="w-full h-full video-js-container" />
}

export default VideoPlayer
