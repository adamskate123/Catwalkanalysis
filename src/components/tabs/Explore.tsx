import { useMemo, useState } from 'react'
import { program } from '../../programs'
import { formatNum, formatP, type Measure, type MeasureResult } from '../../lib/analysis'
import { changedMeasures, type Change } from '../../lib/interpret'
import { type ParamDef } from '../../lib/catalog'
import { MeasureDots, TimeCourse } from './figures'
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

function SigMark({ changes, total }: { changes: Change[]; total: number }) {
  if (!changes.length) return null
  const up = changes.filter((c) => c.comparison.diff > 0).length
  const down = changes.length - up
  const arrow = up && down ? '↕' : up ? '↑' : '↓'
  const title = changes.map((c) => `${c.result.measure.label}: g = ${c.comparison.g.toFixed(2)}, p = ${formatP(c.comparison.pAdj)}`).join('\n')
  return (
    <span className="sig-badge" title={title} aria-label={`${changes.length} of ${total} measures changed`}>
      ★ {arrow}
      {total > 1 ? ` ${changes.length}/${total}` : ''}
    </span>
  )
}

export function Explore(props: TabProps & { selected: string | null; setSelected: (k: string) => void }) {
  const { measures, results, time, selected, setSelected, onLearn, cfg, opt } = props
  const entries = useMemo(() => entriesOf(measures), [measures])
  const [q, setQ] = useState('')
  const [onlyChanged, setOnlyChanged] = useState(false)
  const changed = useMemo(() => changedMeasures(results.find((t) => t.time === time), cfg, opt), [results, time, cfg, opt])
  const [pickerOpen, setPickerOpen] = useState(false)
  const current =
    entries.find((e) => e.measures.some((m) => m.key === selected)) ?? entries.find((e) => e.id === selected) ?? entries.find((e) => e.def.id === 'print_area') ?? entries[0]
  if (!current) return <p>No parameters found.</p>

  const tr = results.find((t) => t.time === time)
  const rows = current.measures.map((m) => tr?.results.find((r) => r.measure.key === m.key)).filter((r): r is MeasureResult => Boolean(r))
  const perPaw = current.measures.filter((m) => m.paw)
  const derived = current.measures.filter((m) => m.derived)
  const single = !perPaw.length ? current.measures[0] : null
  const changesOf = (e: Entry) => e.measures.map((m) => changed.get(m.key)).filter((c): c is Change => Boolean(c))
  const filtered = entries.filter((e) => e.label.toLowerCase().includes(q.toLowerCase()) && (!onlyChanged || changesOf(e).length > 0))
  const nChanged = entries.filter((e) => changesOf(e).length > 0).length
  const d = current.def

  const picker = (
    <div className="card picker">
      <input type="search" placeholder="Search parameters" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search parameters" />
      <label className="check small" style={{ marginTop: 8 }}>
        <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} />
        <span>
          Only changed vs {cfg.controlGroup ?? 'control'} <span className="muted">({nChanged})</span>
        </span>
      </label>
      <p className="small muted" style={{ margin: '4px 0 0' }}>
        <span className="sig-badge">★</span> = p &lt; {opt.alpha}
        {opt.useFdr ? ' and FDR' : ''}, |g| ≥ {opt.minEffect}
        {time ? ` at ${time}` : ''}. Arrows show the direction.
      </p>
      {filtered.length === 0 && <p className="small muted">No parameters match.</p>}
      {program().categoryOrder.map((cat) => {
        const list = filtered.filter((e) => e.def.category === cat)
        if (!list.length) return null
        return (
          <div key={cat}>
            <div className="cat">{program().categoryLabels[cat]}</div>
            <ul>
              {list.map((e) => (
                <li key={e.id}>
                  <button
                    aria-current={e.id === current.id}
                    onClick={() => {
                      setSelected((changesOf(e)[0]?.result.measure.key ?? e.measures[0].key))
                      setPickerOpen(false)
                    }}
                  >
                    <span>{e.label}</span>
                    <SigMark changes={changesOf(e)} total={e.measures.length} />
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
            {program().categoryLabels[d.category]}
            {d.unit ? ` · ${d.unit}` : ''}
            {cfg.speedAdjust ? ' · speed-adjusted' : ''}
          </p>
          {changesOf(current).length > 0 ? (
            <div className="notice" style={{ marginBottom: 10 }}>
              <span className="ic">★</span>
              <span>
                Changed vs {cfg.controlGroup ?? 'control'}
                {time ? ` at ${time}` : ''}:{' '}
                {changesOf(current)
                  .map((c) => {
                    const m = c.result.measure
                    const name = m.paw ?? (m.derived ? m.label.split(', ').slice(1).join(', ') : 'value')
                    return `${name} ${c.comparison.diff > 0 ? '↑' : '↓'} (${c.comparison.group}, g = ${c.comparison.g.toFixed(2)}, p = ${formatP(c.comparison.pAdj)})`
                  })
                  .join('; ')}
              </span>
            </div>
          ) : (
            <p className="small muted">Not changed vs {cfg.controlGroup ?? 'control'} at the current thresholds{time ? ` (${time})` : ''}.</p>
          )}
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
          Dots are individual animals ({program().runsNoun} averaged); black bars show mean ± SEM. Labels under groups give the Holm-adjusted p vs {cfg.controlGroup ?? 'the reference'}{' '}
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
