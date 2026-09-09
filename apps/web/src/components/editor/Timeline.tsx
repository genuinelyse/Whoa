import { useEffect, useRef } from 'react'
import { Play, Pause, Scissors, Diamond, ZoomIn, ZoomOut } from 'lucide-react'
import { useEditor } from '#/store/editor'
import type { Layer } from '#/types'
import { useState } from 'react'

const TRACK_COLOR: Record<string, string> = {
  text: 'var(--color-track-text)',
  shape: 'var(--color-track-shape)',
  image: 'var(--color-track-image)',
  sticker: 'var(--color-track-sticker)',
}

function fmt(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`
}

type Drag =
  | { kind: 'scrub' }
  | { kind: 'trim'; id: string; edge: 'l' | 'r'; s0: number; e0: number; sx: number }
  | null

export default function Timeline() {
  const { project, time, setTime, playing, setPlaying, selectedId, select, updateLayer } = useEditor()
  const [ppms, setPpms] = useState(0.05)
  const trackRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag>(null)
  const { duration } = project

  const timeToX = (t: number) => t * ppms
  const xToTime = (clientX: number) => {
    const el = trackRef.current!
    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left + el.scrollLeft - LABEL_W
    return Math.max(0, Math.min(duration, x / ppms))
  }

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d) return
      if (d.kind === 'scrub') setTime(xToTime(e.clientX))
      else {
        const dt = (e.clientX - d.sx) / ppms
        if (d.edge === 'l') updateLayer(d.id, { start: Math.max(0, Math.min(d.e0 - 200, d.s0 + dt)) })
        else updateLayer(d.id, { end: Math.min(duration, Math.max(d.s0 + 200, d.e0 + dt)) })
      }
    }
    const up = () => { drag.current = null }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [ppms, duration, setTime, updateLayer])

  const layers = [...project.layers].reverse()
  const ticks = Array.from({ length: Math.floor(duration / 1000) + 1 }, (_, i) => i)

  return (
    <div className="shrink-0 border-t border-line bg-timeline" data-testid="timeline">
      {/* controls and ruler */}
      <div className="h-16 bg-timeline">
        <div className="flex h-11 items-center gap-2 px-3">
          <button
            onClick={() => setPlaying(!playing)}
            data-testid="play-btn"
            className="grid h-8 w-8 place-items-center rounded-full bg-white text-black transition-transform active:scale-90"
          >
            {playing ? <Pause className="h-4 w-4" fill="black" /> : <Play className="h-4 w-4" fill="black" />}
          </button>
          <span className="font-mono text-xs tabular-nums text-txt2" data-testid="time-display">
            {fmt(time)} <span className="text-txt3">/ {fmt(duration)}</span>
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button data-testid="split-btn" disabled className="grid h-8 w-8 place-items-center rounded-lg text-txt3 opacity-40" title="Split (coming with backend)">
              <Scissors className="h-4 w-4" />
            </button>
            <button
              data-testid="keyframe-btn"
              onClick={() => {
                if (!selectedId) return
                const l = project.layers.find((x) => x.id === selectedId)
                if (l) updateLayer(selectedId, { start: Math.min(time, l.end - 200) })
              }}
              className="grid h-8 w-8 place-items-center rounded-lg text-txt2 active:bg-surface2"
              title="Set clip start to playhead"
            >
              <Diamond className="h-4 w-4" />
            </button>
            <button data-testid="zoom-out" onClick={() => setPpms((p) => Math.max(0.03, p - 0.03))} className="grid h-8 w-8 place-items-center rounded-lg text-txt2 active:bg-surface2">
              <ZoomOut className="h-4 w-4" />
            </button>
            <button data-testid="zoom-in" onClick={() => setPpms((p) => Math.min(0.4, p + 0.03))} className="grid h-8 w-8 place-items-center rounded-lg text-txt2 active:bg-surface2">
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex h-5 items-start overflow-hidden pl-3" aria-label="Timeline seconds">
          <div className="flex shrink-0" style={{ paddingLeft: LABEL_W - 12 }}>
            {ticks.map((t) => (
              <div key={t} className="relative shrink-0 border-l border-line text-[10px] text-txt3" style={{ width: 1000 * ppms }}>
                <span className="absolute left-1 top-0">{t}s</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* tracks */}
      <div
        ref={trackRef}
        className="relative h-40 overflow-auto no-scrollbar"
        onPointerDown={(e) => { drag.current = { kind: 'scrub' }; setTime(xToTime(e.clientX)) }}
      >
        <div className="relative" style={{ width: LABEL_W + timeToX(duration) + 40, minWidth: '100%' }}>
          {/* rows */}
          <div className="pb-3 pt-2">
            {layers.length === 0 && (
              <p className="py-8 text-center text-xs text-txt3">Add elements to see them on the timeline</p>
            )}
            {layers.map((l) => (
              <Row key={l.id} layer={l} ppms={ppms} selected={selectedId === l.id}
                onSelect={() => select(l.id)}
                onTrim={(edge, e) => { e.stopPropagation(); drag.current = { kind: 'trim', id: l.id, edge, s0: l.start, e0: l.end, sx: e.clientX } }} />
            ))}
          </div>

          {/* playhead */}
          <div className="pointer-events-none absolute top-0 bottom-0 z-20" style={{ left: LABEL_W + timeToX(time) }} data-testid="playhead">
            <div className="absolute -left-1.5 -top-0 h-3 w-3 rounded-sm bg-white" />
            <div className="h-full w-0.5 bg-white" />
          </div>
        </div>
      </div>
    </div>
  )
}

const LABEL_W = 76

function Row({ layer, ppms, selected, onSelect, onTrim }: {
  layer: Layer; ppms: number; selected: boolean; onSelect: () => void
  onTrim: (edge: 'l' | 'r', e: React.PointerEvent) => void
}) {
  const label = layer.type === 'text' ? (layer.text || 'Text') : layer.type === 'sticker' ? `Sticker ${layer.emoji}` : layer.name
  return (
    <div className="flex h-11 items-center">
      <div className="sticky left-0 z-10 flex h-full items-center gap-2 bg-timeline pr-2 pl-3" style={{ width: LABEL_W }}>
        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: TRACK_COLOR[layer.type] }} />
        <span className="truncate text-[11px] text-txt2">{label}</span>
      </div>
      <div className="relative h-full flex-1">
        <div
          onPointerDown={(e) => { e.stopPropagation(); onSelect() }}
          data-testid={`clip-${layer.id}`}
          className={`absolute top-1.5 flex h-8 items-center overflow-hidden rounded-md border ${selected ? 'border-white' : 'border-white/20'}`}
          style={{ left: layer.start * ppms, width: Math.max(24, (layer.end - layer.start) * ppms), background: TRACK_COLOR[layer.type], opacity: 0.92 }}
        >
          <div onPointerDown={(e) => onTrim('l', e)} data-testid={`trim-l-${layer.id}`}
            className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-black/25" style={{ touchAction: 'none' }} />
          <span className="pointer-events-none w-full truncate px-3 text-[11px] font-semibold text-white/95">{label}</span>
          <div onPointerDown={(e) => onTrim('r', e)} data-testid={`trim-r-${layer.id}`}
            className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-black/25" style={{ touchAction: 'none' }} />
        </div>
      </div>
    </div>
  )
}
