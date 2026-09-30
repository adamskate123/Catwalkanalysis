import { program } from '../programs'
import { COMPLIANT_DURATION, DEFAULT_MAX_VARIATION } from './analysis'
import { toNumber } from './parse'
import type { Dataset } from './parse'
import {
  formatNum,
  formatP,
  primaryComparison,
  type AggregateResult,
  type AnalysisConfig,
  type Comparison,
  type MeasureResult,
  type TimeResults,
} from './analysis'
import { describeEvidence, interpret, isReported, isSignificant, type DomainFinding, type InterpretOptions } from './interpret'

export interface Warning {
  level: 'info' | 'warning'
  text: string
}

function describeCounts(m: Map<string, number>): string {
  return [...m].map(([k, n]) => `${n} ${k}`).join(', ')
}

/** Share of latency values at the maximum (a trial cut-off), when that share is large. */
export function ceilingShare(ds: Dataset): { count: number; n: number; max: number } | null {
  const param = program().ceilingParam
  if (!param) return null
  const i = ds.columns.findIndex((c) => c.match?.paramId === param)
  if (i < 0) return null
  const vals = ds.rows.map((r) => toNumber(r[i])).filter((v): v is number => v !== null && Number.isFinite(v))
  if (vals.length < 20) return null
  const max = Math.max(...vals)
  const count = vals.filter((v) => v === max).length
  return count / vals.length >= 0.1 && count >= 5 ? { count, n: vals.length, max } : null
}

export function dataWarnings(agg: AggregateResult, tr: TimeResults | undefined, cfg: AnalysisConfig, ds?: Dataset): Warning[] {
  const w: Warning[] = []
  if (ds) {
    for (const n of ds.notices) w.push({ level: 'info', text: n })
    const ceiling = ceilingShare(ds)
    if (ceiling)
      w.push({
        level: 'warning',
        text: `${ceiling.count} of ${ceiling.n} ${program().test} values (${Math.round((ceiling.count / ceiling.n) * 100)}%) sit exactly at ${+ceiling.max.toFixed(2)} s, which looks like the trial cut-off. Animals that reach the cut-off can't score higher, so differences among good performers are compressed and data are skewed. Consider the non-parametric tests (Setup → Statistics) and a longer maximum trial time or faster acceleration in future cohorts.`,
      })
    // Acquisition settings must be constant for intensities and areas to be comparable.
    const varying = ds.columns.filter((c) => c.meta === 'equipment' && c.distinct > 1).map((c) => c.name)
    if (varying.length)
      w.push({
        level: 'warning',
        text: `Acquisition settings differ between recordings (${varying.join(', ')}). Intensity and area parameters are only comparable when camera gain, intensity threshold and lighting are identical.`,
      })
    for (const k of ds.keys) {
      if (k.unmatchedData.length)
        w.push({
          level: 'warning',
          text: `Animal key ${k.file}: no entry for ${k.unmatchedData.join(', ')} (matched on ${k.dataColumn} = ${k.keyColumn}). Check the join, or pick the ID columns by hand, under Setup → Animal key.`,
        })
      for (const n of k.notes) w.push({ level: 'info', text: `Note from ${k.file}: ${n}` })
    }
  }
  if (cfg.maxVariation === null && agg.rowsAboveDefaultVariation > 0) {
    w.push({
      level: 'warning',
      text: `${agg.rowsAboveDefaultVariation} of ${agg.rowsTotal} runs have a maximum speed variation above ${DEFAULT_MAX_VARIATION}%, meaning the animal hesitated or stopped. Common practice is to exclude such runs; you can do this under Setup → Run quality.`,
    })
  }
  if (tr) {
    const subs = agg.subjects.filter((s) => s.time === tr.time)
    // Sex composition per group
    if (subs.some((s) => s.sex)) {
      // Groups with no animals at this timepoint say nothing about balance.
      const byGroup = agg.groups.filter((g) => subs.some((s) => s.group === g)).map((g) => {
        const m = new Map<string, number>()
        for (const s of subs.filter((x) => x.group === g)) m.set(s.sex ?? '?', (m.get(s.sex ?? '?') ?? 0) + 1)
        return { g, m }
      })
      const sexes = new Set(subs.map((s) => s.sex ?? '?'))
      const unbalanced = byGroup.some(({ m }) => [...sexes].some((x) => !m.has(x)))
      if (unbalanced && sexes.size > 1)
        w.push({
          level: 'warning',
          text: `Sex is not balanced across groups (${byGroup.map(({ g, m }) => `${g}: ${describeCounts(m)}`).join('; ')}). ${program().features.paws ? 'Sex affects body size, print area and speed' : 'Sex affects body weight and performance'}; consider filtering to one sex under Setup → Filters.`,
        })
    }
    // Age differences
    const ages = agg.groups.map((g) => ({ g, a: subs.filter((s) => s.group === g && s.age !== undefined).map((s) => s.age!) }))
    if (ages.filter((x) => x.a.length).length >= 2) {
      const means = ages.filter((x) => x.a.length).map((x) => ({ g: x.g, mean: x.a.reduce((p, c) => p + c, 0) / x.a.length, min: Math.min(...x.a), max: Math.max(...x.a) }))
      const lo = Math.min(...means.map((m) => m.mean))
      const hi = Math.max(...means.map((m) => m.mean))
      if (hi > lo * 1.2)
        w.push({
          level: 'warning',
          text: `Groups differ in age (${means.map((m) => `${m.g}: ${m.min === m.max ? m.min : `${m.min}–${m.max}`}`).join('; ')}). ${program().features.paws ? 'Gait parameters change with growth' : 'Motor performance and activity change with age and body size'}, so part of any group difference may reflect age.`,
        })
    }
  }
  if (!cfg.groupCol) w.push({ level: 'warning', text: 'No group column is selected, so there is nothing to compare. Choose a group column in Setup.' })
  if (!cfg.subjectCol) w.push({ level: 'info', text: `No animal ID column is selected, so every row is treated as a separate animal. If your file has several ${program().runsNoun} per animal, choose the ID column so ${program().runsNoun} are averaged first (otherwise n is inflated).` })
  if (!tr) return w
  const small = agg.groups.filter((g) => {
    const n = Math.max(0, ...tr.results.slice(0, 5).map((r) => r.groups[g]?.n ?? 0))
    return n > 0 && n < 5
  })
  if (small.length) w.push({ level: 'warning', text: `Small groups (n < 5): ${small.join(', ')}. Treat p-values with caution and focus on effect sizes.` })
  const weight = tr.results.find((r) => r.measure.def.id === 'body_weight')
  const weightDiff = weight?.comparisons.find((c) => c.reference === cfg.controlGroup && c.pAdj < 0.05)
  if (weightDiff && !cfg.weightAdjust)
    w.push({
      level: 'warning',
      text: `Body weight differs between ${weightDiff.group} and ${weightDiff.reference} (${weightDiff.diffPct > 0 ? '+' : ''}${weightDiff.diffPct.toFixed(0)}%, p = ${formatP(weightDiff.pAdj)}). ${program().id === 'rotarod' ? 'Heavier mice fall sooner from the rotarod, so part of a latency difference may reflect weight' : program().features.paws ? 'Print area, intensity and stride scale with body size' : 'Activity measures can depend on body size and condition'}; consider adjusting for body weight (Setup → Statistics).`,
    })
  const speed = tr.results.find((r) => r.measure.def.id === 'speed')
  if (speed) {
    const c = speed.comparisons.find((c) => c.pAdj < 0.05)
    if (c && !cfg.speedAdjust)
      w.push({
        level: 'warning',
        text: `Walking speed differs between ${c.group} and ${c.reference} (p = ${formatP(c.pAdj)}, ${c.diffPct > 0 ? '+' : ''}${c.diffPct.toFixed(0)}%). Most CatWalk parameters change with speed; consider turning on speed adjustment in Setup before interpreting temporal and spatial parameters.`,
      })
  } else if (program().features.speed) {
    w.push({ level: 'info', text: 'No average-speed column was found, so speed adjustment is unavailable.' })
  }
  // Minimum-trials advice applies to repeated trials of one test (runs, rotarod trials), not to intervals of a session.
  const repeated = program().features.speed || (Boolean(program().trialDerived?.length) && agg.trials.length > 0)
  if (repeated && cfg.subjectCol) {
    const counted = agg.subjects.map((s) => ({ s, n: s.nCompliant ?? s.nRuns }))
    const short = counted.filter((x) => x.n < 3)
    if (short.length) {
      const byCompliance = agg.subjects.some((s) => s.nCompliant !== undefined)
      const multiTime = new Set(agg.subjects.map((s) => s.time)).size > 1
      const label = (x: (typeof counted)[number]) =>
        `${x.s.id}${multiTime && x.s.time ? ` @ ${x.s.time}` : ''}: ${x.n}${x.s.nRunsRecorded !== undefined ? ` of ${x.s.nRunsRecorded}` : ''}`
      const sorted = [...short].sort((a, b) => a.n - b.n || a.s.id.localeCompare(b.s.id))
      const list = sorted.slice(0, 20).map(label).join('; ') + (sorted.length > 20 ? `; and ${sorted.length - 20} more` : '')
      const threshold = cfg.maxVariation ?? DEFAULT_MAX_VARIATION
      w.push({
        level: 'info',
        text: program().features.speed
          ? `${short.length} of ${counted.length} animal-timepoints have fewer than 3 compliant runs${byCompliance ? ` (compliant = speed variation ≤ ${threshold}% and duration ${COMPLIANT_DURATION[0]}–${COMPLIANT_DURATION[1]} s)` : ''}: ${list}. Noldus and most labs recommend at least 3 compliant runs per animal.`
          : `${short.length} of ${counted.length} animal-timepoints have fewer than 3 ${program().runsNoun}: ${list}. Most protocols average at least 3 ${program().runsNoun} per animal per session.`,
      })
    }
  }
  return w
}

export function topChanges(tr: TimeResults, cfg: AnalysisConfig, opt: InterpretOptions, k = 12): { r: MeasureResult; c: Comparison }[] {
  return tr.results
    .map((r) => ({ r, c: primaryComparison(r, cfg) }))
    .filter((x): x is { r: MeasureResult; c: Comparison } => Boolean(x.c) && Number.isFinite(x.c!.g) && isSignificant(x.r, x.c!, { ...opt, minEffect: 0 }))
    .sort((a, b) => Math.abs(b.c.g) - Math.abs(a.c.g))
    .slice(0, k)
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

/** What one data row is: a run/trial, or just a value when rows are repeated measurements (e.g. Prism replicate subcolumns). */
export function unitNoun(agg: AggregateResult): string {
  return program().features.speed || agg.trials.length > 0 ? program().runsNoun : 'values'
}

export function narrative(
  agg: AggregateResult,
  tr: TimeResults,
  cfg: AnalysisConfig,
  opt: InterpretOptions,
  findings: DomainFinding[] = interpret(tr, cfg, opt),
): string[] {
  const out: string[] = []
  const subs = agg.subjects.filter((s) => s.time === tr.time)
  const counts = agg.groups
    .map((g) => ({ g, n: subs.filter((s) => s.group === g).length }))
    .filter((x) => x.n > 0)
    .map((x) => `${x.g} (n = ${x.n})`)
    .join(', ')
  const when = tr.time ? ` at ${tr.time}` : ''
  out.push(
    `${subs.length} animals${when} were analysed: ${counts}. ${cfg.subjectCol ? `${cap(unitNoun(agg))} were averaged per animal (${formatNum(subs.reduce((s, x) => s + x.nRuns, 0) / Math.max(1, subs.length), 2)} ${unitNoun(agg)} per animal on average)` : 'Each row was treated as one animal'}${cfg.onlyCompliant && cfg.compliantCol ? ' and only compliant runs were used' : ''}${cfg.maxVariation !== null ? `; runs with more than ${cfg.maxVariation}% speed variation were excluded` : ''}${cfg.filters.length ? `; analysis restricted to ${cfg.filters.map((f) => `${f.col} = ${f.values.join(' or ')}`).join(', ')}` : ''}.${cfg.speedAdjust ? ' Values were adjusted to the mean walking speed using a pooled within-animal regression on speed.' : ''}${cfg.weightAdjust && agg.subjects.some((s) => Number.isFinite(s.weight ?? NaN)) ? ` Values were adjusted to the mean body weight at each timepoint using a regression slope pooled within groups${agg.weightMissing ? `; ${agg.weightMissing} animal-timepoint(s) without a weight were left out of adjusted parameters` : ''}.` : ''}`,
  )
  const primaryRef = cfg.diseaseGroup ? `${cfg.diseaseGroup} vs ${cfg.controlGroup}` : `each group vs ${cfg.controlGroup ?? 'the reference group'}`
  const criteria = `p < ${opt.alpha}${opt.useFdr ? ', FDR q < ' + opt.alpha : ''}, |Hedges g| ≥ ${opt.minEffect}`
  const testName = cfg.test === 'parametric' ? "Welch's t-test" : 'the Mann–Whitney U test'
  const plural = (n: number) => `${n} of ${tr.results.length} parameter${tr.results.length === 1 ? '' : 's'}`
  let nSig = 0
  if (cfg.diseaseGroup) {
    nSig = tr.results.filter((r) => {
      const c = primaryComparison(r, cfg)
      return c && isSignificant(r, c, opt)
    }).length
    out.push(`Comparing ${primaryRef} with ${testName}, ${plural(nSig)} met the criteria (${criteria}).`)
  } else {
    // Every group is compared with the control; report how many parameters changed in each.
    const perGroup = agg.groups
      .filter((g) => g !== cfg.controlGroup)
      .map((g) => ({
        g,
        n: tr.results.filter((r) => r.comparisons.some((c) => c.group === g && c.reference === cfg.controlGroup && isSignificant(r, c, opt))).length,
      }))
    nSig = tr.results.filter((r) => r.comparisons.some((c) => c.reference === cfg.controlGroup && isSignificant(r, c, opt))).length
    const hits = perGroup.filter((x) => x.n > 0)
    out.push(
      `Comparing ${primaryRef} with ${testName}, ${plural(nSig)} met the criteria (${criteria}) in at least one group${hits.length ? `: ${hits.map((x) => `${x.g} ${x.n}`).join(', ')}` : ''}.`,
    )
  }
  const strong = findings.filter(isReported)
  if (strong.length) {
    for (const f of strong.slice(0, 3)) {
      const side = f.side ? ` The ${f.side} side is more affected.` : ''
      out.push(
        `The pattern is consistent with **${f.domain.title.toLowerCase()}** (${f.supporting.length} supporting parameter${f.supporting.length === 1 ? '' : 's'}: ${f.supporting
          .slice(0, 4)
          .map(describeEvidence)
          .join('; ')}${f.supporting.length > 4 ? '; …' : ''}).${side} This pattern is typical of ${f.domain.conditions.charAt(0).toLowerCase() + f.domain.conditions.slice(1)}`,
      )
    }
  } else if (nSig > 0) {
    out.push('The significant changes don’t form a coherent phenotype pattern; review them individually in the parameter explorer.')
  } else {
    out.push('No parameter met the significance and effect-size criteria. Check the sample size and consider whether the study had enough power for the expected effect.')
  }
  if (cfg.diseaseGroup && cfg.controlGroup) {
    const treated = agg.groups.filter((g) => g !== cfg.controlGroup && g !== cfg.diseaseGroup)
    const rescued = tr.results.filter((r) => r.rescuePct !== undefined && Number.isFinite(r.rescuePct) && (() => {
      const c = primaryComparison(r, cfg)
      return c && isSignificant(r, c, opt)
    })())
    if (treated.length === 1 && rescued.length) {
      const med = [...rescued.map((r) => r.rescuePct!)].sort((a, b) => a - b)[Math.floor(rescued.length / 2)]
      const vsDisease = rescued.filter((r) => r.comparisons.some((c) => c.group === treated[0] && c.reference === cfg.diseaseGroup && c.pAdj < opt.alpha)).length
      out.push(
        `Across the ${rescued.length} parameters where ${cfg.diseaseGroup} differed from ${cfg.controlGroup}, ${treated[0]} recovered a median of ${med.toFixed(0)}% of the deficit (0% = no change from ${cfg.diseaseGroup}, 100% = back to ${cfg.controlGroup}); ${vsDisease} of these differed significantly from ${cfg.diseaseGroup}.`,
      )
    }
  }
  out.push(
    'These are automated, pattern-based interpretations to help orient the analysis. They are not diagnoses and should be confirmed with study-specific hypotheses, histology and complementary behavioural tests.',
  )
  return out
}

export function reportMarkdown(agg: AggregateResult, results: TimeResults[], cfg: AnalysisConfig, opt: InterpretOptions): string {
  const lines: string[] = [`# ${program().name}: ${program().test} summary`, '']
  for (const tr of results) {
    if (tr.time) lines.push(`## ${tr.time}`, '')
    for (const p of narrative(agg, tr, cfg, opt)) lines.push(p, '')
    const top = topChanges(tr, cfg, opt)
    if (top.length) {
      lines.push('| Parameter | Comparison | Difference | Hedges g | p (adj.) | q (FDR) |', '|---|---|---|---|---|---|')
      for (const { r, c } of top)
        lines.push(`| ${r.measure.label} | ${c.group} vs ${c.reference} | ${Number.isFinite(c.diffPct) ? (c.diffPct > 0 ? '+' : '') + c.diffPct.toFixed(1) + '%' : formatNum(c.diff)} | ${c.g.toFixed(2)} | ${formatP(c.pAdj)} | ${formatP(r.q)} |`)
      lines.push('')
    }
  }
  return lines.join('\n')
}
