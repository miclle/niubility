import { useRef, useEffect, useState } from 'react'
import { Play, Pause, Volume2, VolumeX, Download, RotateCcw, RotateCw, Gauge, Music } from 'lucide-react'

interface AudioPlayerProps {
  src: string
  coverUrl?: string
  title?: string
  downloadUrl?: string
  downloadFilename?: string
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

export function AudioPlayer({ src, coverUrl, title, downloadUrl, downloadFilename }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [showControls, setShowControls] = useState(true)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const controlsTimeoutRef = useRef<number | null>(null)

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

  const showControlsTemporarily = () => {
    setShowControls(true)
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) setShowControls(false)
    }, 3000)
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
      className="relative w-full bg-black rounded-xl overflow-hidden group"
      style={{ aspectRatio: '16/9' }}
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onClick={() => !isPlaying && togglePlay()}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Blurred cover as background */}
      {coverUrl ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${coverUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(24px) brightness(0.35)',
            transform: 'scale(1.1)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-zinc-900" />
      )}

      {/* Center: album art */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ paddingBottom: 80 }}>
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={title || ''}
            className="rounded-xl shadow-2xl object-cover"
            style={{ height: '70%', aspectRatio: '1/1', maxHeight: 220 }}
          />
        ) : (
          <div className="w-28 h-28 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <Music size={48} className="text-white/30" />
          </div>
        )}
      </div>

      {/* Controls overlay — auto-hide when playing */}
      <div
        className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

        {/* Big play button (center) when paused */}
        {!isPlaying && (
          <button
            onClick={(e) => { e.stopPropagation(); togglePlay() }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full flex items-center justify-center transition-colors"
            style={{ background: 'rgba(0,0,0,0.65)', paddingBottom: 80 }}
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
              background: `linear-gradient(to right, #fff ${duration > 0 ? (currentTime / duration) * 100 : 0}%, rgba(255,255,255,0.3) ${duration > 0 ? (currentTime / duration) * 100 : 0}%)`,
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
                className="flex items-center group/volume"
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

              {/* Download */}
              {(downloadUrl || src) && (
                <a
                  href={downloadUrl || src}
                  download={downloadFilename || true}
                  className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors"
                  title="Download"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download size={20} />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
