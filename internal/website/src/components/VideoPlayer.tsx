import { useEffect, useRef, useState } from 'react'
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
  const [videoType, setVideoType] = useState<string | null>(null)

  // Detect video type from URL or fetch Content-Type header
  useEffect(() => {
    if (!src) return

    // Check URL extension
    const urlPath = src.split('?')[0].toLowerCase()
    if (urlPath.endsWith('.m3u8')) {
      setVideoType('hls')
      return
    }
    if (urlPath.endsWith('.mp4')) {
      setVideoType('mp4')
      return
    }
    if (urlPath.endsWith('.webm')) {
      setVideoType('webm')
      return
    }
    if (urlPath.endsWith('.flv')) {
      setVideoType('flv')
      return
    }

    // No extension - fetch Content-Type header to detect type
    fetch(src, { method: 'HEAD' })
      .then((res) => {
        const contentType = res.headers.get('Content-Type') || ''
        if (contentType.includes('application/vnd.apple.mpegurl') || contentType.includes('application/x-mpegurl')) {
          setVideoType('hls')
        } else if (contentType.includes('video/mp4')) {
          setVideoType('mp4')
        } else if (contentType.includes('video/webm')) {
          setVideoType('webm')
        } else if (contentType.includes('video/x-flv')) {
          setVideoType('flv')
        } else {
          // Default to mp4 for unknown types
          setVideoType('mp4')
        }
      })
      .catch(() => {
        // Default to mp4 on error
        setVideoType('mp4')
      })
  }, [src])

  // Initialize player after type is detected
  useEffect(() => {
    if (!containerRef.current || !src || !videoType) return

    const isHLS = videoType === 'hls'

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
  }, [src, poster, autoplay, loop, muted, videoType])

  // Show loading while detecting video type
  if (!videoType) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="text-white text-sm">检测视频格式...</div>
      </div>
    )
  }

  return <div ref={containerRef} className="w-full h-full" />
}

export default VideoPlayer
