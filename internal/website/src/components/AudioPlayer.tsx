import { useRef, useEffect, useState } from 'react'
import { Play, Pause, Volume2, VolumeX, Download } from 'lucide-react'

interface AudioPlayerProps {
  src: string
  downloadUrl?: string
  downloadFilename?: string
}

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

export function AudioPlayer({ src, downloadUrl, downloadFilename }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)

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

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) { audio.play() } else { audio.pause() }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    if (audioRef.current) audioRef.current.currentTime = val
  }

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const cycleRate = () => {
    const idx = RATES.indexOf(playbackRate)
    const next = RATES[(idx + 1) % RATES.length]
    setPlaybackRate(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return '0:00'
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = Math.floor(s % 60)
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const effectiveVolume = muted ? 0 : volume

  return (
    <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play / Pause */}
      <button
        onClick={togglePlay}
        className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full transition-colors"
        style={{ background: '#0f0f0f', color: '#fff' }}
      >
        {isPlaying
          ? <Pause size={16} fill="currentColor" />
          : <Play size={16} fill="currentColor" className="ml-0.5" />}
      </button>

      {/* Current time */}
      <span className="flex-shrink-0 text-xs tabular-nums" style={{ color: '#606060', minWidth: 36 }}>
        {formatTime(currentTime)}
      </span>

      {/* Progress bar */}
      <div className="relative flex-1 h-1.5 rounded-full cursor-pointer" style={{ background: '#d1d5db', minWidth: 60 }}>
        <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${progress}%`, background: '#0f0f0f' }} />
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          style={{ height: '100%', margin: 0 }}
        />
      </div>

      {/* Duration */}
      <span className="flex-shrink-0 text-xs tabular-nums" style={{ color: '#606060', minWidth: 36 }}>
        {formatTime(duration)}
      </span>

      {/* Volume */}
      <div className="flex-shrink-0 flex items-center gap-1.5">
        <button onClick={toggleMute} style={{ color: '#606060' }}>
          {muted || effectiveVolume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <div className="relative h-1 rounded-full hidden sm:block" style={{ background: '#d1d5db', width: 60 }}>
          <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${effectiveVolume * 100}%`, background: '#0f0f0f' }} />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={effectiveVolume}
            onChange={handleVolume}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
            style={{ height: '100%', margin: 0 }}
          />
        </div>
      </div>

      {/* Speed */}
      <button
        onClick={cycleRate}
        className="flex-shrink-0 px-2 py-0.5 rounded text-xs font-semibold transition-colors hover:bg-black/8"
        style={{ color: '#606060', minWidth: 32, textAlign: 'center' }}
      >
        {playbackRate === 1 ? '1×' : `${playbackRate}×`}
      </button>

      {/* Download */}
      {(downloadUrl || src) && (
        <a
          href={downloadUrl || src}
          download={downloadFilename || true}
          className="flex-shrink-0 transition-colors hover:opacity-70"
          style={{ color: '#606060' }}
          title="Download"
        >
          <Download size={16} />
        </a>
      )}
    </div>
  )
}
