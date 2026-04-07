import { useRef, useEffect, useState } from 'react'
import { Play, Pause, Volume2, VolumeX, RotateCcw, RotateCw, Gauge, Music, Maximize, Minimize, RectangleHorizontal, RectangleVertical } from 'lucide-react'

interface AudioPlayerProps {
  src: string
  coverUrl?: string
  title?: string
  theaterMode?: boolean
  onToggleTheater?: () => void
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

export function AudioPlayer({ src, coverUrl, title, theaterMode = false, onToggleTheater }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [showControls] = useState(true)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
      const savedTime = localStorage.getItem(`audio-${src}`)
      if (savedTime) {
        const t = parseFloat(savedTime)
        audio.currentTime = t
        setCurrentTime(t)
      }
    }
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      localStorage.setItem(`audio-${src}`, audio.currentTime.toString())
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [src])

  // Close speed menu on outside click
  useEffect(() => {
    const handleClickOutside = () => setShowSpeedMenu(false)
    if (showSpeedMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showSpeedMenu])

  // Fullscreen change sync
  useEffect(() => {
    const handleFSChange = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFSChange)
    return () => document.removeEventListener('fullscreenchange', handleFSChange)
  }, [])

  const toggleFullscreen = () => {
    const container = containerRef.current
    if (!container) return
    if (!document.fullscreenElement) {
      container.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) { audio.play() } else { audio.pause() }
  }

  const seekBackward = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, audio.currentTime - 15)
  }

  const seekForward = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.min(audio.duration, audio.currentTime + 15)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    if (audioRef.current) audioRef.current.currentTime = val
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    setMuted(val === 0)
    if (audioRef.current) {
      audioRef.current.volume = val
      audioRef.current.muted = val === 0
    }
  }

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    if (audioRef.current) {
      audioRef.current.muted = next
      if (!next && volume === 0) {
        setVolume(0.5)
        audioRef.current.volume = 0.5
      }
    }
  }

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate)
    setShowSpeedMenu(false)
    if (audioRef.current) audioRef.current.playbackRate = rate
  }

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return '0:00'
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = Math.floor(s % 60)
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const effectiveVolume = muted ? 0 : volume

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black overflow-hidden"
      style={{ aspectRatio: '16/9', borderRadius: theaterMode ? 0 : '0.75rem' }}
      onClick={togglePlay}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Cover — fills entire container like a video poster */}
      {coverUrl ? (
        <img
          src={coverUrl}
          alt={title || ''}
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: 'cover' }}
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          <Music size={64} className="text-white/20" />
        </div>
      )}

      {/* Dim overlay so controls are always readable */}
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />

      {/* Controls overlay — always visible */}
      <div className="absolute inset-0 flex flex-col justify-end">
        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

        {/* Big play button (center) when paused */}
        {!isPlaying && (
          <button
            onClick={(e) => { e.stopPropagation(); togglePlay() }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full flex items-center justify-center transition-colors hover:bg-black/85"
            style={{ background: 'rgba(0,0,0,0.7)' }}
          >
            <Play size={32} fill="white" className="text-white ml-1" />
          </button>
        )}

        {/* Controls bar */}
        <div className="relative z-10 px-4 pb-4 pt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
          {/* Progress bar */}
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
            style={{
              background: `linear-gradient(to right, #dc2626 ${duration > 0 ? (currentTime / duration) * 100 : 0}%, rgba(255,255,255,0.3) ${duration > 0 ? (currentTime / duration) * 100 : 0}%)`,
            }}
          />

          {/* Buttons row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {/* Play/Pause */}
              <button onClick={togglePlay} className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer">
                {isPlaying ? <Pause size={22} /> : <Play size={22} />}
              </button>

              {/* Seek ±15s */}
              <button onClick={seekBackward} className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer relative" title="-15s">
                <RotateCcw size={20} />
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-bold">15</span>
              </button>
              <button onClick={seekForward} className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer relative" title="+15s">
                <RotateCw size={20} />
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-bold">15</span>
              </button>

              {/* Time */}
              <span className="text-white text-sm ml-2 tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {/* Volume */}
              <div
                className="flex items-center"
                onMouseEnter={() => setShowVolumeSlider(true)}
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                <button onClick={toggleMute} className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer">
                  {muted || effectiveVolume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <div className={`ml-1 overflow-hidden transition-all duration-200 ${showVolumeSlider ? 'w-20 opacity-100' : 'w-0 opacity-0'}`}>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={effectiveVolume}
                    onChange={handleVolumeChange}
                    className="w-full h-1 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                    style={{ background: `linear-gradient(to right, #fff ${effectiveVolume * 100}%, rgba(255,255,255,0.3) ${effectiveVolume * 100}%)` }}
                  />
                </div>
              </div>

              {/* Speed */}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(!showSpeedMenu) }}
                  className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Gauge size={20} />
                  <span className="text-xs font-medium">{playbackRate === 1 ? '1x' : `${playbackRate}x`}</span>
                </button>
                {showSpeedMenu && (
                  <div className="absolute bottom-full right-0 mb-2 rounded-lg py-1 min-w-[80px] shadow-lg" style={{ background: 'rgba(24,24,27,0.95)' }} onClick={(e) => e.stopPropagation()}>
                    {PLAYBACK_RATES.map((rate) => (
                      <button
                        key={rate}
                        onClick={(e) => { e.stopPropagation(); changePlaybackRate(rate) }}
                        className={`w-full px-3 py-1.5 text-sm text-left hover:bg-white/10 transition-colors cursor-pointer text-white flex items-center gap-1.5 ${playbackRate === rate ? 'font-bold' : ''}`}
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
                <button onClick={onToggleTheater} className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer">
                  {theaterMode ? <RectangleVertical size={20} /> : <RectangleHorizontal size={20} />}
                </button>
              )}

              {/* Fullscreen */}
              <button onClick={toggleFullscreen} className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer">
                {fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
