import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  | { id: string; mode: 'move'; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number; fromCanvas: boolean; moved: boolean; deselectOnTap?: boolean; tapToggleId?: string; tapAddId?: string; group?: { id: string; x: number; y: number; w: number; h: number }[] }
  | { id: string; mode: 'resize'; corner: Corner; isText: boolean; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number; ofs: number; group?: { id: string; x: number; y: number; w: number; h: number; fontSize?: number }[] }
  | null

type Pinch =
  | { mode: 'zoom'; startDist: number; s0: number; lx: number; ly: number }
  | { mode: 'resize'; id: string; startDist: number; w0: number; h0: number; x0: number; y0: number; fontSize: number; group?: { id: string; x: number; y: number; w: number; h: number; fontSize?: number }[] }
  | null

export default function Canvas() {
  const { project, selectedId, selectedIds, select, toggleSelect, updateLayer, time, mode, playing } = useEditor()
  const { ref, size } = useSize<HTMLDivElement>()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const marqueeSession = useRef<{ active: boolean; start: { x: number; y: number }; update?: (event: PointerEvent) => void; finish?: (event: PointerEvent) => void }>({ active: false, start: { x: 0, y: 0 } })
  const marqueeLongPress = useRef<number | null>(null)
  const [pinchActive, setPinchActive] = useState(false)
  const longPress = useRef<number | null>(null)
  const pendingMultiSelectTap = useRef<number | null>(null)
  const pinchTouchSequence = useRef(false)
  const pinchStartedInMultiSelect = useRef(false)
  const multiSelectModeRef = useRef(false)
  multiSelectModeRef.current = multiSelectMode
  const isSpacePressed = useRef(false)
  const gesture = useRef<Gesture>(null)
  const panGesture = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean }>(null)
  const selRef = useRef<HTMLDivElement>(null)
  const layerRefs = useRef(new Map<string, HTMLDivElement>())
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
  const selectedIdsRef = useRef(selectedIds)
  selectedRef.current = selectedId
  selectedIdsRef.current = selectedIds
  const layersRef = useRef(project.layers)
  layersRef.current = project.layers
  const selHRef = useRef(selH)
  selHRef.current = selH
  const { preset } = project
  const active = mode === 'animated' && !(!playing && time === 0)

  const center = useCallback(() => {
    const el = ref.current
    if (!el) return { cx: 0, cy: 0 }
    const r = el.getBoundingClientRect()
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }
  }, [ref])

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
        const dist = Math.hypot(e.clientX - g.sx, e.clientY - g.sy)
        if (dist > 8) {
          if (longPress.current) {
            window.clearTimeout(longPress.current)
            longPress.current = null
          }
          if (marqueeLongPress.current) {
            window.clearTimeout(marqueeLongPress.current)
            marqueeLongPress.current = null
          }
          g.moved = true
        }
        if (g.moved) {
          if (g.group) {
            for (const item of g.group) updateLayer(item.id, { x: item.x + dx, y: item.y + dy, w: item.w, h: item.h })
          } else {
            updateLayer(g.id, { x: g.ox + dx, y: g.oy + dy, w: g.ow, h: g.oh })
          }
        }
        return
      }
      // Resize from a corner. Group bounds scale every selected layer from
      // the opposite corner so their relative positions remain intact.
      const left = g.corner === 'tl' || g.corner === 'bl'
      const top = g.corner === 'tl' || g.corner === 'tr'
      let w = left ? g.ow - dx : g.ow + dx
      let h = top ? g.oh - dy : g.oh + dy
      w = Math.max(20, w)
      h = Math.max(20, h)
      const x = left ? g.ox + (g.ow - w) : g.ox
      const y = top ? g.oy + (g.oh - h) : g.oy
      if (g.group) {
        const factor = Math.min(w / g.ow, h / g.oh)
        w = Math.max(20, g.ow * factor)
        h = Math.max(20, g.oh * factor)
        const groupX = left ? g.ox + (g.ow - w) : g.ox
        const groupY = top ? g.oy + (g.oh - h) : g.oy
        const sx = w / g.ow
        for (const item of g.group) {
          const patch = {
            x: groupX + (item.x - g.ox) * sx,
            y: groupY + (item.y - g.oy) * sx,
                      w: Math.max(20, item.w * sx),
                      h: Math.max(20, item.h * sx),
                    }
          const layer = layersRef.current.find((candidate) => candidate.id === item.id)
          if (layer?.type === 'text' && item.fontSize) {
            updateLayer(item.id, { ...patch, fontSize: Math.max(6, Math.round(item.fontSize * sx)) })
          } else {
            updateLayer(item.id, patch)
          }
        }
      } else if (g.isText) {
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
      if (g?.mode === 'move' && !g.moved && g.tapAddId) {
        select(g.tapAddId, true)
      } else if (g?.mode === 'move' && !g.moved && g.tapToggleId) {
        toggleSelect(g.tapToggleId)
        if (selectedIdsRef.current.length <= 1) {
          setMultiSelectMode(false)
          multiSelectModeRef.current = false
        }
      } else if (g?.mode === 'move' && (g.fromCanvas || g.deselectOnTap) && !g.moved) {
        if (!pinchTouchSequence.current && !pinching.current) {
          setMultiSelectMode(false)
          multiSelectModeRef.current = false
          select(null)
          setEditingId(null)
        }
      }
      gesture.current = null
      panGesture.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [scale, toggleSelect, updateLayer])

  // Track spacebar for pan navigation
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName) && !editingId) {
        isSpacePressed.current = true
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressed.current = false
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [editingId])

  // Pinch-to-zoom / pan on the canvas only (prevents whole-page zoom)
  useEffect(() => {
    const el = ref.current
    if (!el) return
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
        pinchStartedInMultiSelect.current = multiSelectModeRef.current || selectedIdsRef.current.length > 1
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
        if (marqueeLongPress.current) {
          window.clearTimeout(marqueeLongPress.current)
          marqueeLongPress.current = null
        }
        if (marqueeSession.current.active) {
          setMarquee(null)
          marqueeSession.current.active = false
        }
      }
      if (e.touches.length === 1) {
        touchSelectionLock.current = (selectedRef.current && selectedIdsRef.current.includes(selectedRef.current))
          ? selectedRef.current
          : (selectedIdsRef.current[0] ?? null)
        return
      }
      if (e.touches.length === 2) {
        e.preventDefault()
        const [t1, t2] = [e.touches[0], e.touches[1]]
        const startDist = tdist(t1, t2)
        const targetId = (touchSelectionLock.current && selectedIdsRef.current.includes(touchSelectionLock.current))
          ? touchSelectionLock.current
          : (selectedRef.current && selectedIdsRef.current.includes(selectedRef.current) ? selectedRef.current : (selectedIdsRef.current[0] ?? null))
        const selected = targetId ? layersRef.current.find((l) => l.id === targetId) : undefined
        if (selected && !selected.locked) {
          const node = layerRefs.current.get(selected.id)
          const currentW = selected.type === 'text' && node ? node.offsetWidth : selected.w
          const currentH = selected.type === 'text' ? (node?.offsetHeight || selHRef.current || selected.h) : selected.h
          pinch.current = {
            mode: 'resize',
            id: selected.id,
            startDist,
            w0: currentW,
            h0: currentH,
            x0: (selected.type === 'text' && selected.align === 'center' && selected.x === 0 && selected.w === preset.w && node)
              ? (preset.w - currentW) / 2
              : (node?.offsetLeft ?? selected.x),
            y0: selected.y,
            fontSize: selected.fontSize || 40,
            group: selectedIdsRef.current.length > 1
            ? layersRef.current.filter((item) => selectedIdsRef.current.includes(item.id) && !item.locked).map((item) => {
              const itemNode = layerRefs.current.get(item.id)
              const itemW = item.type === 'text' && itemNode ? itemNode.offsetWidth : item.w
              const itemH = item.type === 'text' && itemNode ? itemNode.offsetHeight : item.h
              const itemX = (item.type === 'text' && item.align === 'center' && item.x === 0 && item.w === preset.w && itemNode)
                ? (preset.w - itemW) / 2
                : (itemNode?.offsetLeft ?? item.x)
              return {
                id: item.id,
                x: itemX,
                y: item.y,
                w: itemW,
                h: itemH,
                fontSize: item.type === 'text' ? item.fontSize : undefined,
              }
            })
            : undefined,
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
              const layer = layersRef.current.find((candidate) => candidate.id === item.id)
              const next = {
                x: cx + (item.x + item.w / 2 - cx) * ratio - w / 2,
                y: cy + (item.y + item.h / 2 - cy) * ratio - h / 2,
                w,
                h,
              }
              if (layer?.type === 'text' && item.fontSize) {
                updateLayer(item.id, { ...next, fontSize: Math.max(6, Math.round(item.fontSize * ratio)) })
              } else {
                updateLayer(item.id, next)
              }
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
      if (e.touches.length < 2 && (pinch.current || pinching.current || pinchTouchSequence.current)) {
        pinch.current = null
        pinching.current = false
        setPinchActive(false)
        if (!pinchStartedInMultiSelect.current) {
          setMultiSelectMode(false)
          multiSelectModeRef.current = false
        }
        pinchStartedInMultiSelect.current = false
      }
      // Keep the touch sequence locked while one finger remains down. Safari
      // can send that remaining finger over another layer before the final
      // touchend, which must not start a new selection.
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
    // Once a touch sequence becomes a pinch, neither finger may hit-test or
    // select another layer while the selected layer is being resized.
    if (
      e.pointerType === 'touch' &&
      (pinching.current || pinchTouchSequence.current || touchCount.current >= 2 || activeTouches.current.size > 1)
    ) {
      e.stopPropagation()
      e.preventDefault()
      return
    }
    // A resize owns the active pointer until pointerup, even if the resized
    // layer now overlaps another layer beneath the pointer.
    if (gesture.current?.mode === 'resize') {
      e.stopPropagation()
      e.preventDefault()
      return
    }
    if (editingId === l.id) {
      return
    }
    if (
      pinching.current ||
      (e.pointerType === 'touch' &&
        (pinchTouchSequence.current || touchCount.current >= 2 || activeTouches.current.size > 1)) ||
      (e.pointerType === 'touch' && pinch.current !== null)
    ) {
      if (e.pointerType === 'touch') {
        e.preventDefault()
        e.stopPropagation()
      }
      return
    }
    e.stopPropagation()
    if (longPress.current) {
      window.clearTimeout(longPress.current)
      longPress.current = null
    }

    const isExternalToSelection = selectedIds.length > 0 && !selectedIds.includes(l.id)
    const selectedLayers = project.layers.filter((item) => selectedIds.includes(item.id) && item.visible && !item.locked)

    if (isExternalToSelection && selectedLayers.length > 0) {
      const primary = selectedLayers[0]
      const pNode = layerRefs.current.get(primary.id)
      const pW = (primary.type === 'text' && pNode ? pNode.offsetWidth : pNode?.offsetWidth) || primary.w
      const pH = (primary.type === 'text' && pNode ? pNode.offsetHeight : pNode?.offsetHeight) || primary.h
      const pX = (primary.type === 'text' && primary.align === 'center' && primary.x === 0 && primary.w === preset.w && pNode)
        ? (preset.w - pW) / 2
        : (pNode?.offsetLeft ?? primary.x)
      const group = selectedLayers.length > 1
        ? selectedLayers.map((item) => {
            const itemNode = layerRefs.current.get(item.id)
            const itemW = (item.type === 'text' && itemNode ? itemNode.offsetWidth : itemNode?.offsetWidth) || item.w
            const itemH = (item.type === 'text' && itemNode ? itemNode.offsetHeight : itemNode?.offsetHeight) || item.h
            const itemX = (item.type === 'text' && item.align === 'center' && item.x === 0 && item.w === preset.w && itemNode)
              ? (preset.w - itemW) / 2
              : (itemNode?.offsetLeft ?? item.x)
            return { id: item.id, x: itemX, y: item.y, w: itemW, h: itemH }
          })
        : undefined
      gesture.current = {
        id: primary.id,
        mode: 'move',
        sx: e.clientX,
        sy: e.clientY,
        ox: pX,
        oy: primary.y,
        ow: pW,
        oh: pH,
        fromCanvas: false,
        moved: false,
        deselectOnTap: !multiSelectModeRef.current,
        tapAddId: multiSelectModeRef.current ? l.id : undefined,
        group,
      }
      if (e.pointerType === 'touch') {
        e.currentTarget.setPointerCapture?.(e.pointerId)
      }
      return
    }

    if (l.locked) {
      return
    }

    if (!multiSelectModeRef.current) {
      longPress.current = window.setTimeout(() => {
        setMultiSelectMode(true)
        multiSelectModeRef.current = true
        select(l.id, true)
        gesture.current = null
        longPress.current = null
        try {
          navigator.vibrate?.(40)
        } catch {}
      }, 450)
    }
    if (e.pointerType === 'touch') {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    }
    if (multiSelectModeRef.current) {
      if (!selectedIds.includes(l.id)) {
        select(l.id, true)
        gesture.current = null
        return
      }
    } else if (!selectedIds.includes(l.id)) {
      select(l.id)
    }
    const node = layerRefs.current.get(l.id)
    const currentX = (l.type === 'text' && l.align === 'center' && l.x === 0 && l.w === preset.w && node)
      ? (preset.w - node.offsetWidth) / 2
      : (node?.offsetLeft ?? l.x)
    const currentW = (l.type === 'text' && node ? node.offsetWidth : node?.offsetWidth) || l.w
    const currentH = (l.type === 'text' && node ? node.offsetHeight : node?.offsetHeight) || l.h
    const group = selectedIds.length > 1 && selectedIds.includes(l.id)
      ? project.layers.filter((item) => selectedIds.includes(item.id)).map((item) => {
          const itemNode = layerRefs.current.get(item.id)
          const itemW = (item.type === 'text' && itemNode ? itemNode.offsetWidth : itemNode?.offsetWidth) || item.w
          const itemH = (item.type === 'text' && itemNode ? itemNode.offsetHeight : itemNode?.offsetHeight) || item.h
          const itemX = (item.type === 'text' && item.align === 'center' && item.x === 0 && item.w === preset.w && itemNode)
            ? (preset.w - itemW) / 2
            : (itemNode?.offsetLeft ?? item.x)
          return { id: item.id, x: itemX, y: item.y, w: itemW, h: itemH }
        })
      : undefined
    gesture.current = {
      id: l.id,
      mode: 'move',
      sx: e.clientX,
      sy: e.clientY,
      ox: currentX,
      oy: l.y,
      ow: currentW,
      oh: currentH,
      fromCanvas: false,
      moved: false,
      deselectOnTap: false,
      tapToggleId: multiSelectModeRef.current && selectedIds.length > 1 && selectedIds.includes(l.id) ? l.id : undefined,
      group,
    }
  }
  const startResize = (e: React.PointerEvent, l: Layer, corner: Corner, boxW: number, boxH: number, boundsLeft?: number, boundsTop?: number, group?: { id: string; x: number; y: number; w: number; h: number; fontSize?: number }[]) => {
    if (pinching.current) return
    e.stopPropagation()
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const node = layerRefs.current.get(l.id)
    const currentW = l.type === 'text' && node ? node.offsetWidth : l.w
    const currentH = l.type === 'text' && node ? node.offsetHeight : boxH
    const currentX = (l.type === 'text' && l.align === 'center' && l.x === 0 && l.w === preset.w && node)
      ? (preset.w - currentW) / 2
      : (node?.offsetLeft ?? l.x)
    gesture.current = {
      id: l.id, mode: 'resize', corner, isText: l.type === 'text',
      sx: e.clientX, sy: e.clientY,
      ox: group ? (boundsLeft ?? currentX) : currentX,
      oy: group ? (boundsTop ?? l.y) : l.y,
      ow: group ? boxW : currentW,
      oh: group ? boxH : currentH,
      ofs: l.fontSize || 40,
      group,
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
        if (activeTouches.current.size === 0) {
          touchSelectionLock.current = (selectedRef.current && selectedIdsRef.current.includes(selectedRef.current))
            ? selectedRef.current
            : (selectedIdsRef.current[0] ?? null)
        }
        activeTouches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        touchCount.current = activeTouches.current.size
        if (activeTouches.current.size >= 2) {
          pinchTouchSequence.current = true
          pinchStartedInMultiSelect.current = multiSelectModeRef.current || selectedIdsRef.current.length > 1
          if (marqueeLongPress.current) {
            window.clearTimeout(marqueeLongPress.current)
            marqueeLongPress.current = null
          }
          if (marqueeSession.current.active) {
            setMarquee(null)
            marqueeSession.current.active = false
          }
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
        const targetId = (touchSelectionLock.current && selectedIdsRef.current.includes(touchSelectionLock.current))
          ? touchSelectionLock.current
          : (selectedRef.current && selectedIdsRef.current.includes(selectedRef.current) ? selectedRef.current : (selectedIdsRef.current[0] ?? null))
        const selected = targetId ? layersRef.current.find((l) => l.id === targetId) : undefined
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
            group: selectedIdsRef.current.length > 1
              ? layersRef.current
                .filter((item) => selectedIdsRef.current.includes(item.id) && !item.locked)
                .map((item) => ({ id: item.id, x: item.x, y: item.y, w: item.w, h: item.h, fontSize: item.type === 'text' ? item.fontSize : undefined }))
              : undefined,
          }
          setPinchActive(true)
        } else {
          const v = viewRef.current
          const { cx, cy } = center()
          const mx = (points[0].x + points[1].x) / 2
          const my = (points[0].y + points[1].y) / 2
          pinch.current = { mode: 'zoom', startDist, s0: v.scale, lx: (mx - cx - v.x) / v.scale, ly: (my - cy - v.y) / v.scale }
          setPinchActive(true)
        }
      }}
      onPointerMoveCapture={(e) => {
        if (e.pointerType === 'touch') {
          activeTouches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
          if (pinching.current && pinch.current && activeTouches.current.size >= 2) {
            const points = Array.from(activeTouches.current.values())
            const currentDist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
            const p = pinch.current
            if (p.startDist > 0 && p.mode === 'resize') {
              const ratio = currentDist / p.startDist
              const selected = layersRef.current.find((l) => l.id === p.id)
              if (selected) {
                if (p.group) {
                  const cx = p.group.reduce((sum, item) => sum + item.x + item.w / 2, 0) / p.group.length
                  const cy = p.group.reduce((sum, item) => sum + item.y + item.h / 2, 0) / p.group.length
                  for (const item of p.group) {
                    const w = Math.max(20, item.w * ratio)
                    const h = Math.max(20, item.h * ratio)
                    const layer = layersRef.current.find((candidate) => candidate.id === item.id)
                    const next = {
                      x: cx + (item.x + item.w / 2 - cx) * ratio - w / 2,
                      y: cy + (item.y + item.h / 2 - cy) * ratio - h / 2,
                      w,
                      h,
                    }
                    if (layer?.type === 'text' && item.fontSize) {
                      updateLayer(item.id, { ...next, fontSize: Math.max(6, Math.round(item.fontSize * ratio)) })
                    } else {
                      updateLayer(item.id, next)
                    }
                  }
                } else {
                  const w = Math.max(20, p.w0 * ratio)
                  const h = Math.max(20, p.h0 * ratio)
                  const x = p.x0 + (p.w0 - w) / 2
                  const y = p.y0 + (p.h0 - h) / 2
                  if (selected.type === 'text') updateLayer(p.id, { x, y, w, fontSize: Math.max(6, Math.round(p.fontSize * ratio)) })
                  else updateLayer(p.id, { x, y, w, h })
                }
              }
            }
          }
        }
      }}
      onPointerUpCapture={(e) => {
        if (e.pointerType === 'touch') {
          activeTouches.current.delete(e.pointerId)
          if (activeTouches.current.size < 2 && (pinch.current || pinching.current)) {
            pinch.current = null
            pinching.current = false
            setPinchActive(false)
          }
          if (activeTouches.current.size === 0) pinchTouchSequence.current = false
        }
      }}
      onPointerCancelCapture={(e) => {
        if (e.pointerType === 'touch') {
          activeTouches.current.delete(e.pointerId)
          if (activeTouches.current.size < 2 && (pinch.current || pinching.current)) {
            pinch.current = null
            pinching.current = false
            setPinchActive(false)
          }
          if (activeTouches.current.size === 0) pinchTouchSequence.current = false
        }
      }}
      onPointerDown={(e) => {
        if (isSpacePressed.current || (e.pointerType === 'mouse' && e.button === 1)) {
          e.preventDefault()
          e.currentTarget.setPointerCapture?.(e.pointerId)
          const v = viewRef.current
          panGesture.current = { sx: e.clientX, sy: e.clientY, ox: v.x, oy: v.y, moved: false }
          return
        }
        if (e.pointerType === 'mouse' && e.button !== 0) return
        const target = e.target as HTMLElement
        const hitLayer = target.closest('[data-testid^="layer-"]')
        const hitHandle = target.closest('[data-testid^="resize-"]')
        if (hitHandle || hitLayer) return
        if (pinching.current || (e.pointerType === 'touch' && (touchCount.current >= 2 || activeTouches.current.size > 1))) return

        const artboard = e.currentTarget.querySelector('[data-testid="artboard"]')?.getBoundingClientRect()
        const v = viewRef.current
        const toArtboard = (clientX: number, clientY: number) => {
          if (!artboard) return { x: 0, y: 0 }
          const rawX = (clientX - artboard.left) / (scale * v.scale)
          const rawY = (clientY - artboard.top) / (scale * v.scale)
          return {
            x: rawX,
            y: rawY,
          }
        }

        // Check if there are selected layers to move
        const selectedLayers = project.layers.filter((item) => selectedIds.includes(item.id) && item.visible && !item.locked)
        const marqueeStart = toArtboard(e.clientX, e.clientY)
        const startClient = { x: e.clientX, y: e.clientY }
        const pointerId = e.pointerId
        const currentTarget = e.currentTarget

        if (marqueeLongPress.current) {
          window.clearTimeout(marqueeLongPress.current)
          marqueeLongPress.current = null
        }

        if (selectedLayers.length > 0) {
          const primary = selectedLayers[0]
          const pNode = layerRefs.current.get(primary.id)
          const pW = (primary.type === 'text' && pNode ? pNode.offsetWidth : pNode?.offsetWidth) || primary.w
          const pH = (primary.type === 'text' && pNode ? pNode.offsetHeight : pNode?.offsetHeight) || primary.h
          const pX = (primary.type === 'text' && primary.align === 'center' && primary.x === 0 && primary.w === preset.w && pNode)
            ? (preset.w - pW) / 2
            : (pNode?.offsetLeft ?? primary.x)
          const group = selectedLayers.length > 1
            ? selectedLayers.map((item) => {
                const itemNode = layerRefs.current.get(item.id)
                const itemW = (item.type === 'text' && itemNode ? itemNode.offsetWidth : itemNode?.offsetWidth) || item.w
                const itemH = (item.type === 'text' && itemNode ? itemNode.offsetHeight : itemNode?.offsetHeight) || item.h
                const itemX = (item.type === 'text' && item.align === 'center' && item.x === 0 && item.w === preset.w && itemNode)
                  ? (preset.w - itemW) / 2
                  : (itemNode?.offsetLeft ?? item.x)
                return { id: item.id, x: itemX, y: item.y, w: itemW, h: itemH }
              })
            : undefined
          gesture.current = {
            id: primary.id,
            mode: 'move',
            sx: e.clientX,
            sy: e.clientY,
            ox: pX,
            oy: primary.y,
            ow: pW,
            oh: pH,
            fromCanvas: true,
            moved: false,
            deselectOnTap: true,
            group,
          }
          if (e.pointerType === 'touch') {
            e.currentTarget.setPointerCapture?.(e.pointerId)
          }
        } else if (e.pointerType === 'touch') {
          // On touch, allow panning if no element is selected
          panGesture.current = { sx: e.clientX, sy: e.clientY, ox: v.x, oy: v.y, moved: false }
        }

        const updateMarquee = (event: PointerEvent) => {
          if (!marqueeSession.current.active) {
            const dist = Math.hypot(event.clientX - startClient.x, event.clientY - startClient.y)
            if (event.pointerType === 'mouse' && dist > 4 && selectedLayers.length === 0) {
              marqueeSession.current.active = true
              panGesture.current = null
              gesture.current = null
              setMarquee({ x: marqueeStart.x, y: marqueeStart.y, w: 0, h: 0 })
            } else if (dist > 8) {
              if (marqueeLongPress.current) {
                window.clearTimeout(marqueeLongPress.current)
                marqueeLongPress.current = null
              }
            }
            return
          }
          const end = toArtboard(event.clientX, event.clientY)
          const box = {
            left: Math.min(marqueeStart.x, end.x),
            top: Math.min(marqueeStart.y, end.y),
            right: Math.max(marqueeStart.x, end.x),
            bottom: Math.max(marqueeStart.y, end.y),
          }
          const ids = project.layers
            .filter((layer) => layer.visible && !layer.locked && layer.x < box.right && layer.x + layer.w > box.left && layer.y < box.bottom && layer.y + layer.h > box.top)
            .map((layer) => layer.id)
          setMarquee({ x: box.left, y: box.top, w: box.right - box.left, h: box.bottom - box.top })
          if (ids.length > 1) {
            setMultiSelectMode(true)
            multiSelectModeRef.current = true
            select(ids[0], false, ids)
          } else if (ids.length === 1) {
            setMultiSelectMode(false)
            multiSelectModeRef.current = false
            select(ids[0])
          } else {
            setMultiSelectMode(false)
            multiSelectModeRef.current = false
            select(null)
          }
        }

        const finishMarquee = (event: PointerEvent) => {
          if (marqueeLongPress.current) {
            window.clearTimeout(marqueeLongPress.current)
            marqueeLongPress.current = null
          }
          window.removeEventListener('pointermove', updateMarquee)
          window.removeEventListener('pointerup', finishMarquee)
          window.removeEventListener('pointercancel', finishMarquee)

          if (!marqueeSession.current.active) {
            panGesture.current = null
            return
          }

          const end = toArtboard(event.clientX, event.clientY)
          const box = {
            left: Math.min(marqueeStart.x, end.x),
            top: Math.min(marqueeStart.y, end.y),
            right: Math.max(marqueeStart.x, end.x),
            bottom: Math.max(marqueeStart.y, end.y),
          }
          const ids = project.layers
            .filter((layer) => layer.visible && !layer.locked && layer.x < box.right && layer.x + layer.w > box.left && layer.y < box.bottom && layer.y + layer.h > box.top)
            .map((layer) => layer.id)
          setMarquee(null)
          marqueeSession.current.active = false
          panGesture.current = null
          if (ids.length > 1) {
            setMultiSelectMode(true)
            multiSelectModeRef.current = true
            select(ids[0], false, ids)
          } else if (ids.length === 1) {
            setMultiSelectMode(false)
            multiSelectModeRef.current = false
            select(ids[0])
          } else {
            setMultiSelectMode(false)
            multiSelectModeRef.current = false
            select(null)
          }
        }

        marqueeSession.current = { active: false, start: marqueeStart, update: updateMarquee, finish: finishMarquee }
        if (e.pointerType === 'touch') {
          marqueeLongPress.current = window.setTimeout(() => {
            gesture.current = null
            panGesture.current = null
            marqueeSession.current.active = true
            try {
              navigator.vibrate?.(40)
            } catch {}
            setMarquee({ x: marqueeStart.x, y: marqueeStart.y, w: 0, h: 0 })
            try {
              currentTarget.setPointerCapture?.(pointerId)
            } catch {}
          }, 350)
        }

        window.addEventListener('pointermove', updateMarquee)
        window.addEventListener('pointerup', finishMarquee)
        window.addEventListener('pointercancel', finishMarquee)
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
                ref={(node) => {
                  if (node) layerRefs.current.set(l.id, node)
                  else layerRefs.current.delete(l.id)
                  if (isSel) selRef.current = node
                }}
          onTouchStart={(e) => {
            e.stopPropagation()
            if (l.locked || editingId === l.id) return
            if (e.touches.length > 1 || pinchTouchSequence.current || touchCount.current >= 2 || activeTouches.current.size > 1) {
              if (longPress.current) {
                window.clearTimeout(longPress.current)
                longPress.current = null
              }
              return
            }
            if (multiSelectModeRef.current) return
            if (selectedIdsRef.current.length === 1 && !selectedIdsRef.current.includes(l.id)) return
            if (longPress.current) window.clearTimeout(longPress.current)
            longPress.current = window.setTimeout(() => {
              setMultiSelectMode(true)
              multiSelectModeRef.current = true
              select(l.id, true)
              gesture.current = null
              longPress.current = null
              try {
                navigator.vibrate?.(40)
              } catch {}
            }, 450)
          }}
                  onPointerDownCapture={(e) => {
                    if (e.pointerType !== 'touch') return
                    if (activeTouches.current.size === 0 && !multiSelectModeRef.current) {
                      touchSelectionLock.current = selectedRef.current
                    }
                    activeTouches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
                    touchCount.current = activeTouches.current.size
                    if (activeTouches.current.size >= 2) {
                      pinchTouchSequence.current = true
                      e.preventDefault()
                      e.stopPropagation()
                    }
                  }}
                onPointerDown={(e) => startMove(e, l)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (longPress.current) {
                    window.clearTimeout(longPress.current)
                    longPress.current = null
                  }
                  if (selectedIdsRef.current.length === 1 && !selectedIdsRef.current.includes(l.id)) {
                    setMultiSelectMode(false)
                    multiSelectModeRef.current = false
                    select(null)
                    return
                  }
                  if (!multiSelectModeRef.current) {
                    setMultiSelectMode(true)
                    multiSelectModeRef.current = true
                    select(l.id, true)
                    gesture.current = null
                  }
                }}
          onDoubleClick={(e) => { e.stopPropagation(); if (l.type === 'text') setEditingId(l.id) }}
                data-testid={`layer-${l.id}`}
                style={{
                  position: 'absolute',
                  left: l.type === 'text' && l.align === 'center' && l.x === 0 && l.w === preset.w && layerRefs.current.get(l.id)
                    ? (preset.w - layerRefs.current.get(l.id)!.offsetWidth) / 2
                    : l.x,
                  top: l.y,
                  width: l.type === 'text' ? 'max-content' : l.w,
                  height: l.type === 'text' ? 'auto' : l.h,
                  fontSize: l.type === 'text' ? l.fontSize : undefined,
                  lineHeight: l.type === 'text' ? 0.8 : undefined,
                  margin: 0,
                  padding: 0,
                  boxSizing: 'border-box',
                  opacity: a.opacity,
                  transform: a.transform,
                  outline: isSel ? `${2 / eff}px solid ${(multiSelectMode || selectedIds.length > 1) && !pinchActive ? '#4B1D6B' : '#007AFF'}` : 'none',
                  outlineOffset: 0,
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
            const selected = project.layers.filter((layer) => selectedIds.includes(layer.id) && layer.visible && !layer.locked)
            const sel = project.layers.find((l) => l.id === selectedId)
            if (!sel || editingId || sel.locked || !sel.visible) return null
            const isGroup = selected.length > 1 || multiSelectMode
            const measured = (layer: Layer) => {
              const node = layerRefs.current.get(layer.id)
              const posX = layer.type === 'text' && layer.align === 'center' && layer.x === 0 && layer.w === preset.w && node
                ? (preset.w - node.offsetWidth) / 2
                : (node?.offsetLeft ?? layer.x)
              return {
                x: posX,
                y: node?.offsetTop ?? layer.y,
                w: (layer.type === 'text' && node ? node.offsetWidth : node?.offsetWidth) || layer.w,
                h: (layer.type === 'text' && node ? node.offsetHeight : node?.offsetHeight) || (layer.type === 'text' ? (layer.id === selectedId ? selH : 0) || layer.h : layer.h),
              }
            }
            const bounds = selected.reduce(
              (box, layer) => {
                const rect = measured(layer)
                return {
                  left: Math.min(box.left, rect.x),
                  top: Math.min(box.top, rect.y),
                  right: Math.max(box.right, rect.x + rect.w),
                  bottom: Math.max(box.bottom, rect.y + rect.h),
                }
              },
              { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
            )
            const boxW = bounds.right - bounds.left
            const boxH = bounds.bottom - bounds.top
            const size = hs * 3.8
            const dot = hs * 1.5
            const corners: { c: Corner; cx: number; cy: number }[] = [
              { c: 'tl', cx: 0, cy: 0 },
              { c: 'tr', cx: boxW, cy: 0 },
              { c: 'bl', cx: 0, cy: boxH },
              { c: 'br', cx: boxW, cy: boxH },
            ]
            const group = isGroup ? selected.map((layer) => {
              const rect = measured(layer)
              return { id: layer.id, x: rect.x, y: rect.y, w: rect.w, h: rect.h, fontSize: layer.type === 'text' ? layer.fontSize : undefined }
            }) : undefined
            return (
              <div
                style={{ position: 'absolute', left: bounds.left, top: bounds.top, width: boxW, height: boxH, border: (isGroup || multiSelectMode) ? `${2 / eff}px solid #4B1D6B` : 'none', pointerEvents: 'none', zIndex: 60, boxSizing: 'border-box' }}
              >
                {corners.map(({ c, cx, cy }) => (
                  <div
                    key={c}
                    data-testid={`resize-${c}-${isGroup ? 'group' : sel.id}`}
                    onPointerDown={(e) => startResize(e, sel, c, boxW, boxH, bounds.left, bounds.top, group)}
                    style={{
                      position: 'absolute',
                      left: cx - size / 2,
                      top: cy - size / 2,
                      width: size,
                      height: size,
                      display: 'grid',
                      placeItems: 'center',
                      pointerEvents: 'auto',
                      cursor: c === 'tl' || c === 'br' ? 'nwse-resize' : 'nesw-resize',
                      touchAction: 'none',
                    }}
                  >
                    <div style={{ width: dot, height: dot, borderRadius: '9999px', background: '#fff', border: `${Math.max(1.5, dot * 0.18)}px solid ${multiSelectMode || isGroup ? '#4B1D6B' : '#007AFF'}` }} />
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
        </div>
      )}

      {marquee && (
        <div
          aria-hidden="true"
          data-testid="marquee-selection"
          style={{ position: 'absolute', left: marquee.x * scale * view.scale + view.x + (size.w - preset.w * scale * view.scale) / 2, top: marquee.y * scale * view.scale + view.y + (size.h - preset.h * scale * view.scale) / 2, width: marquee.w * scale * view.scale, height: marquee.h * scale * view.scale, border: '1.5px solid #4B1D6B', background: 'rgba(75, 29, 107, 0.12)', pointerEvents: 'none', zIndex: 80 }}
        />
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
      style={{ ...style, minWidth: '1ch', minHeight: '0.8em' }}
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
      lineHeight: 0.8,
      width: 'max-content',
      margin: 0,
      padding: 0,
      boxSizing: 'border-box',
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
