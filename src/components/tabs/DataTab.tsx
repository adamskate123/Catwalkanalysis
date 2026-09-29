import { useMemo, useState } from 'react'
import { hasTrialAnalysis, program } from '../../programs'
import { formatNum, type Measure } from '../../lib/analysis'
import { animalCsv, download, downloadZip, statsCsv, type GraphFormat } from '../../lib/export'
import { changedMeasures } from '../../lib/interpret'
import { buildPrismTables, buildStatsTables, describeSettings, describeStatistics, toPzfx, type PrismOptions } from '../../lib/prism'
import { reportMarkdown } from '../../lib/report'
import { APP_VERSION } from '../../version'
import { allGraphFiles } from '../exportGraphs'
import type { TabProps } from './types'

type PrismScope = 'key' | 'significant' | 'all' | 'custom'

export function DataTab(props: TabProps) {
  const { agg, measures, results, cfg, opt, colorOf } = props
  const [limit, setLimit] = useState(8)
  const prog = program()
  const byTrial = hasTrialAnalysis(prog) && agg.trials.length > 0
  const multiTime = agg.times.length > 1 || byTrial
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
    () => buildPrismTables(agg, { measures: prismMeasures, layout: effLayout, appVersion: APP_VERSION, runNoun: byTrial ? prog.runNoun : undefined }),
    [agg, prismMeasures, effLayout, byTrial, prog.runNoun],
  )
  const [graphFormat, setGraphFormat] = useState<GraphFormat>('png')
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [origin, setOrigin] = useState<'bundle' | 'graphs'>('graphs')
  const enc = (text: string) => new TextEncoder().encode(text)
  const status = (where: 'bundle' | 'graphs') =>
    origin === where && (busy || done) ? (
      <p className="small" role="status" aria-live="polite" style={{ marginTop: 10, marginBottom: 0 }}>
        {busy ?? done}
      </p>
    ) : null

  const run = async (label: string, work: () => Promise<string>) => {
    setOrigin(label.startsWith('Drawing') ? 'graphs' : 'bundle')
    setDone(null)
    setBusy(`${label}…`)
    try {
      setDone(await work())
    } catch (e) {
      setDone(`Could not export: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  const exportAllGraphs = () =>
    run('Drawing graphs', async () => {
      const { files, count } = await allGraphFiles(props, graphFormat, '', setBusy)
      if (!count) return 'No graphs to export.'
      downloadZip(`${prog.filePrefix}_graphs_${stamp}.zip`, files)
      return `Downloaded ${count} graph${count === 1 ? '' : 's'}${graphFormat === 'both' ? ' (SVG and PNG)' : ` (${graphFormat.toUpperCase()})`}.`
    })

  const exportBundle = () =>
    run('Building the Prism bundle', async () => {
      const statsTables = buildStatsTables(results, agg.groups, prismMeasures)
      const methods = describeStatistics(results, cfg)
      const pzfx = toPzfx([...statsTables, ...prismTables], { appVersion: APP_VERSION, notes: `${describeSettings(cfg)} ${methods}` })
      const drawn = await allGraphFiles(props, 'both', '', setBusy, new Set(prismMeasures.map((m) => m.key)))
      const count = drawn.count
      const files = Object.fromEntries(Object.entries(drawn.files).map(([k, v]) => [`graphs/${k}`, v]))
      const base = `${prog.filePrefix}_prism_bundle_${stamp}`
      const readme = [
        `${prog.name} (Behavior Lab) v${APP_VERSION}: Prism project with graphs and statistics, ${stamp}`,
        '',
        `${base}.pzfx`,
        `  Open in GraphPad Prism (File > Open). It holds ${statsTables.length} "Statistics" table(s), one per timepoint, with the app's results for`,
        `  ${prismMeasures.length} parameter(s): group n, mean, SD, SEM, omnibus p, FDR q and, per comparison, % difference, Hedges g, test statistic, df, p and Holm p.`,
        '  These are fixed numbers from the app, identical to the Summary and Parameters tabs; Prism does not recalculate them.',
        `  It also holds ${prismTables.length} data table(s) with the per-animal values, ready for Prism's own graphs and analyses.`,
        '',
        'statistics.csv',
        '  The same statistics for every parameter and timepoint, for Excel or R.',
        '',
        'methods.txt',
        '  How values were computed and which tests were run, for a methods section.',
        '',
        'summary.md',
        '  The written summary from the app.',
        '',
        `graphs/svg and graphs/png (${count} graphs each)`,
        '  The graphs the app draws for the parameters in the Prism file, plus the fingerprint and progression heatmaps,',
        '  in folders by tab and timepoint. SVG files can be edited in Illustrator,',
        '  Inkscape or PowerPoint; PNG files are 3x screen resolution. Prism cannot import them as editable Prism graphs;',
        '  place them on a Prism layout as pictures if needed.',
      ].join('\n')
      const methodsText = [
        `${prog.name} (Behavior Lab) v${APP_VERSION}, ${stamp}.`,
        '',
        describeSettings(cfg),
        '',
        methods,
        '',
        `Groups analysed: ${agg.groups.join(', ')}. Timepoints: ${agg.times.filter(Boolean).length ? agg.times.join(', ') : 'one'}.`,
      ].join('\n')
      downloadZip(`${base}.zip`, {
        'README.txt': enc(readme),
        [`${base}.pzfx`]: enc(pzfx),
        'statistics.csv': enc(statsCsv(results, agg.groups)),
        'methods.txt': enc(methodsText),
        'summary.md': enc(reportMarkdown(agg, results, cfg, opt)),
        ...files,
      })
      return `Downloaded the Prism bundle: ${statsTables.length + prismTables.length} Prism tables and ${count} graphs.`
    })

  const exportPrism = () =>
    download(
      `${prog.filePrefix}_prism_${stamp}.pzfx`,
      toPzfx(prismTables, { appVersion: APP_VERSION, notes: describeSettings(cfg) }),
      'application/xml',
    )

  return (
    <>
      <div className="card">
        <h2>Export</h2>
        <div className="row">
          <button className="btn primary" onClick={() => download(`${prog.filePrefix}_animals_${stamp}.csv`, animalCsv(agg, measures), 'text/csv')}>
            Per-animal values (CSV)
          </button>
          <button className="btn" onClick={() => download(`${prog.filePrefix}_statistics_${stamp}.csv`, statsCsv(results, agg.groups), 'text/csv')}>
            Statistics table (CSV)
          </button>
          <button className="btn" onClick={() => download(`${prog.filePrefix}_summary_${stamp}.md`, reportMarkdown(agg, results, cfg, opt), 'text/markdown')}>
            Written summary (Markdown)
          </button>
          <button className="btn" onClick={() => window.print()}>
            Print / save as PDF
          </button>
        </div>
        <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>
          The per-animal file has one row per animal and timepoint ({prog.runsNoun} averaged{cfg.speedAdjust ? ', speed-adjusted' : ''}); it can be opened in Excel, Prism or R for
          further modelling, such as mixed models for repeated measures. Single charts can be downloaded as SVG or PNG from each chart's header, all charts on a tab with "Export this tab's graphs", and every chart below.
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
              <option value="key">{prog.features.paws ? 'Key: whole-body + front/hind means' : 'Key parameters'}</option>
              <option value="significant">Changed vs control ({changedKeys.size})</option>
              <option value="all">{prog.features.paws ? 'All, incl. each paw and asymmetry' : 'All parameters'}</option>
            </select>
          </label>
          <label className="field">
            Table layout
            <select value={effLayout} onChange={(e) => setLayout(e.target.value as PrismOptions['layout'])} disabled={!multiTime}>
              <option value="column">Column tables{agg.times.length > 1 ? ' (one per timepoint)' : ''}</option>
              {multiTime && <option value="grouped">Grouped tables ({[agg.times.length > 1 && 'time', byTrial && prog.runNoun].filter(Boolean).join(' / ')} × group)</option>}
              {multiTime && <option value="both">Both</option>}
            </select>
            <span className="hint">
              {multiTime
                ? `In grouped tables each animal keeps the same replicate subcolumn at every ${byTrial ? `${prog.runNoun} and ` : ''}timepoint, so repeated-measures two-way ANOVA or mixed-effects analysis works directly.`
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
              {program().categoryOrder.map((cat) => {
                const list = visible.filter((m) => m.def.category === cat)
                if (!list.length) return null
                const allOn = list.every((m) => custom.has(m.key))
                return (
                  <fieldset key={cat}>
                    <legend>
                      <label className="check small">
                        <input type="checkbox" checked={allOn} onChange={(e) => toggle(list.map((m) => m.key), e.target.checked)} />
                        <span>{program().categoryLabels[cat]}</span>
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
              <b>Column tables</b>: one column per group ({agg.groups.join(', ')}) with one value per animal ({prog.runsNoun} averaged). Use them for scatter-dot or bar
              graphs, t-tests and one-way ANOVA.
            </li>
            {multiTime && (
              <li>
                <b>Grouped tables</b>: rows are {byTrial ? (agg.times.length > 1 ? `timepoints (or ${prog.runsNoun} in the "by ${prog.runNoun}" tables)` : prog.runsNoun) : 'timepoints'}, columns are groups, and each animal is a replicate
                subcolumn that keeps its position in every row. Use them for {byTrial ? 'learning curves, ' : ''}time-course graphs and repeated-measures two-way ANOVA or
                mixed-effects analysis.
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
          <button className="btn" onClick={exportBundle} disabled={prismTables.length === 0 || busy !== null}>
            Prism with graphs and statistics (.zip)
          </button>
          <span className="small muted">
            {prismTables.length} data table{prismTables.length === 1 ? '' : 's'} from {prismMeasures.length} parameter{prismMeasures.length === 1 ? '' : 's'}
          </span>
        </div>
        <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>
          The .zip adds the app's statistics as Prism tables, exactly as calculated here (n, mean, SD, SEM, % difference, Hedges g, test statistic, p, Holm p and FDR q),
          plus the graphs of the same parameters as SVG and PNG, a statistics CSV and a methods note. Prism cannot open the app's graphs as editable Prism graphs, so they are included as image
          files.
        </p>
        {status('bundle')}
      </div>
      <div className="card">
        <h2>Graphs</h2>
        <p className="small">
          Download every graph the app draws for this analysis, in folders by tab and timepoint: each parameter at each timepoint
          {agg.times.length > 1 ? ', time courses' : ''}
          {byTrial ? `, ${(prog.trialsTab?.label ?? 'trial curves').toLowerCase()}` : ''}, fingerprints
          {measures.some((m) => m.def.id === 'body_weight') ? ', weight checks' : ''}
          {prog.features.speed ? ', speed checks' : ''}. Graphs use the light theme. To save only the graphs on one tab, use "Export this tab's graphs" above the tab.
        </p>
        <div className="row">
          <label className="small row">
            Format
            <select value={graphFormat} onChange={(e) => setGraphFormat(e.target.value as GraphFormat)} style={{ width: 'auto' }}>
              <option value="png">PNG (images, 3× resolution)</option>
              <option value="svg">SVG (editable vector)</option>
              <option value="both">Both</option>
            </select>
          </label>
          <button className="btn primary" onClick={exportAllGraphs} disabled={busy !== null}>
            Download every graph (.zip)
          </button>
        </div>
        {status('graphs')}
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
