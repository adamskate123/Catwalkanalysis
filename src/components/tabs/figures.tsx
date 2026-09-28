import { useRef, type ReactNode, type RefObject } from 'react'
import { stars, type Measure } from '../../lib/analysis'
import { PAW_NAMES } from '../../lib/catalog'
import { mean, sem, finite } from '../../lib/stats'
import { downloadPng, downloadSvg, safeName } from '../../lib/export'
import { DotPlot, type DotGroup } from '../charts/DotPlot'
import { LineChart, type LineSeries } from '../charts/LineChart'
import type { TabProps } from './types'

// Chart cards shared by the Parameters and Story tabs.

export function ChartCard({ title, children, svg, name }: { title: string; children: ReactNode; svg: RefObject<SVGSVGElement | null>; name: string }) {
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>{title}</h3>
        <span className="chart-actions">
          <button className="btn sm" onClick={() => downloadSvg(svg.current, safeName(name))} aria-label={`Download ${title} as SVG`}>
            SVG
          </button>
          <button className="btn sm" onClick={() => downloadPng(svg.current, safeName(name))} aria-label={`Download ${title} as PNG`}>
            PNG
          </button>
        </span>
      </div>
      {children}
    </div>
  )
}

export function MeasureDots({ m, props, height = 240, fullTitle = false }: { m: Measure; props: TabProps; height?: number; fullTitle?: boolean }) {
  const { agg, results, time, theme, colorOf } = props
  const ref = useRef<SVGSVGElement>(null)
  const r = results.find((t) => t.time === time)?.results.find((x) => x.measure.key === m.key)
  const groups: DotGroup[] = agg.groups.map((g) => {
    const pts = agg.subjects.filter((s) => s.time === time && s.group === g && Number.isFinite(s.values[m.key])).map((s) => ({ id: s.id, v: s.values[m.key] }))
    const vals = pts.map((p) => p.v)
    const cmp = r?.comparisons.find((c) => c.group === g && c.reference === props.cfg.controlGroup)
    return {
      name: g,
      color: colorOf(g),
      points: pts,
      mean: mean(vals),
      sem: sem(vals),
      n: vals.length,
      note: cmp ? (stars(cmp.pAdj) || 'ns') : undefined,
    }
  })
  const title = fullTitle ? m.label : m.paw ? `${PAW_NAMES[m.paw]} (${m.paw})` : m.derived ? m.label.split(', ').slice(1).join(', ') : m.label
  return (
    <ChartCard title={title} svg={ref} name={`${m.label}${time ? '_' + time : ''}`}>
      <DotPlot groups={groups} theme={theme} unit={m.derived?.startsWith('ASYM') ? '% (L−R)' : m.def.unit} height={height} svgRef={ref} />
    </ChartCard>
  )
}

export function TimeCourse({ m, props }: { m: Measure; props: TabProps }) {
  const { agg, theme, colorOf } = props
  const ref = useRef<SVGSVGElement>(null)
  const series: LineSeries[] = agg.groups.map((g) => ({
    name: g,
    color: colorOf(g),
    points: agg.times.map((t) => {
      const vals = finite(agg.subjects.filter((s) => s.group === g && s.time === t).map((s) => s.values[m.key]))
      return { x: t, mean: mean(vals), sem: sem(vals), n: vals.length }
    }),
  }))
  return (
    <ChartCard title={`${m.label} over time`} svg={ref} name={`${m.label}_timecourse`}>
      <LineChart series={series} xs={agg.times} theme={theme} unit={m.def.unit} svgRef={ref} />
    </ChartCard>
  )
}

