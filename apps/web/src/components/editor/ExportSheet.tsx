import { useState } from 'react'
import { X, Check, Download } from 'lucide-react'
import { useEditor } from '#/store/editor'

export default function ExportSheet({ onClose }: { onClose: () => void }) {
  const { project, mode } = useEditor()
  const formats = mode === 'animated' ? ['MP4', 'GIF', 'PNG'] : ['PNG', 'JPG', 'SVG']
  const [fmt, setFmt] = useState(formats[0])
  const [quality, setQuality] = useState('HD')
  const [phase, setPhase] = useState<'idle' | 'rendering' | 'done'>('idle')
  const [pct, setPct] = useState(0)

  const bg = project.background
  const preview: React.CSSProperties =
    bg.type === 'image'
      ? { backgroundImage: `url(${bg.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : bg.type === 'gradient'
        ? { backgroundImage: bg.value }
        : { background: bg.value }

  const run = () => {
    setPhase('rendering'); setPct(0)
    const id = setInterval(() => {
      setPct((p) => {
        if (p >= 100) { clearInterval(id); setPhase('done'); return 100 }
        return p + 7
      })
    }, 90)
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end" data-testid="export-sheet">
      <div className="absolute inset-0 bg-black/60 animate-fade" onClick={onClose} />
      <div className="animate-sheet relative rounded-t-3xl border-t border-line bg-surface pb-8">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h3 className="text-xl">Export</h3>
          <button onClick={onClose} data-testid="export-close" className="grid h-8 w-8 place-items-center rounded-full bg-surface2 text-txt2">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5">
          <div className="mb-5 flex items-center gap-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-line" style={preview}>
              <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white/90">{project.preset.ratio}</span>
            </div>
            <div>
              <p className="font-bold">{project.name}</p>
              <p className="text-sm text-txt2">{project.preset.label} · {project.preset.w}×{project.preset.h}</p>
              <p className="text-xs text-txt3 capitalize">{mode} banner</p>
            </div>
          </div>

          {phase === 'done' ? (
            <div className="flex flex-col items-center gap-3 py-6 animate-fade">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-track-image/20">
                <Check className="h-7 w-7 text-[var(--color-track-image)]" strokeWidth={3} />
              </div>
              <p className="font-bold">Export ready</p>
              <p className="text-center text-sm text-txt2">Your {fmt} banner has been rendered.<br /><span className="text-txt3">(Saving is mocked — hook up in the backend phase.)</span></p>
              <button onClick={onClose} data-testid="export-done" className="mt-2 w-full rounded-xl bg-surface2 py-3 font-semibold">Done</button>
            </div>
          ) : (
            <>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-txt3">Format</p>
              <div className="mb-5 flex gap-2">
                {formats.map((f) => (
                  <button key={f} data-testid={`fmt-${f}`} onClick={() => setFmt(f)}
                    className={`flex-1 rounded-xl border py-3 text-sm font-bold ${fmt === f ? 'border-accent bg-accent/10 text-white' : 'border-line bg-surface2 text-txt2'}`}>{f}</button>
                ))}
              </div>

              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-txt3">Quality</p>
              <div className="mb-6 flex gap-2">
                {['SD', 'HD', '4K'].map((q) => (
                  <button key={q} data-testid={`q-${q}`} onClick={() => setQuality(q)}
                    className={`flex-1 rounded-xl border py-3 text-sm font-bold ${quality === q ? 'border-accent bg-accent/10 text-white' : 'border-line bg-surface2 text-txt2'}`}>{q}</button>
                ))}
              </div>

              {phase === 'rendering' ? (
                <div className="py-2" data-testid="export-progress">
                  <div className="mb-2 flex justify-between text-sm"><span className="text-txt2">Rendering…</span><span className="font-semibold">{Math.min(100, pct)}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface2">
                    <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              ) : (
                <button onClick={run} data-testid="export-start"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-4 font-bold text-white transition-transform active:scale-[0.98]">
                  <Download className="h-5 w-5" /> Export {fmt} · {quality}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
