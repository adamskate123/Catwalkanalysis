import { useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { formatNum, formatP, stars, type Measure, type MeasureResult } from '../../lib/analysis'
import { CATEGORY_LABELS, CATEGORY_ORDER, PAW_NAMES, type ParamDef } from '../../lib/catalog'
import { mean, sem, finite } from '../../lib/stats'
import { downloadPng, downloadSvg, safeName } from '../../lib/export'
import { DotPlot, type DotGroup } from '../charts/DotPlot'
import { LineChart, type LineSeries } from '../charts/LineChart'
import type { TabProps } from './types'

interface Entry {
  id: string
  def: ParamDef
  label: string
  measures: Measure[]
}

function entriesOf(measures: Measure[]): Entry[] {
  const map = new Map<string, Entry>()
  for (const m of measures) {
    const id = m.paw || m.derived ? m.def.id : m.key
    const e = map.get(id) ?? { id, def: m.def, label: m.paw || m.derived ? m.def.label : m.label, measures: [] }
    e.measures.push(m)
    map.set(id, e)
  }
  return [...map.values()]
}

function ChartCard({ title, children, svg, name }: { title: string; children: ReactNode; svg: RefObject<SVGSVGElement | null>; name: string }) {
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

function MeasureDots({ m, props, height = 240 }: { m: Measure; props: TabProps; height?: number }) {
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
  const title = m.paw ? `${PAW_NAMES[m.paw]} (${m.paw})` : m.derived ? m.label.split(', ').slice(1).join(', ') : m.label
  return (
    <ChartCard title={title} svg={ref} name={`${m.label}${time ? '_' + time : ''}`}>
      <DotPlot groups={groups} theme={theme} unit={m.derived?.startsWith('ASYM') ? '% (L−R)' : m.def.unit} height={height} svgRef={ref} />
    </ChartCard>
  )
}

function TimeCourse({ m, props }: { m: Measure; props: TabProps }) {
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

function StatsTable({ rows, props }: { rows: MeasureResult[]; props: TabProps }) {
  const { agg } = props
  const cmpKeys = [...new Map(rows.flatMap((r) => r.comparisons.map((c) => [`${c.group}|${c.reference}`, c] as const))).values()]
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Measure</th>
            {agg.groups.map((g) => (
              <th key={g} className="num">
                {g}
                <div className="small muted" style={{ fontWeight: 400 }}>
                  mean ± SEM (n)
                </div>
              </th>
            ))}
            {cmpKeys.map((c) => (
              <th key={c.group + c.reference} className="num">
                {c.group} vs {c.reference}
                <div className="small muted" style={{ fontWeight: 400 }}>
                  g · p (Holm)
                </div>
              </th>
            ))}
            <th className="num">q (FDR)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.measure.key}>
              <td>{r.measure.paw ?? (r.measure.derived ? r.measure.label.split(', ').slice(1).join(', ') : r.measure.label)}</td>
              {agg.groups.map((g) => (
                <td key={g} className="num">
                  {formatNum(r.groups[g]?.mean)} ± {formatNum(r.groups[g]?.sem, 2)} ({r.groups[g]?.n ?? 0})
                </td>
              ))}
              {cmpKeys.map((k) => {
                const c = r.comparisons.find((x) => x.group === k.group && x.reference === k.reference)
                return (
                  <td key={k.group + k.reference} className={`num${c && c.pAdj < 0.05 ? ' sig' : ''}`}>
                    {c ? `${Number.isFinite(c.g) ? c.g.toFixed(2) : '—'} · ${formatP(c.pAdj)}` : '—'}
                  </td>
                )
              })}
              <td className="num">{formatP(r.q)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Explore(props: TabProps & { selected: string | null; setSelected: (k: string) => void }) {
  const { measures, results, time, selected, setSelected, onLearn, cfg } = props
  const entries = useMemo(() => entriesOf(measures), [measures])
  const [q, setQ] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const current =
    entries.find((e) => e.measures.some((m) => m.key === selected)) ?? entries.find((e) => e.id === selected) ?? entries.find((e) => e.def.id === 'print_area') ?? entries[0]
  if (!current) return <p>No parameters found.</p>

  const tr = results.find((t) => t.time === time)
  const rows = current.measures.map((m) => tr?.results.find((r) => r.measure.key === m.key)).filter((r): r is MeasureResult => Boolean(r))
  const perPaw = current.measures.filter((m) => m.paw)
  const derived = current.measures.filter((m) => m.derived)
  const single = !perPaw.length ? current.measures[0] : null
  const filtered = entries.filter((e) => e.label.toLowerCase().includes(q.toLowerCase()))
  const d = current.def

  const picker = (
    <div className="card picker">
      <input type="search" placeholder="Search parameters" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search parameters" />
      {CATEGORY_ORDER.map((cat) => {
        const list = filtered.filter((e) => e.def.category === cat)
        if (!list.length) return null
        return (
          <div key={cat}>
            <div className="cat">{CATEGORY_LABELS[cat]}</div>
            <ul>
              {list.map((e) => (
                <li key={e.id}>
                  <button
                    aria-current={e.id === current.id}
                    onClick={() => {
                      setSelected(e.measures[0].key)
                      setPickerOpen(false)
                    }}
                  >
                    {e.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="explore">
      <div>
        <button className="btn no-print mobile-only" onClick={() => setPickerOpen(!pickerOpen)} style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
          <span>{current.label}</span>
          <span aria-hidden>{pickerOpen ? '▴' : '▾'}</span>
        </button>
        <div className={pickerOpen ? '' : 'picker-collapsed'}>{picker}</div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="card">
          <h2 style={{ marginBottom: 4 }}>{current.label}</h2>
          <p className="small muted" style={{ marginBottom: 8 }}>
            {CATEGORY_LABELS[d.category]}
            {d.unit ? ` · ${d.unit}` : ''}
            {cfg.speedAdjust ? ' · speed-adjusted' : ''}
          </p>
          <p>{d.description}</p>
          {(d.down || d.up) && (
            <ul className="small" style={{ paddingLeft: 18, marginBottom: 0 }}>
              {d.down && (
                <li>
                  <b>Lower:</b> {d.down}
                </li>
              )}
              {d.up && (
                <li>
                  <b>Higher:</b> {d.up}
                </li>
              )}
            </ul>
          )}
          <button className="btn ghost sm" style={{ paddingLeft: 0 }} onClick={() => onLearn('glossary')}>
            Open glossary
          </button>
        </div>

        {single && <MeasureDots m={single} props={props} height={300} />}
        {perPaw.length > 0 && (
          <>
            <div className="paw-grid" style={{ marginBottom: 16 }}>
              {(['LF', 'RF', 'LH', 'RH'] as const).map((p) => {
                const m = perPaw.find((x) => x.paw === p)
                return m ? <MeasureDots key={p} m={m} props={props} height={210} /> : <div key={p} className="card muted small">No {p} column</div>
              })}
            </div>
            {derived.length > 0 && (
              <div className="grid-2">
                {derived.map((m) => (
                  <MeasureDots key={m.key} m={m} props={props} height={210} />
                ))}
              </div>
            )}
          </>
        )}
        <p className="small muted">
          Dots are individual animals (runs averaged); black bars show mean ± SEM. Labels under groups give the Holm-adjusted p vs {cfg.controlGroup ?? 'the reference'}{' '}
          (* &lt; 0.05, ** &lt; 0.01, *** &lt; 0.001, ns = not significant).
        </p>

        {rows.length > 0 && (
          <div className="card">
            <h3>Statistics{time ? ` · ${time}` : ''}</h3>
            <StatsTable rows={rows} props={props} />
            {rows[0].omnibus && (
              <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>
                Omnibus ({rows[0].omnibus.test}): {rows.map((r) => `${r.measure.paw ?? r.measure.derived ?? ''} p = ${formatP(r.omnibus!.p)}`).join(' · ')}
              </p>
            )}
          </div>
        )}

        {props.agg.times.length > 1 && (
          <div className="grid-2">
            {(single ? [single] : derived.filter((m) => m.derived === 'FRONT' || m.derived === 'HIND')).map((m) => (
              <TimeCourse key={m.key} m={m} props={props} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
