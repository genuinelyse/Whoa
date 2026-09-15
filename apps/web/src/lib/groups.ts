import type { Layer, Preset } from '#/types'
import { uid } from '#/lib/data'

export interface ComponentItem {
  id: string
  name: string
  description?: string
  createdAt: number
  presetWidth: number
  presetHeight: number
  root: Partial<Layer>
  layers: Layer[]
  previewBg?: string
  thumbnailEmoji?: string
}

const STORAGE_KEY = 'bannr_components_v1'

/**
 * Get all descendant layers of a group (recursive)
 */
export function getDescendantLayers(groupId: string, allLayers: Layer[]): Layer[] {
  const directChildren = allLayers.filter((l) => l.groupId === groupId)
  const descendants: Layer[] = []
  for (const child of directChildren) {
    descendants.push(child)
    if (child.type === 'group') {
      descendants.push(...getDescendantLayers(child.id, allLayers))
    }
  }
  return descendants
}

/**
 * Get direct children of a group
 */
export function getDirectChildren(groupId: string, allLayers: Layer[]): Layer[] {
  return allLayers.filter((l) => l.groupId === groupId)
}

/**
 * Find the topmost group containing a given layer
 */
export function getTopmostGroup(layerId: string, allLayers: Layer[]): Layer | null {
  const current = allLayers.find((l) => l.id === layerId)
  if (!current || !current.groupId) return null
  let parent = allLayers.find((l) => l.id === current.groupId)
  while (parent && parent.groupId) {
    const nextParent = allLayers.find((l) => l.id === parent!.groupId)
    if (!nextParent) break
    parent = nextParent
  }
  return parent || null
}

/**
 * Calculate bounding box and timing of a group from its visible non-group children
 */
export function computeGroupBounds(groupId: string, allLayers: Layer[]): {
  x: number
  y: number
  w: number
  h: number
  minStart: number
  maxEnd: number
} {
  const descendants = getDescendantLayers(groupId, allLayers)
  const contentLayers = descendants.filter((l) => l.type !== 'group' && l.visible)
  const pool = contentLayers.length > 0 ? contentLayers : descendants

  if (pool.length === 0) {
    const self = allLayers.find((l) => l.id === groupId)
    return {
      x: self?.x ?? 0,
      y: self?.y ?? 0,
      w: self?.w ?? 100,
      h: self?.h ?? 100,
      minStart: self?.start ?? 0,
      maxEnd: self?.end ?? 5000,
    }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let minStart = Infinity
  let maxEnd = -Infinity

  for (const l of pool) {
    minX = Math.min(minX, l.x)
    minY = Math.min(minY, l.y)
    maxX = Math.max(maxX, l.x + l.w)
    maxY = Math.max(maxY, l.y + l.h)
    minStart = Math.min(minStart, l.start)
    maxEnd = Math.max(maxEnd, l.end)
  }

  return {
    x: Math.round(minX),
    y: Math.round(minY),
    w: Math.max(20, Math.round(maxX - minX)),
    h: Math.max(20, Math.round(maxY - minY)),
    minStart: Math.max(0, minStart === Infinity ? 0 : minStart),
    maxEnd: Math.max(200, maxEnd === -Infinity ? 5000 : maxEnd),
  }
}

/**
 * Create a new group from selected layer IDs
 */
export function createGroupFromSelection(
  layers: Layer[],
  selectedIds: string[],
  name?: string,
  isComponent = false,
): { newLayers: Layer[]; groupLayer: Layer } {
  if (selectedIds.length === 0) {
    throw new Error('No layers selected to group')
  }

  // Find all selected layers
  const selectedLayers = layers.filter((l) => selectedIds.includes(l.id))
  if (selectedLayers.length === 0) {
    throw new Error('Selected layers not found')
  }

  // Check if they share a common parent group
  const parentGroupId = selectedLayers[0].groupId
  const sameParent = selectedLayers.every((l) => l.groupId === parentGroupId)
  const commonGroupId = sameParent ? parentGroupId : undefined

  // Calculate bounding box and timing
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let minStart = Infinity
  let maxEnd = -Infinity

  for (const l of selectedLayers) {
    // If l is a group, include its descendant bounds
    if (l.type === 'group') {
      const b = computeGroupBounds(l.id, layers)
      minX = Math.min(minX, b.x)
      minY = Math.min(minY, b.y)
      maxX = Math.max(maxX, b.x + b.w)
      maxY = Math.max(maxY, b.y + b.h)
      minStart = Math.min(minStart, b.minStart)
      maxEnd = Math.max(maxEnd, b.maxEnd)
    } else {
      minX = Math.min(minX, l.x)
      minY = Math.min(minY, l.y)
      maxX = Math.max(maxX, l.x + l.w)
      maxY = Math.max(maxY, l.y + l.h)
      minStart = Math.min(minStart, l.start)
      maxEnd = Math.max(maxEnd, l.end)
    }
  }

  const groupId = uid()
  const groupCount = layers.filter((l) => l.type === 'group' && !l.isComponent).length
  const componentCount = layers.filter((l) => l.isComponent).length

  const defaultName = isComponent
    ? `Component ${componentCount + 1}`
    : `Group ${groupCount + 1}`

  const groupLayer: Layer = {
    id: groupId,
    type: 'group',
    name: name || defaultName,
    x: Math.round(minX === Infinity ? 0 : minX),
    y: Math.round(minY === Infinity ? 0 : minY),
    w: Math.max(20, Math.round(maxX - minX)),
    h: Math.max(20, Math.round(maxY - minY)),
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    start: Math.max(0, minStart === Infinity ? 0 : minStart),
    end: Math.max(500, maxEnd === -Infinity ? 5000 : maxEnd),
    anim: 'none',
    groupId: commonGroupId,
    isComponent,
    collapsed: false,
  }

  // Update selected layers to belong to this new group
  const updatedLayers = layers.map((l) => {
    if (selectedIds.includes(l.id)) {
      return { ...l, groupId }
    }
    return l
  })

  // Find the highest index among selected items to insert the group container next to its children
  const indices = selectedIds.map((id) => updatedLayers.findIndex((l) => l.id === id)).filter((i) => i >= 0)
  const maxIdx = Math.max(...indices)

  // Insert group layer right above or at the highest child
  const newLayers = [...updatedLayers]
  newLayers.splice(maxIdx + 1, 0, groupLayer)

  return { newLayers, groupLayer }
}

/**
 * Ungroup a group layer
 */
export function ungroupLayer(
  layers: Layer[],
  groupId: string,
): { newLayers: Layer[]; unpackedIds: string[] } {
  const group = layers.find((l) => l.id === groupId && l.type === 'group')
  if (!group) return { newLayers: layers, unpackedIds: [] }

  const directChildren = layers.filter((l) => l.groupId === groupId)
  const unpackedIds = directChildren.map((c) => c.id)

  const newLayers = layers
    .filter((l) => l.id !== groupId)
    .map((l) => {
      if (l.groupId === groupId) {
        // Move children to the parent group of this group (or root if undefined)
        return { ...l, groupId: group.groupId }
      }
      return l
    })

  return { newLayers, unpackedIds }
}

/**
 * Duplicate a layer or group (with all descendant layers and mapped IDs)
 */
export function duplicateLayerOrGroup(
  layers: Layer[],
  targetId: string,
): { newLayers: Layer[]; newSelectedId: string } {
  const target = layers.find((l) => l.id === targetId)
  if (!target) return { newLayers: layers, newSelectedId: targetId }

  if (target.type !== 'group') {
    const copy: Layer = {
      ...target,
      id: uid(),
      x: target.x + 24,
      y: target.y + 24,
      name: `${target.name} copy`,
    }
    const idx = layers.findIndex((l) => l.id === targetId)
    const newLayers = [...layers]
    newLayers.splice(idx + 1, 0, copy)
    return { newLayers, newSelectedId: copy.id }
  }

  // Target is a group: duplicate the group and all its descendants
  const descendants = getDescendantLayers(targetId, layers)
  const allToDuplicate = [target, ...descendants]

  // Map old IDs to new IDs
  const idMap = new Map<string, string>()
  for (const item of allToDuplicate) {
    idMap.set(item.id, uid())
  }

  const offset = 24
  const duplicatedItems: Layer[] = allToDuplicate.map((item) => {
    const newId = idMap.get(item.id)!
    const newGroupId = item.groupId && idMap.has(item.groupId)
      ? idMap.get(item.groupId)
      : (item.id === targetId ? target.groupId : undefined)

    return {
      ...item,
      id: newId,
      name: item.id === targetId ? `${item.name} copy` : item.name,
      x: item.x + offset,
      y: item.y + offset,
      groupId: newGroupId,
    }
  })

  // Insert duplicated items right after the last original item
  const allIndices = allToDuplicate.map((item) => layers.findIndex((l) => l.id === item.id)).filter((i) => i >= 0)
  const maxIdx = Math.max(...allIndices)

  const newLayers = [...layers]
  newLayers.splice(maxIdx + 1, 0, ...duplicatedItems)

  return { newLayers, newSelectedId: idMap.get(targetId)! }
}

/**
 * Delete a layer or group (including all descendant layers if a group)
 */
export function deleteLayerOrGroup(layers: Layer[], targetId: string): Layer[] {
  const target = layers.find((l) => l.id === targetId)
  if (!target) return layers

  if (target.type === 'group') {
    const descendants = getDescendantLayers(targetId, layers)
    const idsToRemove = new Set([targetId, ...descendants.map((d) => d.id)])
    return layers.filter((l) => !idsToRemove.has(l.id))
  }

  return layers.filter((l) => l.id !== targetId)
}

/**
 * Reorder a layer or group among its siblings with the same parent groupId
 */
export function reorderSibling(layers: Layer[], id: string, dir: number): Layer[] {
  const target = layers.find((l) => l.id === id)
  if (!target) return layers

  const parentGroupId = target.groupId

  // Collect siblings (including groups) that share the same parentGroupId
  const siblings = layers.filter((l) => l.groupId === parentGroupId)
  const sIdx = siblings.findIndex((l) => l.id === id)
  if (sIdx < 0) return layers

  const newSIdx = sIdx + dir
  if (newSIdx < 0 || newSIdx >= siblings.length) return layers

  // Sibling we are swapping with
  const otherSibling = siblings[newSIdx]

  // If target or otherSibling are groups, we must move the whole block (group + descendants)
  const getBlock = (item: Layer): Layer[] => {
    if (item.type === 'group') {
      const desc = getDescendantLayers(item.id, layers)
      return [item, ...desc]
    }
    return [item]
  }

  const targetBlock = getBlock(target)
  const otherBlock = getBlock(otherSibling)

  const targetIds = new Set(targetBlock.map((l) => l.id))

  const newLayers = layers.filter((l) => !targetIds.has(l.id))
  const insertPos = dir > 0
    ? newLayers.findIndex((l) => l.id === otherSibling.id) + otherBlock.length
    : newLayers.findIndex((l) => l.id === otherSibling.id)

  newLayers.splice(Math.max(0, insertPos), 0, ...targetBlock)
  return newLayers
}

/* =========================================================================
   Components Library Persistence & Stock Library
   ========================================================================= */

export const STOCK_COMPONENTS: ComponentItem[] = [
  {
    id: 'stock-cta-badge',
    name: 'CTA Button & Badge',
    description: 'High-conversion button with animated notification pill',
    createdAt: 1710000000000,
    presetWidth: 1080,
    presetHeight: 1080,
    thumbnailEmoji: '🔥',
    previewBg: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)',
    root: {
      name: 'CTA Button & Badge',
      w: 420,
      h: 110,
      isComponent: true,
      start: 0,
      end: 5000,
      anim: 'pop',
    },
    layers: [
      {
        id: 'c-cta-bg',
        type: 'shape',
        name: 'Button Background',
        x: 0,
        y: 10,
        w: 420,
        h: 90,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        start: 0,
        end: 5000,
        anim: 'pop',
        shape: 'rect',
        fill: '#007AFF',
        radius: 20,
      },
      {
        id: 'c-cta-txt',
        type: 'text',
        name: 'CTA Label',
        x: 40,
        y: 35,
        w: 340,
        h: 40,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        start: 200,
        end: 5000,
        anim: 'rise',
        text: 'CLAIM OFFER NOW →',
        fontFamily: 'Manrope',
        fontSize: 32,
        fontWeight: 800,
        color: '#FFFFFF',
        align: 'center',
      },
      {
        id: 'c-cta-sticker',
        type: 'sticker',
        name: 'Fire Badge',
        x: 370,
        y: 0,
        w: 56,
        h: 56,
        rotation: 12,
        opacity: 1,
        visible: true,
        locked: false,
        start: 400,
        end: 5000,
        anim: 'pop',
        emoji: '🔥',
      },
    ],
  },
  {
    id: 'stock-discount-tag',
    name: 'Discount Promo Tag',
    description: 'Vibrant discount badge with animated burst text',
    createdAt: 1710000000000,
    presetWidth: 1080,
    presetHeight: 1080,
    thumbnailEmoji: '🏷️',
    previewBg: 'linear-gradient(135deg, #831843 0%, #be123c 100%)',
    root: {
      name: 'Discount Promo Tag',
      w: 360,
      h: 160,
      isComponent: true,
      start: 0,
      end: 5000,
      anim: 'pop',
    },
    layers: [
      {
        id: 'c-tag-pill',
        type: 'shape',
        name: 'Tag Container',
        x: 0,
        y: 0,
        w: 360,
        h: 160,
        rotation: -4,
        opacity: 1,
        visible: true,
        locked: false,
        start: 0,
        end: 5000,
        anim: 'pop',
        shape: 'rect',
        fill: '#FFCC00',
        radius: 28,
      },
      {
        id: 'c-tag-title',
        type: 'text',
        name: '50% OFF',
        x: 20,
        y: 20,
        w: 320,
        h: 65,
        rotation: -4,
        opacity: 1,
        visible: true,
        locked: false,
        start: 250,
        end: 5000,
        anim: 'rise',
        text: '50% OFF',
        fontFamily: 'Impact',
        fontSize: 64,
        fontWeight: 800,
        color: '#0A0A0A',
        align: 'center',
      },
      {
        id: 'c-tag-sub',
        type: 'text',
        name: 'Subtitle',
        x: 20,
        y: 100,
        w: 320,
        h: 30,
        rotation: -4,
        opacity: 1,
        visible: true,
        locked: false,
        start: 450,
        end: 5000,
        anim: 'fade',
        text: 'LIMITED TIME ONLY',
        fontFamily: 'Manrope',
        fontSize: 20,
        fontWeight: 800,
        color: '#0A0A0A',
        align: 'center',
      },
    ],
  },
  {
    id: 'stock-social-card',
    name: 'Social Follow Banner',
    description: 'Polished creator follow card with verified star badge',
    createdAt: 1710000000000,
    presetWidth: 1080,
    presetHeight: 1080,
    thumbnailEmoji: '⭐',
    previewBg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    root: {
      name: 'Social Follow Banner',
      w: 460,
      h: 120,
      isComponent: true,
      start: 0,
      end: 5000,
      anim: 'slide',
    },
    layers: [
      {
        id: 'c-soc-bg',
        type: 'shape',
        name: 'Card Base',
        x: 0,
        y: 0,
        w: 460,
        h: 120,
        rotation: 0,
        opacity: 0.95,
        visible: true,
        locked: false,
        start: 0,
        end: 5000,
        anim: 'slide',
        shape: 'rect',
        fill: '#18181B',
        radius: 999,
      },
      {
        id: 'c-soc-icon',
        type: 'sticker',
        name: 'Star Icon',
        x: 25,
        y: 25,
        w: 70,
        h: 70,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        start: 200,
        end: 5000,
        anim: 'pop',
        emoji: '⭐',
      },
      {
        id: 'c-soc-handle',
        type: 'text',
        name: 'Handle Text',
        x: 115,
        y: 28,
        w: 310,
        h: 36,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        start: 350,
        end: 5000,
        anim: 'fade',
        text: '@yourbrand',
        fontFamily: 'Manrope',
        fontSize: 34,
        fontWeight: 800,
        color: '#FFFFFF',
        align: 'left',
      },
      {
        id: 'c-soc-sub',
        type: 'text',
        name: 'Subscribe Call',
        x: 115,
        y: 72,
        w: 310,
        h: 22,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        start: 500,
        end: 5000,
        anim: 'fade',
        text: 'Follow for daily drops',
        fontFamily: 'Manrope',
        fontSize: 18,
        fontWeight: 600,
        color: '#A1A1AA',
        align: 'left',
      },
    ],
  },
]

export function getLibraryComponents(): ComponentItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return STOCK_COMPONENTS
    const parsed: ComponentItem[] = JSON.parse(raw)
    // Combine custom components with stock ones, custom first
    const customIds = new Set(parsed.map((c) => c.id))
    const stocksToAdd = STOCK_COMPONENTS.filter((s) => !customIds.has(s.id))
    return [...parsed, ...stocksToAdd]
  } catch {
    return STOCK_COMPONENTS
  }
}

export function saveComponentToLibrary(
  name: string,
  rootGroup: Layer,
  descendantLayers: Layer[],
  preset: Preset,
  description?: string,
): ComponentItem {
  // Normalize coordinates relative to root group (0, 0)
  const relX = rootGroup.x
  const relY = rootGroup.y

  const normalizedRoot: Layer = {
    ...rootGroup,
    x: 0,
    y: 0,
    isComponent: true,
    groupId: undefined,
  }

  const normalizedLayers: Layer[] = descendantLayers.map((l) => ({
    ...l,
    x: l.x - relX,
    y: l.y - relY,
  }))

  const item: ComponentItem = {
    id: `comp-${uid()}`,
    name: name.trim() || 'Untitled Component',
    description: description || 'Custom saved creative component',
    createdAt: Date.now(),
    presetWidth: preset.w,
    presetHeight: preset.h,
    root: normalizedRoot,
    layers: normalizedLayers,
    thumbnailEmoji: descendantLayers.find((l) => l.type === 'sticker')?.emoji || '❖',
  }

  try {
    const current = getLibraryComponents().filter((c) => !c.id.startsWith('stock-'))
    const next = [item, ...current]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch (err) {
    console.error('Failed to save component to localStorage:', err)
  }

  return item
}

export function deleteComponentFromLibrary(id: string): void {
  try {
    const current = getLibraryComponents().filter((c) => c.id !== id && !c.id.startsWith('stock-'))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch (err) {
    console.error('Failed to delete component from localStorage:', err)
  }
}

/**
 * Instantiate a library component into the target preset
 */
export function instantiateComponent(
  comp: ComponentItem,
  preset: Preset,
  targetX?: number,
  targetY?: number,
): { rootLayer: Layer; childLayers: Layer[] } {
  const rootW = comp.root.w || 300
  const rootH = comp.root.h || 120

  const originX = targetX !== undefined ? targetX : Math.round((preset.w - rootW) / 2)
  const originY = targetY !== undefined ? targetY : Math.round((preset.h - rootH) / 2)

  const newRootId = uid()

  // Map old layer IDs to new UIDs
  const idMap = new Map<string, string>()
  idMap.set(comp.root.id || 'root', newRootId)
  for (const l of comp.layers) {
    idMap.set(l.id, uid())
  }

  const rootLayer: Layer = {
    id: newRootId,
    type: 'group',
    name: comp.name,
    x: originX,
    y: originY,
    w: rootW,
    h: rootH,
    rotation: comp.root.rotation || 0,
    opacity: comp.root.opacity ?? 1,
    visible: true,
    locked: false,
    start: comp.root.start ?? 0,
    end: comp.root.end ?? 5000,
    anim: comp.root.anim || 'none',
    isComponent: true,
    componentId: comp.id,
    collapsed: false,
  }

  const childLayers: Layer[] = comp.layers.map((l) => {
    const newId = idMap.get(l.id)!
    // If the child was attached to an internal sub-group, map that group ID, otherwise point to newRootId
    const targetGroupId = l.groupId && idMap.has(l.groupId) ? idMap.get(l.groupId) : newRootId

    return {
      ...l,
      id: newId,
      x: originX + l.x,
      y: originY + l.y,
      groupId: targetGroupId,
    }
  })

  return { rootLayer, childLayers }
}
