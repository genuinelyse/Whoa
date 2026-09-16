import type { TargetBox } from '#/lib/sizeMatch'

export type ElementAlignAxis = 'x' | 'y'

export type ElementAlignType =
  | 'left-left'
  | 'left-right'
  | 'center-center'
  | 'right-left'
  | 'right-right'
  | 'top-top'
  | 'top-bottom'
  | 'middle-middle'
  | 'bottom-top'
  | 'bottom-bottom'

export interface ElementAlignMatch {
  axis: ElementAlignAxis
  type: ElementAlignType
  guideCoord: number
  targetBox: TargetBox
  startCoord: number
  endCoord: number
  label: string
}

export interface ElementAlignResult {
  dx: number
  dy: number
  xMatches: ElementAlignMatch[]
  yMatches: ElementAlignMatch[]
}

interface AlignCandidate {
  axis: ElementAlignAxis
  type: ElementAlignType
  delta: number
  distance: number
  guideCoord: number
  targetBox: TargetBox
  label: string
}

/**
 * Calculates element-to-element alignment snaps and returns smart alignment guide metadata
 * when an element (or selection box) is dragged on the canvas.
 *
 * Supported alignments:
 * - X-axis:
 *   - Left edge to Left edge ('left-left')
 *   - Left edge to Right edge ('left-right')
 *   - Horizontal Center to Horizontal Center ('center-center')
 *   - Right edge to Left edge ('right-left')
 *   - Right edge to Right edge ('right-right')
 * - Y-axis:
 *   - Top edge to Top edge ('top-top')
 *   - Top edge to Bottom edge ('top-bottom')
 *   - Vertical Center to Vertical Center ('middle-middle')
 *   - Bottom edge to Top edge ('bottom-top')
 *   - Bottom edge to Bottom edge ('bottom-bottom')
 */
export function findElementAlignMatch(
  movingBox: { x: number; y: number; w: number; h: number },
  candidates: TargetBox[],
  tolerance = 8,
): ElementAlignResult {
  if (!candidates || candidates.length === 0) {
    return { dx: 0, dy: 0, xMatches: [], yMatches: [] }
  }

  const left = movingBox.x
  const centerX = movingBox.x + movingBox.w / 2
  const right = movingBox.x + movingBox.w

  const top = movingBox.y
  const centerY = movingBox.y + movingBox.h / 2
  const bottom = movingBox.y + movingBox.h

  const xCandidates: AlignCandidate[] = []
  const yCandidates: AlignCandidate[] = []

  for (const t of candidates) {
    const tLeft = t.x
    const tCenterX = t.x + t.w / 2
    const tRight = t.x + t.w

    const tTop = t.y
    const tCenterY = t.y + t.h / 2
    const tBottom = t.y + t.h

    // --- Horizontal (X) Alignments ---
    // 1. Left to Left
    const dLeftLeft = tLeft - left
    xCandidates.push({
      axis: 'x',
      type: 'left-left',
      delta: dLeftLeft,
      distance: Math.abs(dLeftLeft),
      guideCoord: tLeft,
      targetBox: t,
      label: 'Left',
    })

    // 2. Center to Center
    const dCenterCenter = tCenterX - centerX
    xCandidates.push({
      axis: 'x',
      type: 'center-center',
      delta: dCenterCenter,
      distance: Math.abs(dCenterCenter),
      guideCoord: tCenterX,
      targetBox: t,
      label: 'Center',
    })

    // 3. Right to Right
    const dRightRight = tRight - right
    xCandidates.push({
      axis: 'x',
      type: 'right-right',
      delta: dRightRight,
      distance: Math.abs(dRightRight),
      guideCoord: tRight,
      targetBox: t,
      label: 'Right',
    })

    // 4. Left to Right (flush adjacent)
    const dLeftRight = tRight - left
    xCandidates.push({
      axis: 'x',
      type: 'left-right',
      delta: dLeftRight,
      distance: Math.abs(dLeftRight),
      guideCoord: tRight,
      targetBox: t,
      label: 'Align Right',
    })

    // 5. Right to Left (flush adjacent)
    const dRightLeft = tLeft - right
    xCandidates.push({
      axis: 'x',
      type: 'right-left',
      delta: dRightLeft,
      distance: Math.abs(dRightLeft),
      guideCoord: tLeft,
      targetBox: t,
      label: 'Align Left',
    })

    // --- Vertical (Y) Alignments ---
    // 1. Top to Top
    const dTopTop = tTop - top
    yCandidates.push({
      axis: 'y',
      type: 'top-top',
      delta: dTopTop,
      distance: Math.abs(dTopTop),
      guideCoord: tTop,
      targetBox: t,
      label: 'Top',
    })

    // 2. Middle to Middle
    const dMiddleMiddle = tCenterY - centerY
    yCandidates.push({
      axis: 'y',
      type: 'middle-middle',
      delta: dMiddleMiddle,
      distance: Math.abs(dMiddleMiddle),
      guideCoord: tCenterY,
      targetBox: t,
      label: 'Middle',
    })

    // 3. Bottom to Bottom
    const dBottomBottom = tBottom - bottom
    yCandidates.push({
      axis: 'y',
      type: 'bottom-bottom',
      delta: dBottomBottom,
      distance: Math.abs(dBottomBottom),
      guideCoord: tBottom,
      targetBox: t,
      label: 'Bottom',
    })

    // 4. Top to Bottom (flush adjacent)
    const dTopBottom = tBottom - top
    yCandidates.push({
      axis: 'y',
      type: 'top-bottom',
      delta: dTopBottom,
      distance: Math.abs(dTopBottom),
      guideCoord: tBottom,
      targetBox: t,
      label: 'Align Bottom',
    })

    // 5. Bottom to Top (flush adjacent)
    const dBottomTop = tTop - bottom
    yCandidates.push({
      axis: 'y',
      type: 'bottom-top',
      delta: dBottomTop,
      distance: Math.abs(dBottomTop),
      guideCoord: tTop,
      targetBox: t,
      label: 'Align Top',
    })
  }

  // Find best X match within tolerance
  const validX = xCandidates.filter((c) => c.distance <= tolerance).sort((a, b) => a.distance - b.distance)
  let bestDx = 0
  let xMatches: ElementAlignMatch[] = []

  if (validX.length > 0) {
    bestDx = validX[0].delta
    const matchedCandidates = validX.filter((c) => Math.abs(c.delta - bestDx) < 0.001)

    // Compute guide vertical span (from top to bottom of the aligned elements)
    const snappedTop = movingBox.y
    const snappedBottom = movingBox.y + movingBox.h

    xMatches = matchedCandidates.map((c) => {
      const startCoord = Math.min(snappedTop, c.targetBox.y) - 14
      const endCoord = Math.max(snappedBottom, c.targetBox.y + c.targetBox.h) + 14
      return {
        axis: 'x',
        type: c.type,
        guideCoord: c.guideCoord,
        targetBox: c.targetBox,
        startCoord,
        endCoord,
        label: c.label,
      }
    })
  }

  // Find best Y match within tolerance
  const validY = yCandidates.filter((c) => c.distance <= tolerance).sort((a, b) => a.distance - b.distance)
  let bestDy = 0
  let yMatches: ElementAlignMatch[] = []

  if (validY.length > 0) {
    bestDy = validY[0].delta
    const matchedCandidates = validY.filter((c) => Math.abs(c.delta - bestDy) < 0.001)

    // Compute guide horizontal span (from left to right of the aligned elements)
    const snappedLeft = movingBox.x + bestDx
    const snappedRight = movingBox.x + bestDx + movingBox.w

    yMatches = matchedCandidates.map((c) => {
      const startCoord = Math.min(snappedLeft, c.targetBox.x) - 14
      const endCoord = Math.max(snappedRight, c.targetBox.x + c.targetBox.w) + 14
      return {
        axis: 'y',
        type: c.type,
        guideCoord: c.guideCoord,
        targetBox: c.targetBox,
        startCoord,
        endCoord,
        label: c.label,
      }
    })
  }

  // Refine X match start/end coordinates with snapped Y
  if (xMatches.length > 0 && bestDy !== 0) {
    const refinedTop = movingBox.y + bestDy
    const refinedBottom = movingBox.y + bestDy + movingBox.h
    xMatches = xMatches.map((m) => ({
      ...m,
      startCoord: Math.min(refinedTop, m.targetBox.y) - 14,
      endCoord: Math.max(refinedBottom, m.targetBox.y + m.targetBox.h) + 14,
    }))
  }

  return {
    dx: bestDx,
    dy: bestDy,
    xMatches,
    yMatches,
  }
}
