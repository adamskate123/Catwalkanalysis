import { useState } from 'react'
import { Legend, Tooltip, type TipState } from './common'
import { useWidth } from './useWidth'
import { fmtTick, linear, niceTicks } from './scale'
import type { ChartTheme } from '../../lib/theme'
import { formatNum } from '../../lib/analysis'

export interface ScatterGroup {
  name: string
  color: string
  points: { id: string; x: number; y: number }[]
}

interface Props {
  groups: ScatterGroup[]
  theme: ChartTheme
  xLabel: string
  yLabel: string
  height?: number
}

export function Scatter({ groups, theme, xLabel, yLabel, height = 300 }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TipState | null>(null)
  const pts = groups.flatMap((g) => g.points).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
  const xt = niceTicks(Math.min(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.x)), 5)
  const yt = niceTicks(Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.y)), 5)
  const m = { l: 50, r: 12, t: 10, b: 40 }
  const pw = Math.max(40, width - m.l - m.r)
  const ph = height - m.t - m.b
  if (!pts.length) return <p className="muted">No animals have both values.</p>
  const x = linear(xt[0], xt[xt.length - 1], m.l, m.l + pw)
  const y = linear(yt[0], yt[yt.length - 1], m.t + ph, m.t)
  return (
    <div ref={ref} className="chart" onPointerLeave={() => setTip(null)}>
      <Legend items={groups.map((g) => ({ label: g.name, color: g.color }))} />
      <svg width={width} height={height} role="img" aria-label={`${yLabel} versus ${xLabel}`} fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif">
        <rect width={width} height={height} fill={theme.surface} />
        {yt.map((t) => (
          <g key={`y${t}`}>
            <line x1={m.l} x2={m.l + pw} y1={y(t)} y2={y(t)} stroke={theme.grid} />
            <text x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10.5} fill={theme.muted}>
              {fmtTick(t)}
            </text>
          </g>
        ))}
        {xt.map((t) => (
          <text key={`x${t}`} x={x(t)} y={m.t + ph + 15} textAnchor="middle" fontSize={10.5} fill={theme.muted}>
            {fmtTick(t)}
          </text>
        ))}
        <line x1={m.l} x2={m.l + pw} y1={m.t + ph} y2={m.t + ph} stroke={theme.axis} />
        <text x={m.l + pw / 2} y={height - 6} textAnchor="middle" fontSize={11} fill={theme.text2}>
          {xLabel}
        </text>
        <text transform={`translate(12 ${m.t + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill={theme.text2}>
          {yLabel}
        </text>
        {groups.map((g) =>
          g.points.map((p, i) =>
            Number.isFinite(p.x) && Number.isFinite(p.y) ? (
              <g key={g.name + p.id + i}>
                <circle cx={x(p.x)} cy={y(p.y)} r={4.5} fill={g.color} stroke={theme.surface} strokeWidth={2} />
                <circle
                  cx={x(p.x)}
                  cy={y(p.y)}
                  r={10}
                  fill="transparent"
                  onPointerEnter={() =>
                    setTip({
                      x: x(p.x),
                      y: y(p.y) - 12,
                      content: (
                        <>
                          <b>{p.id}</b> · {g.name}
                          <br />
                          {xLabel}: {formatNum(p.x)} · {yLabel}: {formatNum(p.y)}
                        </>
                      ),
                    })
                  }
                />
              </g>
            ) : null,
          ),
        )}
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  )
}
