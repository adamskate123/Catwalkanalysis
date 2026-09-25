import { useState, type ReactNode, type Ref } from 'react'
import { Tooltip, type TipState } from './common'
import { useWidth } from './useWidth'
import { divergingColor, inkOn, type ChartTheme } from '../../lib/theme'

export interface HeatCell {
  col: string
  g: number
  sig: '' | '*' | '**' | '***'
  tip: ReactNode
}

export interface HeatRow {
  key: string
  label: string
  section?: string
  cells: HeatCell[]
}

interface Props {
  rows: HeatRow[]
  cols: { key: string; label: string }[]
  theme: ChartTheme
  onSelect?: (rowKey: string, col: string) => void
  svgRef?: Ref<SVGSVGElement>
  title?: string
}

export function Heatmap({ rows, cols, theme, onSelect, svgRef, title }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TipState | null>(null)
  const labelW = Math.min(200, Math.max(120, width * 0.34))
  const cellW = Math.max(28, Math.min(78, (width - labelW - 8) / Math.max(1, cols.length)))
  const cellH = 26
  const headH = 26
  const sectionH = 24
  const titleH = title ? 22 : 0
  const svgW = Math.min(width, labelW + cellW * cols.length + 8)

  const layout: { r: HeatRow; y: number; newSection: boolean }[] = []
  let yCursor = titleH + headH
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const newSection = Boolean(r.section && r.section !== rows[i - 1]?.section)
    if (newSection) yCursor += sectionH
    layout.push({ r, y: yCursor, newSection })
    yCursor += cellH
  }
  const height = yCursor + 6

  return (
    <div ref={ref} className="chart" onPointerLeave={() => setTip(null)}>
      <svg ref={svgRef} width={svgW} height={height} viewBox={`0 0 ${svgW} ${height}`} role="img" aria-label={title ?? 'Effect-size heatmap'} xmlns="http://www.w3.org/2000/svg" fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif">
        <rect width={svgW} height={height} fill={theme.surface} />
        {title && (
          <text x={4} y={15} fontSize={12} fontWeight={600} fill={theme.text}>
            {title}
          </text>
        )}
        {cols.map((c, ci) => (
          <text key={c.key} x={labelW + ci * cellW + cellW / 2} y={titleH + headH - 9} textAnchor="middle" fontSize={11} fontWeight={600} fill={theme.text2}>
            {c.label}
          </text>
        ))}
        {layout.map(({ r, y, newSection }) => (
          <g key={r.key}>
            {newSection && (
              <text x={4} y={y - 8} fontSize={10.5} fontWeight={600} fill={theme.muted} style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {r.section}
              </text>
            )}
            <text x={labelW - 8} y={y + cellH / 2} dy="0.32em" textAnchor="end" fontSize={11.5} fill={theme.text}>
              {r.label.length > labelW / 7 ? r.label.slice(0, Math.floor(labelW / 7) - 1) + '…' : r.label}
            </text>
            {cols.map((c, ci) => {
              const cell = r.cells.find((x) => x.col === c.key)
              const x = labelW + ci * cellW
              if (!cell) {
                return <rect key={c.key} x={x + 1} y={y + 1} width={cellW - 2} height={cellH - 2} fill="none" stroke={theme.grid} strokeWidth={1} rx={3} />
              }
              const fill = divergingColor(theme, cell.g)
              const ink = inkOn(fill)
              const label = Number.isFinite(cell.g) ? `${cell.g > 0 ? '+' : cell.g < 0 ? '−' : ''}${Math.abs(cell.g).toFixed(1)}${cell.sig}` : '—'
              const show = cellW >= 44
              return (
                <g
                  key={c.key}
                  style={{ cursor: onSelect ? 'pointer' : undefined }}
                  onPointerEnter={() => setTip({ x: x + cellW / 2, y: y - 4, content: cell.tip })}
                  onClick={() => onSelect?.(r.key, c.key)}
                >
                  <rect x={x + 1} y={y + 1} width={cellW - 2} height={cellH - 2} fill={fill} rx={3} />
                  {show ? (
                    <text x={x + cellW / 2} y={y + cellH / 2} dy="0.32em" textAnchor="middle" fontSize={10.5} fill={ink} style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {label}
                    </text>
                  ) : (
                    cell.sig && <circle cx={x + cellW / 2} cy={y + cellH / 2} r={2.5} fill={ink} />
                  )}
                </g>
              )
            })}
          </g>
        ))}
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  )
}

export function DivergingLegend({ theme }: { theme: ChartTheme }) {
  const steps = [-2.5, -1.8, -1.2, -0.8, -0.5, 0, 0.5, 0.8, 1.2, 1.8, 2.5]
  return (
    <div className="div-legend" aria-label="Colour scale: Hedges g">
      <span>Lower than reference</span>
      <span className="div-legend-bar">
        {steps.map((s) => (
          <span key={s} style={{ background: divergingColor(theme, s) }} title={`g ≈ ${s}`} />
        ))}
      </span>
      <span>Higher</span>
    </div>
  )
}
