import React, { useEffect, useRef, useState, useMemo } from 'react'
import {
  Play, Pause, Scissors, Diamond, ZoomIn, ZoomOut,
  ChevronDown, ChevronRight, Folder, Component as ComponentIcon,
  ArrowUp, ArrowDown,
} from 'lucide-react'
import { useEditor } from '#/store/editor'
import type { Layer } from '#/types'
import { getDescendantLayers } from '#/lib/groups'

const TRACK_COLOR: Record<string, string> = {
  text: 'var(--color-track-text)',
  shape: 'var(--color-track-shape)',
  image: 'var(--color-track-image)',
  sticker: 'var(--color-track-sticker)',
  group: '#4338CA',
}

function fmt(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`
}

type Drag =
  | { kind: 'playhead' }
  | { kind: 'trim'; id: string; edge: 'l' | 'r'; s0: number; e0: number; sx: number }
  | { kind: 'move'; id: string; sx: number; initialStart: number; initialEnd: number }
  | { kind: 'trim-group'; id: string; edge: 'l' | 'r'; s0: number; e0: number; sx: number; initialStarts: Map<string, number>; initialEnds: Map<string, number> }
  | { kind: 'move-group'; id: string; sx: number; initialStarts: Map<string, number>; initialEnds: Map<string, number> }
  | null

const LABEL_W = 148

interface TimelineRowItem {
  layer: Layer
  depth: number
  isGroup: boolean
  isComponent: boolean
  hasChildren: boolean
  collapsed?: boolean
  effectiveStart: number
  effectiveEnd: number
}

export default function Timeline() {
  const {
    project, time, setTime, playing, setPlaying, selectedId, select,
    updateLayer, toggleGroupCollapse, reorder, timelineOpen, toggleTimeline, openTool, setAnimationSide,
  } = useEditor()
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

  // Build the hierarchical timeline row list
  const rows = useMemo<TimelineRowItem[]>(() => {
    const layers = project.layers
    const layerMap = new Map(layers.map((l) => [l.id, l]))
    const rootLayers = layers.filter((l) => !l.groupId || !layerMap.has(l.groupId))

    const result: TimelineRowItem[] = []

    function addNode(layer: Layer, depth: number) {
      const isGroup = layer.type === 'group'
      const isComponent = Boolean(layer.isComponent)
      const children = layers.filter((l) => l.groupId === layer.id).reverse()
      const hasChildren = children.length > 0
      const collapsed = Boolean(layer.collapsed)

      let effectiveStart = layer.start
      let effectiveEnd = layer.end

      if (isGroup) {
        const descendants = getDescendantLayers(layer.id, layers).filter((l) => l.type !== 'group')
        if (descendants.length > 0) {
          effectiveStart = Math.min(...descendants.map((d) => d.start))
          effectiveEnd = Math.max(...descendants.map((d) => d.end))
        }
      }

      result.push({
        layer,
        depth,
        isGroup,
        isComponent,
        hasChildren,
        collapsed,
        effectiveStart,
        effectiveEnd,
      })

      if (isGroup && !collapsed) {
        for (const child of children) {
          addNode(child, depth + 1)
        }
      }
    }

    const reversedRoots = [...rootLayers].reverse()
    for (const root of reversedRoots) {
      addNode(root, 0)
    }

    return result
  }, [project.layers])

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d) return
      if (d.kind === 'playhead') {
        setTime(xToTime(e.clientX))
      } else if (d.kind === 'trim') {
        const dt = (e.clientX - d.sx) / ppms
        if (d.edge === 'l') {
          updateLayer(d.id, { start: Math.max(0, Math.min(d.e0 - 200, d.s0 + dt)) })
        } else {
          updateLayer(d.id, { end: Math.min(duration, Math.max(d.s0 + 200, d.e0 + dt)) })
        }
      } else if (d.kind === 'move') {
        const dt = (e.clientX - d.sx) / ppms
        const span = d.initialEnd - d.initialStart
        const newStart = Math.max(0, Math.min(duration - span, d.initialStart + dt))
        updateLayer(d.id, { start: newStart, end: newStart + span })
      } else if (d.kind === 'move-group') {
        const dt = (e.clientX - d.sx) / ppms
        for (const [childId, initStart] of d.initialStarts.entries()) {
          const initEnd = d.initialEnds.get(childId) ?? (initStart + 1000)
          const span = initEnd - initStart
          const newStart = Math.max(0, Math.min(duration - span, initStart + dt))
          updateLayer(childId, { start: newStart, end: newStart + span })
        }
      } else if (d.kind === 'trim-group') {
        const dt = (e.clientX - d.sx) / ppms
        for (const [childId, initStart] of d.initialStarts.entries()) {
          const initEnd = d.initialEnds.get(childId) ?? (initStart + 1000)
          if (d.edge === 'l') {
            const newStart = Math.max(0, Math.min(initEnd - 100, initStart + dt))
            updateLayer(childId, { start: newStart })
          } else {
            const newEnd = Math.min(duration, Math.max(initStart + 100, initEnd + dt))
            updateLayer(childId, { end: newEnd })
          }
        }
      }
    }
    const up = () => { drag.current = null }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [ppms, duration, setTime, updateLayer])

  const ticks = Array.from({ length: Math.floor(duration / 1000) + 1 }, (_, i) => i)

  const startGroupDrag = (groupId: string, e: React.PointerEvent) => {
    e.stopPropagation()
    const descendants = getDescendantLayers(groupId, project.layers)
    const initialStarts = new Map<string, number>()
    const initialEnds = new Map<string, number>()
    for (const d of descendants) {
      initialStarts.set(d.id, d.start)
      initialEnds.set(d.id, d.end)
    }
    drag.current = {
      kind: 'move-group',
      id: groupId,
      sx: e.clientX,
      initialStarts,
      initialEnds,
    }
  }

  const startGroupTrim = (groupId: string, edge: 'l' | 'r', s0: number, e0: number, e: React.PointerEvent) => {
    e.stopPropagation()
    const descendants = getDescendantLayers(groupId, project.layers)
    const initialStarts = new Map<string, number>()
    const initialEnds = new Map<string, number>()
    for (const d of descendants) {
      initialStarts.set(d.id, d.start)
      initialEnds.set(d.id, d.end)
    }
    drag.current = {
      kind: 'trim-group',
      id: groupId,
      edge,
      s0,
      e0,
      sx: e.clientX,
      initialStarts,
      initialEnds,
    }
  }

  return (
    <div
      className={`shrink-0 border-t border-line bg-timeline transition-all duration-200 ${
        timelineOpen ? 'block' : 'hidden'
      }`}
      data-testid="timeline"
      data-collapsed={!timelineOpen}
      data-state={timelineOpen ? 'open' : 'collapsed'}
      aria-hidden={!timelineOpen}
    >
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
            <button
              data-testid="timeline-collapse-btn"
              onClick={() => toggleTimeline(false)}
              className="grid h-8 w-8 place-items-center rounded-lg text-txt2 hover:text-white active:bg-surface2 transition-colors"
              title="Collapse timeline"
              aria-label="Collapse timeline"
            >
              <ChevronDown className="h-4 w-4" />
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
        className="relative h-44 overflow-auto no-scrollbar"
      >
        <div className="relative" style={{ width: LABEL_W + timeToX(duration) + 40, minWidth: '100%' }}>
          {/* rows */}
          <div className="pb-3 pt-2">
            {rows.length === 0 && (
              <p className="py-8 text-center text-xs text-txt3">Add elements to see them on the timeline</p>
            )}
            {rows.map((item) => (
              <TimelineRow
                key={item.layer.id}
                item={item}
                ppms={ppms}
                selected={selectedId === item.layer.id}
                onSelect={() => select(item.layer.id)}
                onToggleCollapse={() => toggleGroupCollapse(item.layer.id)}
                onReorder={(dir) => reorder(item.layer.id, dir)}
                onTrimLayer={(edge, e) => {
                  e.stopPropagation()
                  drag.current = { kind: 'trim', id: item.layer.id, edge, s0: item.layer.start, e0: item.layer.end, sx: e.clientX }
                }}
                onMoveLayer={(e) => {
                  e.stopPropagation()
                  drag.current = { kind: 'move', id: item.layer.id, sx: e.clientX, initialStart: item.layer.start, initialEnd: item.layer.end }
                }}
                onAnimation={(side, e) => {
                  e.stopPropagation()
                  select(item.layer.id)
                  setAnimationSide(side)
                  openTool('animate')
                }}
                onDragGroup={(e) => startGroupDrag(item.layer.id, e)}
                onDragLayer={(e) => onMoveLayer(e)}
                onTrimGroup={(edge, e) => startGroupTrim(item.layer.id, edge, item.effectiveStart, item.effectiveEnd, e)}
              />
            ))}
          </div>

          {/* playhead */}
          <div className="pointer-events-none absolute inset-y-0 z-20" style={{ left: LABEL_W }} data-testid="playhead">
            <div
              className="pointer-events-auto absolute -top-1 h-4 w-4 -translate-x-1/2 cursor-ew-resize rounded-sm bg-white shadow-sm"
              style={{ left: timeToX(time), touchAction: 'none' }}
              onPointerDown={(e) => {
                e.stopPropagation()
                drag.current = { kind: 'playhead' }
                setTime(xToTime(e.clientX))
              }}
              aria-label="Drag timeline playhead"
              role="slider"
              tabIndex={0}
            />
            <div className="absolute top-0 bottom-0 w-0.5 bg-white" style={{ left: timeToX(time) }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function TimelineRow({
  item,
  ppms,
  selected,
  onSelect,
  onToggleCollapse,
  onReorder,
  onTrimLayer,
  onMoveLayer,
  onAnimation,
  onDragLayer,
  onDragGroup,
  onTrimGroup,
}: {
  item: TimelineRowItem
  ppms: number
  selected: boolean
  onSelect: () => void
  onToggleCollapse: () => void
  onReorder: (dir: number) => void
  onTrimLayer: (edge: 'l' | 'r', e: React.PointerEvent) => void
  onMoveLayer: (e: React.PointerEvent) => void
  onAnimation: (side: 'in' | 'out', e: React.PointerEvent) => void
  onDragGroup: (e: React.PointerEvent) => void
  onTrimGroup: (edge: 'l' | 'r', e: React.PointerEvent) => void
}) {
  const { layer, depth, isGroup, isComponent, hasChildren, collapsed, effectiveStart, effectiveEnd } = item
  const label = layer.type === 'text'
    ? (layer.text || 'Text')
    : layer.type === 'sticker'
      ? `Sticker ${layer.emoji}`
      : layer.name

  const indentPx = Math.min(depth * 14, 42)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pointerDownX = useRef(0)
  const lastPointerEvent = useRef<React.PointerEvent | null>(null)
  const touchDragging = useRef(false)
  const pointerTarget = useRef<HTMLDivElement | null>(null)
  const pointerId = useRef<number | null>(null)

  const clearHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }

  const handleLayerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    onSelect()
    pointerDownX.current = e.clientX
    lastPointerEvent.current = e
    pointerTarget.current = e.currentTarget
    pointerId.current = e.pointerId
    touchDragging.current = false

    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      holdTimer.current = setTimeout(() => {
        holdTimer.current = null
        touchDragging.current = true
        if (pointerTarget.current && pointerId.current !== null) {
          pointerTarget.current.setPointerCapture(pointerId.current)
        }
        if (lastPointerEvent.current) onDragLayer(lastPointerEvent.current)
      }, 350)
      return
    }

    e.currentTarget.setPointerCapture(e.pointerId)
    onDragLayer(e)
  }

  const handleLayerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    lastPointerEvent.current = e
    if (holdTimer.current && Math.abs(e.clientX - pointerDownX.current) > 8) {
      clearHold()
    }
    if (touchDragging.current) e.preventDefault()
  }

  const handleLayerPointerUp = () => {
    clearHold()
    touchDragging.current = false
    lastPointerEvent.current = null
    pointerTarget.current = null
    pointerId.current = null
  }

  return (
    <div
      className={`group/row flex h-11 items-center border-b border-white/[0.04] transition-colors ${
        selected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.02]'
      }`}
    >
      {/* Left label column */}
      <div
        className="sticky left-0 z-10 flex h-full items-center gap-1.5 bg-timeline pr-2 pl-2"
        style={{ width: LABEL_W, paddingLeft: `${8 + indentPx}px` }}
        onClick={onSelect}
      >
        {isGroup && hasChildren && (
          <button
            type="button"
            data-testid={`toggle-group-${layer.id}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggleCollapse()
            }}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-txt3 hover:bg-white/10 hover:text-white"
            title={collapsed ? 'Expand group' : 'Collapse group'}
          >
            {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}
        {isGroup && !hasChildren && (
          <span className="w-4 shrink-0" />
        )}

        {!isGroup && depth > 0 && (
          <span className="h-3 w-1.5 shrink-0 border-b border-l border-white/20 -mt-1 mr-0.5" />
        )}

        {isComponent ? (
          <ComponentIcon className="h-3.5 w-3.5 shrink-0 text-purple-400" />
        ) : isGroup ? (
          <Folder className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
        ) : (
          <span
            className="h-2 w-2 shrink-0 rounded-sm"
            style={{ background: TRACK_COLOR[layer.type] || '#3B82F6' }}
          />
        )}

        <span
          className={`truncate text-[11px] select-none flex-1 ${
            isComponent
              ? 'font-semibold text-purple-300'
              : isGroup
                ? 'font-semibold text-indigo-200'
                : 'text-txt2'
          }`}
          title={label}
        >
          {label}
        </span>

        {/* Up / Down reorder arrows */}
        <div className="flex items-center opacity-0 group-hover/row:opacity-100 transition-opacity">
          <button
            type="button"
            data-testid={`reorder-up-${layer.id}`}
            onClick={(e) => {
              e.stopPropagation()
              onReorder(1)
            }}
            className="h-4 w-3 text-txt3 hover:text-white flex items-center justify-center"
            title="Move layer up"
          >
            <ArrowUp className="h-2.5 w-2.5" />
          </button>
          <button
            type="button"
            data-testid={`reorder-down-${layer.id}`}
            onClick={(e) => {
              e.stopPropagation()
              onReorder(-1)
            }}
            className="h-4 w-3 text-txt3 hover:text-white flex items-center justify-center"
            title="Move layer down"
          >
            <ArrowDown className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>

      {/* Right track area */}
      <div className="relative h-full flex-1">
        {isGroup ? (
          /* Group track clip */
          <div
            data-testid={`clip-${layer.id}`}
            onPointerDown={(e) => {
              onSelect()
              onDragGroup(e)
            }}
            className={`absolute top-1.5 flex h-8 items-center overflow-hidden rounded-md border shadow-sm cursor-grab active:cursor-grabbing ${
              selected
                ? isComponent
                  ? 'border-purple-400 bg-purple-950/70 ring-1 ring-purple-400'
                  : 'border-indigo-400 bg-indigo-950/70 ring-1 ring-indigo-400'
                : isComponent
                  ? 'border-purple-500/40 bg-purple-950/40'
                  : 'border-indigo-500/40 bg-indigo-950/40'
            }`}
            style={{
              left: effectiveStart * ppms,
              width: Math.max(32, (effectiveEnd - effectiveStart) * ppms),
              touchAction: 'none',
            }}
          >
            <div
              onPointerDown={(e) => onTrimGroup('l', e)}
              data-testid={`trim-l-${layer.id}`}
              className="absolute left-0 top-0 h-full w-2.5 cursor-ew-resize bg-black/30 hover:bg-white/20"
              style={{ touchAction: 'none' }}
            />
            <div className="flex w-full items-center gap-1.5 truncate px-3.5 select-none pointer-events-none">
              {isComponent ? (
                <span className="rounded bg-purple-500/30 px-1 py-0.2 text-[9px] font-bold text-purple-200">CMP</span>
              ) : (
                <span className="rounded bg-indigo-500/30 px-1 py-0.2 text-[9px] font-bold text-indigo-200">GRP</span>
              )}
              <span className="truncate text-[11px] font-semibold text-white/90">{label}</span>
            </div>
            <div
              onPointerDown={(e) => onTrimGroup('r', e)}
              data-testid={`trim-r-${layer.id}`}
              className="absolute right-0 top-0 h-full w-2.5 cursor-ew-resize bg-black/30 hover:bg-white/20"
              style={{ touchAction: 'none' }}
            />
          </div>
        ) : (
          /* Normal Layer clip */
          <div
            onPointerDown={handleLayerPointerDown}
            onPointerMove={handleLayerPointerMove}
            onPointerUp={handleLayerPointerUp}
            onPointerCancel={handleLayerPointerUp}
            data-testid={`clip-${layer.id}`}
            className={`absolute top-1.5 flex h-8 items-center overflow-hidden rounded-md border ${
              selected ? 'border-white ring-1 ring-white/60' : 'border-white/20'
            }`}
            style={{
              left: layer.start * ppms,
              width: Math.max(24, (layer.end - layer.start) * ppms),
              background: TRACK_COLOR[layer.type] || '#3B82F6',
              opacity: 0.92,
              touchAction: 'pan-x',
            }}
          >
            <button
              type="button"
              onPointerDown={(e) => onAnimation('in', e)}
              data-testid={`anim-in-${layer.id}`}
              aria-label={`Edit in-animation for ${label}`}
              title={`In-animation: ${layer.inAnim || layer.anim || 'none'}`}
              className="absolute left-0 top-0 z-10 h-full w-3 cursor-pointer bg-white/10 transition-colors hover:bg-emerald-300/60"
            />
            <div
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onTrimLayer('l', e) }}
              data-testid={`trim-l-${layer.id}`}
              className="absolute left-3 top-0 z-20 h-full w-2.5 cursor-ew-resize bg-black/25 hover:bg-black/40"
              style={{ touchAction: 'none' }}
            />
            <span className="pointer-events-none w-full truncate px-3 text-[11px] font-semibold text-white/95 select-none">
              {label}
            </span>
            <div
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onTrimLayer('r', e) }}
              data-testid={`trim-r-${layer.id}`}
              className="absolute right-3 top-0 z-20 h-full w-2.5 cursor-ew-resize bg-black/25 hover:bg-black/40"
              style={{ touchAction: 'none' }}
            />
            <button
              type="button"
              onPointerDown={(e) => onAnimation('out', e)}
              data-testid={`anim-out-${layer.id}`}
              aria-label={`Edit out-animation for ${label}`}
              title={`Out-animation: ${layer.outAnim || 'none'}`}
              className="absolute right-0 top-0 z-10 h-full w-3 cursor-pointer bg-white/10 transition-colors hover:bg-rose-300/60"
            />
          </div>
        )}
      </div>
    </div>
  )
}

