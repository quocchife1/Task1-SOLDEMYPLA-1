import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Circle,
  FileText,
  MoreVertical,
  PlayCircle,
  Search,
} from 'lucide-react'

import HlsVideoPlayer from '../components/HlsVideoPlayer'
import {
  setCurrentLessonId,
  setIsPlaying,
  setPlaybackRate,
  setProgress,
} from '../store/courseSlice'
import { cn } from '../utils/cn'

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function CoursePlayerPage() {
  const dispatch = useDispatch()
  const { currentLessonId, progress } = useSelector((s) => s.course)

  const [courseData, setCourseData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const [activeTab, setActiveTab] = useState('overview')
  const [sidebarSearch, setSidebarSearch] = useState('')
  const [openSections, setOpenSections] = useState(() => new Set(['section-1']))
  const [currentTimeSec, setCurrentTimeSec] = useState(0)
  const [shouldAutoplay, setShouldAutoplay] = useState(false)

  // Gọi API lấy dữ liệu khóa học từ Laravel
  useEffect(() => {
    async function fetchCourseData() {
      try {
        // Thay đổi cổng 8000 tùy theo port Laravel backend của bạn đang chạy
        const res = await fetch('http://localhost:8000/api/course-videos')
        const data = await res.json()
        setCourseData(data)
      } catch (error) {
        console.error('Lỗi khi fetch dữ liệu video:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchCourseData()
  }, [])

  // Auto-set bài học đầu tiên khi có data nhưng chưa có ID nào được chọn
  useEffect(() => {
    if (courseData && !currentLessonId) {
      const firstLessonId = courseData.sections?.[0]?.lessons?.[0]?.id
      if (firstLessonId) {
        dispatch(setCurrentLessonId(firstLessonId))
      }
    }
  }, [courseData, currentLessonId, dispatch])

  // Lấy ra bài học hiện tại để ném vào Player
  const lesson = useMemo(() => {
    if (!courseData) return null
    for (const section of courseData.sections) {
      const found = section.lessons.find((l) => l.id === currentLessonId)
      if (found) return found
    }
    return null
  }, [courseData, currentLessonId])

  const videoUrl = lesson?.videoUrl || ''

  // Logic kiểm tra xem còn bài học phía sau không
  const hasNextLesson = useMemo(() => {
    if (!courseData || !currentLessonId) return false
    const flat = courseData.sections.flatMap((s) => s.lessons)
    const idx = flat.findIndex((l) => l.id === currentLessonId)
    return idx !== -1 && idx + 1 < flat.length
  }, [courseData, currentLessonId])

  const toggleSection = (sectionId) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
  }

  const handleSelectLesson = (lessonId) => {
    setShouldAutoplay(true)
    dispatch(setCurrentLessonId(lessonId))
    dispatch(setProgress(0))
    setCurrentTimeSec(0)
  }

  const handlePlayNextLesson = () => {
    if (!courseData) return
    const flat = courseData.sections.flatMap((s) => s.lessons)
    const idx = flat.findIndex((l) => l.id === currentLessonId)
    const nextId = flat[idx + 1]?.id

    if (nextId) {
      setShouldAutoplay(true)
      dispatch(setCurrentLessonId(nextId))
      dispatch(setProgress(0))
      setCurrentTimeSec(0)
    }
  }

  const filteredSections = useMemo(() => {
    if (!courseData) return []
    const q = sidebarSearch.trim().toLowerCase()
    if (!q) return courseData.sections

    return courseData.sections
      .map((section) => ({
        ...section,
        lessons: section.lessons.filter((l) => l.title.toLowerCase().includes(q)),
      }))
      .filter((section) => section.lessons.length > 0)
  }, [sidebarSearch, courseData])

  // Hiển thị UI khi đang fetch data
  if (isLoading || !courseData) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background text-on-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p>Loading course content...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background text-on-background font-body-md h-screen flex flex-col overflow-hidden">
      {/* Top Header */}
      <header className="flex-shrink-0 bg-surface border-b border-outline-variant px-lg py-md flex justify-between items-center z-40">
        <div className="flex items-center gap-md">
          <button type="button" className="text-on-surface-variant hover:text-primary transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-headline-sm text-headline-sm text-on-surface">
            {courseData.title}
          </h1>
        </div>

        <div className="hidden md:flex items-center gap-md w-64">
          <span className="font-label-md text-label-md text-on-surface-variant">
            {Math.round(progress)}% Complete
          </span>
          <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <button type="button" className="text-on-surface-variant hover:text-primary transition-colors ml-sm">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Sidebar Gọn Gàng */}
        <aside className="w-full md:w-[280px] lg:w-[320px] flex-shrink-0 border-r border-outline-variant bg-surface flex flex-col h-full order-2 md:order-1 overflow-hidden z-10">
          <div className="p-md border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
            <h3 className="font-title-md text-title-md text-on-surface">Course Content</h3>
          </div>

          <div className="p-md border-b border-outline-variant bg-surface">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                className="w-full bg-[#f1f5f9] border-none rounded-lg pl-10 pr-4 py-2 font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:bg-white transition-all"
                placeholder="Search lessons..."
                type="text"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
            {filteredSections.map((section) => {
              const isOpen = openSections.has(section.id)

              return (
                <div key={section.id} className="border-b border-outline-variant">
                  <button
                    type="button"
                    className="w-full flex justify-between items-center p-md bg-surface hover:bg-surface-container-low transition-colors text-left"
                    onClick={() => toggleSection(section.id)}
                  >
                    <div>
                      <h4 className="font-title-md text-title-md text-on-surface">{section.title}</h4>
                      <p className="font-label-sm text-label-sm text-on-surface-variant mt-xs">{section.meta}</p>
                    </div>
                    <ChevronDown className={cn('w-5 h-5 transition-transform text-on-surface-variant', isOpen ? 'rotate-180' : 'rotate-0')} />
                  </button>

                  {isOpen && (
                    <div className="bg-surface">
                      {section.lessons.map((l) => {
                        const isActive = l.id === currentLessonId
                        const isCompleted = Boolean(l.completed)
                        const isReading = l.type === 'reading'

                        return (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => handleSelectLesson(l.id)}
                            className={cn(
                              'w-full flex items-start gap-md p-md text-left hover:bg-surface-container-low cursor-pointer transition-colors',
                              isActive && 'bg-[#eff6ff] border-l-4 border-primary hover:bg-[#eff6ff]',
                            )}
                          >
                            <div className="mt-1">
                              {isCompleted ? (
                                <CheckCircle2 className="w-5 h-5 text-tertiary" />
                              ) : isActive ? (
                                <PlayCircle className="w-5 h-5 text-primary" />
                              ) : (
                                <Circle className="w-5 h-5 text-outline-variant" />
                              )}
                            </div>

                            <div className="flex-1">
                              <p className={cn('font-body-md text-body-md', isCompleted ? 'text-on-surface-variant line-through decoration-on-surface-variant/50' : isActive ? 'font-title-md text-title-md text-on-surface' : 'text-on-surface')}>
                                {l.title}
                              </p>
                              <div className={cn('flex items-center gap-xs mt-xs', isActive ? 'text-primary' : 'text-on-surface-variant')}>
                                {isReading ? <FileText className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                                <span className="font-label-sm text-label-sm">
                                  {isActive ? `Now Playing • ${l.durationLabel}` : l.durationLabel}
                                </span>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </aside>

        {/* Cột hiển thị Video */}
        <div className="flex-1 flex flex-col bg-surface-bright order-1 md:order-2 overflow-y-auto no-scrollbar relative min-w-0">
          
          <div className="w-full bg-black flex-shrink-0 flex justify-center items-center h-[65vh] lg:h-[75vh] min-h-[400px] max-h-[850px] border-b border-black/20 shadow-inner">
            <HlsVideoPlayer
              key={currentLessonId}
              videoUrl={videoUrl}
              hasNextLesson={hasNextLesson}
              className="h-full aspect-video max-w-full"
              shouldAutoplay={shouldAutoplay}
              onProgress={(pct) => dispatch(setProgress(pct))}
              onTimeUpdate={({ currentTimeSec: t }) => setCurrentTimeSec(t)}
              onPlayingChange={(v) => dispatch(setIsPlaying(v))}
              onPlaybackRateChange={(r) => dispatch(setPlaybackRate(r))}
              onPlayNextLesson={handlePlayNextLesson}
              onCourseComplete={() => console.log('Hoàn thành khóa học!')}
            />
          </div>

          <div className="px-6 py-8 pb-16 flex-1 max-w-[1200px] w-full mx-auto">
            <div className="border-b border-outline-variant flex gap-lg overflow-x-auto no-scrollbar mb-8">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'qa', label: 'Q&A' },
                { id: 'notes', label: 'Notes' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={cn(
                    'font-title-md text-title-md border-b-2 pb-sm whitespace-nowrap transition-colors',
                    activeTab === t.id ? 'text-primary border-primary' : 'text-on-surface-variant hover:text-on-surface border-transparent',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="relative">
              {activeTab === 'overview' && (
                <div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface mb-md">
                    Tổng quan nội dung
                  </h2>
                  <p className="font-body-md text-body-md text-on-surface-variant mb-lg max-w-3xl leading-relaxed">
                    Đây là nội dung được lấy tự động dựa vào hệ thống Video CDN. Khóa học được stream qua MinIO lưu trữ chuẩn HLS.
                  </p>
                  <div className="flex items-center gap-md p-md bg-surface border border-outline-variant rounded-lg max-w-sm">
                    <img alt="Instructor" className="w-12 h-12 rounded-full border border-outline-variant" src={courseData.instructor.avatarUrl} />
                    <div>
                      <p className="font-title-md text-title-md text-on-surface">{courseData.instructor.name}</p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">{courseData.instructor.title}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'notes' && <NotesTab currentTimeSec={currentTimeSec} />}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function NotesTab({ currentTimeSec }) {
  const [text, setText] = useState('')
  const [notes, setNotes] = useState([])
  const timestamp = formatTime(currentTimeSec)

  return (
    <div className="max-w-3xl">
      <div className="bg-surface p-md rounded-lg border border-outline-variant mb-lg focus-within:ring-2 focus-within:ring-primary transition-shadow">
        <textarea
          className="w-full bg-transparent border-none focus:ring-0 resize-none font-body-md text-on-surface mb-sm placeholder:text-on-surface-variant"
          placeholder={`Thêm ghi chú tại giây thứ ${timestamp}...`}
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex justify-between items-center">
          <span className="font-label-sm text-primary bg-primary-container/30 px-2 py-1 rounded">@ {timestamp}</span>
          <button type="button" className="bg-primary text-on-primary font-label-md px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors" onClick={() => {
              const trimmed = text.trim(); if (!trimmed) return
              setNotes((prev) => [{ id: `note-${Date.now()}`, at: Math.floor(currentTimeSec), text: trimmed }, ...prev])
              setText('')
            }}>Lưu ghi chú</button>
        </div>
      </div>
      <div className="space-y-md">
        {notes.map((n) => (
          <div key={n.id} className="bg-surface p-md rounded-lg border border-outline-variant">
            <div className="flex justify-between items-start mb-sm">
              <button type="button" className="font-label-sm text-primary bg-primary-container/30 px-2 py-1 rounded hover:bg-primary-container/50 transition-colors">@ {formatTime(n.at)}</button>
            </div>
            <p className="font-body-md text-on-surface">{n.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}