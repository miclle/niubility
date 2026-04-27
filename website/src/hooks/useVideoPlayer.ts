import { useState, useEffect, useRef } from 'react'

const PLAYBACK_PROGRESS_KEY = 'video_playback_progress'

interface UseVideoPlayerOptions {
  videoRef: React.RefObject<HTMLVideoElement>
  containerRef: React.RefObject<HTMLDivElement>
  contentId?: string
  loop?: boolean
}

// useVideoPlayer manages video playback state, controls, and progress persistence.
export function useVideoPlayer({ videoRef, containerRef, contentId }: UseVideoPlayerOptions) {
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [mutedState, setMutedState] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [, setIsPiP] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const controlsTimeoutRef = useRef<number | null>(null)

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) video.play()
    else video.pause()
  }

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

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = parseFloat(e.target.value)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) return
    const newVolume = parseFloat(e.target.value)
    video.volume = newVolume
    setVolume(newVolume)
    setMutedState(newVolume === 0)
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setMutedState(video.muted)
  }

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

  const changePlaybackRate = (rate: number) => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = rate
    setPlaybackRate(rate)
    setShowSpeedMenu(false)
  }

  const showControlsTemporarily = () => {
    setShowControls(true)
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (playing) setShowControls(false)
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
      } catch { /* Ignore localStorage errors */ }
    }

    const loadProgress = (): number | null => {
      if (!contentId) return null
      try {
        const data = JSON.parse(localStorage.getItem(PLAYBACK_PROGRESS_KEY) || '{}')
        return data[contentId]?.time ?? null
      } catch { return null }
    }

    let lastSavedTime = 0

    const handlePlay = () => setPlaying(true)
    const handlePause = () => setPlaying(false)
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      if (video.currentTime - lastSavedTime >= 5) {
        saveProgress(video.currentTime)
        lastSavedTime = video.currentTime
      }
    }
    const handleDurationChange = () => setDuration(video.duration)
    const handleVolumeEvt = () => { setVolume(video.volume); setMutedState(video.muted) }
    const handleEnterPiP = () => setIsPiP(true)
    const handleLeavePiP = () => setIsPiP(false)
    const handleLoadedMetadata = () => {
      const savedTime = loadProgress()
      if (savedTime && savedTime < video.duration - 5) video.currentTime = savedTime
    }
    const handleEnded = () => {
      if (!contentId) return
      try {
        const data = JSON.parse(localStorage.getItem(PLAYBACK_PROGRESS_KEY) || '{}')
        delete data[contentId]
        localStorage.setItem(PLAYBACK_PROGRESS_KEY, JSON.stringify(data))
      } catch { /* Ignore */ }
    }

    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('durationchange', handleDurationChange)
    video.addEventListener('volumechange', handleVolumeEvt)
    video.addEventListener('enterpictureinpicture', handleEnterPiP)
    video.addEventListener('leavepictureinpicture', handleLeavePiP)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('durationchange', handleDurationChange)
      video.removeEventListener('volumechange', handleVolumeEvt)
      video.removeEventListener('enterpictureinpicture', handleEnterPiP)
      video.removeEventListener('leavepictureinpicture', handleLeavePiP)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('ended', handleEnded)
    }
  }, [contentId, videoRef])

  // Fullscreen change handler
  useEffect(() => {
    const handleFullscreenChange = () => setFullscreen(!!document.fullscreenElement)
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

  return {
    playing, currentTime, duration, volume, mutedState, fullscreen,
    playbackRate, showSpeedMenu, showControls, showVolumeSlider,
    setShowSpeedMenu, setShowVolumeSlider, setShowControls,
    formatTime, togglePlay, seekBackward, seekForward,
    handleSeek, handleVolumeChange, toggleMute,
    toggleFullscreen, togglePiP, changePlaybackRate,
    showControlsTemporarily,
  }
}
