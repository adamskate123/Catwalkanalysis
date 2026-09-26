import { useState, type Ref } from 'react'
import { Tooltip, type TipState } from './common'
import { useWidth } from './useWidth'
import { fmtTick, jitter, linear, niceTicks } from './scale'
import type { ChartTheme } from '../../lib/theme'
import { formatNum } from '../../lib/analysis'

export interface DotGroup {
  name: string
  color: string
  points: { id: string; v: number }[]
  mean: number
  sem: number
  n: number
  note?: string
}

interface Props {
  groups: DotGroup[]
  theme: ChartTheme
  unit?: string
  height?: number
  title?: string
  svgRef?: Ref<SVGSVGElement>
  zeroBased?: boolean
}

function wrap(label: string, maxChars: number): string[] {
  const words = label.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) {
      lines.push(cur)
      cur = w
    } else cur = (cur + ' ' + w).trim()
  }
  if (cur) lines.push(cur)
  if (lines.length > 2) return [lines[0], lines.slice(1).join(' ').slice(0, maxChars - 1) + '…']
  return lines
}

export function DotPlot({ groups, theme, unit, height = 260, title, svgRef, zeroBased }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TipState | null>(null)
  const all = groups.flatMap((g) => [...g.points.map((p) => p.v), g.mean + (g.sem || 0), g.mean - (g.sem || 0)]).filter(Number.isFinite)
  let lo = all.length ? Math.min(...all) : 0
  let hi = all.length ? Math.max(...all) : 1
  if (zeroBased && lo > 0) lo = 0
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.1 || 1
  lo = zeroBased && lo === 0 ? 0 : lo - pad
  hi += pad
  const ticks = niceTicks(lo, hi, height < 200 ? 3 : 5)
  const y0 = ticks[0] ?? lo
  const y1 = ticks[ticks.length - 1] ?? hi

  const m = { l: 46, r: 8, t: title ? 26 : 12, b: groups.some((g) => g.note) ? 50 : 36 }
  const pw = Math.max(40, width - m.l - m.r)
  const ph = height - m.t - m.b
  const y = linear(y0, y1, m.t + ph, m.t)
  const band = pw / Math.max(1, groups.length)
  const maxChars = Math.max(6, Math.floor(band / 6.2))

  return (
    <div ref={ref} className="chart" onPointerLeave={() => setTip(null)}>
      <svg ref={svgRef} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title ?? 'Dot plot'} xmlns="http://www.w3.org/2000/svg" fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif">
        <rect width={width} height={height} fill={theme.surface} />
        {title && (
          <text x={m.l - 38} y={16} fontSize={12} fontWeight={600} fill={theme.text}>
            {title}
          </text>
        )}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={m.l + pw} y1={y(t)} y2={y(t)} stroke={theme.grid} strokeWidth={1} />
            <text x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10.5} fill={theme.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {fmtTick(t)}
            </text>
          </g>
        ))}
        {unit && (
          <text transform={`translate(10 ${m.t + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize={10.5} fill={theme.muted}>
            {unit}
          </text>
        )}
        {groups.map((g, gi) => {
          const cx = m.l + band * gi + band / 2
          const jw = Math.min(band * 0.28, 16)
          const mw = Math.min(band * 0.55, 40)
          const lines = wrap(g.name, maxChars)
          return (
            <g key={g.name}>
              {Number.isFinite(g.sem) && g.n > 1 && (
                <g stroke={theme.text} strokeWidth={1.5} strokeLinecap="round">
                  <line x1={cx} x2={cx} y1={y(g.mean - g.sem)} y2={y(g.mean + g.sem)} />
                  <line x1={cx - 6} x2={cx + 6} y1={y(g.mean - g.sem)} y2={y(g.mean - g.sem)} />
                  <line x1={cx - 6} x2={cx + 6} y1={y(g.mean + g.sem)} y2={y(g.mean + g.sem)} />
                </g>
              )}
              {g.points.map((p, i) => {
                const px = cx + jitter(i, g.points.length) * jw
                const py = y(p.v)
                return (
                  <g key={p.id + i}>
                    <circle cx={px} cy={py} r={4} fill={g.color} stroke={theme.surface} strokeWidth={2} fillOpacity={0.9} />
                    <circle
                      cx={px}
                      cy={py}
                      r={10}
                      fill="transparent"
                      onPointerEnter={() =>
                        setTip({
                          x: px,
                          y: py - 12,
                          content: (
                            <>
                              <b>{p.id}</b> · {g.name}
                              <br />
                              {formatNum(p.v)} {unit}
                            </>
                          ),
                        })
                      }
                    />
                  </g>
                )
              })}
              {Number.isFinite(g.mean) && (
                <line
                  x1={cx - mw / 2}
                  x2={cx + mw / 2}
                  y1={y(g.mean)}
                  y2={y(g.mean)}
                  stroke={theme.text}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  onPointerEnter={() =>
                    setTip({
                      x: cx,
                      y: y(g.mean) - 12,
                      content: (
                        <>
                          <b>{g.name}</b>
                          <br />
                          mean {formatNum(g.mean)} ± {formatNum(g.sem)} SEM (n = {g.n})
                        </>
                      ),
                    })
                  }
                />
              )}
              {lines.map((ln, li) => (
                <text key={li} x={cx} y={m.t + ph + 15 + li * 12} textAnchor="middle" fontSize={11} fill={theme.text2}>
                  {ln}
                </text>
              ))}
              {g.note && (
                <text x={cx} y={m.t + ph + 15 + lines.length * 12 + 2} textAnchor="middle" fontSize={10.5} fill={theme.muted}>
                  {g.note}
                </text>
              )}
            </g>
          )
        })}
        <line x1={m.l} x2={m.l + pw} y1={m.t + ph} y2={m.t + ph} stroke={theme.axis} strokeWidth={1} />
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  )
}
