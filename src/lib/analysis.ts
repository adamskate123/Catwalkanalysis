import { PAWS, otherParam, type Paw, type ParamDef, type StatKind } from './catalog'
import { paramById, program, type TrialDerived } from '../programs'
import { SOURCE_COL, toNumber, type Cell, type Dataset } from './parse'
import {
  benjaminiHochberg,
  describe,
  finite,
  hedgesG,
  holm,
  kruskalWallis,
  mannWhitney,
  mean,
  oneWayAnova,
  pooledWithinSlope,
  welchT,
  type Describe,
  type TestResult,
} from './stats'

// ---------------------------------------------------------------------------
// Measures (one analysable variable each)

export type DerivedKind = 'FRONT' | 'HIND' | 'ASYM_F' | 'ASYM_H'

export interface Measure {
  key: string
  def: ParamDef
  paw?: Paw
  variant?: string
  derived?: DerivedKind
  /** Computed per animal from the ordered trials of a measure (best, first, last, improvement). */
  trial?: { source: string; how: TrialDerived['how'] }
  col?: number
  stat: StatKind
  label: string
}

const STAT_PREFERENCE: StatKind[] = ['mean', 'value', 'median', 'max', 'min', 'sem', 'sd', 'cv']

export const DERIVED_LABEL: Record<DerivedKind, string> = {
  FRONT: 'front paws (mean)',
  HIND: 'hind paws (mean)',
  ASYM_F: 'front L−R asymmetry (%)',
  ASYM_H: 'hind L−R asymmetry (%)',
}

export function measureLabel(def: ParamDef, paw?: Paw, variant?: string, derived?: DerivedKind): string {
  if (derived) return `${def.label}, ${DERIVED_LABEL[derived]}`
  if (paw) return `${def.label} (${paw})`
  if (variant) return `${def.label} ${variant}`
  return def.label
}

export function buildMeasures(ds: Dataset): Measure[] {
  const byKey = new Map<string, Measure>()
  ds.columns.forEach((c, col) => {
    if (c.meta || c.numericShare < 0.8 || c.distinct < 2) return
    if (c.match) {
      const def = paramById(c.match.paramId)
      if (!def) return
      const key = `${def.id}|${c.match.paw ?? c.match.variant ?? ''}`
      const existing = byKey.get(key)
      if (existing && STAT_PREFERENCE.indexOf(existing.stat) <= STAT_PREFERENCE.indexOf(c.match.stat)) return
      byKey.set(key, {
        key,
        def,
        paw: c.match.paw,
        variant: c.match.variant,
        col,
        stat: c.match.stat,
        label: measureLabel(def, c.match.paw, c.match.variant),
      })
    } else {
      const label = c.name.replace(/^other[\s_]*statistics[\s_]*/i, 'Other statistics: ').replace(/_/g, ' ')
      const def = otherParam(label)
      byKey.set(def.id, { key: def.id, def, col, stat: 'value', label })
    }
  })
  const measures = [...byKey.values()]
  // Derived fore/hind means and asymmetry indices for complete per-paw sets
  const perPaw = new Map<string, Measure[]>()
  for (const m of measures) {
    if (!m.paw) continue
    const arr = perPaw.get(m.def.id) ?? []
    arr.push(m)
    perPaw.set(m.def.id, arr)
  }
  for (const [id, arr] of perPaw) {
    if (arr.length < 4) continue
    const def = paramById(id)!
    for (const d of ['FRONT', 'HIND', 'ASYM_F', 'ASYM_H'] as DerivedKind[]) {
      measures.push({ key: `${id}|${d}`, def, derived: d, stat: 'mean', label: measureLabel(def, undefined, undefined, d) })
    }
  }
  // Per-animal summaries across trials (rotarod best/first/last trial), when rows are trials.
  if (ds.columns.some(isTrialColumn)) {
    for (const td of program().trialDerived ?? []) {
      const src = measures.find((m) => m.def.id === td.from && m.col !== undefined && !m.paw && !m.variant)
      const def = paramById(td.id)
      if (!src || !def || measures.some((m) => m.def.id === td.id)) continue
      measures.push({ key: `${td.id}|trials`, def, trial: { source: src.key, how: td.how }, stat: 'mean', label: def.label })
    }
  }
  return sortMeasures(measures)
}

const PAW_ORDER: Record<string, number> = { LF: 0, RF: 1, LH: 2, RH: 3 }
const DERIVED_ORDER: Record<DerivedKind, number> = { FRONT: 4, HIND: 5, ASYM_F: 6, ASYM_H: 7 }

export function sortMeasures(ms: Measure[]): Measure[] {
  const { params, categoryOrder } = program()
  const paramIndex = (m: Measure) => {
    const i = params.findIndex((p) => p.id === m.def.id)
    return i < 0 ? 999 : (params[i].displayOrder ?? i)
  }
  const catIndex = (m: Measure) => {
    const i = categoryOrder.indexOf(m.def.category)
    return i < 0 ? 999 : i
  }
  return [...ms].sort(
    (a, b) =>
      catIndex(a) - catIndex(b) ||
      paramIndex(a) - paramIndex(b) ||
      (a.paw ? PAW_ORDER[a.paw] : a.derived ? DERIVED_ORDER[a.derived] : -1) -
        (b.paw ? PAW_ORDER[b.paw] : b.derived ? DERIVED_ORDER[b.derived] : -1) ||
      (a.variant ?? '').localeCompare(b.variant ?? '') ||
      a.label.localeCompare(b.label),
  )
}

// ---------------------------------------------------------------------------
// Configuration

export interface AnalysisConfig {
  subjectCol: string | null
  groupCol: string | null
  timeCol: string | null
  compliantCol: string | null
  onlyCompliant: boolean
  controlGroup: string | null
  diseaseGroup: string | null
  excludedGroups: string[]
  groupOrder: string[]
  timeOrder: string[]
  test: 'parametric' | 'nonparametric'
  speedAdjust: boolean
  /** Adjust every parameter for body weight (pooled within-group slope, per timepoint centring). */
  weightAdjust?: boolean
  minRuns: number
  /** Exclude runs whose maximum speed variation (%) exceeds this value; null = keep all. */
  maxVariation: number | null
  /** Keep only rows whose value in `col` is one of `values`. */
  filters: { col: string; values: string[] }[]
  /** Groups analysed together: original group name → combined group name. */
  groupMerge?: Record<string, string>
}

export const DEFAULT_MAX_VARIATION = 60

const NO_GROUP = 'All animals'

/** The group an original group value is analysed in (after any combining). */
export function groupOf(cfg: Pick<AnalysisConfig, 'groupMerge'>, raw: string): string {
  return (raw && cfg.groupMerge?.[raw]) || raw
}

/** Groups as analysed: original values of the group column with combined groups folded together. */
export function groupList(ds: Dataset, cfg: Pick<AnalysisConfig, 'groupCol' | 'groupMerge'>): string[] {
  return [...new Set(distinctValues(ds, cfg.groupCol).map((g) => groupOf(cfg, g)))].sort(naturalCompare)
}

/** The original groups that make up an analysed group. */
export function groupMembers(ds: Dataset, cfg: Pick<AnalysisConfig, 'groupCol' | 'groupMerge'>, group: string): string[] {
  return distinctValues(ds, cfg.groupCol).filter((g) => groupOf(cfg, g) === group)
}

/**
 * Analyses several groups as one, named `name` (e.g. three wild-type cohorts as
 * "Jax WT"). The combined group takes the first one's place in the order and
 * inherits its control/disease role.
 */
export function combineGroups(ds: Dataset, cfg: AnalysisConfig, groups: string[], name: string): AnalysisConfig {
  const target = name.trim()
  if (!target || groups.length === 0) return cfg
  const chosen = new Set(groups)
  const merge = { ...(cfg.groupMerge ?? {}) }
  for (const raw of distinctValues(ds, cfg.groupCol)) if (chosen.has(groupOf(cfg, raw))) merge[raw] = target
  for (const k of Object.keys(merge)) if (merge[k] === k) delete merge[k]
  const firstAt = cfg.groupOrder.findIndex((g) => chosen.has(g))
  const order = cfg.groupOrder.filter((g) => !chosen.has(g) && g !== target)
  order.splice(firstAt < 0 ? order.length : Math.min(firstAt, order.length), 0, target)
  const role = (g: string | null) => (g && chosen.has(g) ? target : g)
  const control = role(cfg.controlGroup)
  const disease = role(cfg.diseaseGroup)
  return {
    ...cfg,
    groupMerge: merge,
    groupOrder: order,
    controlGroup: control,
    diseaseGroup: disease === control ? null : disease,
    excludedGroups: cfg.excludedGroups.filter((g) => !chosen.has(g)),
  }
}

/** Undoes combineGroups for one analysed group, restoring its original groups. */
export function splitGroup(ds: Dataset, cfg: AnalysisConfig, group: string): AnalysisConfig {
  const members = groupMembers(ds, cfg, group)
  if (members.length < 2 && !cfg.groupMerge?.[group]) return cfg
  const merge = { ...(cfg.groupMerge ?? {}) }
  for (const raw of members) delete merge[raw]
  const at = cfg.groupOrder.indexOf(group)
  const order = cfg.groupOrder.filter((g) => g !== group)
  // Keep an original group with the combined name (e.g. "Jax WT") in the combined group's place.
  const restored = [...members].sort((a, b) => Number(a !== group) - Number(b !== group) || a.length - b.length)
  order.splice(at < 0 ? order.length : at, 0, ...restored)
  const heir = restored[0]
  return {
    ...cfg,
    groupMerge: merge,
    groupOrder: order,
    controlGroup: cfg.controlGroup === group ? heir : cfg.controlGroup,
    diseaseGroup: cfg.diseaseGroup === group ? heir : cfg.diseaseGroup,
  }
}

function colIndex(ds: Dataset, name: string | null): number {
  return name ? ds.headers.indexOf(name) : -1
}

function cellText(c: Cell): string {
  if (c === null) return ''
  if (typeof c === 'number') return Number.isInteger(c) ? String(c) : String(+c.toFixed(6))
  return c.trim()
}

export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

export function distinctValues(ds: Dataset, name: string | null): string[] {
  const i = colIndex(ds, name)
  if (i < 0) return []
  const s = new Set<string>()
  for (const r of ds.rows) {
    const t = cellText(r[i])
    if (t) s.add(t)
  }
  return [...s].sort(naturalCompare)
}

/** A run/trial column with an order (not unordered replicate subcolumns from a Prism table). */
export const isTrialColumn = (c: { meta: string | null; name: string }) => c.meta === 'run' && !/^replicate\b/i.test(c.name.trim())

const CONTROL_HINT = /^(wt|wild[\s-]?type|control|ctrl|sham|naive|vehicle|veh|healthy|\+\/\+|het)$/i
const CONTROL_HINT_LOOSE = /(wt|wild[\s-]?type|control|ctrl|sham|naive)/i

/** Group names that look like a control cohort ("Jax WT", "EIF Jax WT", "Sham"). */
export const isControlLike = (g: string) => CONTROL_HINT_LOOSE.test(g)
const DISEASE_HINT = /(vehicle|veh|pbs|saline|untreated|ko|-\/-|mutant|model|lesion|disease)/i

export function groupDefaults(groups: string[]): { controlGroup: string | null; diseaseGroup: string | null; groupOrder: string[] } {
  // Among loose matches ("Jax WT", "EIF Jax WT", "New Jax WT") the plainest, shortest name is the main control.
  const loose = groups.filter((g) => CONTROL_HINT_LOOSE.test(g)).sort((a, b) => a.length - b.length)
  // Wild-type beats other control-like names (het, sham, vehicle) when several are present.
  const exact = groups.filter((g) => CONTROL_HINT.test(g)).sort((a, b) => Number(!/^(wt|wild[\s-]?type|\+\/\+)$/i.test(a)) - Number(!/^(wt|wild[\s-]?type|\+\/\+)$/i.test(b)))
  const control = exact[0] ?? loose[0] ?? groups[0] ?? null
  const disease =
    groups.length >= 3 ? (groups.find((g) => g !== control && DISEASE_HINT.test(g) && !/aav|treat|drug|gene|rescue/i.test(g)) ?? null) : null
  return {
    controlGroup: control,
    diseaseGroup: disease,
    groupOrder: [control, disease, ...groups.filter((g) => g !== control && g !== disease)].filter((g): g is string => Boolean(g)),
  }
}

/** Groups whose rows are labelled "Control" in a CatWalk Group_Type column. */
function controlsFromGroupType(ds: Dataset, groupCol: string | null): string[] {
  const gi = colIndex(ds, groupCol)
  const ti = ds.columns.findIndex((c) => c.meta === 'grouptype')
  if (gi < 0 || ti < 0) return []
  const out = new Set<string>()
  for (const r of ds.rows) if (/^control$/i.test(cellText(r[ti]))) out.add(cellText(r[gi]))
  return [...out]
}

export function autoConfig(ds: Dataset): AnalysisConfig {
  const find = (role: string) => ds.columns.find((c) => c.meta === role)?.name ?? null
  let subjectCol = find('subject') ?? find('trial')
  // CatWalk numbers animals (Animal0001…) per experiment, so when several CatWalk
  // experiments are combined the trial name (usually the ear tag) identifies animals.
  const expCol = ds.headers.find((h) => /^experiment$/i.test(h.trim())) ?? null
  const trialCol = find('trial')
  if (subjectCol && trialCol && subjectCol !== trialCol && expCol && distinctValues(ds, expCol).length > 1) {
    const ids = distinctValues(ds, subjectCol)
    if (ids.length && ids.every((v) => /^animal\s*\d+$/i.test(v))) subjectCol = trialCol
  }
  let groupCol = find('group')
  if (!groupCol && ds.sources.length > 1) groupCol = SOURCE_COL
  // A time column is only useful with 2+ real timepoints (CatWalk writes "Undefined" when none were set).
  const timeCol =
    ds.columns.find((c) => c.meta === 'time' && distinctValues(ds, c.name).filter((v) => !/^undefined$/i.test(v)).length >= 2)?.name ?? null
  const compliantCol = find('compliant')
  const groups = distinctValues(ds, groupCol)
  const defaults = groupDefaults(groups)
  const typed = controlsFromGroupType(ds, groupCol)
  if (typed.length === 1 && groups.includes(typed[0])) {
    const control = typed[0]
    defaults.controlGroup = control
    if (defaults.diseaseGroup === control) defaults.diseaseGroup = null
    defaults.groupOrder = [control, ...defaults.groupOrder.filter((g) => g !== control)]
  }
  return {
    subjectCol,
    groupCol,
    timeCol,
    compliantCol,
    onlyCompliant: Boolean(compliantCol),
    ...defaults,
    excludedGroups: [],
    timeOrder: distinctValues(ds, timeCol),
    test: 'parametric',
    speedAdjust: false,
    minRuns: 1,
    maxVariation: null,
    filters: [],
  }
}

export function isCompliant(c: Cell): boolean {
  if (c === null) return false
  if (typeof c === 'number') return c !== 0
  return /^(yes|y|true|1|compliant|ok)$/i.test(c.trim())
}

// ---------------------------------------------------------------------------
// Aggregation

export interface Subject {
  id: string
  group: string
  time: string
  nRuns: number
  sex?: string
  age?: number
  values: Record<string, number>
  speed: number
  /** Body weight (g), when a weight column or weight file is present. */
  weight?: number
}

export interface AggregateResult {
  subjects: Subject[]
  rowsTotal: number
  rowsUsed: number
  rowsNonCompliant: number
  rowsHighVariation: number
  rowsFiltered: number
  /** Runs (rows) whose max speed variation exceeds the default threshold, counted before filtering. */
  rowsAboveDefaultVariation: number
  speedSlopes: Record<string, number>
  /** Within-group slope of each parameter on body weight (units per g), when weight adjustment is on. */
  weightSlopes: Record<string, number>
  /** Animal-timepoints left out of adjusted parameters because their weight is missing. */
  weightMissing: number
  groups: string[]
  times: string[]
  /** Row-level values when rows are individual trials/runs with a trial number (for learning curves). */
  trials: TrialRow[]
}

export interface TrialRow {
  id: string
  group: string
  time: string
  trial: string
  order: number
  values: Record<string, number>
}

export function aggregate(ds: Dataset, measures: Measure[], cfg: AnalysisConfig): AggregateResult {
  const si = colIndex(ds, cfg.subjectCol)
  const gi = colIndex(ds, cfg.groupCol)
  const ti = colIndex(ds, cfg.timeCol)
  const ci = colIndex(ds, cfg.compliantCol)
  const speedM = measures.find((m) => m.def.id === 'speed' && m.col !== undefined)
  const varM = measures.find((m) => m.def.id === 'speed_variation' && m.col !== undefined)
  const weightM = measures.find((m) => m.def.id === 'body_weight' && m.col !== undefined)
  const nri = ds.columns.findIndex((c) => c.meta === 'nruns')
  const sexi = ds.columns.findIndex((c) => c.meta === 'sex')
  const agei = ds.columns.findIndex((c) => /^age\b/i.test(c.name) && c.numericShare > 0.8)
  const runi = ds.columns.findIndex((c) => c.meta === 'run')
  // Replicate subcolumns (repeated measurements with no order) give no learning curve.
  const triali = ds.columns.findIndex(isTrialColumn)
  const filters = cfg.filters.map((f) => ({ i: colIndex(ds, f.col), values: new Set(f.values) })).filter((f) => f.i >= 0)
  const raw = measures.filter((m) => m.col !== undefined)

  interface Row {
    subject: string
    group: string
    time: string
    speed: number
    weight: number
    v: number[]
    nRuns: number
    sex?: string
    age?: number
    order: number
    trial: string
  }
  const rows: Row[] = []
  let nonCompliant = 0
  let highVar = 0
  let filtered = 0
  let aboveDefault = 0
  ds.rows.forEach((r, idx) => {
    const variation = varM ? toNumber(r[varM.col!]) : null
    if (variation !== null && variation > DEFAULT_MAX_VARIATION && nri < 0) aboveDefault++
    if (ci >= 0 && cfg.onlyCompliant && !isCompliant(r[ci])) {
      nonCompliant++
      return
    }
    if (filters.some((f) => !f.values.has(cellText(r[f.i])))) {
      filtered++
      return
    }
    // Only meaningful for run-level rows; trial statistics already average runs.
    if (cfg.maxVariation !== null && nri < 0 && variation !== null && variation > cfg.maxVariation) {
      highVar++
      return
    }
    const group = gi >= 0 ? groupOf(cfg, cellText(r[gi])) : NO_GROUP
    if (!group || cfg.excludedGroups.includes(group)) return
    const time = ti >= 0 ? cellText(r[ti]) : ''
    if (ti >= 0 && !time) return
    const subject = si >= 0 ? cellText(r[si]) || `row ${idx + 1}` : `row ${idx + 1}`
    rows.push({
      subject,
      group,
      time,
      speed: speedM ? (toNumber(r[speedM.col!]) ?? NaN) : NaN,
      weight: weightM ? (toNumber(r[weightM.col!]) ?? NaN) : NaN,
      v: raw.map((m) => toNumber(r[m.col!]) ?? NaN),
      nRuns: nri >= 0 ? (toNumber(r[nri]) ?? 1) : 1,
      sex: sexi >= 0 ? cellText(r[sexi]) || undefined : undefined,
      age: agei >= 0 ? (toNumber(r[agei]) ?? undefined) : undefined,
      order: runi >= 0 ? runOrder(r[runi], idx) : idx,
      trial: triali >= 0 ? cellText(r[triali]) : '',
    })
  })

  // Optional ANCOVA-style speed adjustment at the run level
  const speedSlopes: Record<string, number> = {}
  if (cfg.speedAdjust && speedM) {
    const grand = mean(finite(rows.map((r) => r.speed)))
    raw.forEach((m, j) => {
      if (m === speedM) return
      // Prefer the within-animal (run-to-run) slope; fall back to within-group
      // when there's only one row per animal.
      let slope = pooledWithinSlope(rows.map((r) => ({ x: r.speed, y: r.v[j], g: `${r.group}\u0000${r.time}\u0000${r.subject}` })))
      if (!Number.isFinite(slope)) {
        slope = pooledWithinSlope(rows.map((r) => ({ x: r.speed, y: r.v[j], g: `${r.group}\u0000${r.time}` })))
      }
      if (!Number.isFinite(slope)) return
      speedSlopes[m.key] = slope
      for (const r of rows) r.v[j] = Number.isFinite(r.speed) ? r.v[j] - slope * (r.speed - grand) : NaN
    })
  }

  // Average runs per subject × group × time
  const bySubject = new Map<string, Row[]>()
  for (const r of rows) {
    const k = `${r.subject}\u0000${r.group}\u0000${r.time}\u0000${r.sex ?? ''}`
    const arr = bySubject.get(k) ?? []
    arr.push(r)
    bySubject.set(k, arr)
  }
  const subjects: Subject[] = []
  for (const arr of bySubject.values()) {
    if (arr.reduce((n, r) => n + r.nRuns, 0) < cfg.minRuns) continue
    const values: Record<string, number> = {}
    raw.forEach((m, j) => {
      values[m.key] = mean(finite(arr.map((r) => r.v[j])))
    })
    addDerived(values, measures)
    addTrialDerived(values, measures, raw, arr)
    subjects.push({
      id: arr[0].subject,
      group: arr[0].group,
      time: arr[0].time,
      // Trial-statistics exports carry the run count in their own column.
      nRuns: arr.reduce((n, r) => n + r.nRuns, 0),
      sex: arr[0].sex,
      age: arr[0].age,
      values,
      speed: mean(finite(arr.map((r) => r.speed))),
      weight: weightM ? mean(finite(arr.map((r) => r.weight))) : undefined,
    })
  }

  // Optional ANCOVA-style adjustment for body weight at the animal level: the slope of each
  // parameter on weight is pooled within group × timepoint, and values are re-centred on the
  // mean weight of all animals at that timepoint.
  const weightSlopes: Record<string, number> = {}
  let weightMissing = 0
  if (cfg.weightAdjust && weightM) {
    const w = (s: Subject) => s.weight ?? NaN
    weightMissing = subjects.filter((s) => !Number.isFinite(w(s))).length
    const grand = new Map<string, number>()
    for (const t of new Set(subjects.map((s) => s.time))) grand.set(t, mean(finite(subjects.filter((s) => s.time === t).map(w))))
    for (const m of measures) {
      if (m === weightM || m.def.id === 'body_weight') continue
      const slope = pooledWithinSlope(subjects.map((s) => ({ x: w(s), y: s.values[m.key], g: `${s.group}\u0000${s.time}` })))
      if (!Number.isFinite(slope)) continue
      weightSlopes[m.key] = slope
      for (const s of subjects) s.values[m.key] = Number.isFinite(w(s)) ? s.values[m.key] - slope * (w(s) - grand.get(s.time)!) : NaN
    }
  }

  const present = new Set(subjects.map((s) => s.group))
  const groups = [...cfg.groupOrder.filter((g) => present.has(g)), ...[...present].filter((g) => !cfg.groupOrder.includes(g)).sort(naturalCompare)]
  const tPresent = new Set(subjects.map((s) => s.time))
  const times = [...cfg.timeOrder.filter((t) => tPresent.has(t)), ...[...tPresent].filter((t) => !cfg.timeOrder.includes(t)).sort(naturalCompare)]
  return {
    subjects,
    rowsTotal: ds.rows.length,
    rowsUsed: rows.length,
    rowsNonCompliant: nonCompliant,
    rowsHighVariation: highVar,
    rowsFiltered: filtered,
    rowsAboveDefaultVariation: aboveDefault,
    speedSlopes,
    weightSlopes,
    weightMissing,
    groups,
    times,
    trials:
      triali >= 0
        ? rows
            .filter((r) => r.trial && subjects.some((s) => s.id === r.subject && s.group === r.group && s.time === r.time))
            .map((r) => ({ id: r.subject, group: r.group, time: r.time, trial: r.trial, order: r.order, values: Object.fromEntries(raw.map((m, j) => [m.key, r.v[j]])) }))
        : [],
  }
}

/** Every (timepoint, trial) pair present, in order; labels read "Day 1 · 2" when there are several timepoints. */
export function trialAxis(agg: AggregateResult, noun = 'Trial'): { label: string; time: string; trial: string }[] {
  const first = new Map<string, number>()
  for (const t of agg.trials) first.set(t.trial, Math.min(first.get(t.trial) ?? Infinity, t.order))
  const trials = [...first.keys()].sort((a, b) => first.get(a)! - first.get(b)! || naturalCompare(a, b))
  const times = agg.times.length ? agg.times : ['']
  const present = new Set(agg.trials.map((t) => `${t.time}\u0000${t.trial}`))
  return times.flatMap((time) =>
    trials
      .filter((trial) => present.has(`${time}\u0000${trial}`))
      .map((trial) => ({ time, trial, label: times.length > 1 ? `${time} · ${trial}` : /^\d/.test(trial) ? `${noun} ${trial}` : trial })),
  )
}

/** One value per animal for a trial (duplicate rows averaged). */
export function trialValue(agg: AggregateResult, key: string, id: string, group: string, time: string, trial: string): number {
  return mean(finite(agg.trials.filter((r) => r.id === id && r.group === group && r.time === time && r.trial === trial).map((r) => r.values[key])))
}

/** Position of a trial/run: its number ("Trial 3" → 3); rows without one keep file order. */
function runOrder(c: Cell, idx: number): number {
  const n = toNumber(c) ?? (typeof c === 'string' ? Number(/\d+(\.\d+)?/.exec(c)?.[0] ?? NaN) : NaN)
  return Number.isFinite(n) ? n * 1e6 + idx : 1e12 + idx
}

function addTrialDerived(values: Record<string, number>, measures: Measure[], raw: Measure[], rows: { v: number[]; order: number }[]) {
  const sorted = [...rows].sort((a, b) => a.order - b.order)
  for (const m of measures) {
    if (!m.trial) continue
    const j = raw.findIndex((x) => x.key === m.trial!.source)
    const xs = j < 0 ? [] : finite(sorted.map((r) => r.v[j]))
    let out = NaN
    if (xs.length) {
      switch (m.trial.how) {
        case 'max':
          out = Math.max(...xs)
          break
        case 'first':
          out = xs[0]
          break
        case 'last':
          out = xs[xs.length - 1]
          break
        case 'improvement':
          out = xs.length > 1 ? xs[xs.length - 1] - xs[0] : NaN
          break
      }
    }
    values[m.key] = out
  }
}

function addDerived(values: Record<string, number>, measures: Measure[]) {
  for (const m of measures) {
    if (!m.derived) continue
    const v = (p: Paw) => values[`${m.def.id}|${p}`]
    const [lf, rf, lh, rh] = PAWS.map(v)
    let out = NaN
    switch (m.derived) {
      case 'FRONT':
        out = (lf + rf) / 2
        break
      case 'HIND':
        out = (lh + rh) / 2
        break
      case 'ASYM_F':
        out = asym(lf, rf)
        break
      case 'ASYM_H':
        out = asym(lh, rh)
        break
    }
    values[m.key] = out
  }
}

function asym(l: number, r: number): number {
  const m = (l + r) / 2
  return m !== 0 && Number.isFinite(m) ? ((l - r) / m) * 100 : NaN
}

// ---------------------------------------------------------------------------
// Statistics per timepoint

export interface Comparison {
  group: string
  reference: string
  test: TestResult
  pAdj: number
  g: number
  diffPct: number
  diff: number
}

export interface MeasureResult {
  measure: Measure
  time: string
  groups: Record<string, Describe & { values: number[] }>
  omnibus: TestResult | null
  comparisons: Comparison[]
  /** p used for FDR across measures (omnibus when >2 groups, else the pairwise p) */
  pPrimary: number
  q: number
  rescuePct?: number
}

export interface TimeResults {
  time: string
  results: MeasureResult[]
}

export function analyse(agg: AggregateResult, measures: Measure[], cfg: AnalysisConfig): TimeResults[] {
  const times = agg.times.length ? agg.times : ['']
  const control = cfg.controlGroup && agg.groups.includes(cfg.controlGroup) ? cfg.controlGroup : agg.groups[0]
  const disease = cfg.diseaseGroup && agg.groups.includes(cfg.diseaseGroup) && cfg.diseaseGroup !== control ? cfg.diseaseGroup : null
  const pair = cfg.test === 'parametric' ? welchT : mannWhitney
  const omni = cfg.test === 'parametric' ? oneWayAnova : kruskalWallis

  return times.map((time) => {
    const subs = agg.subjects.filter((s) => s.time === time)
    const results: MeasureResult[] = measures.map((m) => {
      const groups: MeasureResult['groups'] = {}
      for (const g of agg.groups) {
        const vals = finite(subs.filter((s) => s.group === g).map((s) => s.values[m.key]))
        groups[g] = { ...describe(vals), values: vals }
      }
      const withData = agg.groups.filter((g) => groups[g].n > 0)
      const comparisons: Comparison[] = []
      const compare = (g: string, ref: string) => {
        const a = groups[g].values
        const b = groups[ref].values
        const refMean = groups[ref].mean
        comparisons.push({
          group: g,
          reference: ref,
          test: pair(a, b),
          pAdj: NaN,
          g: hedgesG(a, b),
          diff: groups[g].mean - refMean,
          diffPct: refMean !== 0 ? ((groups[g].mean - refMean) / Math.abs(refMean)) * 100 : NaN,
        })
      }
      if (control && groups[control]?.n) {
        for (const g of withData) if (g !== control) compare(g, control)
      }
      if (disease && groups[disease]?.n) {
        for (const g of withData) if (g !== control && g !== disease) compare(g, disease)
      }
      const adj = holm(comparisons.map((c) => c.test.p))
      comparisons.forEach((c, i) => (c.pAdj = comparisons.length > 1 ? adj[i] : c.test.p))
      const omnibus = withData.length > 2 ? omni(withData.map((g) => groups[g].values)) : null
      const pPrimary = omnibus ? omnibus.p : (comparisons[0]?.test.p ?? NaN)

      let rescuePct: number | undefined
      if (disease && control) {
        const d = groups[disease].mean
        const c = groups[control].mean
        const treated = withData.filter((g) => g !== control && g !== disease)
        if (treated.length === 1 && Math.abs(c - d) > 0) {
          rescuePct = ((groups[treated[0]].mean - d) / (c - d)) * 100
        }
      }
      return { measure: m, time, groups, omnibus, comparisons, pPrimary, q: NaN, rescuePct }
    })
    const q = benjaminiHochberg(results.map((r) => r.pPrimary))
    results.forEach((r, i) => (r.q = q[i]))
    return { time, results }
  })
}

// ---------------------------------------------------------------------------
// Convenience

export function primaryComparison(r: MeasureResult, cfg: AnalysisConfig): Comparison | undefined {
  // The disease-vs-control comparison if defined, otherwise the first vs-control comparison.
  if (cfg.diseaseGroup) {
    const c = r.comparisons.find((c) => c.group === cfg.diseaseGroup && c.reference === cfg.controlGroup)
    if (c) return c
  }
  return r.comparisons[0]
}

export function formatP(p: number): string {
  if (!Number.isFinite(p)) return '—'
  if (p < 0.0001) return '<0.0001'
  if (p < 0.001) return p.toFixed(4)
  return p.toFixed(3)
}

export function stars(p: number): string {
  if (!Number.isFinite(p)) return ''
  if (p < 0.001) return '***'
  if (p < 0.01) return '**'
  if (p < 0.05) return '*'
  return ''
}

export function formatNum(x: number, digits = 3): string {
  if (!Number.isFinite(x)) return '—'
  const a = Math.abs(x)
  if (a === 0) return '0'
  if (a >= 1000) return x.toLocaleString(undefined, { maximumFractionDigits: 0 })
  if (a >= 100) return x.toFixed(1)
  if (a >= 1) return x.toFixed(Math.max(0, digits - 1))
  return x.toPrecision(digits)
}
