import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react'
import type { Project, Layer, LayerType, Background } from '#/types'
import { createLayer, uid } from '#/lib/data'

interface State {
  project: Project
  selectedId: string | null
  tool: string | null
  time: number
  playing: boolean
}

type Action =
  | { t: 'select'; id: string | null }
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
      return { ...state, selectedId: a.id }
    case 'tool':
      return { ...state, tool: a.tool }
    case 'addLayer':
      return { ...state, project: touch({ ...p, layers: [...p.layers, a.layer] }), selectedId: a.layer.id, tool: null }
    case 'updateLayer':
      return { ...state, project: touch({ ...p, layers: p.layers.map((l) => (l.id === a.id ? { ...l, ...a.patch } : l)) }) }
    case 'deleteLayer':
      return { ...state, project: touch({ ...p, layers: p.layers.filter((l) => l.id !== a.id) }), selectedId: state.selectedId === a.id ? null : state.selectedId }
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
  select: (id: string | null) => void
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
  const [state, dispatch] = useReducer(reducer, { project, selectedId: null, tool: null, time: 0, playing: false })

  const select = useCallback((id: string | null) => dispatch({ t: 'select', id }), [])
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
      select, openTool, addLayer, updateLayer, deleteLayer, duplicate, reorder,
      setBackground, setTime, setPlaying, setMode, rename, setDuration,
    }),
    [state, select, openTool, addLayer, updateLayer, deleteLayer, duplicate, reorder, setBackground, setTime, setPlaying, setMode, rename, setDuration],
  )

  return <EditorCtx.Provider value={value}>{children}</EditorCtx.Provider>
}

export function useEditor() {
  const ctx = useContext(EditorCtx)
  if (!ctx) throw new Error('useEditor must be used within EditorProvider')
  return ctx
}
