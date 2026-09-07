import {
  Type, Shapes, Sticker, Image as ImageIcon, Layers as LayersIcon, Palette,
  Copy, Trash2, Wand2, Droplets, AlignLeft, Bold, PaintBucket, Square,
  ArrowUp, ArrowDown, Scissors, Crop,
} from 'lucide-react'
import { useEditor } from '#/store/editor'

type Item = { key: string; label: string; icon: React.ReactNode; onClick?: () => void; danger?: boolean }

export default function Toolbar() {
  const { selected, openTool, deleteLayer, duplicate, reorder } = useEditor()

  let items: Item[] = []

  if (!selected) {
    items = [
      { key: 'text', label: 'Text', icon: <Type /> },
      { key: 'elements', label: 'Elements', icon: <Shapes /> },
      { key: 'stickers', label: 'Stickers', icon: <Sticker /> },
      { key: 'image', label: 'Image', icon: <ImageIcon /> },
      { key: 'background', label: 'Background', icon: <Palette /> },
      { key: 'layers', label: 'Layers', icon: <LayersIcon /> },
    ]
  } else {
    const common: Item[] = [
      { key: 'animate', label: 'Animate', icon: <Wand2 /> },
      { key: 'opacity', label: 'Opacity', icon: <Droplets /> },
      { key: 'up', label: 'Forward', icon: <ArrowUp />, onClick: () => reorder(selected.id, 1) },
      { key: 'down', label: 'Back', icon: <ArrowDown />, onClick: () => reorder(selected.id, -1) },
      { key: 'dup', label: 'Duplicate', icon: <Copy />, onClick: () => duplicate(selected.id) },
      { key: 'del', label: 'Delete', icon: <Trash2 />, onClick: () => deleteLayer(selected.id), danger: true },
    ]
    if (selected.type === 'text') {
      items = [
        { key: 'font', label: 'Font', icon: <Type /> },
        { key: 'color', label: 'Color', icon: <PaintBucket /> },
        { key: 'style', label: 'Style', icon: <Bold /> },
        { key: 'align', label: 'Align', icon: <AlignLeft /> },
        ...common,
      ]
    } else if (selected.type === 'shape') {
      items = [
        { key: 'shape', label: 'Shape', icon: <Square /> },
        { key: 'color', label: 'Fill', icon: <PaintBucket /> },
        { key: 'radius', label: 'Corners', icon: <Square /> },
        { key: 'mask', label: 'Mask', icon: <Scissors /> },
        ...common,
      ]
    } else if (selected.type === 'image') {
      items = [
        { key: 'image', label: 'Replace', icon: <ImageIcon /> },
        { key: 'crop', label: 'Crop', icon: <Crop /> },
        { key: 'mask', label: 'Mask', icon: <Scissors /> },
        ...common,
      ]
    } else {
      items = [{ key: 'stickers', label: 'Replace', icon: <Sticker /> }, ...common]
    }
  }

  return (
    <div className="flex h-16 shrink-0 items-center gap-1 overflow-x-auto border-t border-line bg-toolbar px-2 no-scrollbar" data-testid="toolbar">
      {items.map((it) => (
        <button
          key={it.key}
          data-testid={`tool-${it.key}`}
          onClick={() => (it.onClick ? it.onClick() : openTool(it.key))}
          className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-xl transition-colors active:bg-surface2 ${
            it.danger ? 'text-danger' : 'text-txt'
          }`}
        >
          <span className="[&>svg]:h-5 [&>svg]:w-5">{it.icon}</span>
          <span className="text-[10px] font-medium">{it.label}</span>
        </button>
      ))}
    </div>
  )
}
