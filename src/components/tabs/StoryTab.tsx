import { useMemo, type ReactNode } from 'react'
import { formatP, primaryComparison, type Measure } from '../../lib/analysis'
import { download, safeName } from '../../lib/export'
import { describeEvidence, interpret, isSignificant, type DomainFinding, type Evidence } from '../../lib/interpret'
import { buildPrismTables, describeSettings, toPzfx } from '../../lib/prism'
import { dataWarnings, narrative } from '../../lib/report'
import { APP_VERSION } from '../../version'
import { MeasureDots, TimeCourse } from './figures'
import type { TabProps } from './types'

const MAX_FIGURES = 6

function Md({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return <>{parts.map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p))}</>
}

/** Strongest supporting measures, one per measure, largest effect first. */
function topEvidence(f: DomainFinding): Evidence[] {
  const seen = new Set<string>()
  return [...f.supporting]
    .sort((a, b) => Math.abs(b.comparison.g) - Math.abs(a.comparison.g))
    .filter((e) => !seen.has(e.result.measure.key) && seen.add(e.result.measure.key))
    .slice(0, MAX_FIGURES)
}

function strength(f: DomainFinding): { label: string; strong: boolean } {
  const strong = f.supporting.length >= 3 || (f.supporting.length >= 2 && f.score >= 0.4)
  return { label: strong ? 'Strong pattern' : 'Suggestive', strong }
}

function PrismButton({ measures, name, props }: { measures: Measure[]; name: string; props: TabProps }) {
  const { agg, cfg } = props
  const exportIt = () => {
    const tables = buildPrismTables(agg, { measures, layout: agg.times.length > 1 ? 'both' : 'column', appVersion: APP_VERSION })
    const notes = `${describeSettings(cfg)} Figures for: ${name}.`
    download(`${safeName(name)}_${new Date().toISOString().slice(0, 10)}.pzfx`, toPzfx(tables, { appVersion: APP_VERSION, notes }), 'application/xml')
  }
  return (
    <button className="btn sm" onClick={exportIt} disabled={!measures.length}>
      Export these figures to Prism
    </button>
  )
}

function Chapter({ index, title, badge, children }: { index: number; title: string; badge?: { label: string; strong: boolean }; children: ReactNode }) {
  return (
    <section className="card story-chapter">
      <header className="story-head">
        <span className="story-n">{index}</span>
        <h2>{title}</h2>
        {badge && <span className={`badge${badge.strong ? ' strong' : ''}`}>{badge.label}</span>}
      </header>
      {children}
    </section>
  )
}

export function StoryTab(props: TabProps) {
  const { ds, agg, results, cfg, opt, time, openMeasure, onLearn, measures } = props
  const tr = results.find((r) => r.time === time) ?? results[0]
  const findings = useMemo(() => (tr ? interpret(tr, cfg, opt).filter((f) => f.supporting.length > 0) : []), [tr, cfg, opt])
  if (!tr) return <p>No results.</p>

  const paras = narrative(agg, tr, cfg, opt, findings)
  const cautions = dataWarnings(agg, tr, cfg, ds).filter((w) => w.level === 'warning')
  const speed = measures.find((m) => m.def.id === 'speed')
  const speedRes = speed && tr.results.find((r) => r.measure.key === speed.key)
  const speedDiffers = Boolean(speedRes?.comparisons.some((c) => c.pAdj < opt.alpha))
  const treated = agg.groups.filter((g) => g !== cfg.controlGroup && g !== cfg.diseaseGroup)
  const rescued =
    cfg.diseaseGroup && treated.length === 1
      ? tr.results
          .filter((r) => {
            const c = primaryComparison(r, cfg)
            return c && isSignificant(r, c, opt) && Number.isFinite(r.rescuePct)
          })
          .sort((a, b) => Math.abs(primaryComparison(b, cfg)!.g) - Math.abs(primaryComparison(a, cfg)!.g))
          .slice(0, MAX_FIGURES)
      : []
  const multiTime = agg.times.length > 1
  let n = 0

  return (
    <>
      <div className="card narrative">
        <h2 style={{ marginTop: 0 }}>The story{tr.time ? ` at ${tr.time}` : ''}</h2>
        <p className="small muted">
          Figures grouped by what they suggest together. Each section shows the parameters behind a phenotype pattern, what the pattern may mean, and tests
          that could confirm it. Tap a listed parameter to open its full statistics.
        </p>
        {paras.slice(0, -1).map((p, i) => (
          <p key={i}>
            <Md text={p} />
          </p>
        ))}
      </div>

      {findings.length === 0 && (
        <div className="card">
          <p style={{ margin: 0 }}>
            No phenotype pattern has supporting evidence at the current thresholds (p &lt; {opt.alpha}, |g| ≥ {opt.minEffect}
            {opt.useFdr ? ', FDR' : ''}). You can relax the thresholds in Setup → Statistics, or browse individual parameters.
          </p>
        </div>
      )}

      {findings.map((f) => {
        const ev = topEvidence(f)
        const s = strength(f)
        return (
          <Chapter key={f.domain.id} index={++n} title={f.domain.title} badge={s}>
            <p className="story-lede">
              <b>What we see.</b> {f.domain.summary}
              {f.side ? ` The ${f.side} side appears more affected.` : ''} {f.supporting.length} of {f.available} markers of this pattern changed:
            </p>
            <ul className="small story-evidence">
              {ev.map((e) => (
                <li key={e.result.measure.key}>
                  <button className="btn ghost sm" style={{ padding: 0, minHeight: 0, textAlign: 'left' }} onClick={() => openMeasure(e.result.measure.key)}>
                    {describeEvidence(e)}
                  </button>
                </li>
              ))}
              {f.supporting.length > ev.length && <li className="muted">and {f.supporting.length - ev.length} more</li>}
            </ul>
            <div className="story-grid">
              {ev.map((e) => (
                <MeasureDots key={e.result.measure.key} m={e.result.measure} props={props} height={220} fullTitle />
              ))}
            </div>
            {multiTime && ev[0] && (
              <div className="story-grid">
                {ev.slice(0, 2).map((e) => (
                  <TimeCourse key={e.result.measure.key} m={e.result.measure} props={props} />
                ))}
              </div>
            )}
            <div className="grid-2" style={{ marginTop: 4 }}>
              <div>
                <h3>What it might mean</h3>
                <p className="small">{f.domain.meaning}</p>
                <p className="small muted">Seen in: {f.domain.conditions}</p>
              </div>
              <div>
                <h3>To confirm</h3>
                <ul className="small" style={{ paddingLeft: 18 }}>
                  {f.domain.followUp.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="row no-print">
              <PrismButton measures={ev.map((e) => e.result.measure)} name={f.domain.title} props={props} />
              <button className="btn ghost sm" onClick={() => onLearn('diseases')}>
                Background on gait patterns
              </button>
            </div>
          </Chapter>
        )
      })}

      {rescued.length > 0 && (
        <Chapter index={++n} title={`Treatment effect: ${treated[0]}`} badge={{ label: 'Rescue', strong: true }}>
          <p className="story-lede">
            <b>What we see.</b> For the parameters where {cfg.diseaseGroup} differed most from {cfg.controlGroup}, this is where {treated[0]} falls between the two
            (0% = no change from {cfg.diseaseGroup}, 100% = back to {cfg.controlGroup}):
          </p>
          <ul className="small story-evidence">
            {rescued.map((r) => {
              const vsD = r.comparisons.find((c) => c.group === treated[0] && c.reference === cfg.diseaseGroup)
              return (
                <li key={r.measure.key}>
                  {r.measure.label}: {r.rescuePct!.toFixed(0)}% rescued{vsD ? ` (vs ${cfg.diseaseGroup} p = ${formatP(vsD.pAdj)})` : ''}
                </li>
              )
            })}
          </ul>
          <div className="story-grid">
            {rescued.map((r) => (
              <MeasureDots key={r.measure.key} m={r.measure} props={props} height={220} fullTitle />
            ))}
          </div>
          {multiTime && (
            <div className="story-grid">
              {rescued.slice(0, 2).map((r) => (
                <TimeCourse key={r.measure.key} m={r.measure} props={props} />
              ))}
            </div>
          )}
          <p className="small">
            A consistent partial rescue across several parameters supports a real treatment effect. Rescue confined to one or two parameters, or values above 100%,
            deserve a closer look at variability and group sizes.
          </p>
          <div className="row no-print">
            <PrismButton measures={rescued.map((r) => r.measure)} name={`Treatment effect ${treated[0]}`} props={props} />
          </div>
        </Chapter>
      )}

      {(speedDiffers || cautions.length > 0) && (
        <Chapter index={++n} title="Before drawing conclusions" badge={{ label: 'Caveats', strong: false }}>
          <p className="story-lede">Other explanations to rule out before attributing these changes to the disease or treatment:</p>
          <ul className="small">
            {cautions.map((w) => (
              <li key={w.text}>{w.text}</li>
            ))}
          </ul>
          {speedDiffers && speed && (
            <div className="story-grid">
              <MeasureDots m={speed} props={props} height={220} fullTitle />
            </div>
          )}
        </Chapter>
      )}
    </>
  )
}
