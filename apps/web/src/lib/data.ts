import type { Preset, Project, Layer, LayerType, Background } from '#/types'

export const uid = () => Math.random().toString(36).slice(2, 10)

export const PRESET_CATEGORIES = [
  'Social Media',
  'Display Ads',
  'Posters',
  'Video Ads',
]

export const PRESETS: Preset[] = [
  // Social Media
  { id: 'ig-post', label: 'Instagram Post', w: 1080, h: 1080, category: 'Social Media', ratio: '1:1' },
  { id: 'ig-story', label: 'Instagram Story', w: 1080, h: 1920, category: 'Social Media', ratio: '9:16' },
  { id: 'fb-cover', label: 'Facebook Cover', w: 1640, h: 624, category: 'Social Media', ratio: '2.6:1' },
  { id: 'yt-thumb', label: 'YouTube Thumbnail', w: 1280, h: 720, category: 'Social Media', ratio: '16:9' },
  { id: 'x-header', label: 'X / Twitter Header', w: 1500, h: 500, category: 'Social Media', ratio: '3:1' },
  // Display Ads
  { id: 'ad-mrec', label: 'Medium Rectangle', w: 300, h: 250, category: 'Display Ads', ratio: '6:5' },
  { id: 'ad-lead', label: 'Leaderboard', w: 728, h: 90, category: 'Display Ads', ratio: '8:1' },
  { id: 'ad-sky', label: 'Wide Skyscraper', w: 160, h: 600, category: 'Display Ads', ratio: '4:15' },
  { id: 'ad-large', label: 'Large Rectangle', w: 336, h: 280, category: 'Display Ads', ratio: '6:5' },
  { id: 'ad-mobile', label: 'Mobile Banner', w: 320, h: 100, category: 'Display Ads', ratio: '16:5' },
  // Posters
  { id: 'poster-p', label: 'Poster Portrait', w: 1080, h: 1350, category: 'Posters', ratio: '4:5' },
  { id: 'poster-a4', label: 'A4 Flyer', w: 1240, h: 1754, category: 'Posters', ratio: 'A4' },
  // Video Ads
  { id: 'vid-full', label: 'Fullscreen Video', w: 1080, h: 1920, category: 'Video Ads', ratio: '9:16' },
  { id: 'vid-land', label: 'Landscape Video', w: 1920, h: 1080, category: 'Video Ads', ratio: '16:9' },
  { id: 'vid-sq', label: 'Square Video', w: 1080, h: 1080, category: 'Video Ads', ratio: '1:1' },
]

export const FONTS = [
  'Manrope',
  'IBM Plex Sans',
  'Playfair Display',
  'Georgia',
  'Impact',
  'Courier New',
  'Arial Black',
]

export const PALETTE = [
  '#FFFFFF', '#000000', '#FF3B30', '#FF9500', '#FFCC00', '#34C759',
  '#00C7BE', '#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#A1A1AA',
]

export const GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
  'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)',
  'linear-gradient(135deg, #0A0A0A 0%, #2b2b2b 100%)',
  'linear-gradient(135deg, #00b09b 0%, #96c93d 100%)',
]

export const BG_IMAGES = [
  'https://images.unsplash.com/photo-1635776062043-223faf322554?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzOTB8MHwxfHNlYXJjaHwzfHxhYnN0cmFjdCUyMHZpYnJhbnQlMjBncmFkaWVudCUyMGJhY2tncm91bmR8ZW58MHx8fHwxNzg3NDkxOTg1fDA&ixlib=rb-4.1.0&q=85',
  'https://images.unsplash.com/photo-1614849286521-4c58b2f0ff15?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzOTB8MHwxfHNlYXJjaHw0fHxhYnN0cmFjdCUyMHZpYnJhbnQlMjBncmFkaWVudCUyMGJhY2tncm91bmR8ZW58MHx8fHwxNzg3NDkxOTg1fDA&ixlib=rb-4.1.0&q=85',
  'https://images.unsplash.com/photo-1635776062127-d379bfcba9f8?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzOTB8MHwxfHNlYXJjaHwyfHxhYnN0cmFjdCUyMHZpYnJhbnQlMjBncmFkaWVudCUyMGJhY2tncm91bmR8ZW58MHx8fHwxNzg3NDkxOTg1fDA&ixlib=rb-4.1.0&q=85',
  'https://images.pexels.com/photos/6985132/pexels-photo-6985132.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
]

export const STOCK_IMAGES = [
  'https://images.unsplash.com/photo-1624281043172-16ff234c2a14?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwxfHxzdW1tZXIlMjBzYWxlJTIwZmFzaGlvbiUyMGxpZmVzdHlsZXxlbnwwfHx8fDE3ODc0OTE5ODV8MA&ixlib=rb-4.1.0&q=85',
  'https://images.pexels.com/photos/5622839/pexels-photo-5622839.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
  'https://images.pexels.com/photos/5625045/pexels-photo-5625045.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
  'https://images.unsplash.com/photo-1580828343064-fde4fc206bc6?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODR8MHwxfHNlYXJjaHwxfHxwcm9kdWN0JTIwbWFya2V0aW5nJTIwc2FsZSUyMHByb21vdGlvbnxlbnwwfHx8fDE3ODc0OTE5ODV8MA&ixlib=rb-4.1.0&q=85',
]

export const STICKERS = ['🔥', '⭐', '✨', '❤️', '👍', '🎉', '💯', '🏷️', '🛒', '⚡', '🎁', '📣', '💥', '✅', '👑', '🚀']

export const SHAPES = ['rect', 'circle', 'triangle', 'star', 'line'] as const

export function createLayer(type: LayerType, preset: Preset, extra: Partial<Layer> = {}): Layer {
  const base: Layer = {
    id: uid(),
    type,
    name: type[0].toUpperCase() + type.slice(1),
    x: preset.w * 0.2,
    y: preset.h * 0.35,
    w: preset.w * 0.6,
    h: preset.h * 0.2,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    start: 0,
    end: 5000,
    anim: 'none',
  }
  if (type === 'text') {
    Object.assign(base, {
      name: 'Text',
      text: 'Double-tap to edit',
      fontFamily: 'Manrope',
      fontSize: Math.round(preset.w * 0.075),
      fontWeight: 800,
      color: '#FFFFFF',
      align: 'center',
      h: Math.round(preset.w * 0.075 * 1.3),
      anim: 'rise',
    })
  } else if (type === 'shape') {
    const s = preset.w * 0.35
    Object.assign(base, {
      name: 'Shape',
      shape: 'rect',
      fill: '#007AFF',
      radius: 16,
      w: s,
      h: s,
      x: (preset.w - s) / 2,
      y: (preset.h - s) / 2,
      anim: 'pop',
    })
  } else if (type === 'image') {
    const w = preset.w * 0.55
    Object.assign(base, {
      name: 'Image',
      src: STOCK_IMAGES[0],
      w,
      h: w * 0.66,
      x: (preset.w - w) / 2,
      y: preset.h * 0.25,
      anim: 'fade',
    })
  } else if (type === 'sticker') {
    const s = preset.w * 0.22
    Object.assign(base, {
      name: 'Sticker',
      emoji: '🔥',
      w: s,
      h: s,
      x: (preset.w - s) / 2,
      y: (preset.h - s) / 2,
      anim: 'pop',
    })
  }
  Object.assign(base, extra)
  return base
}

export function newProject(preset: Preset, name?: string): Project {
  return {
    id: uid(),
    name: name || 'Untitled Banner',
    preset,
    background: { type: 'gradient', value: GRADIENTS[0] },
    layers: [],
    duration: 5000,
    mode: 'static',
    updatedAt: Date.now(),
  }
}

function findPreset(id: string) {
  return PRESETS.find((p) => p.id === id)!
}

// ---- Templates (open into ready-made projects) ----
export interface Template {
  id: string
  name: string
  presetId: string
  thumb: string
  build: () => Project
}

function tmpl(id: string, name: string, presetId: string, thumb: string, bg: Background, layers: (p: Preset) => Layer[], mode: 'static' | 'animated' = 'static'): Template {
  return {
    id,
    name,
    presetId,
    thumb,
    build: () => {
      const preset = findPreset(presetId)
      const p = newProject(preset, name)
      p.background = bg
      p.layers = layers(preset)
      p.mode = mode
      return p
    },
  }
}

export const TEMPLATES: Template[] = [
  tmpl('t-summer', 'Summer Sale', 'ig-post', GRADIENTS[3],
    { type: 'gradient', value: GRADIENTS[3] },
    (p) => [
      createLayer('text', p, { text: 'SUMMER', fontSize: Math.round(p.w * 0.18), fontWeight: 800, color: '#1a1a1a', y: p.h * 0.18, x: 0, w: p.w, align: 'center', anim: 'rise' }),
      createLayer('text', p, { text: 'SALE', fontSize: Math.round(p.w * 0.3), fontWeight: 800, color: '#FFFFFF', y: p.h * 0.34, x: 0, w: p.w, align: 'center', anim: 'pop', start: 300 }),
      createLayer('shape', p, { shape: 'rect', fill: '#1a1a1a', radius: 999, w: p.w * 0.5, h: p.h * 0.11, x: p.w * 0.25, y: p.h * 0.7, anim: 'slide', start: 600 }),
      createLayer('text', p, { text: 'UP TO 50% OFF', fontSize: Math.round(p.w * 0.05), fontWeight: 700, color: '#FFFFFF', y: p.h * 0.725, x: 0, w: p.w, align: 'center', start: 800 }),
    ], 'animated'),

  tmpl('t-yt', 'Gaming Thumbnail', 'yt-thumb', GRADIENTS[4],
    { type: 'gradient', value: GRADIENTS[4] },
    (p) => [
      createLayer('text', p, { text: 'EPIC WIN', fontSize: Math.round(p.w * 0.13), fontWeight: 800, color: '#FFCC00', x: p.w * 0.05, y: p.h * 0.2, w: p.w * 0.6, align: 'left' }),
      createLayer('text', p, { text: 'you won\'t believe #12', fontSize: Math.round(p.w * 0.05), fontWeight: 700, color: '#FFFFFF', x: p.w * 0.05, y: p.h * 0.52, w: p.w * 0.7, align: 'left' }),
      createLayer('sticker', p, { emoji: '🔥', w: p.w * 0.18, h: p.w * 0.18, x: p.w * 0.75, y: p.h * 0.3 }),
    ]),

  tmpl('t-mrec', 'Product Ad', 'ad-large', 'linear-gradient(135deg, #FF3B30 0%, #FF6B4A 100%)',
    { type: 'color', value: '#FF3B30' },
    (p) => [
      createLayer('image', p, { src: STOCK_IMAGES[2], w: p.w * 0.9, h: p.h * 0.5, x: p.w * 0.05, y: p.h * 0.06 }),
      createLayer('text', p, { text: 'Shop Now', fontSize: Math.round(p.w * 0.12), fontWeight: 800, color: '#FFFFFF', x: 0, y: p.h * 0.62, w: p.w, align: 'center' }),
      createLayer('shape', p, { shape: 'rect', fill: '#FFCC00', radius: 8, w: p.w * 0.5, h: p.h * 0.16, x: p.w * 0.25, y: p.h * 0.8 }),
    ]),

  tmpl('t-story', 'Story Promo', 'ig-story', GRADIENTS[1],
    { type: 'gradient', value: GRADIENTS[1] },
    (p) => [
      createLayer('text', p, { text: 'NEW\nDROP', fontSize: Math.round(p.w * 0.22), fontWeight: 800, color: '#FFFFFF', x: p.w * 0.08, y: p.h * 0.15, w: p.w * 0.8, align: 'left', anim: 'rise' }),
      createLayer('image', p, { src: STOCK_IMAGES[0], w: p.w * 0.7, h: p.w * 0.9, x: p.w * 0.15, y: p.h * 0.4, anim: 'fade', start: 300 }),
      createLayer('text', p, { text: 'Swipe up ↑', fontSize: Math.round(p.w * 0.06), fontWeight: 700, color: '#FFFFFF', x: 0, y: p.h * 0.9, w: p.w, align: 'center', start: 600 }),
    ], 'animated'),

  tmpl('t-poster', 'Event Poster', 'poster-p', GRADIENTS[2],
    { type: 'gradient', value: GRADIENTS[2] },
    (p) => [
      createLayer('text', p, { text: 'LIVE', fontSize: Math.round(p.w * 0.3), fontWeight: 800, color: '#0A0A0A', x: 0, y: p.h * 0.12, w: p.w, align: 'center' }),
      createLayer('text', p, { text: 'MUSIC FESTIVAL', fontSize: Math.round(p.w * 0.07), fontWeight: 700, color: '#FFFFFF', x: 0, y: p.h * 0.4, w: p.w, align: 'center' }),
      createLayer('shape', p, { shape: 'circle', fill: '#FFCC00', w: p.w * 0.3, h: p.w * 0.3, x: p.w * 0.35, y: p.h * 0.5 }),
      createLayer('text', p, { text: 'SAT · 8PM', fontSize: Math.round(p.w * 0.05), fontWeight: 700, color: '#FFFFFF', x: 0, y: p.h * 0.85, w: p.w, align: 'center' }),
    ]),

  tmpl('t-lead', 'Leaderboard Ad', 'ad-lead', GRADIENTS[0],
    { type: 'gradient', value: GRADIENTS[0] },
    (p) => [
      createLayer('text', p, { text: 'Free Shipping Today', fontSize: Math.round(p.h * 0.32), fontWeight: 800, color: '#FFFFFF', x: p.w * 0.03, y: p.h * 0.18, w: p.w * 0.6, align: 'left' }),
      createLayer('shape', p, { shape: 'rect', fill: '#FFCC00', radius: 6, w: p.w * 0.18, h: p.h * 0.55, x: p.w * 0.78, y: p.h * 0.22 }),
      createLayer('text', p, { text: 'GET IT', fontSize: Math.round(p.h * 0.22), fontWeight: 800, color: '#0A0A0A', x: p.w * 0.78, y: p.h * 0.33, w: p.w * 0.18, align: 'center' }),
    ]),
]

// ---- Sample recent projects for the Home screen ----
export function seedProjects(): Project[] {
  return [
    TEMPLATES[0].build(),
    TEMPLATES[3].build(),
    TEMPLATES[1].build(),
  ].map((p, i) => ({ ...p, name: ['Summer Sale', 'Autumn Drop', 'Stream Cover'][i], updatedAt: Date.now() - i * 86400000 }))
}
