import { useRef, useEffect, useState } from 'react'
import { Play, Pause } from 'lucide-react'

interface AudioPlayerProps {
  src: string
}

export function AudioPlayer({ src }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
      const savedTime = localStorage.getItem(`audio-${src}`)
      if (savedTime) {
        audio.currentTime = parseFloat(savedTime)
      }
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      localStorage.setItem(`audio-${src}`, audio.currentTime.toString())
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('play', () => setIsPlaying(true))
    audio.addEventListener('pause', () => setIsPlaying(false))

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
    }
  }, [src])

  const togglePlay = () => {
    if (audioRef.current?.paused) {
      audioRef.current.play()
    } else {
      audioRef.current?.pause()
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      audioRef.current.currentTime = parseFloat(e.target.value)
    }
  }

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="w-full bg-gray-50 border border-gray-200 rounded-lg p-4">
      <audio ref={audioRef} src={src} />
      <div className="flex items-center gap-4">
        <button
          onClick={togglePlay}
          className="flex-shrink-0 p-2 hover:bg-gray-200 rounded-full"
        >
          {isPlaying ? (
            <Pause className="w-6 h-6" />
          ) : (
            <Play className="w-6 h-6" />
          )}
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 w-10">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min="0"
              max={duration}
              value={currentTime}
              onChange={handleSeek}
              className="w-full"
            />
            <span className="text-xs text-gray-600 w-10">
              {formatTime(duration)}
            </span>
          </div>
        </div>
        <select
          value={playbackRate}
          onChange={(e) => {
            const rate = parseFloat(e.target.value)
            setPlaybackRate(rate)
            if (audioRef.current) {
              audioRef.current.playbackRate = rate
            }
          }}
          className="px-2 py-1 border border-gray-300 rounded text-sm"
        >
          <option value={0.75}>0.75x</option>
          <option value={1}>1x</option>
          <option value={1.25}>1.25x</option>
          <option value={1.5}>1.5x</option>
          <option value={2}>2x</option>
        </select>
      </div>
    </div>
  )
}
