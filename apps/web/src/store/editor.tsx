import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react'
import type { Project, Layer, LayerType, Background } from '#/types'
import { createLayer } from '#/lib/data'
import {
  createGroupFromSelection,
  ungroupLayer,
  duplicateLayerOrGroup,
  deleteLayerOrGroup,
  reorderSibling,
  instantiateComponent,
  saveComponentToLibrary,
  getDescendantLayers,
  computeGroupBounds,
  type ComponentItem,
} from '#/lib/groups'

interface State {
  project: Project
  selectedId: string | null
  selectedIds: string[]
  tool: string | null
  time: number
  playing: boolean
  artboardSnap: boolean
  timelineOpen: boolean
}

export type AlignMode =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom'
  | 'distribute-h'
  | 'distribute-v'

type Action =
  | { t: 'select'; id: string | null; additive?: boolean; ids?: string[] }
  | { t: 'toggleSelect'; id: string }
  | { t: 'alignSelected'; mode: AlignMode; measured?: Record<string, { x: number; y: number; w: number; h: number }>; targetGroupId?: string }
  | { t: 'tool'; tool: string | null }
  | { t: 'addLayer'; layer: Layer }
  | { t: 'updateLayer'; id: string; patch: Partial<Layer> }
  | { t: 'updateLayers'; ids: string[]; patch: Partial<Layer> }
  | { t: 'deleteLayer'; id: string }
  | { t: 'deleteLayers'; ids: string[] }
  | { t: 'reorder'; id: string; dir: number }
  | { t: 'duplicate'; id: string }
  | { t: 'createGroup'; ids?: string[]; name?: string; isComponent?: boolean }
  | { t: 'ungroup'; groupId: string }
  | { t: 'toggleGroupCollapse'; groupId: string }
  | { t: 'insertComponent'; component: ComponentItem }
  | { t: 'convertToComponent'; groupId: string; name?: string }
  | { t: 'setBackground'; bg: Background }
  | { t: 'setTime'; time: number }
  | { t: 'setPlaying'; playing: boolean }
  | { t: 'setArtboardSnap'; enabled: boolean }
  | { t: 'setMode'; mode: 'static' | 'animated' }
  | { t: 'rename'; name: string }
  | { t: 'setDuration'; duration: number }
  | { t: 'toggleTimeline'; open?: boolean }
  | { t: 'setTimelineOpen'; open: boolean }
  | { t: 'nudge'; dx: number; dy: number; measured?: Record<string, { x: number; y: number; w: number; h: number }> }

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
      // Check if we are aligning the children of a single group
      const targetGroupId =
        a.targetGroupId ||
        (state.selectedIds.length === 1 && p.layers.find((l) => l.id === state.selectedIds[0])?.type === 'group'
          ? state.selectedIds[0]
          : undefined)

      if (targetGroupId) {
        const groupLayer = p.layers.find((l) => l.id === targetGroupId)
        if (!groupLayer) return state

        // Direct children of this group (non-locked, visible)
        const children = p.layers.filter((l) => l.groupId === targetGroupId && l.visible && !l.locked)
        if (children.length === 0) return state

        const getBox = (layer: Layer) => {
          if (a.measured && a.measured[layer.id]) {
            return a.measured[layer.id]
          }
          if (layer.type === 'group') {
            return computeGroupBounds(layer.id, p.layers)
          }
          const isCenteredTemplateText =
            layer.type === 'text' && layer.align === 'center' && layer.x === 0 && layer.w === p.preset.w
          const x = isCenteredTemplateText ? (p.preset.w - layer.w) / 2 : layer.x
          return { x, y: layer.y, w: layer.w, h: layer.h }
        }

        const boxes = new Map(children.map((layer) => [layer.id, getBox(layer)]))
        const left = Math.min(...children.map((l) => boxes.get(l.id)!.x))
        const right = Math.max(...children.map((l) => boxes.get(l.id)!.x + boxes.get(l.id)!.w))
        const top = Math.min(...children.map((l) => boxes.get(l.id)!.y))
        const bottom = Math.max(...children.map((l) => boxes.get(l.id)!.y + boxes.get(l.id)!.h))

        // Compute distribution maps if needed
        const isDistributeH = a.mode === 'distribute-h'
        const isDistributeV = a.mode === 'distribute-v'

        const sortedX = isDistributeH
          ? [...children].sort((c1, c2) => boxes.get(c1.id)!.x - boxes.get(c2.id)!.x)
          : []
        const sortedY = isDistributeV
          ? [...children].sort((c1, c2) => boxes.get(c1.id)!.y - boxes.get(c2.id)!.y)
          : []

        let distHGap = 0
        if (isDistributeH && children.length > 2) {
          const totalW = children.reduce((sum, c) => sum + boxes.get(c.id)!.w, 0)
          const span = right - left
          distHGap = (span - totalW) / (children.length - 1)
        }
        let distVGap = 0
        if (isDistributeV && children.length > 2) {
          const totalH = children.reduce((sum, c) => sum + boxes.get(c.id)!.h, 0)
          const span = bottom - top
          distVGap = (span - totalH) / (children.length - 1)
        }

        const distPositionsX = new Map<string, number>()
        if (isDistributeH) {
          let currX = left
          for (const c of sortedX) {
            distPositionsX.set(c.id, currX)
            currX += boxes.get(c.id)!.w + distHGap
          }
        }

        const distPositionsY = new Map<string, number>()
        if (isDistributeV) {
          let currY = top
          for (const c of sortedY) {
            distPositionsY.set(c.id, currY)
            currY += boxes.get(c.id)!.h + distVGap
          }
        }

        // Compute new positions and displacement deltas for each child
        const childDeltas = new Map<string, { dx: number; dy: number; newX: number; newY: number; w: number; h: number }>()
        for (const child of children) {
          const b = boxes.get(child.id)!
          let nx = b.x
          let ny = b.y

          if (a.mode === 'left') nx = left
          else if (a.mode === 'right') nx = right - b.w
          else if (a.mode === 'center') nx = (left + right - b.w) / 2
          else if (a.mode === 'distribute-h') nx = distPositionsX.get(child.id) ?? b.x

          if (a.mode === 'top') ny = top
          else if (a.mode === 'bottom') ny = bottom - b.h
          else if (a.mode === 'middle') ny = (top + bottom - b.h) / 2
          else if (a.mode === 'distribute-v') ny = distPositionsY.get(child.id) ?? b.y

          childDeltas.set(child.id, {
            dx: Math.round(nx) - b.x,
            dy: Math.round(ny) - b.y,
            newX: Math.round(nx),
            newY: Math.round(ny),
            w: Math.round(b.w),
            h: Math.round(b.h),
          })
        }

        // Sub-group descendants delta mapping
        const descendantDeltas = new Map<string, { dx: number; dy: number }>()
        for (const child of children) {
          if (child.type === 'group') {
            const desc = getDescendantLayers(child.id, p.layers)
            const delta = childDeltas.get(child.id)!
            for (const d of desc) {
              descendantDeltas.set(d.id, { dx: delta.dx, dy: delta.dy })
            }
          }
        }

        let updatedLayers = p.layers.map((layer) => {
          if (childDeltas.has(layer.id)) {
            const d = childDeltas.get(layer.id)!
            return {
              ...layer,
              x: d.newX,
              y: d.newY,
              w: layer.type === 'group' ? layer.w : d.w,
              h: layer.type === 'group' ? layer.h : d.h,
            }
          }
          if (descendantDeltas.has(layer.id)) {
            const d = descendantDeltas.get(layer.id)!
            return {
              ...layer,
              x: Math.round(layer.x + d.dx),
              y: Math.round(layer.y + d.dy),
            }
          }
          return layer
        })

        // Recompute the parent group bounds to fit the newly aligned children
        const newGroupBounds = computeGroupBounds(targetGroupId, updatedLayers)
        updatedLayers = updatedLayers.map((l) =>
          l.id === targetGroupId
            ? {
                ...l,
                x: newGroupBounds.x,
                y: newGroupBounds.y,
                w: newGroupBounds.w,
                h: newGroupBounds.h,
              }
            : l
        )

        return { ...state, project: touch({ ...p, layers: updatedLayers }) }
      }

      // Multi-selection alignment (or single element alignment to canvas)
      const selected = p.layers.filter((layer) => state.selectedIds.includes(layer.id))
      if (selected.length < 1) return state

      const getBox = (layer: Layer) => {
        if (a.measured && a.measured[layer.id]) {
          return a.measured[layer.id]
        }
        if (layer.type === 'group') {
          return computeGroupBounds(layer.id, p.layers)
        }
        const isCenteredTemplateText =
          layer.type === 'text' && layer.align === 'center' && layer.x === 0 && layer.w === p.preset.w
        const x = isCenteredTemplateText ? (p.preset.w - layer.w) / 2 : layer.x
        return { x, y: layer.y, w: layer.w, h: layer.h }
      }

      const boxes = new Map(selected.map((layer) => [layer.id, getBox(layer)]))
      const isSingle = selected.length === 1
      const left = isSingle ? 0 : Math.min(...selected.map((l) => boxes.get(l.id)!.x))
      const right = isSingle ? p.preset.w : Math.max(...selected.map((l) => boxes.get(l.id)!.x + boxes.get(l.id)!.w))
      const top = isSingle ? 0 : Math.min(...selected.map((l) => boxes.get(l.id)!.y))
      const bottom = isSingle ? p.preset.h : Math.max(...selected.map((l) => boxes.get(l.id)!.y + boxes.get(l.id)!.h))

      const isDistributeH = a.mode === 'distribute-h'
      const isDistributeV = a.mode === 'distribute-v'

      const sortedX = isDistributeH
        ? [...selected].sort((c1, c2) => boxes.get(c1.id)!.x - boxes.get(c2.id)!.x)
        : []
      const sortedY = isDistributeV
        ? [...selected].sort((c1, c2) => boxes.get(c1.id)!.y - boxes.get(c2.id)!.y)
        : []

      let distHGap = 0
      if (isDistributeH && selected.length > 2) {
        const totalW = selected.reduce((sum, c) => sum + boxes.get(c.id)!.w, 0)
        const span = right - left
        distHGap = (span - totalW) / (selected.length - 1)
      }
      let distVGap = 0
      if (isDistributeV && selected.length > 2) {
        const totalH = selected.reduce((sum, c) => sum + boxes.get(c.id)!.h, 0)
        const span = bottom - top
        distVGap = (span - totalH) / (selected.length - 1)
      }

      const distPositionsX = new Map<string, number>()
      if (isDistributeH) {
        let currX = left
        for (const c of sortedX) {
          distPositionsX.set(c.id, currX)
          currX += boxes.get(c.id)!.w + distHGap
        }
      }

      const distPositionsY = new Map<string, number>()
      if (isDistributeV) {
        let currY = top
        for (const c of sortedY) {
          distPositionsY.set(c.id, currY)
          currY += boxes.get(c.id)!.h + distVGap
        }
      }

      const groupDeltas = new Map<string, { dx: number; dy: number }>()

      let layers = p.layers.map((layer) => {
        if (!state.selectedIds.includes(layer.id)) return layer
        const b = boxes.get(layer.id)!
        let x = b.x
        let y = b.y

        if (a.mode === 'left') x = left
        else if (a.mode === 'right') x = right - b.w
        else if (a.mode === 'center') x = (left + right - b.w) / 2
        else if (a.mode === 'distribute-h') x = distPositionsX.get(layer.id) ?? b.x

        if (a.mode === 'top') y = top
        else if (a.mode === 'bottom') y = bottom - b.h
        else if (a.mode === 'middle') y = (top + bottom - b.h) / 2
        else if (a.mode === 'distribute-v') y = distPositionsY.get(layer.id) ?? b.y

        const newX = Math.round(x)
        const newY = Math.round(y)

        if (layer.type === 'group') {
          groupDeltas.set(layer.id, { dx: newX - b.x, dy: newY - b.y })
        }

        return {
          ...layer,
          x: newX,
          y: newY,
          w: layer.type === 'group' ? layer.w : Math.round(b.w),
          h: layer.type === 'group' ? layer.h : Math.round(b.h),
        }
      })

      // Shift descendants of any moved groups that were selected
      if (groupDeltas.size > 0) {
        layers = layers.map((layer) => {
          for (const [groupId, delta] of groupDeltas.entries()) {
            const desc = getDescendantLayers(groupId, p.layers)
            if (desc.some((d) => d.id === layer.id)) {
              return {
                ...layer,
                x: Math.round(layer.x + delta.dx),
                y: Math.round(layer.y + delta.dy),
              }
            }
          }
          return layer
        })
      }

      return { ...state, project: touch({ ...p, layers }) }
    }
    case 'nudge': {
      const targetId = state.selectedId || state.selectedIds[0] || null
      if (!targetId) return state

      // Determine all layers that should move together
      const allIds = new Set<string>()
      if (state.selectedIds.length > 1) {
        for (const id of state.selectedIds) {
          allIds.add(id)
          const desc = getDescendantLayers(id, p.layers)
          for (const d of desc) allIds.add(d.id)
        }
      } else {
        const target = p.layers.find((l) => l.id === targetId)
        if (!target || target.locked) return state
        allIds.add(target.id)
        if (target.type === 'group') {
          const desc = getDescendantLayers(target.id, p.layers)
          for (const d of desc) allIds.add(d.id)
        }
      }

      let layers = p.layers.map((l) => {
        if (!allIds.has(l.id) || l.locked) return l

        const isCenteredTemplateText =
          l.type === 'text' && l.align === 'center' && l.x === 0 && l.w === p.preset.w
        const measuredBox = a.measured?.[l.id]

        if (isCenteredTemplateText && measuredBox) {
          return {
            ...l,
            x: Math.round(measuredBox.x + a.dx),
            y: Math.round(measuredBox.y + a.dy),
            w: Math.round(measuredBox.w),
          }
        }

        return {
          ...l,
          x: Math.round(l.x + a.dx),
          y: Math.round(l.y + a.dy),
        }
      })

      // Recompute group bounds for any affected groups
      const affectedGroupIds = new Set<string>()
      for (const id of allIds) {
        const l = p.layers.find((layer) => layer.id === id)
        if (l?.type === 'group') affectedGroupIds.add(l.id)
        if (l?.groupId) affectedGroupIds.add(l.groupId)
      }

      if (affectedGroupIds.size > 0) {
        layers = layers.map((l) => {
          if (!affectedGroupIds.has(l.id) || l.type !== 'group') return l
          const bounds = computeGroupBounds(l.id, layers)
          return {
            ...l,
            x: bounds.x,
            y: bounds.y,
            w: bounds.w,
            h: bounds.h,
          }
        })
      }

      return {
        ...state,
        project: touch({ ...p, layers }),
      }
    }
    case 'tool':
      return { ...state, tool: a.tool }
    case 'addLayer':
      return { ...state, project: touch({ ...p, layers: [...p.layers, a.layer] }), selectedId: a.layer.id, selectedIds: [a.layer.id], tool: null }
    case 'updateLayer':
      return { ...state, project: touch({ ...p, layers: p.layers.map((l) => (l.id === a.id ? { ...l, ...a.patch } : l)) }) }
    case 'updateLayers':
      return { ...state, project: touch({ ...p, layers: p.layers.map((l) => (a.ids.includes(l.id) ? { ...l, ...a.patch } : l)) }) }
    case 'createGroup': {
      const targetIds = a.ids || state.selectedIds
      if (!targetIds || targetIds.length === 0) return state
      try {
        const { newLayers, groupLayer } = createGroupFromSelection(p.layers, targetIds, a.name, a.isComponent)
        return {
          ...state,
          project: touch({ ...p, layers: newLayers }),
          selectedId: groupLayer.id,
          selectedIds: [groupLayer.id],
        }
      } catch (err) {
        console.warn('Failed to create group:', err)
        return state
      }
    }
    case 'ungroup': {
      const { newLayers, unpackedIds } = ungroupLayer(p.layers, a.groupId)
      return {
        ...state,
        project: touch({ ...p, layers: newLayers }),
        selectedId: unpackedIds[0] || null,
        selectedIds: unpackedIds,
      }
    }
    case 'toggleGroupCollapse': {
      const layers = p.layers.map((l) => (l.id === a.groupId ? { ...l, collapsed: !l.collapsed } : l))
      return { ...state, project: touch({ ...p, layers }) }
    }
    case 'insertComponent': {
      const { rootLayer, childLayers } = instantiateComponent(a.component, p.preset)
      const layers = [...p.layers, ...childLayers, rootLayer]
      return {
        ...state,
        project: touch({ ...p, layers }),
        selectedId: rootLayer.id,
        selectedIds: [rootLayer.id],
        tool: null,
      }
    }
    case 'convertToComponent': {
      const layers = p.layers.map((l) => (l.id === a.groupId ? { ...l, isComponent: true, name: a.name || l.name } : l))
      return { ...state, project: touch({ ...p, layers }) }
    }
    case 'deleteLayer': {
      const layers = deleteLayerOrGroup(p.layers, a.id)
      const remainingIds = state.selectedIds.filter((id) => layers.some((l) => l.id === id))
      return {
        ...state,
        project: touch({ ...p, layers }),
        selectedId: layers.some((l) => l.id === state.selectedId) ? state.selectedId : remainingIds[0] || null,
        selectedIds: remainingIds,
      }
    }
    case 'deleteLayers': {
      const layers = a.ids.reduce((current, id) => deleteLayerOrGroup(current, id), p.layers)
      const remainingIds = state.selectedIds.filter((id) => layers.some((l) => l.id === id))
      return {
        ...state,
        project: touch({ ...p, layers }),
        selectedId: remainingIds.at(-1) ?? null,
        selectedIds: remainingIds,
        tool: null,
      }
    }
    case 'duplicate': {
      const { newLayers, newSelectedId } = duplicateLayerOrGroup(p.layers, a.id)
      return {
        ...state,
        project: touch({ ...p, layers: newLayers }),
        selectedId: newSelectedId,
        selectedIds: [newSelectedId],
      }
    }
    case 'reorder': {
      const layers = reorderSibling(p.layers, a.id, a.dir)
      return { ...state, project: touch({ ...p, layers }) }
    }
    case 'setBackground':
      return { ...state, project: touch({ ...p, background: a.bg }) }
    case 'setTime':
      return { ...state, time: a.time }
    case 'setPlaying':
      return { ...state, playing: a.playing }
    case 'setArtboardSnap':
      return { ...state, artboardSnap: a.enabled }
    case 'setMode':
      return { ...state, project: touch({ ...p, mode: a.mode }) }
    case 'rename':
      return { ...state, project: touch({ ...p, name: a.name }) }
    case 'setDuration':
      return { ...state, project: touch({ ...p, duration: a.duration }) }
    case 'toggleTimeline':
      return { ...state, timelineOpen: a.open !== undefined ? a.open : !state.timelineOpen }
    case 'setTimelineOpen':
      return { ...state, timelineOpen: a.open }
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
  alignSelected: (mode: AlignMode, measured?: Record<string, { x: number; y: number; w: number; h: number }>, targetGroupId?: string) => void
  openTool: (tool: string | null) => void
  addLayer: (type: LayerType, extra?: Partial<Layer>) => void
  updateLayer: (id: string, patch: Partial<Layer>) => void
  updateLayers: (ids: string[], patch: Partial<Layer>) => void
  deleteLayer: (id: string) => void
  deleteLayers: (ids: string[]) => void
  duplicate: (id: string) => void
  reorder: (id: string, dir: number) => void
  createGroup: (ids?: string[], name?: string, isComponent?: boolean) => void
  ungroup: (groupId: string) => void
  toggleGroupCollapse: (groupId: string) => void
  insertComponent: (component: ComponentItem) => void
  saveAsComponent: (name: string, targetId?: string) => ComponentItem | null
  setBackground: (bg: Background) => void
  setTime: (t: number) => void
  setPlaying: (v: boolean) => void
  setArtboardSnap: (v: boolean) => void
  setMode: (m: 'static' | 'animated') => void
  rename: (n: string) => void
  setDuration: (d: number) => void
  toggleTimeline: (open?: boolean) => void
  setTimelineOpen: (open: boolean) => void
  nudge: (dx: number, dy: number, measured?: Record<string, { x: number; y: number; w: number; h: number }>) => void
}

const EditorCtx = createContext<Ctx | null>(null)

export function EditorProvider({ project, children }: { project: Project; children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { project, selectedId: null, selectedIds: [], tool: null, time: 0, playing: false, artboardSnap: true, timelineOpen: false })

  const select = useCallback((id: string | null, additive = false, ids?: string[]) => dispatch({ t: 'select', id, additive, ids }), [])
  const toggleSelect = useCallback((id: string) => dispatch({ t: 'toggleSelect', id }), [])
  const alignSelected = useCallback((mode: AlignMode, measured?: Record<string, { x: number; y: number; w: number; h: number }>, targetGroupId?: string) => dispatch({ t: 'alignSelected', mode, measured, targetGroupId }), [])
  const openTool = useCallback((tool: string | null) => dispatch({ t: 'tool', tool }), [])
  const updateLayer = useCallback((id: string, patch: Partial<Layer>) => dispatch({ t: 'updateLayer', id, patch }), [])
  const updateLayers = useCallback((ids: string[], patch: Partial<Layer>) => dispatch({ t: 'updateLayers', ids, patch }), [])
  const deleteLayer = useCallback((id: string) => dispatch({ t: 'deleteLayer', id }), [])
  const deleteLayers = useCallback((ids: string[]) => dispatch({ t: 'deleteLayers', ids }), [])
  const duplicate = useCallback((id: string) => dispatch({ t: 'duplicate', id }), [])
  const reorder = useCallback((id: string, dir: number) => dispatch({ t: 'reorder', id, dir }), [])
  const createGroup = useCallback((ids?: string[], name?: string, isComponent = false) => dispatch({ t: 'createGroup', ids, name, isComponent }), [])
  const ungroup = useCallback((groupId: string) => dispatch({ t: 'ungroup', groupId }), [])
  const toggleGroupCollapse = useCallback((groupId: string) => dispatch({ t: 'toggleGroupCollapse', groupId }), [])
  const insertComponent = useCallback((component: ComponentItem) => dispatch({ t: 'insertComponent', component }), [])

  const saveAsComponent = useCallback((name: string, targetId?: string): ComponentItem | null => {
    const id = targetId || state.selectedId
    if (!id) return null
    let group = state.project.layers.find((l) => l.id === id)

    // If target is not already a group, but we have multiple items selected, group them first
    if (!group || group.type !== 'group') {
      if (state.selectedIds.length > 0) {
        const { newLayers, groupLayer } = createGroupFromSelection(state.project.layers, state.selectedIds, name, true)
        const descendants = getDescendantLayers(groupLayer.id, newLayers)
        const saved = saveComponentToLibrary(name, groupLayer, descendants, state.project.preset)
        dispatch({ t: 'createGroup', ids: state.selectedIds, name, isComponent: true })
        return saved
      }
      return null
    }

    const descendants = getDescendantLayers(group.id, state.project.layers)
    const saved = saveComponentToLibrary(name, group, descendants, state.project.preset)
    dispatch({ t: 'convertToComponent', groupId: group.id, name })
    return saved
  }, [state.selectedId, state.selectedIds, state.project.layers, state.project.preset])

  const setBackground = useCallback((bg: Background) => dispatch({ t: 'setBackground', bg }), [])
  const setTime = useCallback((t: number) => dispatch({ t: 'setTime', time: t }), [])
  const setPlaying = useCallback((v: boolean) => dispatch({ t: 'setPlaying', playing: v }), [])
  const setArtboardSnap = useCallback((v: boolean) => dispatch({ t: 'setArtboardSnap', enabled: v }), [])
  const setMode = useCallback((m: 'static' | 'animated') => dispatch({ t: 'setMode', mode: m }), [])
  const rename = useCallback((n: string) => dispatch({ t: 'rename', name: n }), [])
  const setDuration = useCallback((d: number) => dispatch({ t: 'setDuration', duration: d }), [])
  const toggleTimeline = useCallback((open?: boolean) => dispatch({ t: 'toggleTimeline', open }), [])
  const setTimelineOpen = useCallback((open: boolean) => dispatch({ t: 'setTimelineOpen', open }), [])
  const nudge = useCallback(
    (dx: number, dy: number, measured?: Record<string, { x: number; y: number; w: number; h: number }>) =>
      dispatch({ t: 'nudge', dx, dy, measured }),
    [],
  )

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
      select, toggleSelect, alignSelected, openTool, addLayer, updateLayer, updateLayers, deleteLayer, deleteLayers, duplicate, reorder,
      createGroup, ungroup, toggleGroupCollapse, insertComponent, saveAsComponent,
      setBackground, setTime, setPlaying, setArtboardSnap, setMode, rename, setDuration,
      toggleTimeline, setTimelineOpen, nudge,
    }),
    [state, select, alignSelected, openTool, addLayer, updateLayer, updateLayers, deleteLayer, deleteLayers, duplicate, reorder, createGroup, ungroup, toggleGroupCollapse, insertComponent, saveAsComponent, setBackground, setTime, setPlaying, setArtboardSnap, setMode, rename, setDuration, toggleTimeline, setTimelineOpen, nudge],
  )

  return <EditorCtx.Provider value={value}>{children}</EditorCtx.Provider>
}

export function useEditor() {
  const ctx = useContext(EditorCtx)
  if (!ctx) throw new Error('useEditor must be used within EditorProvider')
  return ctx
}
