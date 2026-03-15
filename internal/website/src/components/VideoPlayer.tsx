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
    // Log video events for debugging
    const video = videoRef.current
    if (!video) return

    const handleError = () => {
      console.error('Video error:', video.error)
    }

    video.addEventListener('error', handleError)
    return () => video.removeEventListener('error', handleError)
  }, [])

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      autoPlay={autoplay}
      loop={loop}
      muted={muted}
      controls
      playsInline
      className="w-full h-full bg-black"
      style={{ objectFit: 'contain' }}
    >
      您的浏览器不支持视频播放
    </video>
  )
}

export default VideoPlayer
