import { useState, type Ref } from 'react'
import { Legend, Tooltip, type TipState } from './common'
import { useWidth } from './useWidth'
import { fmtTick, linear, niceTicks } from './scale'
import type { ChartTheme } from '../../lib/theme'
import { formatNum } from '../../lib/analysis'

export interface LineSeries {
  name: string
  color: string
  points: { x: string; mean: number; sem: number; n: number }[]
}

interface Props {
  series: LineSeries[]
  xs: string[]
  theme: ChartTheme
  unit?: string
  height?: number
  title?: string
  svgRef?: Ref<SVGSVGElement>
}

export function LineChart({ series, xs, theme, unit, height = 260, title, svgRef }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TipState | null>(null)
  const vals = series.flatMap((s) => s.points.flatMap((p) => [p.mean - (p.sem || 0), p.mean + (p.sem || 0)])).filter(Number.isFinite)
  const lo = vals.length ? Math.min(...vals) : 0
  const hi = vals.length ? Math.max(...vals) : 1
  const pad = (hi - lo) * 0.1 || 1
  const ticks = niceTicks(lo - pad, hi + pad, height < 200 ? 3 : 5)
  const direct = series.length <= 4 && width >= 420
  const m = { l: 46, r: direct ? 110 : 14, t: title ? 26 : 12, b: 30 }
  const pw = Math.max(40, width - m.l - m.r)
  const ph = height - m.t - m.b
  const y = linear(ticks[0], ticks[ticks.length - 1], m.t + ph, m.t)
  const step = xs.length > 1 ? pw / (xs.length - 1) : 0
  const x = (i: number) => (xs.length > 1 ? m.l + i * step : m.l + pw / 2)
  const dodge = (si: number) => (series.length > 1 ? (si - (series.length - 1) / 2) * Math.min(6, step / 8 || 6) : 0)

  // Direct end labels only when they don't collide; otherwise the legend carries identity.
  const ends = series
    .map((s) => {
      const last = [...s.points].reverse().find((p) => Number.isFinite(p.mean))
      return last ? { name: s.name, y: y(last.mean) } : null
    })
    .filter((e): e is { name: string; y: number } => e !== null)
    .sort((a, b) => a.y - b.y)
  const collide = ends.some((e, i) => i > 0 && e.y - ends[i - 1].y < 13)

  return (
    <div ref={ref} className="chart" onPointerLeave={() => setTip(null)}>
      <Legend items={series.map((s) => ({ label: s.name, color: s.color }))} />
      <svg ref={svgRef} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title ?? 'Time course'} xmlns="http://www.w3.org/2000/svg" fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif">
        <rect width={width} height={height} fill={theme.surface} />
        {title && (
          <text x={8} y={16} fontSize={12} fontWeight={600} fill={theme.text}>
            {title}
          </text>
        )}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={m.l + pw} y1={y(t)} y2={y(t)} stroke={theme.grid} strokeWidth={1} />
            <text x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10.5} fill={theme.muted}>
              {fmtTick(t)}
            </text>
          </g>
        ))}
        {unit && (
          <text transform={`translate(10 ${m.t + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize={10.5} fill={theme.muted}>
            {unit}
          </text>
        )}
        {xs.map((lab, i) => (
          <text key={lab} x={x(i)} y={m.t + ph + 18} textAnchor="middle" fontSize={11} fill={theme.text2}>
            {lab}
          </text>
        ))}
        <line x1={m.l} x2={m.l + pw} y1={m.t + ph} y2={m.t + ph} stroke={theme.axis} strokeWidth={1} />
        {series.map((s, si) => {
          const pts = xs
            .map((lab, i) => {
              const p = s.points.find((q) => q.x === lab)
              return p && Number.isFinite(p.mean) ? { ...p, px: x(i) + dodge(si), py: y(p.mean) } : null
            })
            .filter((p): p is NonNullable<typeof p> => p !== null)
          return (
            <g key={s.name}>
              {Number.isFinite(pts[0]?.sem) &&
                pts.map((p) =>
                  Number.isFinite(p.sem) ? (
                    <line key={`e${p.x}`} x1={p.px} x2={p.px} y1={y(p.mean - p.sem)} y2={y(p.mean + p.sem)} stroke={s.color} strokeWidth={1.5} strokeLinecap="round" />
                  ) : null,
                )}
              <polyline points={pts.map((p) => `${p.px},${p.py}`).join(' ')} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p) => (
                <g key={p.x}>
                  <circle cx={p.px} cy={p.py} r={4.5} fill={s.color} stroke={theme.surface} strokeWidth={2} />
                  <circle
                    cx={p.px}
                    cy={p.py}
                    r={11}
                    fill="transparent"
                    onPointerEnter={() =>
                      setTip({
                        x: p.px,
                        y: p.py - 12,
                        content: (
                          <>
                            <b>{s.name}</b> · {p.x}
                            <br />
                            {formatNum(p.mean)} ± {formatNum(p.sem)} SEM (n = {p.n})
                          </>
                        ),
                      })
                    }
                  />
                </g>
              ))}
              {direct && !collide && pts.length > 0 && (
                <text x={pts[pts.length - 1].px + 10} y={pts[pts.length - 1].py} dy="0.32em" fontSize={11} fill={theme.text2}>
                  {s.name.length > 16 ? s.name.slice(0, 15) + '…' : s.name}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  )
}
