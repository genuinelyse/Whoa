import { useState, useCallback, useEffect } from 'react'
import type { Project } from '#/types'
import Home from '#/screens/Home'
import Editor from '#/screens/Editor'

export default function App() {
  const [project, setProject] = useState<Project | null>(null)

  const open = useCallback((p: Project) => setProject(p), [])
  const close = useCallback(() => setProject(null), [])

  // Prevent the whole app/page from zooming (trackpad ctrl-wheel + Safari gestures).
  useEffect(() => {
    const wheel = (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault() }
    const gesture = (e: Event) => e.preventDefault()
    document.addEventListener('wheel', wheel, { passive: false })
    document.addEventListener('gesturestart', gesture)
    document.addEventListener('gesturechange', gesture)
    return () => {
      document.removeEventListener('wheel', wheel)
      document.removeEventListener('gesturestart', gesture)
      document.removeEventListener('gesturechange', gesture)
    }
  }, [])

  return (
    <div className="flex h-full w-full items-stretch justify-center bg-black sm:py-4">
      {/* Mobile device frame — mobile-first, centered on larger screens */}
      <div className="relative h-full w-full max-w-[440px] overflow-hidden bg-bg text-txt shadow-2xl sm:h-[900px] sm:max-h-full sm:rounded-[2.2rem] sm:ring-1 sm:ring-white/10">
        {project ? (
          <Editor key={project.id} project={project} onExit={close} />
        ) : (
          <Home onOpen={open} />
        )}
      </div>
    </div>
  )
}
