import { useRef } from 'react'
import { formatNum, formatP } from '../../lib/analysis'
import { benjaminiHochberg, finite, hedgesG, mean, meanCI, oneSampleT, sem, welchT } from '../../lib/stats'
import { sexOf } from '../../lib/weightRef'
import { LineChart, type LineSeries } from '../charts/LineChart'
import { ChartCard } from './figures'
import type { TabProps } from './types'

const weekOf = (t: string) => {
  const m = /^Week (\d+)$/.exec(t)
  return m ? Number(m[1]) : null
}

const ci = (c: { lo: number; hi: number }) => (Number.isFinite(c.lo) ? `${formatNum(c.lo)} to ${formatNum(c.hi)}` : '—')

/**
 * Weight against a reference strain: growth curves with the reference mean ± SD,
 * z-scores over time, each group's z-scores tested against 0 week by week, and
 * each animal's average z-score compared between groups.
 */
export function WeightRefTab(props: TabProps) {
  const { ds, agg, measures, cfg, theme, colorOf } = props
  const ref = ds.reference
  const zM = measures.find((m) => m.def.id === 'weight_z')
  const wM = measures.find((m) => m.def.id === 'body_weight')
  const pM = measures.find((m) => m.def.id === 'weight_pct_ref')
  const growthRefs = { M: useRef<SVGSVGElement>(null), F: useRef<SVGSVGElement>(null) }
  const zRef = useRef<SVGSVGElement>(null)
  if (!ref || !zM || !wM) {
    return (
      <div className="card">
        <h2>Reference strain</h2>
        <p className="small">
          No reference comparison yet. Weight Lab needs each animal’s <b>sex</b>, <b>date of birth</b> and the <b>weigh dates</b> (one column per date, or a
          date column) to place each weigh-in at an age and compare it with {ref?.name ?? 'the reference strain'}.
        </p>
      </div>
    )
  }
  const times = agg.times.length ? agg.times : ['']
  const byWeek = times.every((t) => weekOf(t) !== null)
  const control = cfg.controlGroup
  const zKey = zM.key
  const pKey = pM?.key

  // Growth curves per sex, with the reference mean ± SD where timepoints are weeks
  const sexes = (['M', 'F'] as const).filter((sx) => agg.subjects.some((s) => sexOf(s.sex ?? null) === sx))
  const growth = sexes.map((sx) => {
    const series: LineSeries[] = agg.groups.map((g) => ({
      name: g,
      color: colorOf(g),
      points: times.map((t) => {
        const v = finite(agg.subjects.filter((s) => s.group === g && s.time === t && sexOf(s.sex ?? null) === sx).map((s) => s.values[wM.key]))
        return { x: t, mean: mean(v), sem: sem(v), n: v.length }
      }),
    }))
    if (byWeek)
      series.push({
        name: `${ref.name} (mean ± SD)`,
        color: theme.muted,
        points: times.map((t) => {
          const r = ref.weeks.find((w) => w.week === weekOf(t))?.[sx === 'M' ? 'm' : 'f']
          return { x: t, mean: r?.mean ?? NaN, sem: r?.sd ?? NaN, n: 0 }
        }),
      })
    return { sx, series }
  })

  const zSeries: LineSeries[] = agg.groups.map((g) => ({
    name: g,
    color: colorOf(g),
    points: times.map((t) => {
      const v = finite(agg.subjects.filter((s) => s.group === g && s.time === t).map((s) => s.values[zKey]))
      return { x: t, mean: mean(v), sem: sem(v), n: v.length }
    }),
  }))

  // Week by week: each group's z-scores against 0 (the reference mean), FDR across weeks
  const weekly = agg.groups.map((g) => {
    const rows = times.map((t) => {
      const z = finite(agg.subjects.filter((s) => s.group === g && s.time === t).map((s) => s.values[zKey]))
      const pct = pKey ? finite(agg.subjects.filter((s) => s.group === g && s.time === t).map((s) => s.values[pKey])) : []
      return { t, c: meanCI(z), p: oneSampleT(z).p, pct: mean(pct) }
    })
    const q = benjaminiHochberg(rows.map((r) => r.p))
    return { g, rows: rows.map((r, i) => ({ ...r, q: q[i] })) }
  })

  // Whole curve: each animal's mean z-score across its weigh-ins
  const animalZ = new Map<string, number[]>()
  const perAnimal = new Map<string, { g: string; z: number[] }>()
  for (const s of agg.subjects) {
    const z = s.values[zKey]
    if (!Number.isFinite(z)) continue
    const k = `${s.group}\u0000${s.id}`
    const e = perAnimal.get(k) ?? { g: s.group, z: [] }
    e.z.push(z)
    perAnimal.set(k, e)
  }
  for (const { g, z } of perAnimal.values()) animalZ.set(g, [...(animalZ.get(g) ?? []), mean(z)])
  const ctrlZ = control ? (animalZ.get(control) ?? []) : []
  const overall = agg.groups.map((g) => {
    const z = animalZ.get(g) ?? []
    const vs = control && g !== control && z.length && ctrlZ.length ? { t: welchT(z, ctrlZ), g: hedgesG(z, ctrlZ), d: mean(z) - mean(ctrlZ) } : null
    return { g, c: meanCI(z), p: oneSampleT(z).p, vs }
  })

  return (
    <>
      <div className="card">
        <h2>Reference strain: {ref.name}</h2>
        <p className="small">
          Every weigh-in is compared with the {ref.name} mean and SD for the same sex and week of age (z-score = (weight − reference mean) ÷ reference SD;
          z ≤ −2 is about the lightest 2.5% of the reference colony). Weigh-ins outside the reference weeks ({Math.min(...ref.weeks.map((w) => w.week))}–
          {Math.max(...ref.weeks.map((w) => w.week))}) or without a recorded sex have no z-score.
        </p>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Source: {ref.source}. The reference is a colony average, not a background-matched control; use it alongside your own controls
          {control ? ` (${control})` : ''}.
        </p>
      </div>

      <div className="card">
        <h3>Whole growth curve: each animal’s average z-score</h3>
        <p className="small muted">
          One value per animal (the mean of its z-scores across all weigh-ins), so animals weighed more often don’t count more. Tested against 0 (the reference
          mean) with a one-sample t-test{control ? `, and against ${control} with Welch’s t-test` : ''}.
        </p>
        <div className="table-wrap">
          <table className="small">
            <thead>
              <tr>
                <th>Group</th>
                <th className="num">Animals</th>
                <th className="num">Mean z</th>
                <th className="num">95% CI</th>
                <th className="num">p vs reference</th>
                {control && <th className="num">Δz vs {control}</th>}
                {control && <th className="num">Hedges g</th>}
                {control && <th className="num">p vs {control}</th>}
              </tr>
            </thead>
            <tbody>
              {overall.map((o) => (
                <tr key={o.g}>
                  <td>
                    <span className="swatch" style={{ background: colorOf(o.g), marginRight: 6 }} aria-hidden />
                    {o.g}
                  </td>
                  <td className="num">{o.c.n}</td>
                  <td className="num">{formatNum(o.c.mean)}</td>
                  <td className="num">{ci(o.c)}</td>
                  <td className="num">{formatP(o.p)}</td>
                  {control && <td className="num">{o.vs ? formatNum(o.vs.d) : '—'}</td>}
                  {control && <td className="num">{o.vs ? formatNum(o.vs.g) : '—'}</td>}
                  {control && <td className="num">{o.vs ? formatP(o.vs.t.p) : '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {growth.map(({ sx, series }) => (
        <ChartCard key={sx} title={`Body weight, ${sx === 'M' ? 'males' : 'females'}`} svg={growthRefs[sx]} name={`Body weight ${sx === 'M' ? 'males' : 'females'} vs reference`}>
          <LineChart
            series={series}
            xs={times}
            theme={theme}
            unit={wM.def.unit}
            svgRef={growthRefs[sx]}
            height={300}
            note={`Groups: mean ± SEM of ${sx === 'M' ? 'males' : 'females'}. ${byWeek ? `Grey: ${ref.name} mean ± 1 SD for ${sx === 'M' ? 'males' : 'females'} at that week.` : 'Switch timepoints to weeks of age to show the reference curve.'}`}
          />
        </ChartCard>
      ))}

      <ChartCard title="Weight z-score vs reference over time" svg={zRef} name="Weight z-score vs reference">
        <LineChart series={zSeries} xs={times} theme={theme} unit="SD" svgRef={zRef} height={280} note={`Mean ± SEM of z-scores (both sexes; z is already sex- and age-matched). 0 = ${ref.name} mean; −2 ≈ lightest 2.5% of the reference.`} />
      </ChartCard>

      <div className="card">
        <h3>Week by week: z-score against the reference</h3>
        <p className="small muted">
          Mean z (95% CI), n animals, and the one-sample t-test against 0. q is the Benjamini–Hochberg FDR across timepoints within each group.
        </p>
        <div className="table-wrap" style={{ maxHeight: 520 }}>
          <table className="small">
            <thead>
              <tr>
                <th>Timepoint</th>
                {weekly.map((w) => (
                  <th key={w.g}>{w.g}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {times.map((t, i) => (
                <tr key={t}>
                  <td>{t}</td>
                  {weekly.map((w) => {
                    const r = w.rows[i]
                    return (
                      <td key={w.g}>
                        {r.c.n ? (
                          <>
                            z = {formatNum(r.c.mean)} ({ci(r.c)}), n = {r.c.n}
                            <br />
                            <span className="muted">
                              p = {formatP(r.p)}, q = {formatP(r.q)}
                              {Number.isFinite(r.pct) ? `, ${formatNum(r.pct)}% of ref` : ''}
                            </span>
                          </>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
