import { useEffect, useRef } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { Project } from '#/types'
import { EditorProvider, useEditor } from '#/store/editor'
import Canvas from '#/components/editor/Canvas'
import Toolbar from '#/components/editor/Toolbar'
import Timeline from '#/components/editor/Timeline'
import ToolSheet from '#/components/editor/Panels'

export default function Editor({ project, onExit }: { project: Project; onExit: () => void }) {
  return (
    <EditorProvider project={project}>
      <EditorInner onExit={onExit} />
    </EditorProvider>
  )
}

function EditorInner({ onExit }: { onExit: () => void }) {
  const { playing, time, setTime, project } = useEditor()
  const raf = useRef(0)
  const last = useRef(0)
  const timeRef = useRef(time)
  timeRef.current = time

  useEffect(() => {
    if (!playing) return
    last.current = performance.now()
    const tick = (now: number) => {
      const dt = now - last.current
      last.current = now
      let nt = timeRef.current + dt
      if (nt >= project.duration) nt = 0
      timeRef.current = nt
      setTime(nt)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, project.duration])

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-bg select-none">
      {/* Floating back button in the top left corner */}
      <button
        type="button"
        onClick={onExit}
        onPointerDown={(e) => e.stopPropagation()}
        data-testid="editor-back-btn"
        id="editor-back-btn"
        aria-label="Back"
        title="Back"
        className="absolute top-3 left-3 z-40 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur-md border border-white/10 shadow-lg hover:bg-black/80 hover:text-white active:scale-90 transition-all focus:outline-none"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <Canvas />
      <Toolbar />
      <Timeline />
      <ToolSheet />
    </div>
  )
}
