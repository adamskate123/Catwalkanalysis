import { useMemo, useRef, useState } from 'react'
import { formatNum, formatP, stars } from '../../lib/analysis'
import { CATEGORY_LABELS } from '../../lib/catalog'
import { downloadPng, downloadSvg, safeName } from '../../lib/export'
import { DivergingLegend, Heatmap, type HeatCell, type HeatRow } from '../charts/Heatmap'
import type { TabProps } from './types'

export function TimeTab({ results, theme, cfg, openMeasure }: TabProps) {
  const pairs = useMemo(() => {
    const s = new Map<string, { group: string; reference: string }>()
    for (const t of results) for (const r of t.results) for (const c of r.comparisons) s.set(`${c.group}\u0000${c.reference}`, { group: c.group, reference: c.reference })
    return [...s.values()]
  }, [results])
  const def = pairs.findIndex((p) => p.group === cfg.diseaseGroup && p.reference === cfg.controlGroup)
  const [pi, setPi] = useState(Math.max(0, def))
  const [scope, setScope] = useState<'summary' | 'all'>('summary')
  const ref = useRef<SVGSVGElement>(null)
  const pair = pairs[Math.min(pi, pairs.length - 1)]
  if (!pair) return <div className="card">Select a group column with at least two groups.</div>

  const keys = results[0].results
    .map((r) => r.measure)
    .filter((m) => (scope === 'all' ? true : !m.paw && (m.derived === undefined || m.derived === 'FRONT' || m.derived === 'HIND')))

  const rows: HeatRow[] = keys.map((m) => ({
    key: m.key,
    label: m.label,
    section: CATEGORY_LABELS[m.def.category],
    cells: results
      .map((t): HeatCell | null => {
        const r = t.results.find((x) => x.measure.key === m.key)
        const c = r?.comparisons.find((x) => x.group === pair.group && x.reference === pair.reference)
        if (!r || !c) return null
        return {
          col: t.time,
          g: c.g,
          sig: stars(c.pAdj) as HeatCell['sig'],
          tip: (
            <>
              <b>{m.label}</b> · {t.time}
              <br />
              g = {Number.isFinite(c.g) ? c.g.toFixed(2) : '—'} · p = {formatP(c.pAdj)}
              <br />
              {formatNum(r.groups[c.group]?.mean)} vs {formatNum(r.groups[c.reference]?.mean)} {m.def.unit}
            </>
          ),
        }
      })
      .filter((c): c is HeatCell => c !== null),
  }))

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Progression over time</h2>
          <span className="row">
            {pairs.length > 1 && (
              <select value={pi} onChange={(e) => setPi(Number(e.target.value))} style={{ width: 'auto' }} aria-label="Comparison">
                {pairs.map((p, i) => (
                  <option key={i} value={i}>
                    {p.group} vs {p.reference}
                  </option>
                ))}
              </select>
            )}
            <select value={scope} onChange={(e) => setScope(e.target.value as 'summary' | 'all')} style={{ width: 'auto' }} aria-label="Parameters shown">
              <option value="summary">Whole-body + front/hind means</option>
              <option value="all">All parameters</option>
            </select>
          </span>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>
          Effect size of <b>{pair.group}</b> vs <b>{pair.reference}</b> at each timepoint. A row that darkens from left to right shows a progressive phenotype; one that
          fades in a treated-vs-disease comparison shows a lasting treatment effect. Tap a row to open the parameter.
        </p>
        <DivergingLegend theme={theme} />
      </div>
      <div className="card">
        <div className="chart-actions" style={{ marginBottom: 6 }}>
          <button className="btn sm" onClick={() => downloadSvg(ref.current, safeName(`timecourse_${pair.group}_vs_${pair.reference}`))}>
            SVG
          </button>
          <button className="btn sm" onClick={() => downloadPng(ref.current, safeName(`timecourse_${pair.group}_vs_${pair.reference}`))}>
            PNG
          </button>
        </div>
        <Heatmap rows={rows} cols={results.map((t) => ({ key: t.time, label: t.time }))} theme={theme} svgRef={ref} onSelect={(k) => openMeasure(k)} />
      </div>
    </>
  )
}
