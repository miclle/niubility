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
    if (!containerRef.current || !src) return

    // Create video element
    const videoElement = document.createElement('video')
    videoElement.className = 'video-js vjs-big-play-centered vjs-fluid'
    videoElement.setAttribute('playsinline', 'true')
    videoElement.setAttribute('crossorigin', 'anonymous')
    containerRef.current.appendChild(videoElement)

    // Initialize Video.js player
    const player = videojs(videoElement, {
      controls: true,
      autoplay,
      loop,
      muted,
      poster: poster || '',
      responsive: true,
      playbackRates: [0.5, 1, 1.25, 1.5, 2],
      html5: {
        vhs: {
          overrideNative: false,
        },
      },
      sources: [{ src }],
    })

    playerRef.current = player

    // Cleanup on unmount
    return () => {
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose()
        playerRef.current = null
      }
      // Remove video element if still in DOM
      if (videoElement.parentNode) {
        videoElement.parentNode.removeChild(videoElement)
      }
    }
  }, [src, poster, autoplay, loop, muted])

  return <div ref={containerRef} className="w-full h-full" data-vjs-player />
}

export default VideoPlayer
