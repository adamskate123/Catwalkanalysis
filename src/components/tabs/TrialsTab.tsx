import { useRef, useState } from 'react'
import { trialAxis, trialValue } from '../../lib/analysis'
import { finite, mean, sem } from '../../lib/stats'
import { program } from '../../programs'
import { LineChart, type LineSeries } from '../charts/LineChart'
import { ChartCard } from './figures'
import type { TabProps } from './types'

/** Learning curves: each measure across the ordered trials of every session. */
export function TrialsTab(props: TabProps & { pick?: string }) {
  const { agg, measures, theme, colorOf } = props
  const prog = program()
  const perTrial = measures.filter((m) => m.col !== undefined && m.def.id !== 'body_weight' && agg.trials.some((t) => Number.isFinite(t.values[m.key])))
  const [key, setKey] = useState(perTrial[0]?.key ?? '')
  const ref = useRef<SVGSVGElement>(null)
  const m = perTrial.find((x) => x.key === (props.pick ?? key)) ?? perTrial[0]
  if (!m) return <div className="card">No per-{prog.runNoun} values found. Load a file with one row per {prog.runNoun} and a {prog.runNoun} number column.</div>

  const noun = prog.trialColumn ?? prog.runNoun[0].toUpperCase() + prog.runNoun.slice(1)
  const axis = trialAxis(agg, noun)
  const series: LineSeries[] = agg.groups.map((g) => {
    const ids = [...new Set(agg.trials.filter((r) => r.group === g).map((r) => r.id))]
    return {
      name: g,
      color: colorOf(g),
      points: axis.map((a) => {
        const vals = finite(ids.map((id) => trialValue(agg, m.key, id, g, a.time, a.trial)))
        return { x: a.label, mean: mean(vals), sem: sem(vals), n: vals.length }
      }),
    }
  })

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>{prog.trialsTab?.title ?? 'Trials'}</h2>
          {perTrial.length > 1 && (
            <select value={m.key} onChange={(e) => setKey(e.target.value)} style={{ width: 'auto' }} aria-label="Parameter">
              {perTrial.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.label}
                </option>
              ))}
            </select>
          )}
        </div>
        <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>
          {prog.trialsTab?.text ?? `Group mean ± SEM for every ${prog.runNoun}.`} For a formal {prog.runNoun} × group test, download the Prism file (Data &amp; export →
          grouped tables "by {(prog.trialColumn ?? prog.runNoun).toLowerCase()}") and run a repeated-measures two-way ANOVA or mixed-effects model.
        </p>
      </div>
      <ChartCard title={`${m.label.replace(/ per (interval|trial|bin)$/i, '')} by ${noun.toLowerCase()}`} svg={ref} name={`${m.label}_by_${noun.toLowerCase()}`}>
        <LineChart series={series} xs={axis.map((a) => a.label)} theme={theme} unit={m.def.unit} svgRef={ref} height={300} note={`Group mean ± SEM for each ${noun.toLowerCase()}.`} />
      </ChartCard>
    </>
  )
}
