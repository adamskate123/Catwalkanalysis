import { useMemo, useState } from 'react'
import { formatNum, formatP } from '../../lib/analysis'
import { linearFit, finite } from '../../lib/stats'
import { Scatter } from '../charts/Scatter'
import type { TabProps } from './types'

export function SpeedTab(props: TabProps & { goSetup: () => void }) {
  const { agg, measures, results, time, theme, colorOf, cfg, goSetup, onLearn } = props
  const speed = measures.find((m) => m.def.id === 'speed')
  const candidates = measures.filter((m) => m !== speed)
  const [key, setKey] = useState(() => candidates.find((m) => m.key === 'stride_length|HIND')?.key ?? candidates.find((m) => m.def.id === 'stand')?.key ?? candidates[0]?.key)
  const m = candidates.find((x) => x.key === key)
  const subs = agg.subjects.filter((s) => s.time === time)

  const fit = useMemo(() => {
    if (!m) return null
    const pts = subs.filter((s) => Number.isFinite(s.speed) && Number.isFinite(s.values[m.key]))
    return { ...linearFit(pts.map((s) => s.speed), pts.map((s) => s.values[m.key])), n: pts.length }
  }, [m, subs])

  if (!speed) {
    return (
      <div className="card">
        <h2>Speed check</h2>
        <p>No average-speed column was recognised in your file, so speed effects can't be checked. Include "Average Speed" in the CatWalk export to enable this.</p>
      </div>
    )
  }

  const speedRes = results.find((t) => t.time === time)?.results.find((r) => r.measure.key === speed.key)
  const speedCmp = speedRes?.comparisons ?? []

  return (
    <>
      <div className="card">
        <h2>Speed check</h2>
        <p className="small">
          Almost every CatWalk parameter changes with walking speed. If groups walk at different speeds, a difference in (say) stand duration may simply reflect
          that speed difference rather than a specific gait deficit.{' '}
          <button className="btn ghost sm" style={{ padding: 0, minHeight: 0 }} onClick={() => onLearn('speed')}>
            Read more
          </button>
        </p>
        <div className="tiles" style={{ marginBottom: 8 }}>
          {agg.groups.map((g) => {
            const v = finite(subs.filter((s) => s.group === g).map((s) => s.speed))
            const c = speedCmp.find((x) => x.group === g && x.reference === cfg.controlGroup)
            return (
              <div className="tile" key={g}>
                <div className="label">
                  <span className="swatch" style={{ background: colorOf(g), marginRight: 6 }} aria-hidden />
                  {g}
                </div>
                <div className="value">{formatNum(v.reduce((a, b) => a + b, 0) / v.length)}</div>
                <div className="sub">cm/s{c ? ` · vs control p = ${formatP(c.pAdj)}` : ''}</div>
              </div>
            )
          })}
        </div>
        <p className="small" style={{ marginBottom: 0 }}>
          Speed adjustment is <b>{cfg.speedAdjust ? 'on' : 'off'}</b>.{' '}
          <button className="btn sm" onClick={goSetup}>
            Change in Setup
          </button>
        </p>
      </div>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Parameter vs speed (per animal)</h3>
          <select value={key} onChange={(e) => setKey(e.target.value)} style={{ width: 'auto', maxWidth: '100%' }} aria-label="Parameter">
            {candidates.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        {m && (
          <>
            <Scatter
              theme={theme}
              xLabel="Average speed (cm/s)"
              yLabel={`${m.label}${m.def.unit ? ` (${m.def.unit})` : ''}`}
              groups={agg.groups.map((g) => ({
                name: g,
                color: colorOf(g),
                points: subs.filter((s) => s.group === g).map((s) => ({ id: s.id, x: s.speed, y: s.values[m.key] })),
              }))}
            />
            {fit && Number.isFinite(fit.r2) && (
              <p className="small muted" style={{ marginTop: 8 }}>
                Across all {fit.n} animals, speed explains {(fit.r2 * 100).toFixed(0)}% of the variance in this parameter (r² = {fit.r2.toFixed(2)}, slope ={' '}
                {formatNum(fit.slope)} per cm/s).
                {cfg.speedAdjust ? ' Values shown are already speed-adjusted, so little remaining relationship is expected.' : ''}
              </p>
            )}
          </>
        )}
      </div>
    </>
  )
}
