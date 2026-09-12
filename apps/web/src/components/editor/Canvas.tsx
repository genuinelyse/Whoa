import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Layer } from '#/types'
import { useEditor } from '#/store/editor'

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])
  return { ref, size }
}

function anim(layer: Layer, time: number, active: boolean) {
  if (!active) return { opacity: layer.opacity, transform: `rotate(${layer.rotation}deg)`, hidden: false }
  if (time < layer.start || time > layer.end) return { opacity: 0, transform: '', hidden: true }
  const p = Math.min(1, (time - layer.start) / 450)
  const base = `rotate(${layer.rotation}deg)`
  let opacity = layer.opacity
  let transform = base
  switch (layer.anim) {
    case 'fade':
      opacity = layer.opacity * p
      break
    case 'rise':
      opacity = layer.opacity * p
      transform = `translateY(${(1 - p) * 28}px) ${base}`
      break
    case 'pop':
      opacity = layer.opacity * p
      transform = `scale(${0.7 + 0.3 * p}) ${base}`
      break
    case 'slide':
      opacity = layer.opacity * p
      transform = `translateX(${(1 - p) * -50}px) ${base}`
      break
  }
  return { opacity, transform, hidden: false }
}

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi))
const tdist = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
const tmid = (a: Touch, b: Touch) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 })

type Corner = 'tl' | 'tr' | 'bl' | 'br'
type Gesture =
  | { id: string; mode: 'move'; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number; fromCanvas: boolean; moved: boolean; group?: { id: string; x: number; y: number }[] }
  | { id: string; mode: 'resize'; corner: Corner; isText: boolean; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number; ofs: number }
  | null

type Pinch =
  | { mode: 'zoom'; startDist: number; s0: number; lx: number; ly: number }
  | { mode: 'resize'; id: string; startDist: number; w0: number; h0: number; x0: number; y0: number; fontSize: number; group?: { id: string; x: number; y: number; w: number; h: number }[] }
  | null

export default function Canvas() {
  const { project, selectedId, selectedIds, select, updateLayer, time, mode, playing } = useEditor()
  const { ref, size } = useSize<HTMLDivElement>()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [pinchActive, setPinchActive] = useState(false)
  const longPress = useRef<number | null>(null)
  const pendingMultiSelectTap = useRef<number | null>(null)
  const pinchTouchSequence = useRef(false)
  const pinchStartedInMultiSelect = useRef(false)
  const multiSelectModeRef = useRef(false)
  multiSelectModeRef.current = multiSelectMode
  const gesture = useRef<Gesture>(null)
  const panGesture = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean }>(null)
  const selRef = useRef<HTMLDivElement>(null)
  const [selH, setSelH] = useState(0)
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const viewRef = useRef(view)
  viewRef.current = view
  const pinch = useRef<Pinch>(null)
  const pinching = useRef(false)
  const touchCount = useRef(0)
  const touchSelectionLock = useRef<string | null>(null)
  const activeTouches = useRef(new Map<number, { x: number; y: number }>())
  const selectedRef = useRef(selectedId)
  selectedRef.current = selectedId
  const layersRef = useRef(project.layers)
  layersRef.current = project.layers
  const selHRef = useRef(selH)
  selHRef.current = selH
  const { preset } = project
  const active = mode === 'animated' && !(!playing && time === 0)

  const pad = 0.9
  const scale = size.w && size.h ? Math.min((size.w * pad) / preset.w, (size.h * pad) / preset.h) : 0

  // measure the selected layer's rendered box (text height is auto)
  useLayoutEffect(() => {
    if (!selRef.current) return
    const el = selRef.current
    const update = () => setSelH(el.offsetHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [selectedId, editingId])

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const pan = panGesture.current
      if (pan) {
        const dx = e.clientX - pan.sx
        const dy = e.clientY - pan.sy
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) pan.moved = true
        setView((v) => ({ ...v, x: pan.ox + dx, y: pan.oy + dy }))
        return
      }
      const g = gesture.current
      if (!g || !scale) return
      const eff = scale * viewRef.current.scale
      const dx = (e.clientX - g.sx) / eff
      const dy = (e.clientY - g.sy) / eff
      if (g.mode === 'move') {
        if (Math.abs(e.clientX - g.sx) > 3 || Math.abs(e.clientY - g.sy) > 3) g.moved = true
        if (g.group) {
          for (const item of g.group) updateLayer(item.id, { x: item.x + dx, y: item.y + dy })
        } else {
          updateLayer(g.id, { x: g.ox + dx, y: g.oy + dy })
        }
        return
      }
      // resize from a corner
      const left = g.corner === 'tl' || g.corner === 'bl'
      const top = g.corner === 'tl' || g.corner === 'tr'
      let w = left ? g.ow - dx : g.ow + dx
      let h = top ? g.oh - dy : g.oh + dy
      w = Math.max(20, w)
      h = Math.max(20, h)
      const x = left ? g.ox + (g.ow - w) : g.ox
      const y = top ? g.oy + (g.oh - h) : g.oy
      if (g.isText) {
        const fontSize = Math.max(6, Math.round(g.ofs * (w / g.ow)))
        updateLayer(g.id, { x, y, w, fontSize })
      } else {
        updateLayer(g.id, { x, y, w, h })
      }
    }
    const up = () => {
      if (longPress.current) {
        window.clearTimeout(longPress.current)
        longPress.current = null
      }
      const g = gesture.current
      if (g?.mode === 'move' && g.fromCanvas && !g.moved && !multiSelectModeRef.current) {
        select(null)
      }
      gesture.current = null
      panGesture.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [scale, updateLayer])

  // Pinch-to-zoom / pan on the canvas only (prevents whole-page zoom)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const center = () => {
      const r = el.getBoundingClientRect()
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }
    }
    const zoomAt = (target: number, px: number, py: number) => {
      const v = viewRef.current
      const { cx, cy } = center()
      const s1 = clampN(target, 0.5, 6)
      const lx = (px - cx - v.x) / v.scale
      const ly = (py - cy - v.y) / v.scale
      setView({ scale: s1, x: px - cx - s1 * lx, y: py - cy - s1 * ly })
    }
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
        zoomAt(viewRef.current.scale * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY)
      } else if (viewRef.current.scale > 1) {
        e.preventDefault()
        const v = viewRef.current
        setView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY })
      }
    }
    const onTouchStart = (e: TouchEvent) => {
      touchCount.current = e.touches.length
      if (e.touches.length >= 2) {
        pinchTouchSequence.current = true
        pinchStartedInMultiSelect.current = multiSelectModeRef.current
        if (!pinchStartedInMultiSelect.current) {
          setMultiSelectMode(false)
          multiSelectModeRef.current = false
        }
        if (longPress.current) {
          window.clearTimeout(longPress.current)
          longPress.current = null
        }
        if (pendingMultiSelectTap.current) {
          window.clearTimeout(pendingMultiSelectTap.current)
          pendingMultiSelectTap.current = null
        }

      }
      if (e.touches.length === 1) {
        touchSelectionLock.current = selectedRef.current
        return
      }
      if (e.touches.length === 2) {
        e.preventDefault()
        const [t1, t2] = [e.touches[0], e.touches[1]]
        const startDist = tdist(t1, t2)
        const selected = layersRef.current.find((l) => l.id === touchSelectionLock.current)
        if (selected && !selected.locked) {
          const h = selected.type === 'text' ? (selHRef.current || selected.h) : selected.h
          pinch.current = {
            mode: 'resize',
            id: selected.id,
            startDist,
            w0: selected.w,
            h0: h,
            x0: selected.x,
            y0: selected.y,
            fontSize: selected.fontSize || 40,
            group: selectedIds.length > 1 ? layersRef.current.filter((item) => selectedIds.includes(item.id)).map((item) => ({ id: item.id, x: item.x, y: item.y, w: item.w, h: item.h })) : undefined,
          }
        } else {
          const m = tmid(t1, t2)
          const v = viewRef.current
          const { cx, cy } = center()
          pinch.current = {
            mode: 'zoom',
            startDist,
            s0: v.scale,
            lx: (m.x - cx - v.x) / v.scale,
            ly: (m.y - cy - v.y) / v.scale,
          }
        }
        pinching.current = true
        setPinchActive(true)
        gesture.current = null
        panGesture.current = null
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2 && pinch.current) {
        e.preventDefault()
        const [t1, t2] = [e.touches[0], e.touches[1]]
        const p = pinch.current
        const ratio = tdist(t1, t2) / p.startDist
        if (p.mode === 'resize') {
          const selected = layersRef.current.find((l) => l.id === p.id)
          if (!selected) return
          if (p.group) {
            const cx = p.group.reduce((sum, item) => sum + item.x + item.w / 2, 0) / p.group.length
            const cy = p.group.reduce((sum, item) => sum + item.y + item.h / 2, 0) / p.group.length
            for (const item of p.group) {
              const w = Math.max(20, item.w * ratio)
              const h = Math.max(20, item.h * ratio)
              updateLayer(item.id, { x: cx + (item.x + item.w / 2 - cx) * ratio - w / 2, y: cy + (item.y + item.h / 2 - cy) * ratio - h / 2, w, h })
            }
          } else {
            const w = Math.max(20, p.w0 * ratio)
            const h = Math.max(20, p.h0 * ratio)
            const x = p.x0 + (p.w0 - w) / 2
            const y = p.y0 + (p.h0 - h) / 2
            if (selected.type === 'text') updateLayer(p.id, { x, y, w, fontSize: Math.max(6, Math.round(p.fontSize * ratio)) })
            else updateLayer(p.id, { x, y, w, h })
          }
          return
        }
        const m = tmid(t1, t2)
        const s1 = clampN(p.s0 * ratio, 0.5, 6)
        const { cx, cy } = center()
        setView({ scale: s1, x: m.x - cx - s1 * p.lx, y: m.y - cy - s1 * p.ly })
      }
    }
    const onTouchEnd = (e: TouchEvent) => {
      touchCount.current = e.touches.length
      if (e.touches.length < 2) {
        pinch.current = null
        pinching.current = false
        setPinchActive(false)
        if (!pinchStartedInMultiSelect.current) {
          setMultiSelectMode(false)
          multiSelectModeRef.current = false
        }
        pinchStartedInMultiSelect.current = false
      }
      if (e.touches.length === 0) {
        touchSelectionLock.current = null
        pinchTouchSequence.current = false
      }
    }
    const stop = (e: Event) => e.preventDefault()
    el.addEventListener('wheel', onWheel, { passive: false })
    // Capture touchstart before React's delegated pointer handlers run. This
    // locks the active selection before a second finger can hit another layer.
    el.addEventListener('touchstart', onTouchStart, { passive: false, capture: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false, capture: true })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('gesturestart', stop as EventListener, { passive: false })
    el.addEventListener('gesturechange', stop as EventListener, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('gesturestart', stop as EventListener)
      el.removeEventListener('gesturechange', stop as EventListener)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startMove = (e: React.PointerEvent, l: Layer) => {
    if (e.pointerType === 'touch' && (pinching.current || activeTouches.current.size > 1)) {
      e.stopPropagation()
      e.preventDefault()
      return
    }
    // Once a second touch exists, do not let its hit-tested layer replace the
    // selection that the pinch gesture is resizing.
    if (
      l.locked ||
      editingId === l.id ||
      pinching.current ||
      (e.pointerType === 'touch' &&
        (pinchTouchSequence.current || touchCount.current >= 2 ||
          activeTouches.current.size > 1 ||
          (touchSelectionLock.current !== null && touchSelectionLock.current !== l.id))) ||
      (e.pointerType === 'touch' && pinch.current !== null)
    ) return
    e.stopPropagation()
    if (e.pointerType === 'touch') {
      e.currentTarget.setPointerCapture?.(e.pointerId)
      if (multiSelectModeRef.current) {
        select(l.id, true)
        return
      }
      if (!selectedIds.includes(l.id)) select(l.id)
    } else if (!selectedIds.includes(l.id)) select(l.id)
    const group = selectedIds.length > 1 && selectedIds.includes(l.id)
      ? project.layers.filter((item) => selectedIds.includes(item.id)).map((item) => ({ id: item.id, x: item.x, y: item.y }))
      : undefined
    gesture.current = { id: l.id, mode: 'move', sx: e.clientX, sy: e.clientY, ox: l.x, oy: l.y, ow: l.w, oh: l.h, fromCanvas: false, moved: false, group }
  }
  const startResize = (e: React.PointerEvent, l: Layer, corner: Corner, boxH: number) => {
    if (pinching.current) return
    e.stopPropagation()
    e.preventDefault()
    gesture.current = {
      id: l.id, mode: 'resize', corner, isText: l.type === 'text',
      sx: e.clientX, sy: e.clientY, ox: l.x, oy: l.y, ow: l.w, oh: boxH, ofs: l.fontSize || 40,
    }
  }

  const bg = project.background
  const bgStyle: React.CSSProperties =
    bg.type === 'color'
      ? { background: bg.value }
      : bg.type === 'gradient'
        ? { backgroundImage: bg.value }
        : { backgroundImage: `url(${bg.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }

  const eff = scale * view.scale
  const hs = eff ? 11 / eff : 11 // handle size in artboard px (constant on screen)

  return (
    <div
      ref={ref}
      className="checkerboard relative z-0 flex min-h-0 min-w-0 flex-1 touch-none items-center justify-center overflow-hidden"
      onPointerDownCapture={(e) => {
        if (e.pointerType !== 'touch') return
        if (activeTouches.current.size === 0) touchSelectionLock.current = selectedRef.current
        activeTouches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (activeTouches.current.size >= 2) {
          e.preventDefault()
          e.stopPropagation()
        }
        if (activeTouches.current.size < 2 || pinch.current) return

        const points = Array.from(activeTouches.current.values())
        const startDist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
        if (startDist < 1) return
        e.preventDefault()
        e.stopPropagation()
        pinching.current = true
        pinchTouchSequence.current = true
        gesture.current = null
        const selected = layersRef.current.find((l) => l.id === touchSelectionLock.current)
        if (selected && !selected.locked) {
          const h = selected.type === 'text' ? (selHRef.current || selected.h) : selected.h
          pinch.current = { mode: 'resize', id: selected.id, startDist, w0: selected.w, h0: h, x0: selected.x, y0: selected.y, fontSize: selected.fontSize || 40 }
        } else {
          const v = viewRef.current
          const { cx, cy } = center()
          const mx = (points[0].x + points[1].x) / 2
          const my = (points[0].y + points[1].y) / 2
          pinch.current = { mode: 'zoom', startDist, s0: v.scale, lx: (mx - cx - v.x) / v.scale, ly: (my - cy - v.y) / v.scale }
        }
      }}
      onPointerMoveCapture={(e) => {
        if (e.pointerType === 'touch') activeTouches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      }}
      onPointerUpCapture={(e) => {
        if (e.pointerType === 'touch') {
          activeTouches.current.delete(e.pointerId)
          if (activeTouches.current.size === 0) pinchTouchSequence.current = false
        }
      }}
      onPointerCancelCapture={(e) => {
        if (e.pointerType === 'touch') {
          activeTouches.current.delete(e.pointerId)
          if (activeTouches.current.size === 0) pinchTouchSequence.current = false
        }
      }}
      onPointerDown={(e) => {
        // The second touch belongs to the active pinch. A first touch on the
        // background starts a deferred move for the selected layer: it becomes
        // a deselect on tap, or a drag when the pointer actually moves.
        if (pinching.current || (e.pointerType === 'touch' && (touchCount.current >= 2 || activeTouches.current.size > 1))) return
        if (e.pointerType === 'touch' && selectedId) {
          const selected = project.layers.find((l) => l.id === selectedId)
          if (!multiSelectModeRef.current && selected && !selected.locked && editingId !== selected.id) {
            e.preventDefault()
            gesture.current = { id: selected.id, mode: 'move', sx: e.clientX, sy: e.clientY, ox: selected.x, oy: selected.y, ow: selected.w, oh: selected.h, fromCanvas: true, moved: false }
            return
          }
        }
        if (!selectedId && (e.pointerType === 'mouse' ? e.button === 0 : true)) {
          e.preventDefault()
          e.currentTarget.setPointerCapture(e.pointerId)
          const v = viewRef.current
          panGesture.current = { sx: e.clientX, sy: e.clientY, ox: v.x, oy: v.y, moved: false }
          return
        }
        setMultiSelectMode(false)
        multiSelectModeRef.current = false
        select(null)
        setEditingId(null)
      }}
      data-testid="canvas"
    >
      {scale > 0 && (
        <div style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: 'center', willChange: 'transform' }}>
        <div
          className="relative shrink-0 shadow-2xl"
          style={{ width: preset.w, height: preset.h, transform: `scale(${scale})`, transformOrigin: 'center', ...bgStyle }}
          data-testid="artboard"
        >
          {project.layers.map((l) => {
            const a = anim(l, time, active)
            if (!l.visible || a.hidden) return null
            const isSel = selectedIds.includes(l.id)
            return (
              <div
                key={l.id}
                ref={isSel ? selRef : undefined}
          onTouchStart={(e) => {
            e.stopPropagation()
            if (l.locked || editingId === l.id) return
            if (multiSelectModeRef.current) return
            if (longPress.current) window.clearTimeout(longPress.current)
            longPress.current = window.setTimeout(() => {
              setMultiSelectMode(true)
              multiSelectModeRef.current = true
              select(l.id, true)
              gesture.current = null
              longPress.current = null
            }, 600)
          }}
          onPointerDown={(e) => startMove(e, l)}
          onContextMenu={(e) => {
            if (multiSelectModeRef.current) {
              e.preventDefault()
              e.stopPropagation()
              setMultiSelectMode(true)
              multiSelectModeRef.current = true
              select(l.id, true)
            }
          }}
          onDoubleClick={(e) => { e.stopPropagation(); if (l.type === 'text') setEditingId(l.id) }}
                data-testid={`layer-${l.id}`}
                style={{
                  position: 'absolute',
                  left: l.x,
                  top: l.y,
                  width: l.w,
                  height: l.type === 'text' ? 'auto' : l.h,
                  opacity: a.opacity,
                  transform: a.transform,
                  outline: isSel ? `${2 / eff}px solid ${multiSelectMode && !pinchActive ? '#4B1D6B' : '#007AFF'}` : 'none',
                  outlineOffset: multiSelectMode && !pinchActive ? 2 / eff : 0,
                  cursor: l.locked ? 'default' : 'move',
                  touchAction: 'none',
                }}
              >
                <LayerContent
                  layer={l}
                  editing={editingId === l.id}
                  onEdit={(t) => updateLayer(l.id, { text: t })}
                  onEndEdit={() => setEditingId(null)}
                />
              </div>
            )
          })}

          {/* Selection handles overlay — rendered above all layers so they are never occluded */}
          {(() => {
            const sel = project.layers.find((l) => l.id === selectedId)
            if (!sel || editingId || sel.locked || !sel.visible) return null
            const bh = sel.type === 'text' ? (selH || sel.h) : sel.h
            const size = hs * 3.8
            const dot = hs * 1.5
            const corners: { c: Corner; cx: number; cy: number }[] = [
              { c: 'tl', cx: 0, cy: 0 },
              { c: 'tr', cx: sel.w, cy: 0 },
              { c: 'bl', cx: 0, cy: bh },
              { c: 'br', cx: sel.w, cy: bh },
            ]
            return (
              <div style={{ position: 'absolute', left: sel.x, top: sel.y, width: sel.w, height: bh, pointerEvents: 'none', zIndex: 60 }}>
                {corners.map(({ c, cx, cy }) => (
                  <div
                    key={c}
                    data-testid={`resize-${c}-${sel.id}`}
                    onPointerDown={(e) => startResize(e, sel, c, bh)}
                    style={{
                      position: 'absolute',
                      left: cx - size / 2,
                      top: cy === bh ? bh - size / 2 : cy - size / 2,
                      width: size,
                      height: size,
                      display: 'grid',
                      placeItems: 'center',
                      pointerEvents: 'auto',
                      cursor: c === 'tl' || c === 'br' ? 'nwse-resize' : 'nesw-resize',
                      touchAction: 'none',
                    }}
                  >
                    <div style={{ width: dot, height: dot, borderRadius: '9999px', background: '#fff', border: `${Math.max(1.5, dot * 0.18)}px solid #007AFF` }} />
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
        </div>
      )}

      {view.scale !== 1 && (
        <button
          data-testid="reset-zoom"
          onClick={() => setView({ scale: 1, x: 0, y: 0 })}
          className="absolute bottom-3 right-3 z-40 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md active:scale-95"
        >
          {Math.round(view.scale * 100)}% · Reset
        </button>
      )}

      {project.layers.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-full bg-black/50 px-4 py-2 text-sm text-white/70">
            Tap a tool below to add elements
          </p>
        </div>
      )}
    </div>
  )
}

function EditableText({ initial, style, onCommit, onDone }: { initial: string; style: React.CSSProperties; onCommit: (t: string) => void; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const latest = useRef(initial)
  const committed = useRef(false)
  const commitRef = useRef(onCommit)
  commitRef.current = onCommit
  const commit = () => {
    if (committed.current) return
    committed.current = true
    commitRef.current(latest.current)
  }
  useEffect(() => {
    const el = ref.current
    if (!el) return
    committed.current = false
    el.textContent = initial
    el.focus()
    const r = document.createRange()
    r.selectNodeContents(el)
    const s = window.getSelection()
    s?.removeAllRanges()
    s?.addRange(r)
    return () => commit() // commit even if unmounted (tap empty canvas) without a blur
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
      onInput={(e) => { latest.current = (e.currentTarget as HTMLElement).innerText }}
      onBlur={() => { commit(); onDone() }}
    />
  )
}

function LayerContent({
  layer,
  editing,
  onEdit,
  onEndEdit,
}: {
  layer: Layer
  editing: boolean
  onEdit: (t: string) => void
  onEndEdit: () => void
}) {
  if (layer.type === 'text') {
    const style: React.CSSProperties = {
      fontFamily: layer.fontFamily,
      fontSize: layer.fontSize,
      fontWeight: layer.fontWeight,
      color: layer.color,
      textAlign: layer.align,
      lineHeight: 1.15,
      width: '100%',
      // Keep pinch resizing from introducing accidental soft wraps that change
      // the selected text layer's auto height. Explicit line breaks still work.
      whiteSpace: 'pre',
      wordBreak: 'normal',
      outline: 'none',
    }
    if (editing) {
      return <EditableText style={style} initial={layer.text || ''} onCommit={(t) => onEdit(t)} onDone={onEndEdit} />
    }
    return <div style={style}>{layer.text}</div>
  }

  if (layer.type === 'shape') {
    const common: React.CSSProperties = { width: '100%', height: '100%', background: layer.fill }
    switch (layer.shape) {
      case 'circle':
        return <div style={{ ...common, borderRadius: '9999px' }} />
      case 'triangle':
        return <div style={{ width: 0, height: 0, borderLeft: `${layer.w / 2}px solid transparent`, borderRight: `${layer.w / 2}px solid transparent`, borderBottom: `${layer.h}px solid ${layer.fill}` }} />
      case 'star':
        return <div style={{ ...common, clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' }} />
      case 'line':
        return <div style={{ width: '100%', height: Math.max(4, layer.h * 0.12), background: layer.fill, marginTop: layer.h / 2 }} />
      default:
        return <div style={{ ...common, borderRadius: layer.radius }} />
    }
  }

  if (layer.type === 'image') {
    return (
      <img
        src={layer.src}
        alt=""
        draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: layer.radius || 0 }}
      />
    )
  }

  // sticker
  return (
    <div style={{ width: '100%', height: '100%', fontSize: layer.h * 0.8, display: 'grid', placeItems: 'center', lineHeight: 1 }}>
      {layer.emoji}
    </div>
  )
}
