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
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<Player | null>(null)

  useEffect(() => {
    if (!videoRef.current || !src) return

    // Initialize Video.js player
    const player = videojs(videoRef.current, {
      controls: true,
      autoplay,
      loop,
      muted,
      poster: poster || '',
      fluid: true,
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
      html5: {
        vhs: {
          overrideNative: true,
        },
        nativeVideoTracks: false,
        nativeAudioTracks: false,
        nativeTextTracks: false,
      },
    })

    playerRef.current = player

    // Cleanup on unmount
    return () => {
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose()
        playerRef.current = null
      }
    }
  }, [src, poster, autoplay, loop, muted])

  return (
    <div data-vjs-player>
      <video
        ref={videoRef}
        className="video-js vjs-big-play-centered vjs-theme-fantasy"
        playsInline
      >
        <source src={src} />
      </video>
    </div>
  )
}

export default VideoPlayer
