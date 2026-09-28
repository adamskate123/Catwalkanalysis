import { useMemo, useState } from 'react'
import { formatNum, type Measure } from '../../lib/analysis'
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../../lib/catalog'
import { animalCsv, download, statsCsv } from '../../lib/export'
import { changedMeasures } from '../../lib/interpret'
import { buildPrismTables, describeSettings, toPzfx, type PrismOptions } from '../../lib/prism'
import { reportMarkdown } from '../../lib/report'
import { APP_VERSION } from '../../version'
import type { TabProps } from './types'

type PrismScope = 'key' | 'significant' | 'all' | 'custom'

export function DataTab({ agg, measures, results, cfg, opt, colorOf }: TabProps) {
  const [limit, setLimit] = useState(8)
  const multiTime = agg.times.length > 1
  const [scope, setScope] = useState<PrismScope>('key')
  const [layout, setLayout] = useState<PrismOptions['layout']>(multiTime ? 'both' : 'column')
  const shownMeasures = measures.filter((m) => !m.derived).slice(0, limit)
  const stamp = new Date().toISOString().slice(0, 10)

  // Parameters changed vs control at any timepoint (current thresholds)
  const changedKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const t of results) for (const k of changedMeasures(t, cfg, opt).keys()) keys.add(k)
    return keys
  }, [results, cfg, opt])
  const keyMeasures = useMemo(() => measures.filter((m) => (!m.paw && !m.derived) || m.derived === 'FRONT' || m.derived === 'HIND'), [measures])
  const [custom, setCustom] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')

  const prismMeasures = useMemo(() => {
    if (scope === 'all') return measures
    if (scope === 'key') return keyMeasures
    if (scope === 'significant') return measures.filter((m) => changedKeys.has(m.key))
    return measures.filter((m) => custom.has(m.key))
  }, [scope, measures, keyMeasures, changedKeys, custom])

  const setScopeAndSeed = (next: PrismScope) => {
    // Start a custom selection from whatever was selected before.
    if (next === 'custom' && custom.size === 0) setCustom(new Set(prismMeasures.map((m) => m.key)))
    setScope(next)
  }
  const toggle = (keys: string[], on: boolean) =>
    setCustom((prev) => {
      const n = new Set(prev)
      for (const k of keys) {
        if (on) n.add(k)
        else n.delete(k)
      }
      return n
    })
  const visible = measures.filter((m) => m.label.toLowerCase().includes(q.toLowerCase()))
  const effLayout = multiTime ? layout : 'column'
  const prismTables = useMemo(
    () => buildPrismTables(agg, { measures: prismMeasures, layout: effLayout, appVersion: APP_VERSION }),
    [agg, prismMeasures, effLayout],
  )
  const exportPrism = () =>
    download(
      `catwalk_prism_${stamp}.pzfx`,
      toPzfx(prismTables, { appVersion: APP_VERSION, notes: describeSettings(cfg) }),
      'application/xml',
    )

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
        <h2>GraphPad Prism</h2>
        <p className="small">
          Download a Prism project (.pzfx) with the per-animal values already laid out as data tables. Open it in Prism (File → Open) to graph and analyse without
          retyping anything.
        </p>
        <div className="form-grid">
          <label className="field">
            Parameters
            <select value={scope} onChange={(e) => setScopeAndSeed(e.target.value as PrismScope)}>
              <option value="custom">Choose parameters…</option>
              <option value="key">Key: whole-body + front/hind means</option>
              <option value="significant">Changed vs control ({changedKeys.size})</option>
              <option value="all">All, incl. each paw and asymmetry</option>
            </select>
          </label>
          <label className="field">
            Table layout
            <select value={effLayout} onChange={(e) => setLayout(e.target.value as PrismOptions['layout'])} disabled={!multiTime}>
              <option value="column">Column tables{multiTime ? ' (one per timepoint)' : ''}</option>
              {multiTime && <option value="grouped">Grouped tables (time × group)</option>}
              {multiTime && <option value="both">Both</option>}
            </select>
            <span className="hint">
              {multiTime
                ? 'In grouped tables each animal keeps the same replicate subcolumn at every timepoint, so repeated-measures two-way ANOVA or mixed-effects analysis works directly.'
                : 'Column tables suit t-tests, one-way ANOVA and scatter-dot plots.'}
            </span>
          </label>
        </div>
        {scope === 'custom' && (
          <div className="prism-pick">
            <div className="row" style={{ marginBottom: 8 }}>
              <input type="search" placeholder="Search parameters" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: '1 1 200px', width: 'auto' }} aria-label="Search parameters" />
              <button className="btn sm" onClick={() => setCustom(new Set(changedKeys))}>
                Changed only
              </button>
              <button className="btn sm" onClick={() => setCustom(new Set(keyMeasures.map((m) => m.key)))}>
                Key set
              </button>
              <button className="btn sm" onClick={() => setCustom(new Set())}>
                Clear
              </button>
            </div>
            <div className="prism-list">
              {CATEGORY_ORDER.map((cat) => {
                const list = visible.filter((m) => m.def.category === cat)
                if (!list.length) return null
                const allOn = list.every((m) => custom.has(m.key))
                return (
                  <fieldset key={cat}>
                    <legend>
                      <label className="check small">
                        <input type="checkbox" checked={allOn} onChange={(e) => toggle(list.map((m) => m.key), e.target.checked)} />
                        <span>{CATEGORY_LABELS[cat]}</span>
                      </label>
                    </legend>
                    {list.map((m: Measure) => (
                      <label key={m.key} className="check small">
                        <input type="checkbox" checked={custom.has(m.key)} onChange={(e) => toggle([m.key], e.target.checked)} />
                        <span>
                          {m.label}
                          {changedKeys.has(m.key) && <span className="sig-badge" style={{ marginLeft: 6 }}>★</span>}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                )
              })}
            </div>
            <p className="small muted" style={{ margin: '6px 0 0' }}>
              <span className="sig-badge">★</span> changed vs {cfg.controlGroup ?? 'control'} at any timepoint (current thresholds). {custom.size} selected.
            </p>
          </div>
        )}
        <details className="small" style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>How the Prism file is organised</summary>
          <ul style={{ paddingLeft: 18, marginTop: 6 }}>
            <li>
              Each selected parameter becomes its own <b>data table</b> (named with the parameter, unit and timepoint), so Prism makes one graph per table.
              Only the parameters you select are included.
            </li>
            <li>
              <b>Column tables</b>: one column per group ({agg.groups.join(', ')}) with one value per animal (runs averaged). Use them for scatter-dot or bar
              graphs, t-tests and one-way ANOVA.
            </li>
            {multiTime && (
              <li>
                <b>Grouped tables</b>: rows are timepoints, columns are groups, and each animal is a replicate subcolumn that keeps its position at every
                timepoint. Use them for time-course graphs and repeated-measures two-way ANOVA or mixed-effects analysis.
              </li>
            )}
            <li>
              In Prism: File → Open, choose the .pzfx file, then click any data table and its graph in the navigator. Change a graph's style once, then use
              Prism's "Apply Magic" to copy it to the others.
            </li>
            <li>The project's Info sheet records the app version and analysis settings (filters, run quality, speed adjustment).</li>
          </ul>
        </details>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={exportPrism} disabled={prismTables.length === 0}>
            Download Prism file (.pzfx)
          </button>
          <span className="small muted">
            {prismTables.length} data table{prismTables.length === 1 ? '' : 's'} from {prismMeasures.length} parameter{prismMeasures.length === 1 ? '' : 's'}
          </span>
        </div>
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
