import { useState } from 'react'
import { ChevronLeft, Download } from 'lucide-react'
import { useEditor } from '#/store/editor'

export default function TopBar({ onExit, onExport }: { onExit: () => void; onExport: () => void }) {
  const { project, rename, mode, setMode } = useEditor()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(project.name)

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-toolbar px-2">
      <button
        onClick={onExit}
        data-testid="editor-back-btn"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-txt2 transition-colors active:bg-surface2"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => { rename(name || 'Untitled'); setEditing(false) }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          data-testid="project-title-input"
          className="min-w-0 flex-1 rounded-md bg-surface2 px-2 py-1 text-sm font-semibold outline-none ring-1 ring-accent"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          data-testid="project-title"
          className="flex min-w-0 flex-1 flex-col items-start leading-tight"
        >
          <span className="max-w-full truncate text-sm font-bold">{project.name}</span>
          <span className="text-[10px] text-txt3">{project.preset.label} · {project.preset.ratio}</span>
        </button>
      )}

      {/* Mode toggle */}
      <div className="flex shrink-0 items-center rounded-lg bg-surface2 p-0.5" data-testid="mode-toggle">
        {(['static', 'animated'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            data-testid={`mode-${m}`}
            className={`rounded-md px-2 py-1 text-[11px] font-semibold capitalize transition-colors ${
              mode === m ? 'bg-accent text-white' : 'text-txt2'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <button
        onClick={onExport}
        data-testid="export-btn"
        className="flex shrink-0 items-center gap-1 rounded-lg bg-accent px-2.5 py-2 text-sm font-bold text-white transition-transform active:scale-95"
      >
        <Download className="h-4 w-4" />
        <span>Export</span>
      </button>
    </header>
  )
}
