import { useMemo, useState } from 'react'
import { formatNum, formatP, primaryComparison } from '../../lib/analysis'
import { describeEvidence, interpret, isSignificant } from '../../lib/interpret'
import { dataWarnings, narrative, topChanges } from '../../lib/report'
import type { TabProps } from './types'

function Md({ text }: { text: string }) {
  // Minimal **bold** support for narrative paragraphs.
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return <>{parts.map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p))}</>
}

export function Summary(props: TabProps & { goSetup: () => void }) {
  const { agg, results, cfg, opt, time, openMeasure, onLearn, goSetup } = props
  const tr = results.find((r) => r.time === time) ?? results[0]
  const findings = useMemo(() => (tr ? interpret(tr, cfg, opt) : []), [tr, cfg, opt])
  const [copied, setCopied] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [allRescue, setAllRescue] = useState(false)
  if (!tr) return <p>No results.</p>

  const subs = agg.subjects.filter((s) => s.time === tr.time)
  const paras = narrative(agg, tr, cfg, opt, findings)
  const warnings = dataWarnings(agg, tr, cfg)
  const top = topChanges(tr, cfg, opt, 12)
  const nSig = tr.results.filter((r) => {
    const c = primaryComparison(r, cfg)
    return c && isSignificant(r, c, opt)
  }).length
  const shown = findings.filter((f) => f.supporting.length > 0)
  const hidden = findings.filter((f) => f.supporting.length === 0)
  const treated = agg.groups.filter((g) => g !== cfg.controlGroup && g !== cfg.diseaseGroup)
  const rescueRows =
    cfg.diseaseGroup && treated.length === 1
      ? tr.results.filter((r) => {
          const c = primaryComparison(r, cfg)
          return c && isSignificant(r, c, opt) && Number.isFinite(r.rescuePct)
        })
      : []

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(paras.map((p) => p.replace(/\*\*/g, '')).join('\n\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <>
      <div className="tiles">
        <div className="tile">
          <div className="label">Animals{tr.time ? ` at ${tr.time}` : ''}</div>
          <div className="value">{subs.length}</div>
          <div className="sub">{agg.groups.length} group{agg.groups.length === 1 ? '' : 's'}</div>
        </div>
        <div className="tile">
          <div className="label">Runs used</div>
          <div className="value">{agg.rowsUsed.toLocaleString()}</div>
          <div className="sub">{agg.rowsNonCompliant ? `${agg.rowsNonCompliant} non-compliant excluded` : 'all timepoints'}</div>
        </div>
        <div className="tile">
          <div className="label">Parameters analysed</div>
          <div className="value">{tr.results.length}</div>
          <div className="sub">incl. front/hind means and asymmetry</div>
        </div>
        <div className="tile">
          <div className="label">Changed vs {cfg.diseaseGroup ? 'control' : 'reference'}</div>
          <div className="value">{nSig}</div>
          <div className="sub">
            p &lt; {opt.alpha}, |g| ≥ {opt.minEffect}
            {opt.useFdr ? ', FDR' : ''}
          </div>
        </div>
      </div>

      {warnings.map((w) => (
        <div key={w.text} className={`notice ${w.level}`}>
          <span className="ic" aria-hidden>
            {w.level === 'warning' ? '!' : 'i'}
          </span>
          <span>{w.text}</span>
        </div>
      ))}

      <div className="card narrative">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Summary{tr.time ? ` · ${tr.time}` : ''}</h2>
          <span className="row no-print">
            <button className="btn sm" onClick={copy}>
              {copied ? 'Copied' : 'Copy text'}
            </button>
            <button className="btn sm" onClick={goSetup}>
              Adjust setup
            </button>
          </span>
        </div>
        <div style={{ marginTop: 10 }}>
          {paras.map((p, i) => (
            <p key={i} className={i === paras.length - 1 ? 'small muted' : undefined}>
              <Md text={p} />
            </p>
          ))}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Phenotype patterns</h2>
          <p className="small muted">
            Each pattern is a set of parameters that tend to change together in a kind of neurological deficit. The bar shows how much of the pattern is present.{' '}
            <button className="btn ghost sm" style={{ padding: 0, minHeight: 0 }} onClick={() => onLearn('diseases')}>
              Learn more
            </button>
          </p>
          {shown.length === 0 && <p className="small">No pattern has supporting evidence at the current thresholds.</p>}
          {shown.map((f) => (
            <div className="domain" key={f.domain.id}>
              <header>
                <h4>{f.domain.title}</h4>
                <span className={`badge${f.supporting.length >= 2 ? ' strong' : ''}`}>
                  {f.supporting.length} of {f.available} markers
                </span>
              </header>
              <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(f.score * 100)} aria-label="Share of pattern markers present">
                <span style={{ width: `${Math.max(3, f.score * 100)}%` }} />
              </div>
              <p className="small" style={{ margin: 0 }}>
                {f.domain.summary}
                {f.side ? ` The ${f.side} side appears more affected.` : ''}
              </p>
              <ul>
                {f.supporting.slice(0, 6).map((e) => (
                  <li key={e.result.measure.key}>
                    <button className="btn ghost sm" style={{ padding: 0, minHeight: 0, textAlign: 'left' }} onClick={() => openMeasure(e.result.measure.key)}>
                      {describeEvidence(e)}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="small muted" style={{ marginTop: 6, marginBottom: 0 }}>
                Seen in: {f.domain.conditions}
              </p>
            </div>
          ))}
          {hidden.length > 0 && (
            <>
              <button className="btn ghost sm" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Hide' : 'Show'} {hidden.length} pattern{hidden.length > 1 ? 's' : ''} with no evidence
              </button>
              {showAll && (
                <ul className="small">
                  {hidden.map((f) => (
                    <li key={f.domain.id}>
                      {f.domain.title} <span className="muted">({f.available} markers checked)</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="card">
          <h2>Largest changes</h2>
          <p className="small muted">Ranked by effect size (Hedges g). Tap a row to see the data.</p>
          {top.length === 0 ? (
            <p className="small">No parameter reached p &lt; {opt.alpha}.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th className="num">Change</th>
                    <th className="num">g</th>
                    <th className="num">p</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map(({ r, c }) => (
                    <tr key={r.measure.key} className="clickable" onClick={() => openMeasure(r.measure.key)}>
                      <td style={{ whiteSpace: 'normal', minWidth: 140 }}>
                        {r.measure.label}
                        {agg.groups.length > 2 && <div className="small muted">{c.group}</div>}
                      </td>
                      <td className="num">
                        {r.measure.derived?.startsWith('ASYM') || !Number.isFinite(c.diffPct)
                          ? `${c.diff > 0 ? '+' : ''}${formatNum(c.diff)}`
                          : `${c.diffPct > 0 ? '+' : ''}${c.diffPct.toFixed(0)}%`}
                      </td>
                      <td className="num">{c.g.toFixed(2)}</td>
                      <td className="num">{formatP(c.pAdj)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {rescueRows.length > 0 && (
        <div className="card">
          <h2>Treatment effect: {treated[0]}</h2>
          <p className="small muted">
            Rescue % = ({treated[0]} − {cfg.diseaseGroup}) / ({cfg.controlGroup} − {cfg.diseaseGroup}) × 100, for parameters where {cfg.diseaseGroup} differs from{' '}
            {cfg.controlGroup}. 0% means no change from the untreated disease group; 100% means fully back to control. Values are unstable when the deficit is small.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th className="num">Deficit (g)</th>
                  <th className="num">Rescue</th>
                  <th className="num">p vs {cfg.diseaseGroup}</th>
                </tr>
              </thead>
              <tbody>
                {[...rescueRows]
                  .sort((a, b) => Math.abs(primaryComparison(b, cfg)!.g) - Math.abs(primaryComparison(a, cfg)!.g))
                  .slice(0, allRescue ? undefined : 12)
                  .map((r) => {
                    const vsD = r.comparisons.find((c) => c.group === treated[0] && c.reference === cfg.diseaseGroup)
                    return (
                      <tr key={r.measure.key} className="clickable" onClick={() => openMeasure(r.measure.key)}>
                        <td style={{ whiteSpace: 'normal', minWidth: 140 }}>{r.measure.label}</td>
                        <td className="num">{primaryComparison(r, cfg)!.g.toFixed(2)}</td>
                        <td className="num">{r.rescuePct!.toFixed(0)}%</td>
                        <td className={`num${vsD && vsD.pAdj < opt.alpha ? ' sig' : ''}`}>{vsD ? formatP(vsD.pAdj) : '—'}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
          {rescueRows.length > 12 && (
            <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => setAllRescue(!allRescue)}>
              {allRescue ? 'Show the 12 largest deficits' : `Show all ${rescueRows.length} parameters`}
            </button>
          )}
        </div>
      )}
    </>
  )
}
