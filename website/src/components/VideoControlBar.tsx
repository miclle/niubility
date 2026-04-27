import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, RectangleHorizontal, RectangleVertical, RotateCcw, RotateCw, PictureInPicture2, Gauge, SkipBack, SkipForward } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3]

// VideoControlBarProps defines the props for the VideoControlBar component.
interface VideoControlBarProps {
  playing: boolean
  currentTime: number
  duration: number
  volume: number
  mutedState: boolean
  fullscreen: boolean
  playbackRate: number
  showSpeedMenu: boolean
  showVolumeSlider: boolean
  theaterMode?: boolean
  hasPlaylist?: boolean
  hasPrev?: boolean
  hasNext?: boolean
  formatTime: (time: number) => string
  togglePlay: () => void
  seekBackward: () => void
  seekForward: () => void
  handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  toggleMute: () => void
  toggleFullscreen: () => void
  togglePiP: () => void
  changePlaybackRate: (rate: number) => void
  setShowSpeedMenu: (v: boolean | ((prev: boolean) => boolean)) => void
  setShowVolumeSlider: (v: boolean) => void
  onToggleTheater?: () => void
  onPrev?: () => void
  onNext?: () => void
}

// VideoControlBar renders the bottom control bar for the video player.
function VideoControlBar({
  playing, currentTime, duration, volume, mutedState, fullscreen,
  playbackRate, showSpeedMenu, showVolumeSlider,
  theaterMode, hasPlaylist, hasPrev, hasNext,
  formatTime, togglePlay, seekBackward, seekForward,
  handleSeek, handleVolumeChange, toggleMute,
  toggleFullscreen, togglePiP, changePlaybackRate,
  setShowSpeedMenu, setShowVolumeSlider,
  onToggleTheater, onPrev, onNext,
}: VideoControlBarProps) {
  const { t } = useTranslation('common')

  return (
    <div className="relative z-10 p-4 space-y-2">
      {/* Progress bar */}
      <input
        type="range"
        min={0}
        max={duration || 100}
        value={currentTime}
        onChange={handleSeek}
        className="w-full h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-red-600 [&::-webkit-slider-thumb]:cursor-pointer"
        style={{ background: `linear-gradient(to right, #dc2626 ${(currentTime / duration) * 100}%, rgba(255,255,255,0.3) ${(currentTime / duration) * 100}%)` }}
      />

      {/* Control buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {/* Previous video */}
          {hasPlaylist && (
            <button onClick={onPrev} disabled={!hasPrev} className={`rounded-full p-1.5 transition-colors cursor-pointer ${hasPrev ? 'text-white hover:bg-white/20' : 'text-white/30 cursor-not-allowed'}`} title={t('common:prevVideo')}>
              <SkipBack size={20} />
            </button>
          )}
          {/* Play/Pause */}
          <button onClick={togglePlay} className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer" title={playing ? t('common:pause') : t('common:play')}>
            {playing ? <Pause size={22} /> : <Play size={22} />}
          </button>
          {/* Next video */}
          {hasPlaylist && (
            <button onClick={onNext} disabled={!hasNext} className={`rounded-full p-1.5 transition-colors cursor-pointer ${hasNext ? 'text-white hover:bg-white/20' : 'text-white/30 cursor-not-allowed'}`} title={t('common:nextVideo')}>
              <SkipForward size={20} />
            </button>
          )}
          {/* Seek backward 15s */}
          <button onClick={seekBackward} className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer relative" title={t('common:seekBackward')}>
            <RotateCcw size={20} />
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-bold">15</span>
          </button>
          {/* Seek forward 15s */}
          <button onClick={seekForward} className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer relative" title={t('common:seekForward')}>
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
            <button onClick={toggleMute} className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer" title={mutedState ? t('common:cancelMute') : t('common:mute')}>
              {mutedState || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            {/* Volume slider - appears on hover */}
            <div className={`ml-1 overflow-hidden transition-all duration-200 ${showVolumeSlider ? 'w-20 opacity-100' : 'w-0 opacity-0'}`}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={mutedState ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-full h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white hover:[&::-webkit-slider-thumb]:scale-110 [&::-webkit-slider-thumb]:transition-transform"
                style={{ background: `linear-gradient(to right, #fff ${volume * 100}%, rgba(255,255,255,0.3) ${volume * 100}%)` }}
              />
            </div>
          </div>
          {/* Playback speed */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowSpeedMenu((v: boolean) => !v) }}
              className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer flex items-center gap-1"
              title={t('common:speed')}
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
                    onClick={(e) => { e.stopPropagation(); changePlaybackRate(rate) }}
                    className={`w-full px-2 py-1.5 text-sm text-left hover:bg-white/10 transition-colors cursor-pointer text-white flex items-center gap-1.5 ${playbackRate === rate ? 'font-bold' : ''}`}
                  >
                    <span className={`w-1 h-1 rounded-full flex-shrink-0 ${playbackRate === rate ? 'bg-white' : 'bg-transparent'}`} />
                    {rate === 1 ? t('common:normal') : `${rate}x`}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Theater mode */}
          {onToggleTheater && (
            <button onClick={onToggleTheater} className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer" title={theaterMode ? t('common:exitTheaterMode') : t('common:theaterMode')}>
              {theaterMode ? <RectangleVertical size={20} /> : <RectangleHorizontal size={20} />}
            </button>
          )}
          {/* Picture-in-Picture */}
          <button onClick={togglePiP} className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer" title={t('common:pip')}>
            <PictureInPicture2 size={20} />
          </button>
          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer" title={fullscreen ? t('common:exitFullscreen') : t('common:fullscreen')}>
            {fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>
      </div>
    </div>
  )
}

export default VideoControlBar
