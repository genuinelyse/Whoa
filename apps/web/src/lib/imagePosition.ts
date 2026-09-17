export interface ImagePositionCoords {
  x: number // 0 to 100 percentage
  y: number // 0 to 100 percentage
}

export function parseImagePosition(pos?: string): ImagePositionCoords {
  if (!pos) return { x: 50, y: 50 }
  const p = pos.trim().toLowerCase()
  if (p === 'center top' || p === 'top center' || p === 'top') return { x: 50, y: 0 }
  if (p === 'center bottom' || p === 'bottom center' || p === 'bottom') return { x: 50, y: 100 }
  if (p === 'left center' || p === 'center left' || p === 'left') return { x: 0, y: 50 }
  if (p === 'right center' || p === 'center right' || p === 'right') return { x: 100, y: 50 }
  if (p === 'center center' || p === 'center' || p === 'mid') return { x: 50, y: 50 }

  const parts = p.split(/\s+/)
  if (parts.length >= 2) {
    let px = 50
    let py = 50
    if (parts[0].endsWith('%')) px = parseFloat(parts[0])
    else if (parts[0] === 'left') px = 0
    else if (parts[0] === 'right') px = 100
    else if (parts[0] === 'center') px = 50

    if (parts[1].endsWith('%')) py = parseFloat(parts[1])
    else if (parts[1] === 'top') py = 0
    else if (parts[1] === 'bottom') py = 100
    else if (parts[1] === 'center') py = 50

    return {
      x: isNaN(px) ? 50 : Math.min(100, Math.max(0, px)),
      y: isNaN(py) ? 50 : Math.min(100, Math.max(0, py)),
    }
  }
  return { x: 50, y: 50 }
}

export function formatImagePosition(x: number, y: number): string {
  const cx = Math.min(100, Math.max(0, Math.round(x * 10) / 10))
  const cy = Math.min(100, Math.max(0, Math.round(y * 10) / 10))
  return `${cx}% ${cy}%`
}

export function calcImagePositionDelta(
  startPos: ImagePositionCoords,
  dx: number,
  dy: number,
  boxW: number,
  boxH: number,
  naturalW?: number,
  naturalH?: number,
): ImagePositionCoords {
  const nw = naturalW && naturalW > 0 ? naturalW : boxW
  const nh = naturalH && naturalH > 0 ? naturalH : boxH

  // In object-fit: cover, the image scales to cover the entire container box:
  const scale = Math.max(boxW / nw, boxH / nh)
  const renderedW = nw * scale
  const renderedH = nh * scale

  const overflowX = Math.max(0, renderedW - boxW)
  const overflowY = Math.max(0, renderedH - boxH)

  // Direct manipulation: dragging right (dx > 0) pulls the photo right (so X% decreases towards 0% left edge)
  // Dragging down (dy > 0) pulls the photo down (so Y% decreases towards 0% top edge)
  let deltaPctX = 0
  if (overflowX > 1) {
    deltaPctX = -(dx / overflowX) * 100
  } else {
    deltaPctX = -(dx / (boxW || 100)) * 50
  }

  let deltaPctY = 0
  if (overflowY > 1) {
    deltaPctY = -(dy / overflowY) * 100
  } else {
    deltaPctY = -(dy / (boxH || 100)) * 50
  }

  return {
    x: Math.min(100, Math.max(0, Math.round((startPos.x + deltaPctX) * 10) / 10)),
    y: Math.min(100, Math.max(0, Math.round((startPos.y + deltaPctY) * 10) / 10)),
  }
}
