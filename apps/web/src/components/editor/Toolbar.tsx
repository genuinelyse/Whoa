import {
  Type, Shapes, Sticker, Image as ImageIcon, Layers as LayersIcon, Palette,
  Copy, Trash2, Wand2, Droplets, AlignLeft, Bold, PaintBucket, Square,
  ArrowUp, ArrowDown, Scissors, Crop, FolderPlus, Ungroup, Component as ComponentIcon,
  AlignHorizontalJustifyStart, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignVerticalJustifyCenter,
  Magnet,
} from 'lucide-react'
import { useEditor } from '#/store/editor'

type Item = { key: string; label: string; icon: React.ReactNode; onClick?: () => void; danger?: boolean; accent?: boolean; active?: boolean }

export default function Toolbar() {
  const {
    project, selected, selectedIds, alignSelected, openTool, deleteLayer, duplicate, reorder,
    createGroup, ungroup, saveAsComponent, artboardSnap, setArtboardSnap,
  } = useEditor()

  let items: Item[] = []

  if (!selected) {
    items = [
      { key: 'text', label: 'Text', icon: <Type /> },
      { key: 'elements', label: 'Elements', icon: <Shapes /> },
      { key: 'stickers', label: 'Stickers', icon: <Sticker /> },
      { key: 'image', label: 'Image', icon: <ImageIcon /> },
      { key: 'components', label: 'Components', icon: <ComponentIcon /> },
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

    if (selected.type === 'group') {
      items = [
        {
          key: 'ungroup',
          label: 'Ungroup',
          icon: <Ungroup />,
          onClick: () => ungroup(selected.id),
        },
        {
          key: 'save-comp',
          label: selected.isComponent ? 'Save Lib' : 'Component',
          icon: <ComponentIcon />,
          accent: true,
          onClick: () => {
            const name = prompt('Component name:', selected.name) || selected.name
            saveAsComponent(name, selected.id)
          },
        },
        ...common,
      ]
    } else if (selected.type === 'text') {
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

  const isMulti = selectedIds.length > 1
  const isGroupLayer = selected?.type === 'group'
  const isGroup = isMulti || isGroupLayer

  const handleAlign = (mode: 'left' | 'center' | 'right' | 'middle') => {
    const isSingleGroup = selectedIds.length === 1 && selected?.type === 'group'
    const targetIds = isSingleGroup
      ? project.layers.filter((l) => l.groupId === selected.id).map((l) => l.id)
      : selectedIds

    const measured: Record<string, { x: number; y: number; w: number; h: number }> = {}
    for (const id of targetIds) {
      const el = document.querySelector(`[data-testid="layer-${id}"]`) as HTMLElement | null
      if (el) {
        measured[id] = {
          x: el.offsetLeft,
          y: el.offsetTop,
          w: el.offsetWidth,
          h: el.offsetHeight,
        }
      }
    }
    alignSelected(mode, Object.keys(measured).length > 0 ? measured : undefined, isSingleGroup ? selected.id : undefined)
  }

  const alignOptions: Item[] = [
    { key: 'align-left', label: 'Left', icon: <AlignHorizontalJustifyStart />, onClick: () => handleAlign('left') },
    { key: 'align-center', label: 'Center', icon: <AlignHorizontalJustifyCenter />, onClick: () => handleAlign('center') },
    { key: 'align-right', label: 'Right', icon: <AlignHorizontalJustifyEnd />, onClick: () => handleAlign('right') },
    { key: 'align-middle', label: 'Middle', icon: <AlignVerticalJustifyCenter />, onClick: () => handleAlign('middle') },
  ]

  const groupItems: Item[] = isMulti
    ? [
        {
          key: 'group',
          label: 'Group',
          icon: <FolderPlus />,
          accent: true,
          onClick: () => createGroup(),
        },
        {
          key: 'component',
          label: 'Component',
          icon: <ComponentIcon />,
          accent: true,
          onClick: () => {
            const name = prompt('Component name:', 'New Component') || 'New Component'
            saveAsComponent(name)
          },
        },
        ...alignOptions,
      ]
    : alignOptions

  const renderItem = (it: Item) => (
    <button
      key={it.key}
      data-testid={`tool-${it.key}`}
      aria-label={it.label}
      onClick={() => (it.onClick ? it.onClick() : openTool(it.key))}
      className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-xl transition-colors active:bg-surface2 ${
        it.danger
          ? 'text-danger'
          : it.accent
            ? 'text-purple-400 font-semibold'
            : it.active
              ? 'bg-accent/20 text-accent'
              : 'text-txt'
      }`}
    >
      <span className="[&>svg]:h-5 [&>svg]:w-5">{it.icon}</span>
      <span className="text-[10px] font-medium">{it.label}</span>
    </button>
  )

  const snapItem: Item = {
    key: 'artboard-snap',
    label: artboardSnap ? 'Snap on' : 'Snap',
    icon: <Magnet />,
    active: artboardSnap,
    onClick: () => setArtboardSnap(!artboardSnap),
  }

  return (
    <div className="flex h-16 shrink-0 items-center gap-1 overflow-x-auto border-t border-line bg-toolbar px-2 no-scrollbar" data-testid="toolbar">
      {renderItem(snapItem)}
      <div className={`flex shrink-0 items-center gap-1 overflow-hidden transition-[max-width,opacity,transform] duration-300 ease-out ${isGroup ? 'max-w-[400px] translate-x-0 opacity-100' : 'pointer-events-none max-w-0 -translate-x-3 opacity-0'}`} data-testid="group-alignment-controls" aria-hidden={!isGroup}>
        {groupItems.map(renderItem)}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {items.map(renderItem)}
      </div>
    </div>
  )
}
