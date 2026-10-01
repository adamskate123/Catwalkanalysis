// Weight Lab: weekly weight logs, the C57BL/6J reference and the z-score.
// Synthetic values in the layout of a colony weight log.

import { afterEach, describe, expect, it } from 'vitest'
import { setProgram } from '../programs'
import { aggregate, analyse, autoConfig, buildMeasures } from './analysis'
import { interpret, isReported } from './interpret'
import { mergeTables, pickTables, type Cell, type RawSheet } from './parse'
import { C57BL6J, referenceAt, sexOf } from './weightRef'

afterEach(() => setProgram('catwalk'))

describe('C57BL/6J reference', () => {
  it('holds the JAX values used for comparison', () => {
    expect(referenceAt(C57BL6J, 'F', 21)).toEqual({ week: 3, mean: 10.1, sd: 1.6 })
    expect(referenceAt(C57BL6J, 'M', 84)).toEqual({ week: 12, mean: 29.3, sd: 2.3 })
    expect(referenceAt(C57BL6J, 'M', 168)).toEqual({ week: 24, mean: 35.3, sd: 3.9 })
  })
  it('rounds to the nearest week and does not extrapolate', () => {
    expect(referenceAt(C57BL6J, 'F', 59)?.week).toBe(8) // 8.4 weeks
    expect(referenceAt(C57BL6J, 'F', 18)?.week).toBe(3) // 2.6 weeks
    expect(referenceAt(C57BL6J, 'F', 14)).toBeNull() // week 2
    expect(referenceAt(C57BL6J, 'M', 200)).toBeNull() // week 29
    expect(referenceAt(C57BL6J, null, 84)).toBeNull()
  })
  it('reads sex labels', () => {
    expect(['Female', 'F', 'male', 'M', 'unknown'].map(sexOf)).toEqual(['F', 'F', 'M', 'M', null])
  })
})

const DATES = ['2026-08-11', '2026-08-18', '2026-08-25']

/** One row per animal, one column per weigh-in date; IDs repeat across litters. */
function log(): RawSheet {
  const h = ['Animal ID', 'Tag Number', 'Toe/Ear Mark', 'Sex', 'Genotype', 'DOB', 'Latest Wt (g)', 'Z vs Ref', ...DATES]
  const rows: Cell[][] = [
    ['F1', 'L1.1', 'NM', 'Female', 'Mut', '2026-06-16', 19, -1, 18.0, 18.5, 19.0], // 8, 9, 10 weeks
    ['RF', 'L1.1', 'RF', 'Male', 'Mut', '2026-06-16', 24, -1, 22.0, 23.0, 24.0],
    ['RF', 'L2.1', 'RF', 'Male', 'WT', '2026-06-16', 27, 0, 24.7, 26.1, 26.7], // exactly the reference means
    ['NM', 'L2.1', 'NM', 'Male', 'WT', '2026-06-16', 27, 0, 25.0, null, 27.0],
  ]
  return { file: 'weights.xlsx', sheet: 'Weights', cells: [['Colony weight log'], [], h, ...rows] }
}

/** The same dates holding z-scores: not weigh-ins. */
function zHistory(): RawSheet {
  return { file: 'weights.xlsx', sheet: 'Z History', cells: [['Animal ID', 'Sex', ...DATES], ['F1', 'Female', -0.4, -0.2, -0.1]] }
}

function referenceSheet(): RawSheet {
  const rows: Cell[][] = C57BL6J.weeks.map((w) => [w.week, w.f!.mean, w.f!.sd, w.m!.mean, w.m!.sd])
  return { file: 'weights.xlsx', sheet: 'Reference', cells: [['My strain norms'], [], ['Age (weeks)', 'Female Mean (g)', 'Female SD (g)', 'Male Mean (g)', 'Male SD (g)'], ...rows] }
}

describe('weight log', () => {
  const load = (sheets: RawSheet[]) => {
    setProgram('weight')
    return mergeTables(pickTables(sheets))
  }

  it('melts weigh-in dates into one row per weigh-in with age and week', () => {
    const ds = load([log(), zHistory()])
    const col = (h: string) => ds.headers.indexOf(h)
    expect(ds.rows).toHaveLength(11) // 12 cells, one empty
    expect(ds.columns.find((c) => c.name === 'Age (weeks)')?.meta).toBe('time')
    expect(ds.columns.find((c) => c.name === 'Weigh date')?.meta).toBe('run')
    const f1 = ds.rows.filter((r) => r[col('Animal')] === 'L1.1 NM')
    expect(f1.map((r) => r[col('Age (d)')])).toEqual([56, 63, 70])
    expect(f1.map((r) => r[col('Age (weeks)')])).toEqual(['Week 8', 'Week 9', 'Week 10'])
    // Summary columns from the sheet are not analysed
    expect(buildMeasures(ds).map((m) => m.def.id)).toEqual(['body_weight', 'weight_z', 'weight_pct_ref'])
  })

  it('identifies animals by tag + mark when sheet IDs repeat', () => {
    const ds = load([log()])
    const ids = new Set(ds.rows.map((r) => r[ds.headers.indexOf('Animal')]))
    expect([...ids].sort()).toEqual(['L1.1 NM', 'L1.1 RF', 'L2.1 NM', 'L2.1 RF'])
    expect(ds.notices.some((n) => /RF is L1.1 RF and L2.1 RF/.test(n))).toBe(true)
  })

  it('computes z and % of the reference for sex and week', () => {
    const ds = load([log()])
    const col = (h: string) => ds.headers.indexOf(h)
    const row = (id: string, week: string) => ds.rows.find((r) => r[col('Animal')] === id && r[col('Age (weeks)')] === week)!
    expect(row('L2.1 RF', 'Week 8')[col('Weight z vs reference (SD)')]).toBeCloseTo(0, 10)
    expect(row('L1.1 RF', 'Week 8')[col('Weight z vs reference (SD)')]).toBeCloseTo((22 - 24.7) / 1.8, 10)
    expect(row('L1.1 NM', 'Week 8')[col('Weight z vs reference (SD)')]).toBeCloseTo((18 - 19.5) / 1.2, 10)
    expect(row('L1.1 RF', 'Week 8')[col('Weight, % of reference')]).toBeCloseTo((22 / 24.7) * 100, 10)
    expect(ds.reference?.name).toBe(C57BL6J.name)
  })

  it('uses a reference sheet from the workbook', () => {
    const ds = load([log(), referenceSheet()])
    expect(ds.reference?.name).toBe('My strain norms')
    expect(ds.rows.length).toBe(11) // the reference sheet is not data or an animal key
  })

  it('compares groups by week and reports growth restriction in the demo', () => {
    setProgram('weight')
    const ds = mergeTables(pickTables([setupDemo()]))
    const ms = buildMeasures(ds)
    const cfg = autoConfig(ds)
    expect(cfg.controlGroup).toBe('WT')
    const res = analyse(aggregate(ds, ms, cfg), ms, cfg)
    const late = res[res.length - 1]
    const z = late.results.find((r) => r.measure.def.id === 'weight_z')!
    expect(z.comparisons[0].g).toBeLessThan(-0.8)
    expect(Number.isNaN(z.comparisons[0].diffPct)).toBe(true) // no % change for a z-score
    expect(isReported(interpret(late, cfg).find((f) => f.domain.id === 'wt_low')!)).toBe(true)
  })

  it('leaves date-headed columns alone in other programs', () => {
    setProgram('cagehang')
    const t = pickTables([log()])[0]
    expect(t.headers).toContain(DATES[0])
  })
})

function setupDemo(): RawSheet {
  return setProgram('weight').demo()
}
