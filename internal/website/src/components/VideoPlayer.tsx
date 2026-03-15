import { useEffect, useRef } from 'react'
import Player from 'xgplayer'
import HlsPlugin from 'xgplayer-hls'
import 'xgplayer/dist/index.min.css'

interface VideoPlayerProps {
  src: string
  poster?: string
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
}

// VideoPlayer wraps XGPlayer with HLS support for video playback.
function VideoPlayer({ src, poster, autoplay = false, loop = false, muted = false }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)

  useEffect(() => {
    if (!containerRef.current || !src) return

    // Detect if the source is HLS (m3u8)
    const isHLS = src.includes('.m3u8') || src.includes('m3u8')

    // Initialize XGPlayer
    playerRef.current = new Player({
      el: containerRef.current,
      url: src,
      poster: poster || '',
      autoplay,
      loop,
      muted,
      playsinline: true,
      // Enable HLS plugin if needed
      plugins: isHLS ? [HlsPlugin] : [],
      // XGPlayer configuration
      lang: 'zh-cn',
      fluid: true,
      videoInit: true,
      // Playback controls
      closeVideoClick: false,
      closeVideoDblclick: false,
      // UI settings
      marginControls: false,
      screenShot: true,
      pip: true,
      keyboard: {
        seekStep: 5,
      },
    })

    // Cleanup on unmount
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
  }, [src, poster, autoplay, loop, muted])

  return <div ref={containerRef} className="w-full h-full" />
}

export default VideoPlayer
