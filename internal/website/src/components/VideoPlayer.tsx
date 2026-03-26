import { useRef, useEffect, useState } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, RectangleHorizontal, RectangleVertical, RotateCcw, RotateCw, PictureInPicture2, Gauge, SkipBack, SkipForward } from 'lucide-react'

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

const PLAYBACK_PROGRESS_KEY = 'video_playback_progress'

// VideoPlayer uses native HTML5 video with custom controls.
function VideoPlayer({ src, poster, autoplay = false, loop = false, muted = false, theaterMode = false, onToggleTheater, contentId, hasPlaylist = false, onPrev, onNext, hasPrev = false, hasNext = false }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [mutedState, setMutedState] = useState(muted)
  const [fullscreen, setFullscreen] = useState(false)
  const [, setIsPiP] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const controlsTimeoutRef = useRef<number | null>(null)

  // Format time to mm:ss
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Handle play/pause
  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play()
    } else {
      video.pause()
    }
  }

  // Seek backward/forward 15 seconds
  const seekBackward = () => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = Math.max(0, video.currentTime - 15)
  }

  const seekForward = () => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = Math.min(video.duration, video.currentTime + 15)
  }

  // Handle seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = parseFloat(e.target.value)
  }

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) return
    const newVolume = parseFloat(e.target.value)
    video.volume = newVolume
    setVolume(newVolume)
    setMutedState(newVolume === 0)
  }

  // Toggle mute
  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setMutedState(video.muted)
  }

  // Toggle fullscreen
  const toggleFullscreen = () => {
    const container = containerRef.current
    if (!container) return

    if (!document.fullscreenElement) {
      container.requestFullscreen()
      setFullscreen(true)
    } else {
      document.exitFullscreen()
      setFullscreen(false)
    }
  }

  // Toggle Picture-in-Picture
  const togglePiP = async () => {
    const video = videoRef.current
    if (!video) return

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
        setIsPiP(false)
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture()
        setIsPiP(true)
      }
    } catch (error) {
      console.error('PiP error:', error)
    }
  }

  // Change playback speed
  const changePlaybackRate = (rate: number) => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = rate
    setPlaybackRate(rate)
    setShowSpeedMenu(false)
  }

  const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3]

  // Show controls temporarily
  const showControlsTemporarily = () => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (playing) {
        setShowControls(false)
      }
    }, 3000)
  }

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const saveProgress = (time: number) => {
      if (!contentId) return
      try {
        const data = JSON.parse(localStorage.getItem(PLAYBACK_PROGRESS_KEY) || '{}')
        data[contentId] = { time, savedAt: Date.now() }
        localStorage.setItem(PLAYBACK_PROGRESS_KEY, JSON.stringify(data))
      } catch {
        // Ignore localStorage errors
      }
    }

    const loadProgress = (): number | null => {
      if (!contentId) return null
      try {
        const data = JSON.parse(localStorage.getItem(PLAYBACK_PROGRESS_KEY) || '{}')
        return data[contentId]?.time ?? null
      } catch {
        return null
      }
    }

    let lastSavedTime = 0

    const handlePlay = () => setPlaying(true)
    const handlePause = () => setPlaying(false)
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      // Save progress every 5 seconds
      if (video.currentTime - lastSavedTime >= 5) {
        saveProgress(video.currentTime)
        lastSavedTime = video.currentTime
      }
    }
    const handleDurationChange = () => setDuration(video.duration)
    const handleVolumeChange = () => {
      setVolume(video.volume)
      setMutedState(video.muted)
    }
    const handleEnterPiP = () => setIsPiP(true)
    const handleLeavePiP = () => setIsPiP(false)
    const handleLoadedMetadata = () => {
      // Restore playback position
      const savedTime = loadProgress()
      if (savedTime && savedTime < video.duration - 5) {
        video.currentTime = savedTime
      }
    }
    const handleEnded = () => {
      // Clear saved progress when video ends
      if (contentId) {
        try {
          const data = JSON.parse(localStorage.getItem(PLAYBACK_PROGRESS_KEY) || '{}')
          delete data[contentId]
          localStorage.setItem(PLAYBACK_PROGRESS_KEY, JSON.stringify(data))
        } catch {
          // Ignore
        }
      }
    }

    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('durationchange', handleDurationChange)
    video.addEventListener('volumechange', handleVolumeChange)
    video.addEventListener('enterpictureinpicture', handleEnterPiP)
    video.addEventListener('leavepictureinpicture', handleLeavePiP)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('durationchange', handleDurationChange)
      video.removeEventListener('volumechange', handleVolumeChange)
      video.removeEventListener('enterpictureinpicture', handleEnterPiP)
      video.removeEventListener('leavepictureinpicture', handleLeavePiP)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('ended', handleEnded)
    }
  }, [contentId])

  // Fullscreen change handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Close speed menu on outside click
  useEffect(() => {
    const handleClickOutside = () => setShowSpeedMenu(false)
    if (showSpeedMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showSpeedMenu])

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
      <div
        className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
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
        <div className="relative z-10 p-4 space-y-2">
          {/* Progress bar */}
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-red-600 [&::-webkit-slider-thumb]:cursor-pointer"
            style={{
              background: `linear-gradient(to right, #dc2626 ${(currentTime / duration) * 100}%, rgba(255,255,255,0.3) ${(currentTime / duration) * 100}%)`,
            }}
          />

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {/* Previous video */}
              {hasPlaylist && (
                <button onClick={onPrev} disabled={!hasPrev} className={`rounded-full p-1.5 transition-colors cursor-pointer ${hasPrev ? 'text-white hover:bg-white/20' : 'text-white/30 cursor-not-allowed'}`} title="上一个视频">
                  <SkipBack size={20} />
                </button>
              )}
              {/* Play/Pause */}
              <button onClick={togglePlay} className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer" title={playing ? '暂停' : '播放'}>
                {playing ? <Pause size={22} /> : <Play size={22} />}
              </button>
              {/* Next video */}
              {hasPlaylist && (
                <button onClick={onNext} disabled={!hasNext} className={`rounded-full p-1.5 transition-colors cursor-pointer ${hasNext ? 'text-white hover:bg-white/20' : 'text-white/30 cursor-not-allowed'}`} title="下一个视频">
                  <SkipForward size={20} />
                </button>
              )}
              {/* Seek backward 15s */}
              <button onClick={seekBackward} className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer relative" title="后退 15 秒">
                <RotateCcw size={20} />
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-bold">15</span>
              </button>
              {/* Seek forward 15s */}
              <button onClick={seekForward} className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer relative" title="前进 15 秒">
                <RotateCw size={20} />
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-bold">15</span>
              </button>

              {/* Time */}
              <span className="text-white text-sm ml-2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {/* Volume - YouTube style */}
              <div
                className="flex items-center group/volume relative"
                onMouseEnter={() => setShowVolumeSlider(true)}
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                <button onClick={toggleMute} className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer" title={mutedState ? '取消静音' : '静音'}>
                  {mutedState || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                {/* Volume slider - appears on hover */}
                <div
                  className={`ml-1 overflow-hidden transition-all duration-200 ${
                    showVolumeSlider ? 'w-20 opacity-100' : 'w-0 opacity-0'
                  }`}
                >
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={mutedState ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-full h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white hover:[&::-webkit-slider-thumb]:scale-110 [&::-webkit-slider-thumb]:transition-transform"
                    style={{
                      background: `linear-gradient(to right, #fff ${volume * 100}%, rgba(255,255,255,0.3) ${volume * 100}%)`,
                    }}
                  />
                </div>
              </div>
              {/* Playback speed */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowSpeedMenu(!showSpeedMenu)
                  }}
                  className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer flex items-center gap-1"
                  title="播放速度"
                >
                  <Gauge size={20} />
                  <span className="text-xs font-medium">{playbackRate === 1 ? '1x' : `${playbackRate}x`}</span>
                </button>
                {/* Speed menu */}
                {showSpeedMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-zinc-900/95 rounded-lg py-1 min-w-[80px] shadow-lg" onClick={(e) => e.stopPropagation()}>
                    {playbackRates.map((rate) => (
                      <button
                        key={rate}
                        onClick={(e) => {
                          e.stopPropagation()
                          changePlaybackRate(rate)
                        }}
                        className={`w-full px-2 py-1.5 text-sm text-left hover:bg-white/10 transition-colors cursor-pointer text-white flex items-center gap-1.5 ${
                          playbackRate === rate ? 'font-bold' : ''
                        }`}
                      >
                        <span className={`w-1 h-1 rounded-full flex-shrink-0 ${playbackRate === rate ? 'bg-white' : 'bg-transparent'}`} />
                        {rate === 1 ? '正常' : `${rate}x`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Theater mode */}
              {onToggleTheater && (
                <button onClick={onToggleTheater} className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer" title={theaterMode ? '退出影院模式' : '影院模式'}>
                  {theaterMode ? <RectangleVertical size={20} /> : <RectangleHorizontal size={20} />}
                </button>
              )}
              {/* Picture-in-Picture */}
              <button onClick={togglePiP} className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer" title="画中画">
                <PictureInPicture2 size={20} />
              </button>
              {/* Fullscreen */}
              <button onClick={toggleFullscreen} className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer" title={fullscreen ? '退出全屏' : '全屏'}>
                {fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VideoPlayer
