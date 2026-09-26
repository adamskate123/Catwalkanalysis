import { DEFAULT_MAX_VARIATION } from './analysis'
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
import { describeEvidence, interpret, isSignificant, type DomainFinding, type InterpretOptions } from './interpret'

export interface Warning {
  level: 'info' | 'warning'
  text: string
}

function describeCounts(m: Map<string, number>): string {
  return [...m].map(([k, n]) => `${n} ${k}`).join(', ')
}

export function dataWarnings(agg: AggregateResult, tr: TimeResults | undefined, cfg: AnalysisConfig, ds?: Dataset): Warning[] {
  const w: Warning[] = []
  if (ds) {
    for (const n of ds.notices) w.push({ level: 'info', text: n })
    // Acquisition settings must be constant for intensities and areas to be comparable.
    const varying = ds.columns.filter((c) => c.meta === 'equipment' && c.distinct > 1).map((c) => c.name)
    if (varying.length)
      w.push({
        level: 'warning',
        text: `Acquisition settings differ between recordings (${varying.join(', ')}). Intensity and area parameters are only comparable when camera gain, intensity threshold and lighting are identical.`,
      })
    for (const k of ds.keys) {
      if (k.unmatchedData.length)
        w.push({ level: 'warning', text: `Animal key ${k.file}: no entry for ${k.unmatchedData.join(', ')} (matched on ${k.dataColumn} = ${k.keyColumn}).` })
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
      const byGroup = agg.groups.map((g) => {
        const m = new Map<string, number>()
        for (const s of subs.filter((x) => x.group === g)) m.set(s.sex ?? '?', (m.get(s.sex ?? '?') ?? 0) + 1)
        return { g, m }
      })
      const sexes = new Set(subs.map((s) => s.sex ?? '?'))
      const unbalanced = byGroup.some(({ m }) => [...sexes].some((x) => !m.has(x)))
      if (unbalanced && sexes.size > 1)
        w.push({
          level: 'warning',
          text: `Sex is not balanced across groups (${byGroup.map(({ g, m }) => `${g}: ${describeCounts(m)}`).join('; ')}). Sex affects body size, print area and speed; consider filtering to one sex under Setup → Filters.`,
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
          text: `Groups differ in age (${means.map((m) => `${m.g}: ${m.min === m.max ? m.min : `${m.min}–${m.max}`}`).join('; ')}). Gait parameters change with growth, so part of any group difference may reflect age.`,
        })
    }
  }
  if (!cfg.groupCol) w.push({ level: 'warning', text: 'No group column is selected, so there is nothing to compare. Choose a group column in Setup.' })
  if (!cfg.subjectCol) w.push({ level: 'info', text: 'No animal ID column is selected, so every row is treated as a separate animal. If your file has several runs per animal, choose the ID column so runs are averaged first (otherwise n is inflated).' })
  if (!tr) return w
  const small = agg.groups.filter((g) => {
    const n = Math.max(0, ...tr.results.slice(0, 5).map((r) => r.groups[g]?.n ?? 0))
    return n > 0 && n < 5
  })
  if (small.length) w.push({ level: 'warning', text: `Small groups (n < 5): ${small.join(', ')}. Treat p-values with caution and focus on effect sizes.` })
  const speed = tr.results.find((r) => r.measure.def.id === 'speed')
  if (speed) {
    const c = speed.comparisons.find((c) => c.pAdj < 0.05)
    if (c && !cfg.speedAdjust)
      w.push({
        level: 'warning',
        text: `Walking speed differs between ${c.group} and ${c.reference} (p = ${formatP(c.pAdj)}, ${c.diffPct > 0 ? '+' : ''}${c.diffPct.toFixed(0)}%). Most CatWalk parameters change with speed; consider turning on speed adjustment in Setup before interpreting temporal and spatial parameters.`,
      })
  } else {
    w.push({ level: 'info', text: 'No average-speed column was found, so speed adjustment is unavailable.' })
  }
  if (agg.subjects.some((s) => s.nRuns < 3) && cfg.subjectCol) {
    const k = agg.subjects.filter((s) => s.nRuns < 3).length
    w.push({ level: 'info', text: `${k} animal-timepoint(s) have fewer than 3 compliant runs. Noldus and most labs recommend at least 3 compliant runs per animal.` })
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

export function narrative(
  agg: AggregateResult,
  tr: TimeResults,
  cfg: AnalysisConfig,
  opt: InterpretOptions,
  findings: DomainFinding[] = interpret(tr, cfg, opt),
): string[] {
  const out: string[] = []
  const subs = agg.subjects.filter((s) => s.time === tr.time)
  const counts = agg.groups.map((g) => `${g} (n = ${subs.filter((s) => s.group === g).length})`).join(', ')
  const when = tr.time ? ` at ${tr.time}` : ''
  out.push(
    `${subs.length} animals${when} were analysed: ${counts}. ${cfg.subjectCol ? `Runs were averaged per animal (${formatNum(subs.reduce((s, x) => s + x.nRuns, 0) / Math.max(1, subs.length), 2)} runs per animal on average)` : 'Each row was treated as one animal'}${cfg.onlyCompliant && cfg.compliantCol ? ' and only compliant runs were used' : ''}${cfg.maxVariation !== null ? `; runs with more than ${cfg.maxVariation}% speed variation were excluded` : ''}${cfg.filters.length ? `; analysis restricted to ${cfg.filters.map((f) => `${f.col} = ${f.values.join(' or ')}`).join(', ')}` : ''}.${cfg.speedAdjust ? ' Values were adjusted to the mean walking speed using a pooled within-animal regression on speed.' : ''}`,
  )
  const primaryRef = cfg.diseaseGroup ? `${cfg.diseaseGroup} vs ${cfg.controlGroup}` : `each group vs ${cfg.controlGroup ?? 'the reference group'}`
  const nSig = tr.results.filter((r) => {
    const c = primaryComparison(r, cfg)
    return c && isSignificant(r, c, opt)
  }).length
  out.push(
    `Comparing ${primaryRef} with ${cfg.test === 'parametric' ? "Welch's t-test" : 'the Mann–Whitney U test'}, ${nSig} of ${tr.results.length} parameters met the criteria (p < ${opt.alpha}${opt.useFdr ? ', FDR q < ' + opt.alpha : ''}, |Hedges g| ≥ ${opt.minEffect}).`,
  )
  const strong = findings.filter((f) => f.supporting.length >= 2)
  if (strong.length) {
    for (const f of strong.slice(0, 3)) {
      const side = f.side ? ` The ${f.side} side is more affected.` : ''
      out.push(
        `The pattern is consistent with **${f.domain.title.toLowerCase()}** (${f.supporting.length} supporting parameters: ${f.supporting
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
  const lines: string[] = ['# CatWalk gait analysis summary', '']
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
