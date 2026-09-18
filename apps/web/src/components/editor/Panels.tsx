import { useRef, useState, useEffect } from 'react'
import {
  X, Upload, Type as TypeIcon, Folder, FolderPlus,
  Component as ComponentIcon, ChevronRight, ChevronDown, Plus, Trash2,
  Lock, Unlock,
} from 'lucide-react'
import { useEditor } from '#/store/editor'
import type { ShapeKind, Layer } from '#/types'
import {
  FONTS, PALETTE, GRADIENTS, BG_IMAGES, STOCK_IMAGES, STICKERS, SHAPES,
} from '#/lib/data'
import { getLibraryComponents, deleteComponentFromLibrary, type ComponentItem } from '#/lib/groups'

const TITLES: Record<string, string> = {
  text: 'Add Text', elements: 'Elements', stickers: 'Stickers', image: 'Image',
  components: 'Components Library',
  background: 'Background', layers: 'Layers', font: 'Font', color: 'Color',
  style: 'Text Style', align: 'Alignment', shape: 'Shape', radius: 'Corner Radius',
  animate: 'Animation', mask: 'Mask & Cut', crop: 'Crop',
}

export default function ToolSheet() {
  const { tool, openTool } = useEditor()
  if (!tool) return null
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end" data-testid="tool-sheet">
      <div className="absolute inset-0 bg-black/40 animate-fade" onClick={() => openTool(null)} />
      <div className="animate-sheet relative max-h-[70vh] overflow-y-auto rounded-t-3xl border-t border-line bg-surface pb-8 no-scrollbar">
        <div className="sticky top-0 flex items-center justify-between bg-surface px-5 pt-4 pb-3 z-10">
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
  const needsLayer = ['font', 'color', 'style', 'align', 'shape', 'radius', 'animate', 'mask', 'crop']
  if (needsLayer.includes(tool) && !selected) {
    return <MockPanel text="Select a layer on the canvas first." />
  }
  switch (tool) {
    case 'text': return <TextAdd />
    case 'elements': return <Elements />
    case 'stickers': return <Stickers />
    case 'image': return <Images />
    case 'components': return <ComponentsPanel />
    case 'background': return <BackgroundPanel />
    case 'layers': return <LayersPanel />
    case 'font': return <FontPanel />
    case 'color': return <ColorPanel />
    case 'style': return <StylePanel />
    case 'align': return <AlignPanel />
    case 'shape': return <ShapePanel />
    case 'radius': return <RadiusPanel />
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

  const isImageSelected = Boolean(selected && selected.type === 'image')
  const isLocked = isImageSelected ? Boolean(selected?.lockProportions) : false

  return (
    <div className="pb-4">
      {isImageSelected && selected && (
        <div
          id="image-lock-proportions-container"
          data-testid="image-lock-proportions-container"
          className="mb-4 flex items-center justify-between rounded-2xl border border-line bg-surface2 px-4 py-3"
        >
          <div className="flex items-center gap-2.5">
            <div className={`grid h-8 w-8 place-items-center rounded-xl transition-colors ${isLocked ? 'bg-accent/20 text-accent' : 'bg-surface text-txt3'}`}>
              {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            </div>
            <div>
              <div className="text-sm font-semibold text-txt">Lock proportions</div>
              <div className="text-[11px] text-txt3">Maintain aspect ratio while resizing</div>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isLocked}
            id="lock-proportions-toggle"
            data-testid="lock-proportions-toggle"
            aria-label={isLocked ? 'Unlock proportions' : 'Lock proportions'}
            title={isLocked ? 'Unlock proportions' : 'Lock proportions'}
            onClick={() => {
              const next = !isLocked
              updateLayer(selected.id, {
                lockProportions: next,
                ...(next ? { aspectRatio: selected.h > 0 ? selected.w / selected.h : 1 } : {}),
              })
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isLocked ? 'bg-accent' : 'bg-surface'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                isLocked ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      )}
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
            <img src={src} alt="" draggable={false} className="pointer-events-none h-full w-full select-none object-cover" />
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

/* ---------- Components Panel ---------- */
function ComponentsPanel() {
  const { selected, selectedIds, insertComponent, saveAsComponent, openTool } = useEditor()
  const [components, setComponents] = useState<ComponentItem[]>([])
  const [newCompName, setNewCompName] = useState('')
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null)

  const reload = () => {
    setComponents(getLibraryComponents())
  }

  useEffect(() => {
    reload()
  }, [])

  const handleSaveCurrent = () => {
    const name = newCompName.trim() || 'New Component'
    saveAsComponent(name, selected?.type === 'group' ? selected.id : undefined)
    setNewCompName('')
    setSavedFeedback(`"${name}" saved to library!`)
    reload()
    setTimeout(() => setSavedFeedback(null), 2500)
  }

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    deleteComponentFromLibrary(id)
    reload()
  }

  const handleInsert = (c: ComponentItem) => {
    insertComponent(c)
    openTool(null)
  }

  const customComponents = components.filter((c) => !c.id.startsWith('stock-'))
  const stockComponents = components.filter((c) => c.id.startsWith('stock-'))
  const hasSelection = selectedIds.length > 0 || selected != null

  return (
    <div className="space-y-4 pb-6">
      {/* Save Selection Card */}
      <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-3.5 space-y-2.5">
        <div className="flex items-center gap-2">
          <ComponentIcon className="h-4 w-4 text-purple-400" />
          <span className="text-xs font-semibold text-purple-200">
            {hasSelection ? 'Save Selection as Reusable Component' : 'Create Component'}
          </span>
        </div>
        <p className="text-[11px] text-txt3 leading-relaxed">
          Components preserve all included elements, hierarchy, styles, and animation effects for reuse across creatives.
        </p>
        {hasSelection ? (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Component name (e.g. Header Banner)"
              value={newCompName}
              onChange={(e) => setNewCompName(e.target.value)}
              className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-txt placeholder:text-txt3 focus:border-purple-400 focus:outline-none"
            />
            <button
              onClick={handleSaveCurrent}
              className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-500 active:scale-95 transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              Save
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-txt3 italic">
            Select one or more layers on the canvas to save them as a component.
          </p>
        )}
        {savedFeedback && (
          <p className="text-xs font-medium text-emerald-400 animate-fade">{savedFeedback}</p>
        )}
      </div>

      {/* User Saved Custom Components */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-txt3">Saved in Library</h4>
          <span className="text-[11px] text-txt3">{customComponents.length} custom</span>
        </div>

        {customComponents.length === 0 ? (
          <div className="rounded-xl border border-line/60 bg-surface2/50 p-4 text-center">
            <p className="text-xs text-txt3">No custom components saved yet</p>
            <p className="text-[11px] text-txt3/70 mt-1">Multi-select elements and click "Make Component" to save here.</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {customComponents.map((c) => {
              const anims = Array.from(
                new Set(c.layers.map((l: Layer) => l.anim).filter((a) => Boolean(a && a !== 'none')))
              )
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-line bg-surface2 p-3 hover:border-purple-400/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <ComponentIcon className="h-3.5 w-3.5 text-purple-400" />
                      <span className="text-xs font-semibold text-white">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-txt3">
                        {c.layers.length} elements
                      </span>
                      {anims.map((a: string) => (
                        <span key={a} className="rounded bg-purple-950/60 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 text-[10px]">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleInsert(c)}
                      className="flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 active:scale-95 transition-all"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Insert
                    </button>
                    <button
                      onClick={(e) => handleDelete(c.id, e)}
                      className="p-1.5 text-txt3 hover:text-danger rounded-lg transition-colors"
                      title="Delete component from library"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Preset Starter Components */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-txt3">Preset Components</h4>
          <span className="text-[11px] text-txt3">{stockComponents.length} templates</span>
        </div>
        <div className="grid gap-2">
          {stockComponents.map((c) => {
            const anims = Array.from(
              new Set(c.layers.map((l: Layer) => l.anim).filter((a) => Boolean(a && a !== 'none')))
            )
            return (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-line bg-surface2 p-3 hover:border-indigo-400/50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ComponentIcon className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="text-xs font-semibold text-white">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-txt3">
                      {c.layers.length} elements
                    </span>
                    {anims.map((a: string) => (
                      <span key={a} className="rounded bg-indigo-950/60 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 text-[10px]">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleInsert(c)}
                  className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 active:scale-95 transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Insert
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ---------- Layers ---------- */
function LayersPanel() {
  const {
    project, selectedId, selectedIds, select, updateLayer, deleteLayer,
    reorder, createGroup, ungroup, saveAsComponent, toggleGroupCollapse,
  } = useEditor()

  const label = (l: any) =>
    l.type === 'text' ? (l.text || 'Text').slice(0, 18) : l.type === 'sticker' ? `Sticker ${l.emoji}` : l.name

  // Hierarchical list of layers
  const layerMap = new Map(project.layers.map((l) => [l.id, l]))
  const rootLayers = project.layers.filter((l) => !l.groupId || !layerMap.has(l.groupId)).reverse()

  const renderNode = (layer: any, depth: number) => {
    const isGroup = layer.type === 'group'
    const isComponent = Boolean(layer.isComponent)
    const children = project.layers.filter((l: any) => l.groupId === layer.id).reverse()
    const isSelected = selectedId === layer.id || selectedIds.includes(layer.id)
    const collapsed = Boolean(layer.collapsed)

    return (
      <div key={layer.id} className="space-y-1">
        <div
          data-testid={`layer-row-${layer.id}`}
          onClick={() => select(layer.id)}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors cursor-pointer ${
            isSelected
              ? isComponent
                ? 'border-purple-500 bg-purple-950/30'
                : isGroup
                  ? 'border-indigo-500 bg-indigo-950/30'
                  : 'border-accent bg-accent/10'
              : 'border-line bg-surface2 hover:border-white/20'
          }`}
          style={{ marginLeft: `${depth * 16}px` }}
        >
          {isGroup && children.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleGroupCollapse(layer.id)
              }}
              className="p-0.5 text-txt3 hover:text-white"
            >
              {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}

          {isComponent ? (
            <ComponentIcon className="h-4 w-4 text-purple-400 shrink-0" />
          ) : isGroup ? (
            <Folder className="h-4 w-4 text-indigo-400 shrink-0" />
          ) : (
            <span
              className="h-4 w-4 rounded-md shrink-0"
              style={{ background: layer.type === 'shape' ? layer.fill : layer.type === 'text' ? layer.color : '#3B82F6' }}
            />
          )}

          <span className="flex-1 truncate text-xs font-medium">
            {label(layer)}
          </span>

          {isGroup && (
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                isComponent ? 'bg-purple-500/30 text-purple-200' : 'bg-indigo-500/30 text-indigo-200'
              }`}
            >
              {isComponent ? 'COMPONENT' : 'GROUP'}
            </span>
          )}

          {isGroup && (
            <button
              data-testid={`ungroup-${layer.id}`}
              onClick={(e) => {
                e.stopPropagation()
                ungroup(layer.id)
              }}
              className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-txt2 hover:text-white"
              title="Ungroup"
            >
              Ungroup
            </button>
          )}

          <button
            data-testid={`layer-vis-${layer.id}`}
            onClick={(e) => {
              e.stopPropagation()
              updateLayer(layer.id, { visible: !layer.visible })
            }}
            className="px-1 text-xs text-txt2 hover:text-white"
          >
            {layer.visible ? 'Hide' : 'Show'}
          </button>
          <button
            data-testid={`layer-up-${layer.id}`}
            onClick={(e) => {
              e.stopPropagation()
              reorder(layer.id, 1)
            }}
            className="px-1 text-xs text-txt2 hover:text-white"
            title="Move up"
          >
            ↑
          </button>
          <button
            data-testid={`layer-down-${layer.id}`}
            onClick={(e) => {
              e.stopPropagation()
              reorder(layer.id, -1)
            }}
            className="px-1 text-xs text-txt2 hover:text-white"
            title="Move down"
          >
            ↓
          </button>
          <button
            data-testid={`layer-del-${layer.id}`}
            onClick={(e) => {
              e.stopPropagation()
              deleteLayer(layer.id)
            }}
            className="px-1 text-xs text-danger"
            title="Delete"
          >
            ✕
          </button>
        </div>

        {isGroup && !collapsed && (
          <div className="space-y-1">
            {children.map((child: any) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2 pb-4">
      {/* Top actions if multi-selected */}
      {selectedIds.length > 1 && (
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => createGroup()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm active:scale-95 transition-all"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            Group Selected ({selectedIds.length})
          </button>
          <button
            onClick={() => {
              const name = prompt('Component name:', 'New Component') || 'New Component'
              saveAsComponent(name)
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm active:scale-95 transition-all"
          >
            <ComponentIcon className="h-3.5 w-3.5" />
            Make Component
          </button>
        </div>
      )}

      {rootLayers.length === 0 && <p className="py-8 text-center text-sm text-txt3">No layers yet</p>}
      {rootLayers.map((root) => renderNode(root, 0))}
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
  const { selected, selectedIds, updateLayers } = useEditor()
  const l = selected!
  const key = l.type === 'shape' ? 'fill' : 'color'
  const cur = (l as any)[key]
  const up = (patch: Record<string, string>) => updateLayers(selectedIds, patch)
  return (
  <>
  <div className="pb-1">
  <Grid cols={6}>
  {PALETTE.map((c) => (
  <button key={c} data-testid={`color-${c}`} onClick={() => up({ [key]: c })}
  style={{ background: c }}
  className={`aspect-square rounded-full border-2 transition-transform active:scale-90 ${cur === c ? 'border-accent ring-2 ring-accent/40' : 'border-line'}`} />
  ))}
  </Grid>
  </div>
  <Slider label="Opacity" tid="slider-opacity" value={(l.opacity ?? 1) * 100} min={0} max={100} suffix="%" onChange={(v: number) => updateLayers(selectedIds, { opacity: v / 100 })} />
  </>
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


  function AnimatePanel() {
  const { l, up } = useSel()
  const { setMode, animationSide, setAnimationSide } = useEditor()
  const anims = [
  { k: 'none', label: 'None' }, { k: 'fade', label: animationSide === 'in' ? 'Fade In' : 'Fade Out' }, { k: 'rise', label: 'Rise Up' },
  { k: 'pop', label: 'Pop' }, { k: 'slide', label: animationSide === 'in' ? 'Slide In' : 'Slide Out' }, { k: 'blur', label: 'Blur' },
  ]
  const current = animationSide === 'in' ? (l.inAnim || l.anim || 'none') : (l.outAnim || 'none')
  return (
  <div className="pb-4">
  <div className="mb-4 flex rounded-xl bg-surface2 p-1">
  {(['in', 'out'] as const).map((side) => (
  <button key={side} type="button" onClick={() => setAnimationSide(side)} className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${animationSide === side ? 'bg-accent text-white' : 'text-txt3'}`}>
  {side === 'in' ? 'In-animation' : 'Out-animation'}
  </button>
  ))}
  </div>
  <p className="mb-3 text-sm text-txt2">Choose the {animationSide === 'in' ? 'entrance' : 'exit'} animation for this layer. The timeline edge opens this editor directly.</p>
  <Grid cols={2}>
  {anims.map((a) => (
  <button key={a.k} data-testid={`anim-${animationSide}-${a.k}`} type="button"
  onClick={() => { up(animationSide === 'in' ? { anim: a.k, inAnim: a.k } : { outAnim: a.k }); if (a.k !== 'none') setMode('animated') }}
  className={`rounded-2xl border py-5 text-sm font-semibold ${current === a.k ? 'border-accent bg-accent/10 text-white' : 'border-line bg-surface2 text-txt2'}`}>
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
