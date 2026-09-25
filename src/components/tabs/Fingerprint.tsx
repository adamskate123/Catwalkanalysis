import { useMemo, useRef, useState } from 'react'
import { formatNum, formatP, stars, type Comparison, type MeasureResult } from '../../lib/analysis'
import { CATEGORY_LABELS, PAWS } from '../../lib/catalog'
import { downloadPng, downloadSvg, safeName } from '../../lib/export'
import { DivergingLegend, Heatmap, type HeatCell, type HeatRow } from '../charts/Heatmap'
import type { TabProps } from './types'

function cellFor(r: MeasureResult, cmp: Comparison | undefined, col: string): HeatCell | null {
  if (!cmp) return null
  return {
    col,
    g: cmp.g,
    sig: stars(cmp.pAdj) as HeatCell['sig'],
    tip: (
      <>
        <b>{r.measure.label}</b>
        <br />
        {cmp.group} vs {cmp.reference}
        <br />
        g = {Number.isFinite(cmp.g) ? cmp.g.toFixed(2) : '—'} · p = {formatP(cmp.pAdj)} · q = {formatP(r.q)}
        <br />
        {formatNum(r.groups[cmp.group]?.mean)} vs {formatNum(r.groups[cmp.reference]?.mean)} {r.measure.def.unit}
      </>
    ),
  }
}

export function Fingerprint({ results, time, theme, cfg, openMeasure }: TabProps) {
  const tr = results.find((r) => r.time === time) ?? results[0]
  const pairs = useMemo(() => {
    const s = new Map<string, { group: string; reference: string }>()
    for (const r of tr?.results ?? []) for (const c of r.comparisons) s.set(`${c.group}\u0000${c.reference}`, { group: c.group, reference: c.reference })
    return [...s.values()]
  }, [tr])
  const defaultPair = pairs.findIndex((p) => p.group === cfg.diseaseGroup && p.reference === cfg.controlGroup)
  const [pi, setPi] = useState(Math.max(0, defaultPair))
  const pair = pairs[Math.min(pi, pairs.length - 1)]
  const pawRef = useRef<SVGSVGElement>(null)
  const bodyRef = useRef<SVGSVGElement>(null)

  if (!tr || !pair) return <div className="card">Select a group column with at least two groups to see a fingerprint.</div>

  const find = (r: MeasureResult) => r.comparisons.find((c) => c.group === pair.group && c.reference === pair.reference)

  // Per-paw rows: one per parameter, columns LF RF LH RH + front/hind asymmetry
  const pawRows: HeatRow[] = []
  const seen = new Set<string>()
  for (const r of tr.results) {
    if (!r.measure.paw || seen.has(r.measure.def.id)) continue
    seen.add(r.measure.def.id)
    const same = tr.results.filter((x) => x.measure.def.id === r.measure.def.id)
    const cells: HeatCell[] = []
    for (const p of PAWS) {
      const x = same.find((s) => s.measure.paw === p)
      const c = x && cellFor(x, find(x), p)
      if (c) cells.push(c)
    }
    for (const d of ['ASYM_F', 'ASYM_H'] as const) {
      const x = same.find((s) => s.measure.derived === d)
      const c = x && cellFor(x, find(x), d)
      if (c) cells.push(c)
    }
    pawRows.push({ key: r.measure.def.id, label: r.measure.def.label.replace(/ \(.*\)$/, ''), section: CATEGORY_LABELS[r.measure.def.category], cells })
  }

  const bodyRows: HeatRow[] = tr.results
    .filter((r) => !r.measure.paw && !r.measure.derived)
    .map((r) => {
      const c = cellFor(r, find(r), 'g')
      return { key: r.measure.key, label: r.measure.label, section: CATEGORY_LABELS[r.measure.def.category], cells: c ? [c] : [] }
    })

  const base = safeName(`fingerprint_${pair.group}_vs_${pair.reference}${time ? '_' + time : ''}`)

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Gait fingerprint</h2>
          {pairs.length > 1 && (
            <select value={pi} onChange={(e) => setPi(Number(e.target.value))} style={{ width: 'auto', maxWidth: '100%' }} aria-label="Comparison">
              {pairs.map((p, i) => (
                <option key={i} value={i}>
                  {p.group} vs {p.reference}
                </option>
              ))}
            </select>
          )}
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>
          Each cell is the effect size (Hedges g) for <b>{pair.group}</b> relative to <b>{pair.reference}</b>
          {time ? ` at ${time}` : ''}. Blue = lower, red = higher; darker = larger effect. Stars mark Holm-adjusted p &lt; 0.05 (*), 0.01 (**), 0.001 (***).
          Tap a cell to open that parameter. Asymmetry columns: positive values mean the left paw's value is higher than the right's.
        </p>
        <DivergingLegend theme={theme} />
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <h3 style={{ margin: 0 }}>Per-paw parameters</h3>
            <span className="chart-actions">
              <button className="btn sm" onClick={() => downloadSvg(pawRef.current, base + '_paws')}>
                SVG
              </button>
              <button className="btn sm" onClick={() => downloadPng(pawRef.current, base + '_paws')}>
                PNG
              </button>
            </span>
          </div>
          {pawRows.length ? (
            <Heatmap
              rows={pawRows}
              cols={[
                { key: 'LF', label: 'LF' },
                { key: 'RF', label: 'RF' },
                { key: 'LH', label: 'LH' },
                { key: 'RH', label: 'RH' },
                { key: 'ASYM_F', label: 'Asym F' },
                { key: 'ASYM_H', label: 'Asym H' },
              ]}
              theme={theme}
              svgRef={pawRef}
              onSelect={(row, col) => openMeasure(`${row}|${col}`)}
            />
          ) : (
            <p className="small muted">No per-paw parameters in this file.</p>
          )}
        </div>
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <h3 style={{ margin: 0 }}>Whole-body parameters</h3>
            <span className="chart-actions">
              <button className="btn sm" onClick={() => downloadSvg(bodyRef.current, base + '_body')}>
                SVG
              </button>
              <button className="btn sm" onClick={() => downloadPng(bodyRef.current, base + '_body')}>
                PNG
              </button>
            </span>
          </div>
          {bodyRows.length ? (
            <Heatmap rows={bodyRows} cols={[{ key: 'g', label: 'g' }]} theme={theme} svgRef={bodyRef} onSelect={(row) => openMeasure(row)} />
          ) : (
            <p className="small muted">No whole-body parameters in this file.</p>
          )}
        </div>
      </div>
    </>
  )
}
