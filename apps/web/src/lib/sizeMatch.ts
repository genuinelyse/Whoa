import type { Layer } from '#/types'
import { computeGroupBounds } from '#/lib/groups'

export interface TargetBox {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
  type: string
  isComponent?: boolean
}

export interface SizeMatchDimension {
  size: number
  resizingBox: { x: number; y: number; w: number; h: number }
  targetBox: TargetBox
}

export interface SizeMatch {
  active: boolean
  widthMatch?: SizeMatchDimension
  heightMatch?: SizeMatchDimension
}

/**
 * Collects bounding boxes of all visible, non-excluded layers, groups, and components
 * that can serve as reference targets for size matching.
 */
export function getCandidateTargets(
  allLayers: Layer[],
  excludeIds: Set<string>,
  layerNodes?: Map<string, HTMLElement | null> | null,
  artW?: number,
): TargetBox[] {
  const candidates: TargetBox[] = []

  for (const l of allLayers) {
    if (excludeIds.has(l.id) || l.visible === false || l.groupId) continue

    if (l.type === 'group') {
      const bounds = computeGroupBounds(l.id, allLayers)
      if (bounds.w > 0 && bounds.h > 0) {
        candidates.push({
          id: l.id,
          name: l.name || (l.isComponent ? 'Component' : 'Group'),
          x: bounds.x,
          y: bounds.y,
          w: bounds.w,
          h: bounds.h,
          type: 'group',
          isComponent: l.isComponent,
        })
      }
      continue
    }

    const node = layerNodes?.get(l.id)
    const isCentered = l.type === 'text' && l.align === 'center' && l.x === 0 && artW && l.w === artW && node
    const w = (l.type === 'text' && node ? node.offsetWidth : node?.offsetWidth) || l.w
    const h = (l.type === 'text' && node ? node.offsetHeight : node?.offsetHeight) || l.h
    const x = isCentered && artW ? (artW - w) / 2 : (node?.offsetLeft ?? l.x)
    const y = node?.offsetTop ?? l.y

    if (w > 0 && h > 0) {
      candidates.push({
        id: l.id,
        name: l.name || (l.type === 'shape' ? (l.shape || 'Shape') : l.type),
        x,
        y,
        w,
        h,
        type: l.type,
        isComponent: l.isComponent,
      })
    }
  }

  return candidates
}

/**
 * Checks if the candidate width and/or height are within tolerance of any target dimension.
 * Snaps to the closest match and returns detailed match metadata for visual guides and badges.
 */
export function findSizeMatch(
  candW: number,
  candH: number,
  resizingBox: { x: number; y: number; w: number; h: number },
  candidates: TargetBox[],
  tolerance: number,
  checkWidth: boolean,
  checkHeight: boolean,
): {
  snappedW: number
  snappedH: number
  widthMatch?: SizeMatchDimension
  heightMatch?: SizeMatchDimension
} {
  let snappedW = candW
  let snappedH = candH
  let widthMatch: SizeMatchDimension | undefined = undefined
  let heightMatch: SizeMatchDimension | undefined = undefined

  if (checkWidth && candidates.length > 0) {
    let bestDist = Infinity
    let bestTarget: TargetBox | null = null
    for (const target of candidates) {
      const dist = Math.abs(candW - target.w)
      if (dist <= tolerance && dist < bestDist) {
        bestDist = dist
        bestTarget = target
      }
    }
    if (bestTarget) {
      snappedW = bestTarget.w
      widthMatch = {
        size: bestTarget.w,
        resizingBox: { ...resizingBox, w: snappedW },
        targetBox: bestTarget,
      }
    }
  }

  if (checkHeight && candidates.length > 0) {
    let bestDist = Infinity
    let bestTarget: TargetBox | null = null
    for (const target of candidates) {
      const dist = Math.abs(candH - target.h)
      if (dist <= tolerance && dist < bestDist) {
        bestDist = dist
        bestTarget = target
      }
    }
    if (bestTarget) {
      snappedH = bestTarget.h
      heightMatch = {
        size: bestTarget.h,
        resizingBox: { ...resizingBox, h: snappedH },
        targetBox: bestTarget,
      }
    }
  }

  return { snappedW, snappedH, widthMatch, heightMatch }
}
