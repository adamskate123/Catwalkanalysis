import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { chartFiles, collectCharts, type GraphFormat } from '../lib/export'
import { LIGHT_THEME, seriesColor } from '../lib/theme'
import { timeCaption } from '../lib/ageWindows'
import { hasTrialAnalysis, program } from '../programs'
import { MeasureDots, TimeCourse } from './tabs/figures'
import { Fingerprint } from './tabs/Fingerprint'
import { TimeTab } from './tabs/TimeTab'
import { TrialsTab } from './tabs/TrialsTab'
import { WeightTab } from './tabs/WeightTab'
import { SpeedTab } from './tabs/SpeedTab'
import type { TabProps } from './tabs/types'

// "Every graph in the app": each tab's charts for every timepoint, comparison and
// parameter choice, rendered off-screen in the light theme and saved as files.

/** Separates folder levels in data-chart-scope (group names may contain "/"). */
const SCOPE_SEP = ' › '

interface Job {
  scope: string
  node: ReactNode
  /** Timepoint written on each exported chart of this job. */
  time?: string
}

const noop = () => {}

function pairsOf(results: TabProps['results'], time?: string) {
  const s = new Map<string, { group: string; reference: string }>()
  for (const t of results) {
    if (time !== undefined && t.time !== time) continue
    for (const r of t.results) for (const c of r.comparisons) s.set(`${c.group}\u0000${c.reference}`, { group: c.group, reference: c.reference })
  }
  return [...s.values()]
}

function jobs(base: TabProps, only?: Set<string>): Job[] {
  const prog = program()
  const { agg, results } = base
  const measures = only ? base.measures.filter((m) => only.has(m.key)) : base.measures
  const times = results.map((r) => r.time)
  const multi = times.length > 1
  const at = (t: string): TabProps => ({ ...base, time: t })
  const timeScope = (t: string) => (multi && t ? t : '')
  const out: Job[] = []

  for (const t of times) {
    out.push({
      scope: ['Parameters', timeScope(t)].filter(Boolean).join(SCOPE_SEP),
      time: timeCaption(base.cfg.timeCol, t),
      node: measures.map((m) => <MeasureDots key={m.key} m={m} props={at(t)} height={260} fullTitle />),
    })
  }
  for (const t of times) {
    const pairs = pairsOf(results, t)
    out.push({
      scope: ['Fingerprint', timeScope(t)].filter(Boolean).join(SCOPE_SEP),
      time: timeCaption(base.cfg.timeCol, t),
      node: pairs.map((p, i) => (
        <div key={i} data-chart-scope={`${p.group} vs ${p.reference}`}>
          <Fingerprint {...at(t)} pairIndex={i} />
        </div>
      )),
    })
  }
  if (multi) {
    const pairs = pairsOf(results)
    out.push({
      scope: 'Over time',
      node: (
        <>
          {measures.map((m) => (
            <TimeCourse key={m.key} m={m} props={base} />
          ))}
          {pairs.map((_, i) => (
            <TimeTab key={i} {...base} pairIndex={i} allParams />
          ))}
        </>
      ),
    })
  }
  if (hasTrialAnalysis(prog) && agg.trials.length > 0) {
    const perTrial = measures.filter((m) => m.col !== undefined && m.def.id !== 'body_weight' && agg.trials.some((t) => Number.isFinite(t.values[m.key])))
    out.push({ scope: prog.trialsTab?.label ?? 'Trials', node: perTrial.map((m) => <TrialsTab key={m.key} {...base} pick={m.key} />) })
  }
  const weight = base.measures.find((m) => m.def.id === 'body_weight')
  if (weight) {
    for (const t of times)
      out.push({
        scope: ['Weight check', timeScope(t)].filter(Boolean).join(SCOPE_SEP),
        time: timeCaption(base.cfg.timeCol, t),
        node: measures.filter((m) => m !== weight).map((m) => <WeightTab key={m.key} {...at(t)} goSetup={noop} pick={m.key} />),
      })
  }
  if (prog.features.speed) {
    const speed = base.measures.find((m) => m.def.id === 'speed')
    for (const t of times)
      out.push({
        scope: ['Speed check', timeScope(t)].filter(Boolean).join(SCOPE_SEP),
        time: timeCaption(base.cfg.timeCol, t),
        node: measures.filter((m) => m !== speed).map((m) => <SpeedTab key={m.key} {...at(t)} goSetup={noop} pick={m.key} />),
      })
  }
  return out
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Mounts `node` off-screen at a print-friendly width and waits for the charts to size themselves. */
async function mountOffscreen(node: ReactNode): Promise<{ el: HTMLElement; done: () => void }> {
  const el = document.createElement('div')
  el.setAttribute('aria-hidden', 'true')
  el.style.cssText = 'position:fixed;left:-20000px;top:0;width:760px;visibility:hidden;pointer-events:none'
  document.body.appendChild(el)
  const root = createRoot(el)
  flushSync(() => root.render(node))
  // Charts measure their container (ResizeObserver) and re-render at that width.
  let last = ''
  for (let i = 0; i < 40; i++) {
    await wait(i < 3 ? 16 : 40)
    const sig = [...el.querySelectorAll('svg[role="img"]')].map((s) => s.getAttribute('width')).join(',')
    if (i >= 2 && sig === last) break
    last = sig
  }
  return {
    el,
    done: () => {
      root.unmount()
      el.remove()
    },
  }
}

/**
 * Renders every chart the app can show for this analysis and returns the files
 * (paths inside the ZIP → bytes). `prefix` is a folder to put them in; `only`
 * limits per-parameter graphs to those measure keys (summary heatmaps are kept).
 */
export async function allGraphFiles(
  props: TabProps,
  format: GraphFormat,
  prefix = '',
  onProgress?: (text: string) => void,
  only?: Set<string>,
): Promise<{ files: Record<string, Uint8Array>; count: number }> {
  const theme = LIGHT_THEME
  const order = props.cfg.groupOrder
  const colorOf = (g: string) => {
    const i = order.indexOf(g)
    return seriesColor(theme, i < 0 ? order.length : i)
  }
  const base: TabProps = { ...props, theme, colorOf, openMeasure: noop, onLearn: noop, setCfg: noop }
  const files: Record<string, Uint8Array> = {}
  let count = 0
  const list = jobs(base, only)
  for (const [i, job] of list.entries()) {
    onProgress?.(`Drawing ${job.scope} (${i + 1} of ${list.length})…`)
    const { el, done } = await mountOffscreen(
      <div data-chart-scope={job.scope} data-chart-time={job.time || undefined}>
        {job.node}
      </div>,
    )
    try {
      const charts = collectCharts(el, prefix)
      const f = await chartFiles(charts, format)
      Object.assign(files, f)
      count += charts.length
    } finally {
      done()
    }
  }
  return { files, count }
}
