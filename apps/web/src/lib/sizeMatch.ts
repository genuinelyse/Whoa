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
  artH?: number,
  includeArtboard = false,
): TargetBox[] {
  const candidates: TargetBox[] = []

  if (includeArtboard && artW && artW > 0 && artH && artH > 0) {
    candidates.push({
      id: '__artboard__',
      name: 'Artboard',
      x: 0,
      y: 0,
      w: artW,
      h: artH,
      type: 'artboard',
    })
  }

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

export interface CornerMatchResult {
  factor: number
  w: number
  h: number
  x: number
  y: number
  widthMatch?: SizeMatchDimension
  heightMatch?: SizeMatchDimension
}

/**
 * Calculates uniform corner scale matching for elements, groups, and text when dragging corner handles.
 * Uses smooth least-squares diagonal projection and precise tolerance matching identical to pinch-resize.
 */
export function findCornerSizeMatch(
  ow: number,
  oh: number,
  newW: number,
  newH: number,
  ox: number,
  oy: number,
  isLeft: boolean,
  isTop: boolean,
  candidates: TargetBox[],
  tolerance: number,
  minSize = 15,
): CornerMatchResult {
  if (ow <= 0 || oh <= 0) {
    return { factor: 1, w: Math.max(minSize, ow), h: Math.max(minSize, oh), x: ox, y: oy }
  }

  // Smooth diagonal projection for uniform aspect-ratio scaling
  const deltaW = newW - ow
  const deltaH = newH - oh
  const ratio = 1 + (deltaW * ow + deltaH * oh) / (ow * ow + oh * oh)
  const clampedRatio = Math.max(minSize / Math.min(ow, oh), ratio)

  // Unsnapped proportional size matching pinch-resize
  const rawW = Math.max(minSize, Math.round(ow * clampedRatio))
  const rawH = Math.max(minSize, Math.round(oh * clampedRatio))

  let bestMatchW: { target: TargetBox; dist: number; factor: number } | null = null
  let bestMatchH: { target: TargetBox; dist: number; factor: number } | null = null

  if (candidates.length > 0) {
    for (const target of candidates) {
      if (target.w > 0) {
        const distW = Math.abs(rawW - target.w)
        if (distW <= tolerance && (!bestMatchW || distW < bestMatchW.dist)) {
          bestMatchW = { target, dist: distW, factor: target.w / ow }
        }
      }

      if (target.h > 0) {
        const distH = Math.abs(rawH - target.h)
        if (distH <= tolerance && (!bestMatchH || distH < bestMatchH.dist)) {
          bestMatchH = { target, dist: distH, factor: target.h / oh }
        }
      }
    }
  }

  let chosenFactor = clampedRatio
  let matchedWTarget: TargetBox | null = null
  let matchedHTarget: TargetBox | null = null

  if (bestMatchW && bestMatchH) {
    if (bestMatchW.target.id === bestMatchH.target.id && Math.abs(bestMatchW.factor - bestMatchH.factor) < 0.05) {
      chosenFactor = bestMatchW.factor
      matchedWTarget = bestMatchW.target
      matchedHTarget = bestMatchH.target
    } else if (bestMatchW.dist <= bestMatchH.dist) {
      chosenFactor = bestMatchW.factor
      matchedWTarget = bestMatchW.target
      if (Math.abs(Math.round(oh * chosenFactor) - bestMatchH.target.h) <= tolerance) {
        matchedHTarget = bestMatchH.target
      }
    } else {
      chosenFactor = bestMatchH.factor
      matchedHTarget = bestMatchH.target
      if (Math.abs(Math.round(ow * chosenFactor) - bestMatchW.target.w) <= tolerance) {
        matchedWTarget = bestMatchW.target
      }
    }
  } else if (bestMatchW) {
    chosenFactor = bestMatchW.factor
    matchedWTarget = bestMatchW.target
  } else if (bestMatchH) {
    chosenFactor = bestMatchH.factor
    matchedHTarget = bestMatchH.target
  }

  const w = Math.max(minSize, Math.round(ow * chosenFactor))
  const h = Math.max(minSize, Math.round(oh * chosenFactor))
  const x = isLeft ? Math.round(ox + (ow - w)) : ox
  const y = isTop ? Math.round(oy + (oh - h)) : oy

  const resizingBox = { x, y, w, h }
  const widthMatch: SizeMatchDimension | undefined = matchedWTarget
    ? {
        size: matchedWTarget.w,
        resizingBox,
        targetBox: matchedWTarget,
      }
    : undefined

  const heightMatch: SizeMatchDimension | undefined = matchedHTarget
    ? {
        size: matchedHTarget.h,
        resizingBox,
        targetBox: matchedHTarget,
      }
    : undefined

  return {
    factor: chosenFactor,
    w,
    h,
    x,
    y,
    widthMatch,
    heightMatch,
  }
}
