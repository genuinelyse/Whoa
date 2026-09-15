import type { TargetBox } from '#/lib/sizeMatch'

export interface GapLine {
  axis: 'x' | 'y'
  x1: number
  y1: number
  x2: number
  y2: number
  size: number
}

export interface GapMatchResult {
  dx: number
  dy: number
  gaps: GapLine[]
}

function calcOverlapCenterX(b1: { x: number; w: number }, b2: { x: number; w: number }): number {
  const overlapMin = Math.max(b1.x, b2.x)
  const overlapMax = Math.min(b1.x + b1.w, b2.x + b2.w)
  if (overlapMax > overlapMin) {
    return (overlapMin + overlapMax) / 2
  }
  return (b1.x + b1.w / 2 + b2.x + b2.w / 2) / 2
}

function calcOverlapCenterY(b1: { y: number; h: number }, b2: { y: number; h: number }): number {
  const overlapMin = Math.max(b1.y, b2.y)
  const overlapMax = Math.min(b1.y + b1.h, b2.y + b2.h)
  if (overlapMax > overlapMin) {
    return (overlapMin + overlapMax) / 2
  }
  return (b1.y + b1.h / 2 + b2.y + b2.h / 2) / 2
}

function isHorizontalAligned(
  b1: { x: number; w: number },
  b2: { x: number; w: number },
  maxSeparation = 150,
): boolean {
  const overlap = Math.min(b1.x + b1.w, b2.x + b2.w) - Math.max(b1.x, b2.x)
  return overlap > -maxSeparation
}

function isVerticalAligned(
  b1: { y: number; h: number },
  b2: { y: number; h: number },
  maxSeparation = 150,
): boolean {
  const overlap = Math.min(b1.y + b1.h, b2.y + b2.h) - Math.max(b1.y, b2.y)
  return overlap > -maxSeparation
}

/**
 * Finds equal distance/gap snaps between the moving element and other elements on canvas.
 * Supports:
 * 1. A -> B -> Moving (moving element positioned after pair with same gap)
 * 2. Moving -> A -> B (moving element positioned before pair with same gap)
 * 3. A -> Moving -> B (moving element positioned equidistant between two elements)
 *
 * Checks both vertical (Y) and horizontal (X) dimensions with the specified tolerance (default: 8px).
 */
export function findGapMatch(
  movingBox: { x: number; y: number; w: number; h: number },
  candidates: TargetBox[],
  tolerance = 8,
): GapMatchResult {
  let bestDy = 0
  let minDyDist = Infinity
  let verticalGapLines: GapLine[] = []

  let bestDx = 0
  let minDxDist = Infinity
  let horizontalGapLines: GapLine[] = []

  if (candidates.length >= 2) {
    // -------------------------------------------------------------
    // VERTICAL GAP SNAPPING (Y AXIS)
    // -------------------------------------------------------------
    // Find candidate pairs (A, B) where A is above B and they are horizontally aligned
    for (let i = 0; i < candidates.length; i++) {
      const a = candidates[i]
      for (let j = 0; j < candidates.length; j++) {
        if (i === j) continue
        const b = candidates[j]

        // A must be above B
        const aBottom = a.y + a.h
        const bTop = b.y
        const gapAB = bTop - aBottom

        if (gapAB <= 0) continue
        if (!isHorizontalAligned(a, b)) continue

        // Check if there is another candidate between A and B
        const hasIntervening = candidates.some((k, idx) => {
          if (idx === i || idx === j) return false
          const kBottom = k.y + k.h
          return k.y >= aBottom && kBottom <= bTop && isHorizontalAligned(a, k)
        })
        if (hasIntervening) continue

        // Check if moving element is horizontally aligned with this pair
        if (!isHorizontalAligned(movingBox, a) && !isHorizontalAligned(movingBox, b)) {
          continue
        }

        // Scenario 1: Moving is below B (Sequence A -> B -> Moving)
        // Moving should be at gapAB below B
        const targetMovingY1 = b.y + b.h + gapAB
        const dist1 = Math.abs(movingBox.y - targetMovingY1)
        if (dist1 <= tolerance && dist1 < minDyDist) {
          minDyDist = dist1
          bestDy = targetMovingY1 - movingBox.y
          const snappedMoving = { ...movingBox, y: targetMovingY1 }
          const lxAB = calcOverlapCenterX(a, b)
          const lxBM = calcOverlapCenterX(b, snappedMoving)
          verticalGapLines = [
            {
              axis: 'y',
              x1: lxAB,
              y1: aBottom,
              x2: lxAB,
              y2: bTop,
              size: gapAB,
            },
            {
              axis: 'y',
              x1: lxBM,
              y1: b.y + b.h,
              x2: lxBM,
              y2: snappedMoving.y,
              size: gapAB,
            },
          ]
        }

        // Scenario 2: Moving is above A (Sequence Moving -> A -> B)
        // Moving bottom should be at gapAB above A
        const targetMovingY2 = a.y - movingBox.h - gapAB
        const dist2 = Math.abs(movingBox.y - targetMovingY2)
        if (dist2 <= tolerance && dist2 < minDyDist) {
          minDyDist = dist2
          bestDy = targetMovingY2 - movingBox.y
          const snappedMoving = { ...movingBox, y: targetMovingY2 }
          const lxMA = calcOverlapCenterX(snappedMoving, a)
          const lxAB = calcOverlapCenterX(a, b)
          verticalGapLines = [
            {
              axis: 'y',
              x1: lxMA,
              y1: snappedMoving.y + snappedMoving.h,
              x2: lxMA,
              y2: a.y,
              size: gapAB,
            },
            {
              axis: 'y',
              x1: lxAB,
              y1: aBottom,
              x2: lxAB,
              y2: bTop,
              size: gapAB,
            },
          ]
        }

        // Scenario 3: Moving is between A and B (Sequence A -> Moving -> B)
        const totalSpace = bTop - aBottom
        if (totalSpace > movingBox.h) {
          const equalGap = (totalSpace - movingBox.h) / 2
          if (equalGap > 0) {
            const idealMovingY3 = aBottom + equalGap
            const dist3 = Math.abs(movingBox.y - idealMovingY3)
            if (dist3 <= tolerance && dist3 < minDyDist) {
              minDyDist = dist3
              bestDy = idealMovingY3 - movingBox.y
              const snappedMoving = { ...movingBox, y: idealMovingY3 }
              const lxAM = calcOverlapCenterX(a, snappedMoving)
              const lxMB = calcOverlapCenterX(snappedMoving, b)
              verticalGapLines = [
                {
                  axis: 'y',
                  x1: lxAM,
                  y1: aBottom,
                  x2: lxAM,
                  y2: snappedMoving.y,
                  size: equalGap,
                },
                {
                  axis: 'y',
                  x1: lxMB,
                  y1: snappedMoving.y + snappedMoving.h,
                  x2: lxMB,
                  y2: bTop,
                  size: equalGap,
                },
              ]
            }
          }
        }
      }
    }

    // -------------------------------------------------------------
    // HORIZONTAL GAP SNAPPING (X AXIS)
    // -------------------------------------------------------------
    // Find candidate pairs (A, B) where A is to the left of B and they are vertically aligned
    for (let i = 0; i < candidates.length; i++) {
      const a = candidates[i]
      for (let j = 0; j < candidates.length; j++) {
        if (i === j) continue
        const b = candidates[j]

        // A must be to the left of B
        const aRight = a.x + a.w
        const bLeft = b.x
        const gapAB = bLeft - aRight

        if (gapAB <= 0) continue
        if (!isVerticalAligned(a, b)) continue

        // Check if there is another candidate between A and B
        const hasIntervening = candidates.some((k, idx) => {
          if (idx === i || idx === j) return false
          const kRight = k.x + k.w
          return k.x >= aRight && kRight <= bLeft && isVerticalAligned(a, k)
        })
        if (hasIntervening) continue

        // Check if moving element is vertically aligned with this pair
        if (!isVerticalAligned(movingBox, a) && !isVerticalAligned(movingBox, b)) {
          continue
        }

        // Scenario 1: Moving is to the right of B (Sequence A -> B -> Moving)
        const targetMovingX1 = b.x + b.w + gapAB
        const dist1 = Math.abs(movingBox.x - targetMovingX1)
        if (dist1 <= tolerance && dist1 < minDxDist) {
          minDxDist = dist1
          bestDx = targetMovingX1 - movingBox.x
          const snappedMoving = { ...movingBox, x: targetMovingX1 }
          const lyAB = calcOverlapCenterY(a, b)
          const lyBM = calcOverlapCenterY(b, snappedMoving)
          horizontalGapLines = [
            {
              axis: 'x',
              x1: aRight,
              y1: lyAB,
              x2: bLeft,
              y2: lyAB,
              size: gapAB,
            },
            {
              axis: 'x',
              x1: b.x + b.w,
              y1: lyBM,
              x2: snappedMoving.x,
              y2: lyBM,
              size: gapAB,
            },
          ]
        }

        // Scenario 2: Moving is to the left of A (Sequence Moving -> A -> B)
        const targetMovingX2 = a.x - movingBox.w - gapAB
        const dist2 = Math.abs(movingBox.x - targetMovingX2)
        if (dist2 <= tolerance && dist2 < minDxDist) {
          minDxDist = dist2
          bestDx = targetMovingX2 - movingBox.x
          const snappedMoving = { ...movingBox, x: targetMovingX2 }
          const lyMA = calcOverlapCenterY(snappedMoving, a)
          const lyAB = calcOverlapCenterY(a, b)
          horizontalGapLines = [
            {
              axis: 'x',
              x1: snappedMoving.x + snappedMoving.w,
              y1: lyMA,
              x2: a.x,
              y2: lyMA,
              size: gapAB,
            },
            {
              axis: 'x',
              x1: aRight,
              y1: lyAB,
              x2: bLeft,
              y2: lyAB,
              size: gapAB,
            },
          ]
        }

        // Scenario 3: Moving is between A and B (Sequence A -> Moving -> B)
        const totalSpace = bLeft - aRight
        if (totalSpace > movingBox.w) {
          const equalGap = (totalSpace - movingBox.w) / 2
          if (equalGap > 0) {
            const idealMovingX3 = aRight + equalGap
            const dist3 = Math.abs(movingBox.x - idealMovingX3)
            if (dist3 <= tolerance && dist3 < minDxDist) {
              minDxDist = dist3
              bestDx = idealMovingX3 - movingBox.x
              const snappedMoving = { ...movingBox, x: idealMovingX3 }
              const lyAM = calcOverlapCenterY(a, snappedMoving)
              const lyMB = calcOverlapCenterY(snappedMoving, b)
              horizontalGapLines = [
                {
                  axis: 'x',
                  x1: aRight,
                  y1: lyAM,
                  x2: snappedMoving.x,
                  y2: lyAM,
                  size: equalGap,
                },
                {
                  axis: 'x',
                  x1: snappedMoving.x + snappedMoving.w,
                  y1: lyMB,
                  x2: bLeft,
                  y2: lyMB,
                  size: equalGap,
                },
              ]
            }
          }
        }
      }
    }
  }

  return {
    dx: bestDx,
    dy: bestDy,
    gaps: [...verticalGapLines, ...horizontalGapLines],
  }
}
