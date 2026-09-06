import { useRef } from 'react'
import { X, Upload, Type as TypeIcon } from 'lucide-react'
import { useEditor } from '#/store/editor'
import type { ShapeKind } from '#/types'
import {
  FONTS, PALETTE, GRADIENTS, BG_IMAGES, STOCK_IMAGES, STICKERS, SHAPES,
} from '#/lib/data'

const TITLES: Record<string, string> = {
  text: 'Add Text', elements: 'Elements', stickers: 'Stickers', image: 'Image',
  background: 'Background', layers: 'Layers', font: 'Font', color: 'Color',
  style: 'Text Style', align: 'Alignment', shape: 'Shape', radius: 'Corner Radius',
  opacity: 'Opacity', animate: 'Animation', mask: 'Mask & Cut', crop: 'Crop',
}

export default function ToolSheet() {
  const { tool, openTool } = useEditor()
  if (!tool) return null
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end" data-testid="tool-sheet">
      <div className="absolute inset-0 bg-black/40 animate-fade" onClick={() => openTool(null)} />
      <div className="animate-sheet relative max-h-[70vh] overflow-y-auto rounded-t-3xl border-t border-line bg-surface pb-8 no-scrollbar">
        <div className="sticky top-0 flex items-center justify-between bg-surface px-5 pt-4 pb-3">
          <h3 className="text-lg font-bold">{TITLES[tool] || 'Options'}</h3>
          <button onClick={() => openTool(null)} data-testid="sheet-close" className="grid h-8 w-8 place-items-center rounded-full bg-surface2 text-txt2">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5">
          <PanelBody tool={tool} />
        </div>
      </div>
    </div>
  )
}

function PanelBody({ tool }: { tool: string }) {
  const { selected } = useEditor()
  const needsLayer = ['font', 'color', 'style', 'align', 'shape', 'radius', 'opacity', 'animate', 'mask', 'crop']
  if (needsLayer.includes(tool) && !selected) {
    return <MockPanel text="Select a layer on the canvas first." />
  }
  switch (tool) {
    case 'text': return <TextAdd />
    case 'elements': return <Elements />
    case 'stickers': return <Stickers />
    case 'image': return <Images />
    case 'background': return <BackgroundPanel />
    case 'layers': return <LayersPanel />
    case 'font': return <FontPanel />
    case 'color': return <ColorPanel />
    case 'style': return <StylePanel />
    case 'align': return <AlignPanel />
    case 'shape': return <ShapePanel />
    case 'radius': return <RadiusPanel />
    case 'opacity': return <OpacityPanel />
    case 'animate': return <AnimatePanel />
    case 'mask': return <MaskPanel />
    case 'crop': return <MockPanel text="Pinch & drag on canvas to crop — full crop tool coming with the backend." />
    default: return null
  }
}

/* ---------- Grid helper ---------- */
function Grid({ children, cols = 4 }: { children: React.ReactNode; cols?: number }) {
  return <div className={`grid gap-3 pb-4`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>{children}</div>
}

/* ---------- Add panels ---------- */
function TextAdd() {
  const { addLayer, project } = useEditor()
  const presets = [
    { label: 'Add a heading', size: 0.11, weight: 800 },
    { label: 'Add a subheading', size: 0.07, weight: 700 },
    { label: 'Add body text', size: 0.045, weight: 500 },
  ]
  return (
    <div className="space-y-3 pb-4">
      {presets.map((p) => (
        <button
          key={p.label}
          data-testid={`add-text-${p.weight}`}
          onClick={() => addLayer('text', { text: p.label, fontSize: Math.round(project.preset.w * p.size), fontWeight: p.weight })}
          className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface2 px-4 py-4 text-left transition-colors active:border-accent"
          style={{ fontWeight: p.weight, fontSize: 16 + (p.weight - 500) / 30 }}
        >
          <TypeIcon className="h-5 w-5 text-txt2" />
          {p.label}
        </button>
      ))}
    </div>
  )
}

function Elements() {
  const { addLayer } = useEditor()
  const labels: Record<ShapeKind, string> = { rect: 'Square', circle: 'Circle', triangle: 'Triangle', star: 'Star', line: 'Line' }
  return (
    <Grid cols={3}>
      {SHAPES.map((s) => (
        <button
          key={s}
          data-testid={`add-shape-${s}`}
          onClick={() => addLayer('shape', { shape: s })}
          className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-surface2 transition-colors active:border-accent"
        >
          <ShapeGlyph kind={s} />
          <span className="text-[11px] text-txt2">{labels[s]}</span>
        </button>
      ))}
    </Grid>
  )
}

function ShapeGlyph({ kind }: { kind: ShapeKind }) {
  const c = 'h-9 w-9 bg-white'
  if (kind === 'circle') return <div className={`${c} rounded-full`} />
  if (kind === 'triangle') return <div style={{ width: 0, height: 0, borderLeft: '18px solid transparent', borderRight: '18px solid transparent', borderBottom: '32px solid #fff' }} />
  if (kind === 'star') return <div className="h-9 w-9 bg-white" style={{ clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' }} />
  if (kind === 'line') return <div className="h-1.5 w-9 rounded bg-white" />
  return <div className={`${c} rounded-md`} />
}

function Stickers() {
  const { selected, addLayer, updateLayer, openTool } = useEditor()
  const pick = (emoji: string) => {
    if (selected && selected.type === 'sticker') { updateLayer(selected.id, { emoji }); openTool(null) }
    else addLayer('sticker', { emoji })
  }
  return (
    <Grid cols={5}>
      {STICKERS.map((s) => (
        <button
          key={s}
          data-testid={`sticker-${s}`}
          onClick={() => pick(s)}
          className="grid aspect-square place-items-center rounded-2xl border border-line bg-surface2 text-3xl transition-colors active:border-accent"
        >
          {s}
        </button>
      ))}
    </Grid>
  )
}

function Images() {
  const { selected, addLayer, updateLayer, openTool } = useEditor()
  const fileRef = useRef<HTMLInputElement>(null)
  const apply = (src: string) => {
    if (selected && selected.type === 'image') { updateLayer(selected.id, { src }); openTool(null) }
    else addLayer('image', { src })
  }
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const r = new FileReader()
    r.onload = () => apply(r.result as string)
    r.readAsDataURL(f)
  }
  return (
    <div className="pb-4">
      <button
        onClick={() => fileRef.current?.click()}
        data-testid="upload-image-btn"
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong bg-surface2 py-4 text-sm font-semibold text-txt2 active:border-accent"
      >
        <Upload className="h-4 w-4" /> Upload from device
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} data-testid="file-input" />
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-txt3">Stock</p>
      <Grid cols={3}>
        {STOCK_IMAGES.map((src, i) => (
          <button
            key={i}
            data-testid={`stock-image-${i}`}
            onClick={() => apply(src)}
            className="aspect-square overflow-hidden rounded-xl border border-line active:border-accent"
          >
            <img src={src} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </Grid>
    </div>
  )
}

/* ---------- Background ---------- */
function BackgroundPanel() {
  const { setBackground, project } = useEditor()
  const cur = project.background.value
  const Swatch = ({ active, onClick, style, tid, children }: any) => (
    <button onClick={onClick} data-testid={tid} style={style}
      className={`aspect-square rounded-xl border-2 transition-transform active:scale-95 ${active ? 'border-accent' : 'border-line'}`}>{children}</button>
  )
  return (
    <div className="space-y-5 pb-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-txt3">Solid</p>
        <Grid cols={6}>
          {PALETTE.map((c) => (
            <Swatch key={c} tid={`bg-color-${c}`} active={cur === c} onClick={() => setBackground({ type: 'color', value: c })} style={{ background: c }} />
          ))}
        </Grid>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-txt3">Gradient</p>
        <Grid cols={4}>
          {GRADIENTS.map((g, i) => (
            <Swatch key={i} tid={`bg-gradient-${i}`} active={cur === g} onClick={() => setBackground({ type: 'gradient', value: g })} style={{ backgroundImage: g }} />
          ))}
        </Grid>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-txt3">Image</p>
        <Grid cols={4}>
          {BG_IMAGES.map((src, i) => (
            <Swatch key={i} tid={`bg-image-${i}`} active={cur === src} onClick={() => setBackground({ type: 'image', value: src })}
              style={{ backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
          ))}
        </Grid>
      </div>
    </div>
  )
}

/* ---------- Layers ---------- */
function LayersPanel() {
  const { project, selectedId, select, updateLayer, deleteLayer, reorder } = useEditor()
  const layers = [...project.layers].reverse()
  const label = (l: any) => l.type === 'text' ? (l.text || 'Text').slice(0, 18) : l.type === 'sticker' ? `Sticker ${l.emoji}` : l.name
  return (
    <div className="space-y-2 pb-4">
      {layers.length === 0 && <p className="py-8 text-center text-sm text-txt3">No layers yet</p>}
      {layers.map((l) => (
        <div
          key={l.id}
          data-testid={`layer-row-${l.id}`}
          onClick={() => select(l.id)}
          className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${selectedId === l.id ? 'border-accent bg-accent/10' : 'border-line bg-surface2'}`}
        >
          <span className="h-6 w-6 rounded-md" style={{ background: l.type === 'shape' ? l.fill : l.type === 'text' ? l.color : '#3B82F6' }} />
          <span className="flex-1 truncate text-sm font-medium">{label(l)}</span>
          <button data-testid={`layer-vis-${l.id}`} onClick={(e) => { e.stopPropagation(); updateLayer(l.id, { visible: !l.visible }) }} className="px-1 text-xs text-txt2">{l.visible ? 'Hide' : 'Show'}</button>
          <button data-testid={`layer-up-${l.id}`} onClick={(e) => { e.stopPropagation(); reorder(l.id, 1) }} className="px-1 text-txt2">↑</button>
          <button data-testid={`layer-down-${l.id}`} onClick={(e) => { e.stopPropagation(); reorder(l.id, -1) }} className="px-1 text-txt2">↓</button>
          <button data-testid={`layer-del-${l.id}`} onClick={(e) => { e.stopPropagation(); deleteLayer(l.id) }} className="px-1 text-danger">✕</button>
        </div>
      ))}
    </div>
  )
}

/* ---------- Selected-layer panels ---------- */
function useSel() {
  const { selected, updateLayer } = useEditor()
  return { l: selected!, up: (patch: any) => selected && updateLayer(selected.id, patch) }
}

function FontPanel() {
  const { l, up } = useSel()
  return (
    <div className="space-y-2 pb-4">
      {FONTS.map((f) => (
        <button key={f} data-testid={`font-${f}`} onClick={() => up({ fontFamily: f })}
          style={{ fontFamily: f }}
          className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-lg ${l.fontFamily === f ? 'border-accent bg-accent/10' : 'border-line bg-surface2'}`}>
          <span>{f}</span>
          <span className="text-txt3">Ag</span>
        </button>
      ))}
    </div>
  )
}

function ColorPanel() {
  const { l, up } = useSel()
  const key = l.type === 'shape' ? 'fill' : 'color'
  const cur = (l as any)[key]
  return (
    <Grid cols={6}>
      {PALETTE.map((c) => (
        <button key={c} data-testid={`color-${c}`} onClick={() => up({ [key]: c })}
          style={{ background: c }}
          className={`aspect-square rounded-full border-2 transition-transform active:scale-90 ${cur === c ? 'border-accent ring-2 ring-accent/40' : 'border-line'}`} />
      ))}
    </Grid>
  )
}

function Slider({ label, value, min, max, step = 1, onChange, tid, suffix = '' }: any) {
  return (
    <div className="pb-5">
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-txt2">{label}</span>
        <span className="font-semibold">{Math.round(value)}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} data-testid={tid}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#007AFF]" />
    </div>
  )
}

function StylePanel() {
  const { l, up } = useSel()
  return (
    <div className="pb-4">
      <Slider label="Size" tid="slider-size" value={l.fontSize || 40} min={10} max={400} onChange={(v: number) => up({ fontSize: v })} />
      <Slider label="Weight" tid="slider-weight" value={l.fontWeight || 700} min={400} max={800} step={100} onChange={(v: number) => up({ fontWeight: v })} />
      <Slider label="Opacity" tid="slider-opacity-style" value={(l.opacity ?? 1) * 100} min={10} max={100} suffix="%" onChange={(v: number) => up({ opacity: v / 100 })} />
    </div>
  )
}

function AlignPanel() {
  const { l, up } = useSel()
  return (
    <div className="flex gap-3 pb-4">
      {(['left', 'center', 'right'] as const).map((a) => (
        <button key={a} data-testid={`align-${a}`} onClick={() => up({ align: a })}
          className={`flex-1 rounded-xl border py-4 text-sm font-semibold capitalize ${l.align === a ? 'border-accent bg-accent/10 text-white' : 'border-line bg-surface2 text-txt2'}`}>{a}</button>
      ))}
    </div>
  )
}

function ShapePanel() {
  const { l, up } = useSel()
  return (
    <Grid cols={3}>
      {SHAPES.map((s) => (
        <button key={s} data-testid={`swap-shape-${s}`} onClick={() => up({ shape: s })}
          className={`flex aspect-square items-center justify-center rounded-2xl border ${l.shape === s ? 'border-accent bg-accent/10' : 'border-line bg-surface2'}`}>
          <ShapeGlyph kind={s} />
        </button>
      ))}
    </Grid>
  )
}

function RadiusPanel() {
  const { l, up } = useSel()
  return <div className="pb-4"><Slider label="Corner radius" tid="slider-radius" value={l.radius || 0} min={0} max={200} onChange={(v: number) => up({ radius: v })} /></div>
}

function OpacityPanel() {
  const { l, up } = useSel()
  return <div className="pb-4"><Slider label="Opacity" tid="slider-opacity" value={(l.opacity ?? 1) * 100} min={0} max={100} suffix="%" onChange={(v: number) => up({ opacity: v / 100 })} /></div>
}

function AnimatePanel() {
  const { l, up } = useSel()
  const { setMode } = useEditor()
  const anims = [
    { k: 'none', label: 'None' }, { k: 'fade', label: 'Fade In' }, { k: 'rise', label: 'Rise Up' },
    { k: 'pop', label: 'Pop' }, { k: 'slide', label: 'Slide In' },
  ]
  return (
    <div className="pb-4">
      <p className="mb-3 text-sm text-txt2">Pick an entrance animation. Switches the project to <span className="font-semibold text-white">Animated</span> mode so you can preview on the timeline.</p>
      <Grid cols={2}>
        {anims.map((a) => (
          <button key={a.k} data-testid={`anim-${a.k}`}
            onClick={() => { up({ anim: a.k }); if (a.k !== 'none') setMode('animated') }}
            className={`rounded-2xl border py-5 text-sm font-semibold ${l.anim === a.k ? 'border-accent bg-accent/10 text-white' : 'border-line bg-surface2 text-txt2'}`}>
            {a.label}
          </button>
        ))}
      </Grid>
    </div>
  )
}

function MaskPanel() {
  const { l, up } = useSel()
  const masks = [
    { label: 'None', r: 0 }, { label: 'Rounded', r: 40 }, { label: 'Pill', r: 999 }, { label: 'Circle', r: 9999 },
  ]
  return (
    <div className="pb-4">
      <p className="mb-3 text-sm text-txt2">Masks clip your layer to a shape. Cut & merge (boolean) operations arrive with the backend.</p>
      <Grid cols={4}>
        {masks.map((m) => (
          <button key={m.label} data-testid={`mask-${m.label}`} onClick={() => up({ radius: m.r })}
            className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface2 py-3 active:border-accent">
            <div className="h-10 w-10 bg-white" style={{ borderRadius: m.r > 200 ? '9999px' : m.r }} />
            <span className="text-[11px] text-txt2">{m.label}</span>
          </button>
        ))}
      </Grid>
      <div className="mt-4 flex gap-3">
        <button data-testid="cut-btn" className="flex-1 rounded-xl border border-line bg-surface2 py-3 text-sm font-semibold text-txt2">Cut</button>
        <button data-testid="merge-btn" className="flex-1 rounded-xl border border-line bg-surface2 py-3 text-sm font-semibold text-txt2">Merge</button>
      </div>
      <p className="mt-2 text-center text-xs text-txt3">Current radius: {l.radius || 0}px</p>
    </div>
  )
}

function MockPanel({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-txt2">{text}</p>
}
