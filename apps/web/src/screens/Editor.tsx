import { useEffect, useRef, useState } from 'react'
import type { Project } from '#/types'
import { EditorProvider, useEditor } from '#/store/editor'
import TopBar from '#/components/editor/TopBar'
import Canvas from '#/components/editor/Canvas'
import Toolbar from '#/components/editor/Toolbar'
import Timeline from '#/components/editor/Timeline'
import ToolSheet from '#/components/editor/Panels'
import ExportSheet from '#/components/editor/ExportSheet'

export default function Editor({ project, onExit }: { project: Project; onExit: () => void }) {
  return (
    <EditorProvider project={project}>
      <EditorInner onExit={onExit} />
    </EditorProvider>
  )
}

function EditorInner({ onExit }: { onExit: () => void }) {
  const { playing, time, setTime, setPlaying, project } = useEditor()
  const [exporting, setExporting] = useState(false)
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
    <div className="flex h-full w-full flex-col overflow-hidden bg-bg select-none">
      <TopBar onExit={onExit} onExport={() => { setPlaying(false); setExporting(true) }} />
      <Canvas />
      <Toolbar />
      <Timeline />
      <ToolSheet />
      {exporting && <ExportSheet onClose={() => setExporting(false)} />}
    </div>
  )
}
