export type LayerType = 'text' | 'shape' | 'image' | 'sticker' | 'group'
export type ShapeKind = 'rect' | 'circle' | 'triangle' | 'star' | 'line'
export type BgType = 'color' | 'gradient' | 'image'

export interface Background {
  type: BgType
  value: string // hex, css-gradient, or image url
}

export interface Layer {
  id: string
  type: LayerType
  name: string
  x: number // px in artboard space (top-left)
  y: number
  w: number
  h: number
  rotation: number
  opacity: number
  visible: boolean
  locked: boolean
  start: number // ms
  end: number // ms
  anim: 'none' | 'fade' | 'rise' | 'pop' | 'slide'
  // text
  text?: string
  fontFamily?: string
  fontSize?: number
  fontWeight?: number
  color?: string
  align?: 'left' | 'center' | 'right'
  // shape
  shape?: ShapeKind
  fill?: string
  radius?: number
  // padding
  paddingTop?: number
  paddingRight?: number
  paddingBottom?: number
  paddingLeft?: number
  // image / sticker
  src?: string
  emoji?: string
  lockProportions?: boolean
  // group / component hierarchy
  groupId?: string
  isComponent?: boolean
  componentId?: string
  collapsed?: boolean
}

export interface Preset {
  id: string
  label: string
  w: number
  h: number
  category: string
  ratio: string
}

export interface Project {
  id: string
  name: string
  preset: Preset
  background: Background
  layers: Layer[]
  duration: number // ms
  mode: 'static' | 'animated'
  updatedAt: number
}
