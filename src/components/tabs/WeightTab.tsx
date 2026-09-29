import { useMemo, useState } from 'react'
import { formatNum, formatP } from '../../lib/analysis'
import { finite, mean, pooledWithinSlope } from '../../lib/stats'
import { program } from '../../programs'
import { Scatter } from '../charts/Scatter'
import type { TabProps } from './types'

/** Body weight by group, and each parameter plotted against weight per animal. */
export function WeightTab(props: TabProps & { goSetup: () => void; pick?: string }) {
  const { agg, measures, results, time, theme, colorOf, cfg, goSetup } = props
  const weight = measures.find((m) => m.def.id === 'body_weight')
  const candidates = measures.filter((m) => m !== weight && m.def.id !== 'body_weight')
  const main = ['latency', 'distance', 'speed']
  const [key, setKey] = useState((main.map((id) => candidates.find((c) => c.def.id === id)).find(Boolean) ?? candidates[0])?.key)
  const m = candidates.find((x) => x.key === (props.pick ?? key)) ?? candidates[0]
  const subs = agg.subjects.filter((s) => s.time === time)
  const w = (s: (typeof subs)[number]) => s.weight ?? NaN

  const within = useMemo(() => {
    if (!m) return NaN
    return pooledWithinSlope(subs.map((s) => ({ x: w(s), y: s.values[m.key], g: s.group })))
  }, [m, subs])

  if (!weight) return <div className="card">No body weight found. Add a weights file (Excel or Prism) under Experiment &amp; data.</div>
  const wRes = results.find((t) => t.time === time)?.results.find((r) => r.measure.key === weight.key)
  const n = subs.filter((s) => Number.isFinite(w(s))).length

  return (
    <>
      <div className="card">
        <h2>Body weight</h2>
        <p className="small">
          {program().id === 'rotarod'
            ? 'Heavier mice fall sooner from the rotarod, and weight loss can itself be part of the phenotype.'
            : program().features.paws
              ? 'Print area, intensity and stride scale with body size, and weight loss can itself be part of the phenotype.'
              : 'Body size and condition can affect activity, and weight loss can itself be part of the phenotype.'}{' '}
          If groups differ in weight, check whether a behavioural difference remains after adjusting for it.
        </p>
        <div className="tiles" style={{ marginBottom: 8 }}>
          {agg.groups.map((g) => {
            const v = finite(subs.filter((s) => s.group === g).map(w))
            const c = wRes?.comparisons.find((x) => x.group === g && x.reference === cfg.controlGroup)
            return (
              <div className="tile" key={g}>
                <div className="label">
                  <span className="swatch" style={{ background: colorOf(g), marginRight: 6 }} aria-hidden />
                  {g}
                </div>
                <div className="value">{v.length ? formatNum(mean(v)) : '—'}</div>
                <div className="sub">
                  g · n = {v.length}
                  {c ? ` · vs control p = ${formatP(c.pAdj)}` : ''}
                </div>
              </div>
            )
          })}
        </div>
        <p className="small" style={{ marginBottom: 0 }}>
          Weight adjustment is <b>{cfg.weightAdjust ? 'on' : 'off'}</b>. {n} of {subs.length} animals{time ? ` at ${time}` : ''} have a weight.{' '}
          <button className="btn sm" onClick={goSetup}>
            Change in Setup
          </button>
        </p>
      </div>
      {m && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>Parameter vs body weight (per animal)</h3>
            <select value={m.key} onChange={(e) => setKey(e.target.value)} style={{ width: 'auto', maxWidth: '100%' }} aria-label="Parameter">
              {candidates.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <Scatter
            theme={theme}
            xLabel="Body weight (g)"
            yLabel={`${m.label}${m.def.unit ? ` (${m.def.unit})` : ''}`}
            groups={agg.groups.map((g) => ({
              name: g,
              color: colorOf(g),
              points: subs.filter((s) => s.group === g).map((s) => ({ id: s.id, x: w(s), y: s.values[m.key] })),
            }))}
          />
          {Number.isFinite(within) && (
            <p className="small muted" style={{ marginTop: 8 }}>
              Within groups, {m.label.toLowerCase()} changes by {within > 0 ? '+' : ''}
              {formatNum(within)} {m.def.unit} per gram of body weight (slope pooled within groups, the one used for adjustment).
              {cfg.weightAdjust ? ' Values shown are already weight-adjusted, so little remaining relationship is expected.' : ''}
            </p>
          )}
        </div>
      )}
    </>
  )
}
