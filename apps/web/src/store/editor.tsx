import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react'
import type { Project, Layer, LayerType, Background } from '#/types'
import { createLayer, uid } from '#/lib/data'

interface State {
  project: Project
  selectedId: string | null
  selectedIds: string[]
  tool: string | null
  time: number
  playing: boolean
}

type Action =
  | { t: 'select'; id: string | null; additive?: boolean; ids?: string[] }
  | { t: 'toggleSelect'; id: string }
  | { t: 'alignSelected'; mode: 'left' | 'center' | 'right' | 'middle'; measured?: Record<string, { x: number; y: number; w: number; h: number }> }
  | { t: 'tool'; tool: string | null }
  | { t: 'addLayer'; layer: Layer }
  | { t: 'updateLayer'; id: string; patch: Partial<Layer> }
  | { t: 'deleteLayer'; id: string }
  | { t: 'reorder'; id: string; dir: number }
  | { t: 'duplicate'; id: string }
  | { t: 'setBackground'; bg: Background }
  | { t: 'setTime'; time: number }
  | { t: 'setPlaying'; playing: boolean }
  | { t: 'setMode'; mode: 'static' | 'animated' }
  | { t: 'rename'; name: string }
  | { t: 'setDuration'; duration: number }

function touch(p: Project): Project {
  return { ...p, updatedAt: Date.now() }
}

function reducer(state: State, a: Action): State {
  const p = state.project
  switch (a.t) {
    case 'select':
      return {
        ...state,
        selectedId: a.id,
        selectedIds: a.id ? (a.ids ?? (a.additive ? Array.from(new Set([...state.selectedIds, a.id])) : [a.id])) : [],
      }
    case 'toggleSelect': {
      const selectedIds = state.selectedIds.includes(a.id)
        ? state.selectedIds.filter((id) => id !== a.id)
        : [...state.selectedIds, a.id]
      return { ...state, selectedIds, selectedId: selectedIds.at(-1) ?? null }
    }
    case 'alignSelected': {
      const selected = p.layers.filter((layer) => state.selectedIds.includes(layer.id))
      if (selected.length < 2) return state

      const getBox = (layer: Layer) => {
        if (a.measured && a.measured[layer.id]) {
          return a.measured[layer.id]
        }
        const isCenteredTemplateText =
          layer.type === 'text' && layer.align === 'center' && layer.x === 0 && layer.w === p.preset.w
        const x = isCenteredTemplateText ? (p.preset.w - layer.w) / 2 : layer.x
        return { x, y: layer.y, w: layer.w, h: layer.h }
      }

      const boxes = new Map(selected.map((layer) => [layer.id, getBox(layer)]))
      const left = Math.min(...selected.map((l) => boxes.get(l.id)!.x))
      const right = Math.max(...selected.map((l) => boxes.get(l.id)!.x + boxes.get(l.id)!.w))
      const top = Math.min(...selected.map((l) => boxes.get(l.id)!.y))
      const bottom = Math.max(...selected.map((l) => boxes.get(l.id)!.y + boxes.get(l.id)!.h))

      const layers = p.layers.map((layer) => {
        if (!state.selectedIds.includes(layer.id)) return layer
        const b = boxes.get(layer.id)!
        const x =
          a.mode === 'left'
            ? left
            : a.mode === 'right'
              ? right - b.w
              : a.mode === 'center'
                ? (left + right - b.w) / 2
                : b.x
        const y = a.mode === 'middle' ? (top + bottom - b.h) / 2 : b.y
        return {
          ...layer,
          x: Math.round(x),
          y: Math.round(y),
          w: Math.round(b.w),
          h: Math.round(b.h),
        }
      })
      return { ...state, project: touch({ ...p, layers }) }
    }
    case 'tool':
      return { ...state, tool: a.tool }
    case 'addLayer':
      return { ...state, project: touch({ ...p, layers: [...p.layers, a.layer] }), selectedId: a.layer.id, selectedIds: [a.layer.id], tool: null }
    case 'updateLayer':
      return { ...state, project: touch({ ...p, layers: p.layers.map((l) => (l.id === a.id ? { ...l, ...a.patch } : l)) }) }
    case 'deleteLayer':
      return {
        ...state,
        project: touch({ ...p, layers: p.layers.filter((l) => l.id !== a.id) }),
        selectedId: state.selectedId === a.id ? null : state.selectedId,
        selectedIds: state.selectedIds.filter((id) => id !== a.id),
      }
    case 'duplicate': {
      const src = p.layers.find((l) => l.id === a.id)
      if (!src) return state
      const copy: Layer = { ...src, id: uid(), x: src.x + 24, y: src.y + 24, name: src.name + ' copy' }
      return { ...state, project: touch({ ...p, layers: [...p.layers, copy] }), selectedId: copy.id }
    }
    case 'reorder': {
      const idx = p.layers.findIndex((l) => l.id === a.id)
      if (idx < 0) return state
      const ni = idx + a.dir
      if (ni < 0 || ni >= p.layers.length) return state
      const layers = [...p.layers]
      const [moved] = layers.splice(idx, 1)
      layers.splice(ni, 0, moved)
      return { ...state, project: touch({ ...p, layers }) }
    }
    case 'setBackground':
      return { ...state, project: touch({ ...p, background: a.bg }) }
    case 'setTime':
      return { ...state, time: a.time }
    case 'setPlaying':
      return { ...state, playing: a.playing }
    case 'setMode':
      return { ...state, project: touch({ ...p, mode: a.mode }) }
    case 'rename':
      return { ...state, project: touch({ ...p, name: a.name }) }
    case 'setDuration':
      return { ...state, project: touch({ ...p, duration: a.duration }) }
    default:
      return state
  }
}

interface Ctx extends State {
  mode: 'static' | 'animated'
  selected: Layer | null
  selectedIds: string[]
  select: (id: string | null, additive?: boolean, ids?: string[]) => void
  toggleSelect: (id: string) => void
  alignSelected: (mode: 'left' | 'center' | 'right' | 'middle', measured?: Record<string, { x: number; y: number; w: number; h: number }>) => void
  openTool: (tool: string | null) => void
  addLayer: (type: LayerType, extra?: Partial<Layer>) => void
  updateLayer: (id: string, patch: Partial<Layer>) => void
  deleteLayer: (id: string) => void
  duplicate: (id: string) => void
  reorder: (id: string, dir: number) => void
  setBackground: (bg: Background) => void
  setTime: (t: number) => void
  setPlaying: (v: boolean) => void
  setMode: (m: 'static' | 'animated') => void
  rename: (n: string) => void
  setDuration: (d: number) => void
}

const EditorCtx = createContext<Ctx | null>(null)

export function EditorProvider({ project, children }: { project: Project; children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { project, selectedId: null, selectedIds: [], tool: null, time: 0, playing: false })

  const select = useCallback((id: string | null, additive = false, ids?: string[]) => dispatch({ t: 'select', id, additive, ids }), [])
  const toggleSelect = useCallback((id: string) => dispatch({ t: 'toggleSelect', id }), [])
  const alignSelected = useCallback((mode: 'left' | 'center' | 'right' | 'middle', measured?: Record<string, { x: number; y: number; w: number; h: number }>) => dispatch({ t: 'alignSelected', mode, measured }), [])
  const openTool = useCallback((tool: string | null) => dispatch({ t: 'tool', tool }), [])
  const updateLayer = useCallback((id: string, patch: Partial<Layer>) => dispatch({ t: 'updateLayer', id, patch }), [])
  const deleteLayer = useCallback((id: string) => dispatch({ t: 'deleteLayer', id }), [])
  const duplicate = useCallback((id: string) => dispatch({ t: 'duplicate', id }), [])
  const reorder = useCallback((id: string, dir: number) => dispatch({ t: 'reorder', id, dir }), [])
  const setBackground = useCallback((bg: Background) => dispatch({ t: 'setBackground', bg }), [])
  const setTime = useCallback((t: number) => dispatch({ t: 'setTime', time: t }), [])
  const setPlaying = useCallback((v: boolean) => dispatch({ t: 'setPlaying', playing: v }), [])
  const setMode = useCallback((m: 'static' | 'animated') => dispatch({ t: 'setMode', mode: m }), [])
  const rename = useCallback((n: string) => dispatch({ t: 'rename', name: n }), [])
  const setDuration = useCallback((d: number) => dispatch({ t: 'setDuration', duration: d }), [])

  const addLayer = useCallback(
    (type: LayerType, extra?: Partial<Layer>) => {
      const layer = createLayer(type, state.project.preset, extra)
      layer.end = state.project.duration
      dispatch({ t: 'addLayer', layer })
    },
    [state.project.preset, state.project.duration],
  )

  const value = useMemo<Ctx>(
    () => ({
      ...state,
      mode: state.project.mode,
      selected: state.project.layers.find((l) => l.id === state.selectedId) || null,
      selectedIds: state.selectedIds,
      select, toggleSelect, alignSelected, openTool, addLayer, updateLayer, deleteLayer, duplicate, reorder,
      setBackground, setTime, setPlaying, setMode, rename, setDuration,
    }),
    [state, select, alignSelected, openTool, addLayer, updateLayer, deleteLayer, duplicate, reorder, setBackground, setTime, setPlaying, setMode, rename, setDuration],
  )

  return <EditorCtx.Provider value={value}>{children}</EditorCtx.Provider>
}

export function useEditor() {
  const ctx = useContext(EditorCtx)
  if (!ctx) throw new Error('useEditor must be used within EditorProvider')
  return ctx
}
