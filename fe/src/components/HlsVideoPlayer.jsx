import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import Hls from 'hls.js'
import {
  Check,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  Volume2,
  VolumeX,
  Trophy,
} from 'lucide-react'

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const IDLE_TIMEOUT_MS = 3000
const PLAYBACK_RATES = [0.5, 1, 1.25, 1.5, 2]

const HlsVideoPlayer = forwardRef(function HlsVideoPlayer(
  {
    videoUrl,
    className,
    onProgress,
    onTimeUpdate,
    onPlayingChange,
    onPlaybackRateChange,
    onPlayNextLesson,
    shouldAutoplay = true,
    initialAutoplayEnabled = true,
    hasNextLesson = true,
    onCourseComplete,
  },
  ref,
) {
  const wrapperRef = useRef(null)
  const videoRef = useRef(null)
  const progressBarRef = useRef(null)
  const hlsRef = useRef(null)

  const idleTimerRef = useRef(null)
  const upNextIntervalRef = useRef(null)

  const pendingAutoplayRef = useRef(Boolean(shouldAutoplay))

  const [isPlaying, setIsPlaying] = useState(false)
  const [durationSec, setDurationSec] = useState(0)
  const [currentTimeSec, setCurrentTimeSec] = useState(0)

  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(0.7)
  const [playbackRate, setPlaybackRate] = useState(1)

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isControlsVisible, setIsControlsVisible] = useState(true)

  const [isHoveringTimeline, setIsHoveringTimeline] = useState(false)
  const [hoverPct, setHoverPct] = useState(0)

  const [isAutoplayEnabled, setIsAutoplayEnabled] = useState(Boolean(initialAutoplayEnabled))
  const [showUpNextOverlay, setShowUpNextOverlay] = useState(false)
  const [upNextCountdown, setUpNextCountdown] = useState(5)

  const [availableQualities, setAvailableQualities] = useState([])
  const [currentQualityLevel, setCurrentQualityLevel] = useState(-1)
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false)

  const [showCompletionOverlay, setShowCompletionOverlay] = useState(false)

  useImperativeHandle(ref, () => videoRef.current)

  useEffect(() => {
    pendingAutoplayRef.current = Boolean(shouldAutoplay)
  }, [shouldAutoplay])
  
  useEffect(() => {
    setShowCompletionOverlay(false)
  }, [videoUrl])

  const progressPct = useMemo(() => {
    if (!durationSec) return 0
    return clamp((currentTimeSec / durationSec) * 100, 0, 100)
  }, [currentTimeSec, durationSec])

  const hoverTimeSec = useMemo(() => {
    if (!durationSec) return 0
    return clamp((hoverPct / 100) * durationSec, 0, durationSec)
  }, [hoverPct, durationSec])

  // Khởi tạo luồng HLS Stream
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (!videoUrl) {
      video.removeAttribute('src')
      video.load()
      return
    }

    if (Hls.isSupported()) {
      const hls = new Hls()
      hlsRef.current = hls

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        const levels = data.levels
          .map((level, index) => ({ index, height: level.height }))
          .filter((l) => l.height >= 360)
        const uniqueLevels = []
        const seenHeights = new Set()
        for (const lvl of levels) {
          if (!seenHeights.has(lvl.height)) {
            seenHeights.add(lvl.height)
            uniqueLevels.push(lvl)
          }
        }
        uniqueLevels.sort((a, b) => b.height - a.height)
        setAvailableQualities(uniqueLevels)
        setCurrentQualityLevel(-1)
        if (pendingAutoplayRef.current) {
          video.play().catch((err) => console.warn('Autoplay restricted:', err))
        }
      })

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data?.fatal) return
          switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            try { hls.startLoad() } catch (err) { 
              console.error('HLS Network Error:', err)
              hls.destroy() 
            }
            break
          case Hls.ErrorTypes.MEDIA_ERROR:
            try { hls.recoverMediaError() } catch (err) { 
              console.error('HLS Media Error:', err)
              hls.destroy() 
            }
            break
          default:
            hls.destroy()
        }
      })

      hls.loadSource(videoUrl)
      hls.attachMedia(video)
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = videoUrl
      video.addEventListener('loadedmetadata', () => {
        if (pendingAutoplayRef.current) video.play().catch(console.warn)
      }, { once: true })
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [videoUrl])

  // Lắng nghe sự kiện Video
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onLoadedMetadata = () => setDurationSec(video.duration || 0)

    const onTimeUpdateEvent = () => {
      const nextCurrentTime = video.currentTime || 0
      const nextDuration = video.duration || 0

      setCurrentTimeSec(nextCurrentTime)
      setDurationSec(nextDuration)

      const nextProgress = nextDuration ? (nextCurrentTime / nextDuration) * 100 : 0
      const pct = clamp(nextProgress, 0, 100)

      onProgress?.(pct)
      onTimeUpdate?.({ currentTimeSec: nextCurrentTime, durationSec: nextDuration, progressPct: pct })
    }

    const onPlayEvent = () => {
      setIsPlaying(true)
      onPlayingChange?.(true)
    }

    const onPauseEvent = () => {
      setIsPlaying(false)
      onPlayingChange?.(false)
      setIsControlsVisible(true)
    }

    const onRateChangeEvent = () => {
      setPlaybackRate(video.playbackRate || 1)
      onPlaybackRateChange?.(video.playbackRate || 1)
    }

    const onEndedEvent = () => {
      setIsPlaying(false)
      onPlayingChange?.(false)
      setIsControlsVisible(true)

      // Kiểm tra xem có phải bài học cuối không
      if (!hasNextLesson) {
        setShowCompletionOverlay(true)
        onCourseComplete?.()
        return
      }

      if (!isAutoplayEnabled) return

      pendingAutoplayRef.current = true
      setShowUpNextOverlay(true)
      setUpNextCountdown(5)
    }

    video.addEventListener('loadedmetadata', onLoadedMetadata)
    video.addEventListener('timeupdate', onTimeUpdateEvent)
    video.addEventListener('play', onPlayEvent)
    video.addEventListener('pause', onPauseEvent)
    video.addEventListener('ratechange', onRateChangeEvent)
    video.addEventListener('ended', onEndedEvent)

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata)
      video.removeEventListener('timeupdate', onTimeUpdateEvent)
      video.removeEventListener('play', onPlayEvent)
      video.removeEventListener('pause', onPauseEvent)
      video.removeEventListener('ratechange', onRateChangeEvent)
      video.removeEventListener('ended', onEndedEvent)
    }
  }, [
    hasNextLesson,
    onCourseComplete,
    isAutoplayEnabled,
    onPlaybackRateChange,
    onPlayingChange,
    onProgress,
    onTimeUpdate,
  ])

  // Cấu hình âm thanh, tốc độ
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted
  }, [muted])

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = clamp(volume, 0, 1)
  }, [volume])

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate
  }, [playbackRate])

  // ... (giữ nguyên phần Fullscreen, MouseMove, và UpNext đếm ngược như cũ)
  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFullscreenChange)
    onFullscreenChange()
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return

    const clearIdleTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
    }

    const scheduleIdleTimer = () => {
      clearIdleTimer()
      if (!isPlaying) {
        setIsControlsVisible(true)
        return
      }
      idleTimerRef.current = setTimeout(() => {
        if (!isQualityMenuOpen) setIsControlsVisible(false)
      }, IDLE_TIMEOUT_MS)
    }

    const bump = () => {
      setIsControlsVisible(true)
      scheduleIdleTimer()
    }

    el.addEventListener('mousemove', bump)
    el.addEventListener('mousedown', bump)
    el.addEventListener('touchstart', bump, { passive: true })
    el.addEventListener('keydown', bump)

    scheduleIdleTimer()

    return () => {
      el.removeEventListener('mousemove', bump)
      el.removeEventListener('mousedown', bump)
      el.removeEventListener('touchstart', bump)
      el.removeEventListener('keydown', bump)
      clearIdleTimer()
    }
  }, [isPlaying, isQualityMenuOpen])

  useEffect(() => {
    if (!showUpNextOverlay) return
    if (upNextIntervalRef.current) clearInterval(upNextIntervalRef.current)
    upNextIntervalRef.current = setInterval(() => setUpNextCountdown((prev) => prev - 1), 1000)
    return () => {
      if (upNextIntervalRef.current) clearInterval(upNextIntervalRef.current)
    }
  }, [showUpNextOverlay])

  useEffect(() => {
    if (!showUpNextOverlay) return
    if (upNextCountdown > 0) return
    setShowUpNextOverlay(false)
    setUpNextCountdown(5)
    onPlayNextLesson?.()
  }, [onPlayNextLesson, showUpNextOverlay, upNextCountdown])

  async function togglePlay() {
    const video = videoRef.current
    if (!video) return
    try {
      if (video.paused) await video.play()
      else video.pause()
    } catch (err) { console.error('Failed to toggle play', err) }
  }

  function seekBy(deltaSec) {
    const video = videoRef.current
    if (!video) return
    video.currentTime = clamp((video.currentTime || 0) + deltaSec, 0, video.duration || 0)
  }

  function seekToPct(pct) {
    const video = videoRef.current
    if (!video || !video.duration) return
    video.currentTime = clamp((pct / 100) * video.duration, 0, video.duration)
  }

  function computeHoverPct(clientX) {
    const bar = progressBarRef.current
    if (!bar) return 0
    const rect = bar.getBoundingClientRect()
    if (!rect.width) return 0
    return clamp(((clientX - rect.left) / rect.width) * 100, 0, 100)
  }

  function cycleRate() {
    const idx = PLAYBACK_RATES.findIndex((r) => r === playbackRate)
    setPlaybackRate(PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length])
  }

  async function toggleFullscreen() {
    const container = wrapperRef.current
    if (!container) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await container.requestFullscreen({ navigationUI: 'hide' })
    } catch (err) { console.error('Fullscreen failed', err) }
  }

  function handleQualityChange(levelIndex) {
    if (!hlsRef.current) return
    if (levelIndex === -1) hlsRef.current.currentLevel = -1
    else hlsRef.current.nextLevel = levelIndex
    setCurrentQualityLevel(levelIndex)
    setIsQualityMenuOpen(false)
  }

  function handleCancelUpNext() {
    pendingAutoplayRef.current = false
    setShowUpNextOverlay(false)
    setUpNextCountdown(5)
  }

  const controlBarClass = isControlsVisible || !isPlaying || isQualityMenuOpen
    ? 'opacity-100 translate-y-0'
    : 'opacity-0 translate-y-2 pointer-events-none'

  const wrapperCursorClass = isFullscreen && isPlaying && !isControlsVisible && !isQualityMenuOpen
    ? 'cursor-none'
    : 'cursor-default'

  return (
    <div
      ref={wrapperRef}
      tabIndex={0}
      className={`relative bg-black flex-shrink-0 ${wrapperCursorClass} ${className ?? 'w-full aspect-video'}`}
    >
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-contain bg-black" playsInline />

      <div
        className="absolute inset-0 z-10"
        role="button"
        tabIndex={-1}
        onClick={() => { setIsQualityMenuOpen(false); togglePlay(); }}
        onTouchStart={(e) => { e.preventDefault(); setIsQualityMenuOpen(false); togglePlay(); }}
      />

      {showUpNextOverlay && (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <div className="bg-black/70 text-white rounded-lg px-6 py-5 flex flex-col items-center gap-3">
            <div className="text-lg font-semibold">Up Next in {upNextCountdown}…</div>
            <button type="button" className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 transition" onClick={handleCancelUpNext}>Cancel</button>
          </div>
        </div>
      )}

      {showCompletionOverlay && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/85 backdrop-blur-sm transition-opacity duration-500">
          <div className="text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6">
              <Trophy className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-3xl font-headline-sm text-white mb-3">Course Completed!</h2>
            <p className="font-body-md text-white/70 mb-8 max-w-md">Congratulations on finishing all the lessons. You can now review the materials or claim your certificate.</p>
            <div className="flex items-center gap-4">
              <button type="button" className="px-6 py-2.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition font-label-md" onClick={() => setShowCompletionOverlay(false)}>Review Course</button>
              <button type="button" className="px-6 py-2.5 rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition font-label-md">View Certificate</button>
            </div>
          </div>
        </div>
      )}

      <div
        className={`absolute left-0 right-0 bottom-0 z-20 px-4 pb-4 pt-10 bg-gradient-to-t from-black/80 to-transparent transition-all duration-300 ${controlBarClass}`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div
          ref={progressBarRef}
          className="relative w-full h-2 rounded-full bg-white/25 cursor-pointer touch-none"
          onMouseEnter={() => setIsHoveringTimeline(true)}
          onMouseLeave={() => setIsHoveringTimeline(false)}
          onMouseMove={(e) => setHoverPct(computeHoverPct(e.clientX))}
          onTouchStart={(e) => {
            const t = e.touches?.[0]; if (!t) return
            setIsHoveringTimeline(true); setHoverPct(computeHoverPct(t.clientX))
          }}
          onTouchMove={(e) => {
            const t = e.touches?.[0]; if (!t) return
            setHoverPct(computeHoverPct(t.clientX))
          }}
          onTouchEnd={() => setIsHoveringTimeline(false)}
          onClick={(e) => {
            const pct = computeHoverPct(e.clientX); setHoverPct(pct); seekToPct(pct)
          }}
        >
          <div className="absolute left-0 top-0 h-full bg-primary rounded-full" style={{ width: `${progressPct}%` }} />
          {isHoveringTimeline && durationSec > 0 && (
            <>
              <div className="absolute -top-9 -translate-x-1/2 bg-white text-black text-xs px-2 py-1 rounded" style={{ left: `${hoverPct}%` }}>{formatTime(hoverTimeSec)}</div>
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full" style={{ left: `${hoverPct}%` }} />
            </>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between text-white/90">
          <div className="flex items-center gap-3">
            <button type="button" className="hover:text-white" onClick={() => seekBy(-5)}><RotateCcw className="w-5 h-5" /></button>
            <button type="button" className="hover:text-white" onClick={togglePlay}>{isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}</button>
            <button type="button" className="hover:text-white" onClick={() => seekBy(5)}><RotateCw className="w-5 h-5" /></button>
            <button type="button" className="hover:text-white" onClick={() => setMuted((m) => !m)}>
              {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <input className="hidden sm:block cursor-pointer" type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume} onChange={(e) => { setMuted(false); setVolume(Number(e.target.value)); }} />
            <span className="hidden sm:inline text-xs">{formatTime(currentTimeSec)} / {formatTime(durationSec)}</span>
          </div>

          <div className="flex items-center gap-3">
            <button type="button" className="flex items-center gap-2 text-xs" onClick={() => setIsAutoplayEnabled((v) => !v)}>
              <span className="hidden sm:inline">Autoplay</span>
              <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isAutoplayEnabled ? 'bg-primary' : 'bg-white/30'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isAutoplayEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
              </span>
            </button>
            <button type="button" className="text-xs border border-white/20 rounded px-2 py-1 hover:text-white" onClick={cycleRate}>{playbackRate}x</button>
            
            <div className="relative">
              <button type="button" className={`hover:text-white ${isQualityMenuOpen ? 'text-white' : ''}`} onClick={() => setIsQualityMenuOpen((prev) => !prev)}>
                <Settings className="w-5 h-5" />
              </button>
              {isQualityMenuOpen && availableQualities.length > 0 && (
                <div className="absolute bottom-full right-0 mb-4 w-36 bg-black/95 text-white border border-white/20 rounded-lg shadow-lg overflow-hidden flex flex-col z-50">
                  <div className="px-3 py-2 text-xs text-white/50 border-b border-white/10 uppercase tracking-wider font-semibold">Quality</div>
                  <button type="button" className={`flex items-center justify-between px-3 py-2.5 text-sm hover:bg-white/15 ${currentQualityLevel === -1 ? 'text-primary font-medium' : ''}`} onClick={() => handleQualityChange(-1)}>
                    <span>Auto</span>{currentQualityLevel === -1 && <Check className="w-4 h-4 text-primary" />}
                  </button>
                  {availableQualities.map((q) => (
                    <button key={q.index} type="button" className={`flex items-center justify-between px-3 py-2.5 text-sm hover:bg-white/15 ${currentQualityLevel === q.index ? 'text-primary font-medium' : ''}`} onClick={() => handleQualityChange(q.index)}>
                      <span>{q.height}p</span>{currentQualityLevel === q.index && <Check className="w-4 h-4 text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button type="button" className="hover:text-white" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})

export default HlsVideoPlayer