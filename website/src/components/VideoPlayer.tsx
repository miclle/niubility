import { useRef, useEffect } from 'react'
import { Play } from 'lucide-react'

import VideoControlBar from 'src/components/VideoControlBar'
import { useVideoPlayer } from 'src/hooks/useVideoPlayer'

interface VideoPlayerProps {
  src: string
  poster?: string
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
  theaterMode?: boolean
  onToggleTheater?: () => void
  contentId?: string
  hasPlaylist?: boolean
  onPrev?: () => void
  onNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
}

// VideoPlayer uses native HTML5 video with custom controls.
function VideoPlayer({ src, poster, autoplay = false, loop = false, muted = false, theaterMode = false, onToggleTheater, contentId, hasPlaylist = false, onPrev, onNext, hasPrev = false, hasNext = false }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const {
    playing, currentTime, duration, volume, mutedState, fullscreen,
    playbackRate, showSpeedMenu, showControls, showVolumeSlider,
    setShowSpeedMenu, setShowVolumeSlider, setShowControls,
    formatTime, togglePlay, seekBackward, seekForward,
    handleSeek, handleVolumeChange, toggleMute,
    toggleFullscreen, togglePiP, changePlaybackRate,
    showControlsTemporarily,
  } = useVideoPlayer({ videoRef, containerRef, contentId, loop })

  // Close speed menu on outside click
  useEffect(() => {
    const handleClickOutside = () => setShowSpeedMenu(false)
    if (showSpeedMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showSpeedMenu, setShowSpeedMenu])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black group"
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay={autoplay}
        loop={loop}
        muted={muted}
        playsInline
        className="w-full h-full"
        style={{ objectFit: 'contain' }}
        onClick={togglePlay}
      />

      {/* Custom controls overlay */}
      <div className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Big play button (center) */}
        {!playing && (
          <button
            onClick={togglePlay}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-black/70 flex items-center justify-center hover:bg-black/85 transition-colors"
          >
            <Play size={32} fill="white" className="text-white ml-1" />
          </button>
        )}

        {/* Controls bar */}
        <VideoControlBar
          playing={playing}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          mutedState={mutedState}
          fullscreen={fullscreen}
          playbackRate={playbackRate}
          showSpeedMenu={showSpeedMenu}
          showVolumeSlider={showVolumeSlider}
          theaterMode={theaterMode}
          hasPlaylist={hasPlaylist}
          hasPrev={hasPrev}
          hasNext={hasNext}
          formatTime={formatTime}
          togglePlay={togglePlay}
          seekBackward={seekBackward}
          seekForward={seekForward}
          handleSeek={handleSeek}
          handleVolumeChange={handleVolumeChange}
          toggleMute={toggleMute}
          toggleFullscreen={toggleFullscreen}
          togglePiP={togglePiP}
          changePlaybackRate={changePlaybackRate}
          setShowSpeedMenu={setShowSpeedMenu}
          setShowVolumeSlider={setShowVolumeSlider}
          onToggleTheater={onToggleTheater}
          onPrev={onPrev}
          onNext={onNext}
        />
      </div>
    </div>
  )
}

export default VideoPlayer
