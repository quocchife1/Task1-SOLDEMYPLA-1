import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  currentLessonId: null,
  isPlaying: false,
  playbackRate: 1,
  progress: 0,
}

const courseSlice = createSlice({
  name: 'course',
  initialState,
  reducers: {
    setCurrentLessonId(state, action) {
      state.currentLessonId = action.payload ?? null
    },
    setIsPlaying(state, action) {
      state.isPlaying = Boolean(action.payload)
    },
    setPlaybackRate(state, action) {
      const next = Number(action.payload)
      state.playbackRate = Number.isFinite(next) && next > 0 ? next : 1
    },
    setProgress(state, action) {
      const next = Number(action.payload)
      if (!Number.isFinite(next)) return
      state.progress = Math.min(100, Math.max(0, next))
    },
    resetCourseState() {
      return initialState
    },
  },
})

export const { setCurrentLessonId, setIsPlaying, setPlaybackRate, setProgress, resetCourseState } = courseSlice.actions
export default courseSlice.reducer