import { useState, useRef, useEffect, Fragment } from 'react'
import {
  Type, Shapes, Sticker, Image as ImageIcon, Layers as LayersIcon, Palette,
  Copy, Trash2, Wand2, AlignLeft, Bold, PaintBucket, Square,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Scissors, Crop, FolderPlus, Ungroup, Component as ComponentIcon,
  AlignHorizontalJustifyStart, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
  Magnet, ChevronUp, ChevronDown, Lock, Unlock,
  Move, ArrowUpToLine, ArrowDownToLine, ArrowLeftToLine, ArrowRightToLine, Maximize2, Expand,
} from 'lucide-react'
import { useEditor, type AlignMode } from '#/store/editor'
import { parseImagePosition } from '#/lib/imagePosition'

type Item = { key: string; label: string; icon: React.ReactNode; onClick?: () => void; danger?: boolean; accent?: boolean; active?: boolean }

export default function Toolbar() {
  const {
    project, selected, selectedIds, alignSelected, openTool, deleteLayer, deleteLayers, duplicate, reorder,
    createGroup, ungroup, saveAsComponent, artboardSnap, setArtboardSnap,
    timelineOpen, toggleTimeline, updateLayer, imagePositioningId, setImagePositioningId,
  } = useEditor()

  const [isAlignExpanded, setIsAlignExpanded] = useState(false)
  const [positionMode, setPositionMode] = useState<string | null>(null)
  const alignPillRef = useRef<HTMLDivElement>(null)

  const isImageSelected = Boolean(selected && selected.type === 'image')

  useEffect(() => {
    if (!isImageSelected) {
      setIsAlignExpanded(false)
      setPositionMode(null)
    }
  }, [selected?.id, isImageSelected])

  useEffect(() => {
    if (!isAlignExpanded) return
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (alignPillRef.current && !alignPillRef.current.contains(e.target as Node)) {
        setIsAlignExpanded(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAlignExpanded(false)
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isAlignExpanded])

  const isFreehandActive = Boolean(selected && imagePositioningId === selected.id)

  const handleFreeHand = () => {
    if (!selected || selected.type !== 'image') return
    if (isFreehandActive) {
      setImagePositioningId(null)
      setPositionMode(null)
    } else {
      setImagePositioningId(selected.id)
      setPositionMode('freehand')
    }
  }

  const nudgePosition = (dx: number, dy: number) => {
    if (!selected || selected.type !== 'image') return
    if (selected.crop) {
      updateLayer(selected.id, {
        crop: {
          ...selected.crop,
          x: selected.crop.x + dx,
          y: selected.crop.y + dy,
        },
      })
      return
    }
    const pos = parseImagePosition(selected.imagePosition)
    const newX = Math.min(100, Math.max(0, Math.round(pos.x + dx)))
    const newY = Math.min(100, Math.max(0, Math.round(pos.y + dy)))
    updateImagePosition(`${newX}% ${newY}%`)
  }

  const updateImagePosition = (position: string, fit?: 'cover' | 'contain') => {
    if (!selected) return
    const ids = selectedIds.length > 0 ? selectedIds : [selected.id]
    for (const id of ids) {
      const layer = project.layers.find((l) => l.id === id)
      if (layer?.type === 'image') {
        const patch: Partial<typeof layer> = {
          imagePosition: position,
          ...(fit ? { imageFit: fit } : {}),
        }
        if (layer.crop) {
          let newCropX = layer.crop.x
          let newCropY = layer.crop.y
          const overflowX = layer.crop.w - layer.w
          const overflowY = layer.crop.h - layer.h
          if (position.includes('top')) newCropY = 0
          else if (position.includes('bottom')) newCropY = -overflowY
          else if (position.includes('center') || position.includes('mid')) newCropY = -Math.round(overflowY / 2)

          if (position.includes('left')) newCropX = 0
          else if (position.includes('right')) newCropX = -overflowX
          else if (position.includes('center') || position.includes('mid')) newCropX = -Math.round(overflowX / 2)

          patch.crop = {
            ...layer.crop,
            x: Math.round(newCropX),
            y: Math.round(newCropY),
          }
        }
        updateLayer(id, patch)
      }
    }
  }

  const handleTop = () => {
    setImagePositioningId(null)
    updateImagePosition('center top')
    setPositionMode('top')
  }

  const handleMid = () => {
    setImagePositioningId(null)
    updateImagePosition('center center')
    setPositionMode('mid')
  }

  const handleBottom = () => {
    setImagePositioningId(null)
    updateImagePosition('center bottom')
    setPositionMode('bottom')
  }

  const handleLeft = () => {
    setImagePositioningId(null)
    updateImagePosition('left center')
    setPositionMode('left')
  }

  const handleRight = () => {
    setImagePositioningId(null)
    updateImagePosition('right center')
    setPositionMode('right')
  }

  const handleOriginalRatio = () => {
    if (!selected || selected.type !== 'image') return
    setImagePositioningId(null)

    const processRatio = (naturalWidth: number, naturalHeight: number) => {
      if (!naturalWidth || !naturalHeight) return
      const natRatio = naturalWidth / naturalHeight
      // Restores original aspect ratio of image and element bounds around while retaining height
      const targetH = selected.h
      const newW = Math.max(15, Math.round(targetH * natRatio))
      updateLayer(selected.id, {
        w: newW,
        h: targetH,
        crop: undefined,
        imageFit: 'cover',
        imagePosition: 'center center',
        ...(selected.lockProportions ? { aspectRatio: natRatio } : {}),
      })
      setPositionMode('original-aspect-ratio')
    }

    const img = document.querySelector(`[data-testid="layer-${selected.id}"] img`) as HTMLImageElement | null
    if (img?.naturalWidth && img.naturalHeight) {
      processRatio(img.naturalWidth, img.naturalHeight)
      return
    }

    const source = new window.Image()
    source.onload = () => processRatio(source.naturalWidth, source.naturalHeight)
    source.src = selected.src || ''
  }

  const handleDynamicCrop = () => {
    if (!selected || selected.type !== 'image') return
    setImagePositioningId(null)

    // Toggle off dynamic crop if currently active or crop is applied
    if (positionMode === 'dynamic-crop' || Boolean(selected.crop)) {
      updateLayer(selected.id, {
        crop: undefined,
      })
      setPositionMode(null)
      return
    }

    // Calculate current rendered image position & size from current state
    const img = document.querySelector(`[data-testid="layer-${selected.id}"] img`) as HTMLImageElement | null
    const nw = img?.naturalWidth || selected.w
    const nh = img?.naturalHeight || selected.h
    const scale = Math.max(selected.w / nw, selected.h / nh)
    const renderedW = Math.round(nw * scale)
    const renderedH = Math.round(nh * scale)

    const pos = parseImagePosition(selected.imagePosition)
    const overflowX = Math.max(0, renderedW - selected.w)
    const overflowY = Math.max(0, renderedH - selected.h)
    const cropX = Math.round(-overflowX * (pos.x / 100))
    const cropY = Math.round(-overflowY * (pos.y / 100))

    updateLayer(selected.id, {
      crop: {
        x: cropX,
        y: cropY,
        w: renderedW,
        h: renderedH,
      },
      lockProportions: false,
    })
    setPositionMode('dynamic-crop')
  }

  const isProportionsLocked = Boolean(selected?.type === 'image' && selected.lockProportions)

  const handleToggleLockProportions = () => {
    if (!selected || selected.type !== 'image') return
    if (positionMode === 'original-aspect-ratio' || positionMode === 'dynamic-crop') {
      setPositionMode(null)
    }
    const ids = selectedIds.length > 0 ? selectedIds : [selected.id]
    const nextLocked = !isProportionsLocked
    for (const id of ids) {
      const layer = project.layers.find((l) => l.id === id)
      if (layer && layer.type === 'image') {
        const currentAspect = layer.h > 0 ? layer.w / layer.h : 1
        updateLayer(id, {
          lockProportions: nextLocked,
          ...(nextLocked ? { aspectRatio: currentAspect } : {}),
        })
      }
    }
  }

  const bgAlignItems = [
    {
      key: 'freehand',
      label: isFreehandActive ? 'Exit manual positioning' : 'Manual background position adjustment',
      icon: <Move className="h-4 w-4" />,
      active: isFreehandActive,
      onClick: handleFreeHand,
    },
    {
      key: 'top',
      label: 'Top',
      icon: <ArrowUpToLine className="h-4 w-4" />,
      onClick: handleTop,
    },
    {
      key: 'mid',
      label: 'Mid',
      icon: <AlignVerticalJustifyCenter className="h-4 w-4" />,
      onClick: handleMid,
    },
    {
      key: 'bottom',
      label: 'Bottom',
      icon: <ArrowDownToLine className="h-4 w-4" />,
      onClick: handleBottom,
    },
    {
      key: 'left',
      label: 'Left',
      icon: <ArrowLeftToLine className="h-4 w-4" />,
      onClick: handleLeft,
    },
    {
      key: 'right',
      label: 'Right',
      icon: <ArrowRightToLine className="h-4 w-4" />,
      onClick: handleRight,
    },
    {
      key: 'original-aspect-ratio',
      label: 'Original aspect ratio',
      title: 'Restores the original aspect ratio of the image and image element bounds around. The image element retains its height.',
      icon: <Maximize2 className="h-4 w-4" />,
      active: positionMode === 'original-aspect-ratio',
      onClick: handleOriginalRatio,
    },
    {
      key: 'dynamic-crop',
      label: positionMode === 'dynamic-crop' || Boolean(selected?.crop) ? 'Dynamic crop (Active)' : 'Dynamic crop',
      title: 'Dynamic crop: image is positioned where it is in its current state, drag all sides to increase or decrease how much of the image is shown.',
      icon: <Crop className="h-4 w-4" />,
      active: positionMode === 'dynamic-crop' || Boolean(selected?.crop),
      onClick: handleDynamicCrop,
    },
    {
      key: 'lock-proportions',
      label: isProportionsLocked ? 'Unlock proportions' : 'Lock current proportions',
      icon: isProportionsLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />,
      active: isProportionsLocked,
      onClick: handleToggleLockProportions,
      dividerBefore: true,
    },
  ]

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
      { key: 'dup', label: 'Duplicate', icon: <Copy />, onClick: () => duplicate(selected.id) },
      { key: 'del', label: 'Delete', icon: <Trash2 />, onClick: () => (isMulti ? deleteLayers(selectedIds) : deleteLayer(selected.id)), danger: true },
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
        {
          key: 'lock-proportions',
          label: isProportionsLocked ? 'Unlock proportions' : 'Lock proportions',
          icon: isProportionsLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />,
          active: isProportionsLocked,
          onClick: handleToggleLockProportions,
        },
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

  const handleAlign = (mode: AlignMode) => {
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
    { key: 'align-top', label: 'Top', icon: <AlignVerticalJustifyStart />, onClick: () => handleAlign('top') },
    { key: 'align-middle', label: 'Middle', icon: <AlignVerticalJustifyCenter />, onClick: () => handleAlign('middle') },
    { key: 'align-bottom', label: 'Bottom', icon: <AlignVerticalJustifyEnd />, onClick: () => handleAlign('bottom') },
    { key: 'distribute-h', label: 'Distribute H', icon: <AlignHorizontalDistributeCenter />, onClick: () => handleAlign('distribute-h') },
    { key: 'distribute-v', label: 'Distribute V', icon: <AlignVerticalDistributeCenter />, onClick: () => handleAlign('distribute-v') },
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

  const floatingActionKeys = new Set(['color', 'lock-proportions', 'dup', 'del'])
  const floatingItems = selected ? items.filter((it) => floatingActionKeys.has(it.key)) : []
  const toolbarItems = selected ? items.filter((it) => !floatingActionKeys.has(it.key)) : items

  const renderItem = (it: Item) => {
    const isTimeline = it.key === 'timeline'
    const button = (
      <button
        key={it.key}
        data-testid={isTimeline ? 'toggle-timeline' : `tool-${it.key}`}
        id={isTimeline ? 'toggle-timeline' : `tool-${it.key}`}
        aria-label={isTimeline ? (timelineOpen ? '^ Collapse timeline' : '^ Expand timeline') : it.label}
        title={isTimeline ? (timelineOpen ? 'Collapse timeline (^)' : 'Expand timeline (^)') : it.label}
        onClick={() => (it.onClick ? it.onClick() : openTool(it.key))}
        className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-xl transition-colors active:bg-surface2 ${
          it.danger
            ? 'text-danger'
            : it.accent
              ? 'text-purple-400 font-semibold'
              : it.active
                ? 'bg-accent/20 text-accent font-semibold'
                : 'text-txt'
        }`}
      >
        <span className="[&>svg]:h-5 [&>svg]:w-5 flex items-center justify-center">{it.icon}</span>
        <span className="text-[10px] font-medium flex items-center justify-center gap-0.5">
          {isTimeline && <span className="text-[9px] font-bold">^</span>}
          <span>{it.label}</span>
        </span>
      </button>
    )

    if (isTimeline) {
      return (
        <div key={it.key} data-testid="tool-timeline" className="shrink-0 flex items-center justify-center">
          {button}
        </div>
      )
    }

    return button
  }

  const snapItem: Item = {
    key: 'artboard-snap',
    label: artboardSnap ? 'Snap on' : 'Snap',
    icon: <Magnet />,
    active: artboardSnap,
    onClick: () => setArtboardSnap(!artboardSnap),
  }

  const timelineItem: Item = {
    key: 'timeline',
    label: 'Timeline',
    icon: timelineOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />,
    active: timelineOpen,
    onClick: () => toggleTimeline(),
  }

  const parentGroupId = selected?.groupId
  const siblings = selected ? project.layers.filter((l) => l.groupId === parentGroupId) : []
  const sIdx = selected ? siblings.findIndex((l) => l.id === selected.id) : -1
  const canMoveForward = selectedIds.length > 1 ? true : (sIdx >= 0 && sIdx < siblings.length - 1)
  const canMoveBackward = selectedIds.length > 1 ? true : (sIdx > 0)

  const handleReorder = (dir: 1 | -1) => {
    if (!selected) return
    if (selectedIds.length > 1) {
      const ids = dir > 0 ? [...selectedIds].reverse() : [...selectedIds]
      for (const id of ids) {
        reorder(id, dir)
      }
    } else {
      reorder(selected.id, dir)
    }
  }

  return (
    <>
      {Boolean(selected) && (
        <div
          className={`absolute right-3 z-40 flex flex-col items-end gap-2 select-none pointer-events-none transition-[bottom] duration-200 ${
            timelineOpen ? 'bottom-[19.5rem]' : 'bottom-[4.5rem]'
          }`}
        >
          {/* Floating background positions alignment button for image elements */}
          {isImageSelected && (
            <div
              ref={alignPillRef}
              id="image-bg-align-container"
              data-testid="image-bg-align-container"
              className="pointer-events-auto relative flex flex-col items-end"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {isAlignExpanded ? (
                <>
                  {isFreehandActive && (
                    <div
                      id="image-manual-adjust-card"
                      data-testid="image-manual-adjust-card"
                      className="absolute right-11 top-0 flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-black/85 p-2.5 text-xs text-white shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 min-w-[130px] z-50 pointer-events-auto"
                    >
                      <div className="flex w-full items-center justify-between gap-2 border-b border-white/10 pb-1 font-semibold text-sky-400">
                        <span className="flex items-center gap-1 text-[11px]">
                          <Move className="h-3 w-3" /> Adjust
                        </span>
                        <button
                          type="button"
                          data-testid="image-manual-adjust-done-btn"
                          onClick={() => {
                            setImagePositioningId(null)
                            setPositionMode(null)
                          }}
                          className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white hover:bg-white/20 transition-colors"
                        >
                          Done
                        </button>
                      </div>
                      <div className="text-[10px] text-white/70 text-center leading-tight">
                        Drag image on canvas or nudge:
                      </div>
                      <div className="grid grid-cols-3 gap-1 my-0.5">
                        <div />
                        <button
                          type="button"
                          aria-label="Nudge image up"
                          onClick={() => nudgePosition(0, -5)}
                          className="flex h-6 w-6 items-center justify-center rounded bg-white/10 hover:bg-white/20 active:scale-90 transition-all text-white"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <div />
                        <button
                          type="button"
                          aria-label="Nudge image left"
                          onClick={() => nudgePosition(-5, 0)}
                          className="flex h-6 w-6 items-center justify-center rounded bg-white/10 hover:bg-white/20 active:scale-90 transition-all text-white"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Center image position"
                          title="Center"
                          onClick={() => updateImagePosition('center center')}
                          className="flex h-6 w-6 items-center justify-center rounded bg-white/10 text-[9px] font-bold hover:bg-white/20 active:scale-90 transition-all text-white/90"
                        >
                          50%
                        </button>
                        <button
                          type="button"
                          aria-label="Nudge image right"
                          onClick={() => nudgePosition(5, 0)}
                          className="flex h-6 w-6 items-center justify-center rounded bg-white/10 hover:bg-white/20 active:scale-90 transition-all text-white"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                        <div />
                        <button
                          type="button"
                          aria-label="Nudge image down"
                          onClick={() => nudgePosition(0, 5)}
                          className="flex h-6 w-6 items-center justify-center rounded bg-white/10 hover:bg-white/20 active:scale-90 transition-all text-white"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <div />
                      </div>
                      <div className="text-[10px] text-white/50 font-mono">
                        {(() => {
                          const p = parseImagePosition(selected?.imagePosition)
                          return `X: ${Math.round(p.x)}% Y: ${Math.round(p.y)}%`
                        })()}
                      </div>
                    </div>
                  )}
                  <div
                    id="image-bg-align-pill"
                    data-testid="image-bg-align-pill"
                    role="toolbar"
                    aria-label="Background positions alignment controls"
                    className="flex w-9 max-h-[70vh] flex-col items-center gap-1 overflow-y-auto rounded-full border border-white/10 bg-black/60 p-1 text-xs font-semibold text-white shadow-2xl backdrop-blur-md transition-all duration-200 animate-in fade-in zoom-in-95 slide-in-from-bottom-2"
                  >
                    {bgAlignItems.map((item) => {
                      const isActive = item.active !== undefined ? item.active : positionMode === item.key
                      return (
                        <Fragment key={item.key}>
                          {item.dividerBefore && <div className="my-0.5 h-px w-4 bg-white/20" />}
                          <button
                            type="button"
                            id={`image-align-${item.key}-btn`}
                            data-testid={`image-align-${item.key}-btn`}
                            data-action={item.key}
                            data-align-action={item.key}
                            aria-label={item.label}
                            aria-pressed={isActive}
                            title={item.label}
                            onClick={item.onClick}
                            className={`grid h-8 w-8 place-items-center rounded-full transition-all active:scale-90 focus:outline-none ${
                              isActive
                                ? 'bg-accent text-white shadow-sm ring-1 ring-accent/60'
                                : 'text-white/85 hover:bg-white/20 hover:text-white'
                            }`}
                          >
                            <span className="[&>svg]:h-4 [&>svg]:w-4 flex items-center justify-center">{item.icon}</span>
                          </button>
                        </Fragment>
                      )
                    })}
                  </div>
                  <button
                    type="button"
                    id="image-bg-align-btn"
                    data-testid="image-bg-align-btn"
                    aria-label="Image sizing and background positioning"
                    title="Image sizing and background positioning"
                    aria-expanded={true}
                    onClick={() => setIsAlignExpanded(false)}
                    className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/60 text-white/90 shadow-lg backdrop-blur-md transition-all hover:bg-white/20 hover:text-white active:scale-90 focus:outline-none"
                  >
                    <Expand className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  id="image-bg-align-btn"
                  data-testid="image-bg-align-btn"
                  aria-label="Image sizing and background positioning"
                  title="Image sizing and background positioning"
                  aria-expanded={false}
                  onClick={() => setIsAlignExpanded(true)}
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/60 text-white/90 shadow-lg backdrop-blur-md transition-all hover:bg-white/20 hover:text-white active:scale-90 focus:outline-none"
                >
                  <Expand className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* Vertical pill button for layer Forward & Backward */}
          <div
            id="layer-reorder-pill"
            data-testid="layer-reorder-pill"
            aria-label="Layer order controls"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-auto flex flex-col items-center gap-1 rounded-full border border-white/10 bg-black/60 px-1.5 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-md"
          >
            <button
              type="button"
              id="layer-forward-btn"
              data-testid="layer-forward-btn"
              aria-label="Bring forward"
              title="Bring forward"
              disabled={!canMoveForward}
              onClick={() => handleReorder(1)}
              className={`grid h-6 w-6 place-items-center rounded-full transition-all focus:outline-none ${
                !canMoveForward
                  ? 'opacity-40 cursor-not-allowed text-white/40'
                  : 'text-white/90 hover:bg-white/20 hover:text-white active:scale-90'
              }`}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              id="layer-backward-btn"
              data-testid="layer-backward-btn"
              aria-label="Send backward"
              title="Send backward"
              disabled={!canMoveBackward}
              onClick={() => handleReorder(-1)}
              className={`grid h-6 w-6 place-items-center rounded-full transition-all focus:outline-none ${
                !canMoveBackward
                  ? 'opacity-40 cursor-not-allowed text-white/40'
                  : 'text-white/90 hover:bg-white/20 hover:text-white active:scale-90'
              }`}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Floating element control panel */}
          {floatingItems.length > 0 && (
            <div
              id="floating-action-group"
              data-testid="floating-action-group"
              aria-label="Layer actions"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-black/60 px-2 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-md"
            >
              {floatingItems.map((it) => {
                const isLockProp = it.key === 'lock-proportions'
                return (
                  <button
                    key={it.key}
                    type="button"
                    id={isLockProp ? 'lock-proportions-btn' : `floating-tool-${it.key}`}
                    data-testid={isLockProp ? 'lock-proportions-btn' : `floating-tool-${it.key}`}
                    data-floating-tool={it.key}
                    aria-label={it.label}
                    aria-pressed={isLockProp ? Boolean(it.active) : undefined}
                    title={it.label}
                    onClick={() => (it.onClick ? it.onClick() : openTool(it.key))}
                    className={`grid h-6 w-6 place-items-center rounded-full transition-all active:scale-90 focus:outline-none ${
                      it.danger
                        ? 'text-danger hover:bg-danger/20 hover:text-red-400'
                        : it.active
                          ? 'bg-accent text-white shadow-sm ring-1 ring-accent/60'
                          : 'text-white/90 hover:bg-white/20 hover:text-white'
                    }`}
                  >
                    <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{it.icon}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
      <div className="flex h-16 shrink-0 items-center gap-1 overflow-x-auto border-t border-line bg-toolbar px-2 no-scrollbar" data-testid="toolbar">
        {renderItem(snapItem)}
        {renderItem(timelineItem)}
        <div className={`flex shrink-0 items-center gap-1 overflow-hidden transition-[max-width,opacity,transform] duration-300 ease-out ${isGroup ? 'max-w-[800px] translate-x-0 opacity-100' : 'pointer-events-none max-w-0 -translate-x-3 opacity-0'}`} data-testid="group-alignment-controls" aria-hidden={!isGroup}>
          {groupItems.map(renderItem)}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {toolbarItems.map(renderItem)}
        </div>
      </div>
    </>
  )
}
