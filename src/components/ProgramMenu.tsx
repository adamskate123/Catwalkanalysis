import { useEffect, useRef, useState } from 'react'
import { PROGRAMS, type ProgramId } from '../programs'
import { Logo } from './Logo'

/** The header brand doubles as the switcher between programs (Gait, Rotarod, Open Field). */
export function ProgramMenu({ current, onSelect }: { current: ProgramId; onSelect: (id: ProgramId) => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const prog = PROGRAMS.find((p) => p.id === current) ?? PROGRAMS[0]

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="brand" ref={root}>
      <button className="brand-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} title="Switch program">
        <Logo program={prog.id} />
        <span>{prog.name}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="caret">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="program-menu" role="menu" aria-label="Programs">
          {PROGRAMS.map((p) => (
            <button
              key={p.id}
              role="menuitemradio"
              aria-checked={p.id === current}
              className={p.id === current ? 'current' : undefined}
              onClick={() => {
                setOpen(false)
                onSelect(p.id)
              }}
            >
              <Logo program={p.id} size={30} />
              <span>
                <b>{p.name}</b>
                <span className="small muted">{p.tagline}</span>
              </span>
              {p.id === current && (
                <span className="check-mark" aria-hidden>
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
