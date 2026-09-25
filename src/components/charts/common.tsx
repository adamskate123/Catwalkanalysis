import type { ReactNode } from 'react'

export interface TipState {
  x: number
  y: number
  content: ReactNode
}

export function Tooltip({ tip, width }: { tip: TipState | null; width: number }) {
  if (!tip) return null
  const left = Math.min(Math.max(tip.x, 90), width - 90)
  return (
    <div className="chart-tip" style={{ left, top: tip.y }} role="status">
      {tip.content}
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  if (items.length < 2) return null
  return (
    <ul className="legend" aria-label="Legend">
      {items.map((it) => (
        <li key={it.label}>
          <span className="swatch" style={{ background: it.color }} aria-hidden />
          {it.label}
        </li>
      ))}
    </ul>
  )
}
