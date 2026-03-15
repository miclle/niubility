import { useRef, useEffect } from 'react'

interface VideoPlayerProps {
  src: string
  poster?: string
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
}

// VideoPlayer uses native HTML5 video with custom controls styling.
function VideoPlayer({ src, poster, autoplay = false, loop = false, muted = false }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleError = (e: Event) => {
      const target = e.target as HTMLVideoElement
      console.error('Video error:', {
        code: target.error?.code,
        message: target.error?.message,
        networkState: target.networkState,
        readyState: target.readyState,
        currentSrc: target.currentSrc,
      })
    }

    const handleLoadedMetadata = () => {
      console.log('Video loaded:', {
        duration: video.duration,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
      })
    }

    video.addEventListener('error', handleError)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)

    // Force reload
    video.load()

    return () => {
      video.removeEventListener('error', handleError)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
    }
  }, [src])

  return (
    <video
      ref={videoRef}
      poster={poster}
      autoPlay={autoplay}
      loop={loop}
      muted={muted}
      controls
      playsInline
      preload="metadata"
      className="w-full h-full bg-black"
      style={{ objectFit: 'contain' }}
    >
      <source src={src} type="video/mp4" />
      您的浏览器不支持视频播放
    </video>
  )
}

export default VideoPlayer
