// "Before drawing conclusions" checks that can be switched on and off.
// Each refinement describes a possible confounder, whether it applies to this
// dataset, and how to change the analysis settings to address it.

import { program } from '../programs'
import { aggregate, analyse, combineGroups, DEFAULT_MAX_VARIATION, distinctValues, formatNum, formatP, groupMembers, isControlLike, splitGroup, type AggregateResult, type AnalysisConfig, type Measure, type TimeResults } from './analysis'
import { changedMeasures, interpret, isReported, type InterpretOptions } from './interpret'
import type { Dataset } from './parse'

export interface RefineOption {
  /** Label of the choice, e.g. "M only". */
  label: string
  apply: (cfg: AnalysisConfig) => AnalysisConfig
  active: (cfg: AnalysisConfig) => boolean
}

export interface Refinement {
  id: string
  title: string
  /** Why this could matter for this dataset right now. */
  why: string
  /** One or more mutually exclusive ways to address it; empty when it can only be noted. */
  options: RefineOption[]
  /** Restores the setting to "off". */
  reset: (cfg: AnalysisConfig) => AnalysisConfig
  active: boolean
  /** Short description of the refinement when it is on, e.g. "Sex = M only". */
  summary: string
  /** Left out of "Apply all switches" (a study-design choice rather than a routine clean-up). */
  manualOnly?: boolean
}

export const MIN_RECOMMENDED_RUNS = 3

export function refinements(ds: Dataset, measures: Measure[], agg: AggregateResult, tr: TimeResults | undefined, cfg: AnalysisConfig, opt: InterpretOptions): Refinement[] {
  const out: Refinement[] = []

  // 1. Stop-and-go runs
  if (measures.some((m) => m.def.id === 'speed_variation' && m.col !== undefined) && !ds.columns.some((c) => c.meta === 'nruns')) {
    const active = cfg.maxVariation !== null
    if (active || agg.rowsAboveDefaultVariation > 0) {
      out.push({
        id: 'variation',
        title: `Exclude runs with more than ${DEFAULT_MAX_VARIATION}% speed variation`,
        why: active
          ? `${agg.rowsHighVariation} of ${agg.rowsTotal} runs are excluded because the animal hesitated or stopped (speed varied by more than ${cfg.maxVariation}%).`
          : `${agg.rowsAboveDefaultVariation} of ${agg.rowsTotal} runs have a maximum speed variation above ${DEFAULT_MAX_VARIATION}%, meaning the animal hesitated or stopped. Such runs distort timing and coordination parameters.`,
        options: [
          {
            label: 'Exclude',
            apply: (c) => ({ ...c, maxVariation: DEFAULT_MAX_VARIATION }),
            active: (c) => c.maxVariation !== null,
          },
        ],
        reset: (c) => ({ ...c, maxVariation: null }),
        active,
        summary: `runs with >${cfg.maxVariation ?? DEFAULT_MAX_VARIATION}% speed variation excluded`,
      })
    }
  }

  // 2. Walking speed differs between groups
  const speed = measures.find((m) => m.def.id === 'speed')
  if (speed) {
    const res = tr?.results.find((r) => r.measure.key === speed.key)
    const differs = res?.comparisons.find((c) => c.pAdj < opt.alpha)
    if (cfg.speedAdjust || differs) {
      out.push({
        id: 'speed',
        title: 'Adjust all parameters for walking speed',
        why: cfg.speedAdjust
          ? 'Parameters are adjusted to the mean walking speed, so remaining differences are not explained by one group simply walking faster or slower.'
          : `Walking speed differs between ${differs!.group} and ${differs!.reference} (${differs!.diffPct > 0 ? '+' : ''}${differs!.diffPct.toFixed(0)}%, p = ${differs!.pAdj < 0.001 ? '<0.001' : differs!.pAdj.toFixed(3)}). Most CatWalk parameters change with speed, so some differences may reflect speed rather than a specific deficit.`,
        options: [{ label: 'Adjust', apply: (c) => ({ ...c, speedAdjust: true }), active: (c) => c.speedAdjust }],
        reset: (c) => ({ ...c, speedAdjust: false }),
        active: cfg.speedAdjust,
        summary: 'speed-adjusted',
      })
    }
  }

  // 3. Sex imbalance between groups
  const sexCol = ds.columns.find((c) => c.meta === 'sex')?.name
  if (sexCol) {
    const sexes = distinctValues(ds, sexCol)
    const filter = cfg.filters.find((f) => f.col === sexCol)
    const filtered = Boolean(filter && filter.values.length < sexes.length)
    const subs = agg.subjects.filter((s) => s.time === tr?.time)
    const present = agg.groups.filter((g) => subs.some((s) => s.group === g))
    const perGroup = present.map((g) => new Set(subs.filter((s) => s.group === g).map((s) => s.sex ?? '?')))
    const unbalanced = sexes.length > 1 && perGroup.some((set) => sexes.some((x) => !set.has(x)))
    if (filtered || unbalanced) {
      const withoutSex = (c: AnalysisConfig) => c.filters.filter((f) => f.col !== sexCol)
      out.push({
        id: 'sex',
        title: 'Analyse one sex only',
        why: filtered
          ? `The analysis is restricted to ${sexCol} = ${filter!.values.join(' or ')}.`
          : `Sex is not balanced across groups (${present.map((g, i) => `${g}: ${[...perGroup[i]].join('+')}`).join('; ')}). ${program().features.paws ? 'Sex affects body size, print area and speed.' : 'Sex affects body weight and performance.'}`,
        options: sexes.map((sx) => ({
          label: `${sx} only`,
          apply: (c) => ({ ...c, filters: [...withoutSex(c), { col: sexCol, values: [sx] }] }),
          active: (c) => {
            const f = c.filters.find((x) => x.col === sexCol)
            return Boolean(f && f.values.length === 1 && f.values[0] === sx)
          },
        })),
        reset: (c) => ({ ...c, filters: withoutSex(c) }),
        active: filtered,
        summary: filtered ? `${sexCol} = ${filter!.values.join('/')} only` : '',
      })
    }
  }

  // 4. Too few runs per animal
  const fewRuns = agg.subjects.filter((s) => s.nRuns < MIN_RECOMMENDED_RUNS).length
  const runs = program().runsNoun
  const repeated = program().features.speed || agg.trials.length > 0
  if (repeated && cfg.subjectCol && (cfg.minRuns >= MIN_RECOMMENDED_RUNS || fewRuns > 0)) {
    const active = cfg.minRuns >= MIN_RECOMMENDED_RUNS
    out.push({
      id: 'runs',
      title: `Require at least ${MIN_RECOMMENDED_RUNS} ${runs} per animal`,
      why: active
        ? `Animals with fewer than ${MIN_RECOMMENDED_RUNS} usable ${runs} are left out, so each animal's average is reliable.`
        : `${fewRuns} animal-timepoint(s) have fewer than ${MIN_RECOMMENDED_RUNS} usable ${runs}, so their averages are noisy. Excluding them makes each animal's value more reliable but lowers n.`,
      options: [{ label: 'Require', apply: (c) => ({ ...c, minRuns: MIN_RECOMMENDED_RUNS }), active: (c) => c.minRuns >= MIN_RECOMMENDED_RUNS }],
      reset: (c) => ({ ...c, minRuns: 1 }),
      active,
      summary: `at least ${MIN_RECOMMENDED_RUNS} ${runs} per animal`,
    })
  }

  // 5. Several control cohorts (e.g. "Jax WT", "EIF Jax WT", "New Jax WT") that could be analysed as one
  const control = cfg.controlGroup
  if (control && cfg.groupCol) {
    const merged = groupMembers(ds, cfg, control)
    const cohorts = agg.groups.filter((g) => g !== control && isControlLike(g) && !cfg.excludedGroups.includes(g))
    const active = merged.length > 1
    if (active || cohorts.length > 0) {
      // Compare each extra cohort with the control on the first parameter at this timepoint.
      const r = tr?.results[0]
      const line = (g: string) => {
        const d = r?.groups[g]
        return d && d.n ? `${g} ${formatNum(d.mean)}${r!.measure.def.unit ? ' ' + r!.measure.def.unit : ''} (n = ${d.n})` : `${g} (no animals here)`
      }
      const differ = r ? cohorts.filter((g) => r.comparisons.some((c) => c.group === g && c.reference === control && c.pAdj < 0.05)) : []
      out.push({
        id: 'controls',
        title: active ? `Control cohorts combined as ${control}` : `Combine control cohorts into ${control}`,
        why: active
          ? `${control} is analysed as one group made of ${merged.join(' + ')}. Split it under Setup → Groups, or switch this off, to compare the cohorts separately.`
          : `Besides ${control}, ${cohorts.length === 1 ? 'this group also looks' : 'these groups also look'} like controls: ${cohorts.join(', ')}. Combining them gives a larger control group${r ? ` (${r.measure.label}: ${[control, ...cohorts].map(line).join('; ')})` : ''}. ${
              differ.length
                ? `But ${differ.join(' and ')} ${differ.length === 1 ? 'differs' : 'differ'} from ${control} (p ${differ.map((g) => formatP(r!.comparisons.find((c) => c.group === g && c.reference === control)!.pAdj)).join(', ')}), so the cohorts may not be interchangeable; check strain source, age and test date first.`
                : 'Check that they share strain background, source and testing conditions before combining.'
            }`,
        options: [
          {
            label: 'Combine',
            apply: (c) => (groupMembers(ds, c, c.controlGroup ?? '').length > 1 ? c : combineGroups(ds, c, [c.controlGroup ?? control, ...cohorts], c.controlGroup ?? control)),
            active: (c) => groupMembers(ds, c, c.controlGroup ?? '').length > 1,
          },
        ],
        manualOnly: true,
        reset: (c) => (c.controlGroup ? splitGroup(ds, c, c.controlGroup) : c),
        active,
        summary: `control cohorts combined (${active ? merged.join(' + ') : [control, ...cohorts].join(' + ')})`,
      })
    }
  }

  // 6. Age differences: can only be noted (or handled with a filter on a key column)
  const ages = agg.groups.map((g) => agg.subjects.filter((s) => s.group === g && s.time === tr?.time && s.age !== undefined).map((s) => s.age!))
  const means = ages.filter((a) => a.length).map((a) => a.reduce((x, y) => x + y, 0) / a.length)
  if (means.length >= 2 && Math.max(...means) > Math.min(...means) * 1.2) {
    out.push({
      id: 'age',
      title: 'Groups differ in age',
      why: `Age ranges: ${agg.groups
        .map((g, i) => (ages[i].length ? `${g} ${Math.min(...ages[i])}–${Math.max(...ages[i])}` : ''))
        .filter(Boolean)
        .join('; ')}. ${program().features.paws ? 'Gait changes with growth' : 'Performance changes with age and body size'}, so part of a group difference may reflect age. This can't be adjusted automatically here; use age-matched animals, or restrict animals with a filter in Setup.`,
      options: [],
      reset: (c) => c,
      active: false,
      summary: '',
    })
  }
  return out
}

export interface Outcome {
  animals: number
  changed: number
  patterns: string[]
}

/** Runs the analysis with a given configuration and summarises the result at one timepoint. */
export function outcome(ds: Dataset, measures: Measure[], cfg: AnalysisConfig, opt: InterpretOptions, time: string): Outcome {
  const agg = aggregate(ds, measures, cfg)
  const res = analyse(agg, measures, cfg)
  const tr = res.find((t) => t.time === time) ?? res[0]
  return {
    animals: agg.subjects.filter((s) => s.time === (tr?.time ?? '')).length,
    changed: changedMeasures(tr, cfg, opt).size,
    patterns: tr ? interpret(tr, cfg, opt).filter(isReported).map((f) => f.domain.title) : [],
  }
}
