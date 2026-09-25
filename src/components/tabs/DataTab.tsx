import { useState } from 'react'
import { formatNum } from '../../lib/analysis'
import { animalCsv, download, statsCsv } from '../../lib/export'
import { reportMarkdown } from '../../lib/report'
import type { TabProps } from './types'

export function DataTab({ agg, measures, results, cfg, opt, colorOf }: TabProps) {
  const [limit, setLimit] = useState(8)
  const shownMeasures = measures.filter((m) => !m.derived).slice(0, limit)
  const stamp = new Date().toISOString().slice(0, 10)

  return (
    <>
      <div className="card">
        <h2>Export</h2>
        <div className="row">
          <button className="btn primary" onClick={() => download(`catwalk_animals_${stamp}.csv`, animalCsv(agg, measures), 'text/csv')}>
            Per-animal values (CSV)
          </button>
          <button className="btn" onClick={() => download(`catwalk_statistics_${stamp}.csv`, statsCsv(results, agg.groups), 'text/csv')}>
            Statistics table (CSV)
          </button>
          <button className="btn" onClick={() => download(`catwalk_summary_${stamp}.md`, reportMarkdown(agg, results, cfg, opt), 'text/markdown')}>
            Written summary (Markdown)
          </button>
          <button className="btn" onClick={() => window.print()}>
            Print / save as PDF
          </button>
        </div>
        <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>
          The per-animal file has one row per animal and timepoint (runs averaged{cfg.speedAdjust ? ', speed-adjusted' : ''}); it can be opened in Excel, Prism or R for
          further modelling, such as mixed models for repeated measures. Charts can be downloaded as SVG or PNG from each chart's header.
        </p>
      </div>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Per-animal values</h2>
          <label className="small row">
            Columns
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} style={{ width: 'auto' }}>
              {[8, 20, 50, 1000].map((n) => (
                <option key={n} value={n}>
                  {n === 1000 ? 'all' : n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="table-wrap" style={{ maxHeight: 520, marginTop: 10 }}>
          <table>
            <thead>
              <tr>
                <th>Animal</th>
                <th>Group</th>
                {agg.times.length > 1 && <th>Time</th>}
                <th className="num">Runs</th>
                {shownMeasures.map((m) => (
                  <th key={m.key} className="num">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agg.subjects.map((s, i) => (
                <tr key={i}>
                  <td>{s.id}</td>
                  <td>
                    <span className="swatch" style={{ background: colorOf(s.group), marginRight: 6 }} aria-hidden />
                    {s.group}
                  </td>
                  {agg.times.length > 1 && <td>{s.time}</td>}
                  <td className="num">{s.nRuns}</td>
                  {shownMeasures.map((m) => (
                    <td key={m.key} className="num">
                      {formatNum(s.values[m.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
