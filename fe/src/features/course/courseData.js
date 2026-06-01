export const course = {
  id: 'mastering-system-architecture',
  title: 'Mastering System Architecture',
  instructor: {
    name: 'Sarah Jenkins',
    title: 'Senior Cloud Architect',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBAYzmFF1OLUlmBOZtYFkQWVpbac85JWxswBzhNRGgF_Md-41GVUIc3V7SzNSf5yuryvTeMKA6NlIN4zla3qwfT_thVgIvUfQUohcfB8k2IXtYqSAD0fHRLx39jAZf01bS558wpKZ2VkOZVBRJCI-O9n892ZEg6qxgDwc3daDLHgVIBS6fcXjAz5dzTt_Hj-2RfvT1vW4mwtZ82gS-b-mcET3fqoYNT2LILNWGrfeFvdkwGCgOCkfpyL4vVMv1Jz-moO8gvVqhDB5a8',
  },
  // Replace this with your real HLS URL(s)
  defaultVideoUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  sections: [
    {
      id: 'section-1',
      title: 'Section 1: Introduction',
      meta: '3 / 5 | 45 min',
      lessons: [
        {
          id: 'lesson-1',
          title: '1. What is System Architecture?',
          type: 'video',
          durationLabel: '12:05',
          completed: true,
        },
        {
          id: 'lesson-2',
          title: '2. Monoliths vs Microservices',
          type: 'reading',
          durationLabel: 'Reading',
          completed: true,
        },
        {
          id: 'lesson-3',
          title: '3. Understanding Distributed Systems',
          type: 'video',
          durationLabel: '15:42',
          completed: false,
          nowPlaying: true,
          videoUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        },
        {
          id: 'lesson-4',
          title: '4. CAP Theorem Explained',
          type: 'video',
          durationLabel: '08:20',
          completed: false,
        },
      ],
    },
    {
      id: 'section-2',
      title: 'Section 2: Core Concepts',
      meta: '0 / 4 | 1h 20m',
      lessons: [
        {
          id: 'lesson-5',
          title: '1. Data Consistency',
          type: 'video',
          durationLabel: '22:10',
          completed: false,
        },
      ],
    },
  ],
}

export function findLessonById(lessonId) {
  for (const section of course.sections) {
    const found = section.lessons.find((l) => l.id === lessonId)
    if (found) return found
  }
  return null
}

export function getFirstLessonId() {
  return course.sections[0]?.lessons[0]?.id ?? null
}

export function getNextLessonId(currentLessonId) {
  const flat = course.sections.flatMap((s) => s.lessons)
  const idx = flat.findIndex((l) => l.id === currentLessonId)
  if (idx === -1) return flat[0]?.id ?? null
  return flat[idx + 1]?.id ?? null
}
