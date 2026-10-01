// Age at test and age windows. Synthetic CatWalk-style runs with an animal key.

import { afterEach, describe, expect, it } from 'vitest'
import { setProgram } from '../programs'
import { AGE_WINDOW_COL, windowOf, windowsOf } from './ageWindows'
import { aggregate, buildMeasures, distinctValues } from './analysis'
import { reconcileConfig } from './experiment'
import { detectTable, mergeTables, type Cell, type MergeOptions } from './parse'

afterEach(() => setProgram('catwalk'))

describe('windows', () => {
  it('builds consecutive bins named like age-binned Prism sheets', () => {
    const w = windowsOf({ mode: 'bins', values: [100, 50, 150], tolerance: 0 })
    expect(w.map((x) => x.label)).toEqual(['≤50 days', '51-100 days', '101-150 days', '>150 days'])
    expect(windowOf(50, w)?.label).toBe('≤50 days')
    expect(windowOf(51, w)?.label).toBe('51-100 days')
    expect(windowOf(100, w)?.label).toBe('51-100 days')
    expect(windowOf(100.4, w)?.label).toBe('101-150 days')
    expect(windowOf(400, w)?.label).toBe('>150 days')
  })

  it('builds target ages ± days and leaves other ages out', () => {
    const w = windowsOf({ mode: 'targets', values: [50, 60], tolerance: 7 })
    expect(w.map((x) => x.label)).toEqual(['50 days (43-57)', '60 days (53-67)'])
    expect(windowOf(54, w)?.label).toBe('50 days (43-57)') // in both; 50 is nearer
    expect(windowOf(56, w)?.label).toBe('60 days (53-67)')
    expect(windowOf(70, w)).toBeNull()
  })
})

// Runs: CatWalk writes "Undefined" as the timepoint; the key holds dates of birth and test dates.
const ANIMALS = [
  { trial: 'WT A', group: 'WT', dob: '2026-08-01', test: '2026-09-15' }, // 45 d
  { trial: 'WT B', group: 'WT', dob: '2026-07-01', test: '2026-09-15' }, // 76 d
  { trial: 'MU A', group: 'Mut', dob: '2026-08-05', test: '2026-09-15' }, // 41 d
  { trial: 'MU B', group: 'Mut', dob: '2026-06-01', test: '2026-09-15' }, // 106 d
]

function runs(experiment = 'Cohort 1'): ReturnType<typeof detectTable> {
  const h = ['Experiment', 'Group', 'Animal', 'Time_Point', 'Trial', 'Run', 'Run_Duration_(s)', 'Run_Average_Speed_(cm/s)', 'RH_PrintArea_(cm²)_Mean']
  const rows: Cell[][] = []
  ANIMALS.forEach((a, i) => {
    for (let run = 1; run <= 3; run++) rows.push([experiment, a.group, `Animal000${i + 1}`, 'Undefined', a.trial, `Run00${run}`, 2 + run / 10, 20 + run, 0.3 + i / 100])
  })
  return detectTable({ file: 'runs.xlsx', sheet: 'RunStatistics', cells: [h, ...rows] })
}

function key(withTestDate = true): ReturnType<typeof detectTable> {
  const h = ['CatWalk trial name', 'Genotype', 'Date of birth', ...(withTestDate ? ['CatWalk test date'] : [])]
  const rows: Cell[][] = ANIMALS.map((a) => [a.trial, a.group, a.dob, ...(withTestDate ? [a.test] : [])])
  return detectTable({ file: 'key.xlsx', sheet: 'Animals', cells: [h, ...rows] })
}

const load = (opts: MergeOptions = {}, withTestDate = true, experiment?: string) => mergeTables([runs(experiment)!, key(withTestDate)!], opts)
const BINS: MergeOptions['ageWindows'] = { mode: 'bins', values: [50, 100], tolerance: 0 }

describe('age at test', () => {
  it('is calculated from the key’s date of birth and test date', () => {
    setProgram('catwalk')
    const ds = load()
    expect(ds.keys[0].dataColumn).toBe('Trial')
    const ai = ds.headers.indexOf('Age at test (d)')
    const ti = ds.headers.indexOf('Trial')
    const age = (t: string) => ds.rows.find((r) => r[ti] === t)![ai]
    expect([age('WT A'), age('WT B'), age('MU A'), age('MU B')]).toEqual([45, 76, 41, 106])
    expect(ds.ageInfo?.idColumn).toBe('Trial')
    expect(ds.ageInfo?.aged).toBe(12)
    expect(ds.headers).not.toContain(AGE_WINDOW_COL) // no windows until they are set
  })

  it('adds an age-window timepoint in window order, and analyses by it', () => {
    setProgram('catwalk')
    const ds = load({ ageWindows: BINS })
    expect(ds.columns.find((c) => c.name === AGE_WINDOW_COL)?.meta).toBe('time')
    expect(distinctValues(ds, AGE_WINDOW_COL)).toEqual(['≤50 days', '51-100 days', '>100 days'])
    const cfg = reconcileConfig(undefined, ds)
    const byAge = reconcileConfig({ ...cfg, timeCol: AGE_WINDOW_COL }, ds)
    expect(byAge.timeOrder).toEqual(['≤50 days', '51-100 days', '>100 days'])
    const agg = aggregate(ds, buildMeasures(ds), byAge)
    expect(agg.times).toEqual(['≤50 days', '51-100 days', '>100 days'])
    expect(agg.subjects.filter((s) => s.time === '≤50 days').map((s) => s.group).sort()).toEqual(['Mut', 'WT'])
  })

  it('leaves out runs outside target windows', () => {
    setProgram('catwalk')
    const ds = load({ ageWindows: { mode: 'targets', values: [45], tolerance: 5 } })
    const cfg = reconcileConfig({ ...reconcileConfig(undefined, ds), timeCol: AGE_WINDOW_COL }, ds)
    const agg = aggregate(ds, buildMeasures(ds), cfg)
    expect(agg.times).toEqual(['45 days (40-50)'])
    expect(agg.subjects).toHaveLength(2) // WT A (45 d) and MU A (41 d)
    expect(ds.notices.some((n) => /6 lie outside every window/.test(n))).toBe(true)
  })

  it('uses dates entered in the app, overriding the key', () => {
    setProgram('catwalk')
    const ds = load({ ageWindows: { ...BINS, birthDates: { 'MU B': '2026-08-10' } } })
    const ai = ds.headers.indexOf('Age at test (d)')
    expect(ds.rows.find((r) => r[ds.headers.indexOf('Trial')] === 'MU B')![ai]).toBe(36)
  })

  it('asks for a test date when there is none, and uses one entered per timepoint', () => {
    setProgram('catwalk')
    const ds = load({}, false)
    expect(ds.ageInfo?.aged).toBe(0)
    expect(ds.ageInfo?.missingTestDates).toEqual(['Undefined'])
    const ds2 = load({ ageWindows: { ...BINS, testDates: { Undefined: '2026-09-15' } } }, false)
    expect(ds2.ageInfo?.aged).toBe(12)
    expect(ds2.ageInfo?.testSource).toMatch(/entered in Setup/)
  })

  it('falls back to a date in the experiment name', () => {
    setProgram('catwalk')
    const ds = load({}, false, 'TBCD cohort 9-15-2026')
    expect(ds.ageInfo?.aged).toBe(12)
    expect(ds.ageInfo?.testSource).toMatch(/Experiment name/)
  })
})
