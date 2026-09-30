// Regression tests for animal-key joins against a weekly weight log (v2.5.1).
// Synthetic values; the layout mirrors a real colony weight log and a CatWalk XT
// run-statistics export with two test dates.

import { describe, expect, it } from 'vitest'
import { aggregate, analyse, autoConfig, buildMeasures } from './analysis'
import { detectTable, mergeTables, parseDay, type Cell, type RawSheet } from './parse'
import { dataWarnings } from './report'

const ANIMALS = [
  { id: 'JAX NM', group: 'WT', tag: 'Jax Ctrl', mark: 'NM', key: 'NM', sex: 'Male' },
  { id: 'JAX L', group: 'WT', tag: 'Jax Ctrl', mark: 'L', key: 'L', sex: 'Male' },
  { id: 'JAX R', group: 'WT', tag: 'Jax Ctrl', mark: 'R', key: 'R', sex: 'Male' },
  { id: 'KX9.1 LF', group: 'Mut', tag: 'KX9.1', mark: 'LF', key: 'M-LF', sex: 'Male' },
  { id: 'KX9.1 RF', group: 'Mut', tag: 'KX9.1', mark: 'RF', key: 'M-RF', sex: 'Male' },
  { id: 'KX9.1 NM', group: 'Mut', tag: 'KX9.1', mark: 'NM', key: 'F1', sex: 'Female' },
]
const DATES = ['9/24/2026', '9/30/2026']

/** Run statistics: 3 runs per animal per date; the first animal's first-date runs mostly hesitate. */
function runSheet(): RawSheet {
  const h = ['Group', 'Animal', 'Time_Point', 'Trial', 'Run', 'Run_Duration_(s)', 'Run_Average_Speed_(cm/s)', 'Run_Maximum_Variation_(%)', 'StepSequence_NumberOfPatterns', 'RH_PrintArea_(cm²)_Mean']
  const rows: Cell[][] = []
  ANIMALS.forEach((a, ai) =>
    DATES.forEach((d, di) => {
      for (let run = 1; run <= 3; run++) {
        const hesitant = ai === 0 && di === 0 && run < 3
        // Pattern counts 1–7 overlap the weigh-in counts in the key by chance.
        rows.push([a.group, a.id, d, `${a.id}-${di + 1}`, `Run00${run}`, hesitant ? 4 : 1.5, 20 + run, hesitant ? 120 : 20, ((ai + run + di) % 7) + 1, 0.3 + ai / 100])
      }
    }),
  )
  return { file: 'runs.xlsx', sheet: 'RunStatistics', cells: [h, ...rows] }
}

/** Weight log: IDs that differ from CatWalk's, a numeric weigh-in count, weekly date columns. */
function weightSheet(): RawSheet {
  const h = ['Animal ID', 'Tag Number', 'Toe/Ear Mark', 'Sex', 'DOB', 'Weigh-ins (n)', 'Current Age (d)', '2026-09-15', '2026-09-22', '2026-09-29']
  const rows: Cell[][] = ANIMALS.map((a, i) => [a.key, a.tag, a.mark, a.sex, '2026-08-01', (i % 7) + 1, 999, 20 + i, 21 + i, i === 2 ? null : 22 + i])
  return { file: 'weights.xlsx', sheet: 'TBCD Weights', cells: [['Colony weight log'], [], h, ...rows] }
}

const load = (opts = {}) => mergeTables([detectTable(runSheet())!, detectTable(weightSheet())!], opts)

describe('animal key joined to a weekly weight log', () => {
  it('never joins on numeric columns that overlap by chance', () => {
    const ds = load()
    expect(ds.keys[0].keyColumn).not.toMatch(/Weigh-ins/)
    expect(ds.keys[0].dataColumn).not.toMatch(/StepSequence/)
  })

  it('combines tag and mark and matches IDs by their words', () => {
    const k = load().keys[0]
    expect(k.keyColumns).toEqual(['Tag Number', 'Toe/Ear Mark'])
    expect(k.dataColumn).toBe('Animal')
    expect(k.matchedIds).toBe(6)
    expect(k.unmatchedData).toEqual([])
    expect(k.fuzzy).toBe(3) // JAX NM ↔ Jax Ctrl NM, etc.
    expect(k.auto).toBe(true)
  })

  it('takes the weigh-in nearest each test date and computes age at test from DOB', () => {
    const ds = load()
    const wi = ds.headers.indexOf('Body weight (g)')
    const ai = ds.headers.indexOf('Age at test (d)')
    const ti = ds.headers.indexOf('Time_Point')
    const idi = ds.headers.indexOf('Animal')
    const at = (id: string, d: string) => ds.rows.find((r) => r[idi] === id && r[ti] === d)!
    expect(at('KX9.1 LF', '9/24/2026')[wi]).toBe(24) // 9/22 is 2 days away
    expect(at('KX9.1 LF', '9/30/2026')[wi]).toBe(25) // 9/29
    expect(at('JAX R', '9/30/2026')[wi]).toBeNull() // no weigh-in within 7 days
    expect(at('KX9.1 LF', '9/24/2026')[ai]).toBe(54)
    expect(ds.headers.filter((h) => /^2026-/.test(h))).toEqual([]) // weekly columns are not added
    expect(buildMeasures(ds).some((m) => m.def.id === 'body_weight')).toBe(true)
  })

  it('counts compliant runs per animal-timepoint and names the short ones', () => {
    const ds = load()
    const m = buildMeasures(ds)
    const cfg = autoConfig(ds)
    const agg = aggregate(ds, m, cfg)
    expect(agg.subjects).toHaveLength(12) // sex from the key is consistent within an animal
    const text = dataWarnings(agg, analyse(agg, m, cfg)[0], cfg, ds).map((w) => w.text).join('\n')
    expect(text).toMatch(/1 of 12 animal-timepoints have fewer than 3 compliant runs/)
    expect(text).toMatch(/JAX NM @ 9\/24\/2026: 1 of 3/)
    expect(text).not.toMatch(/no entry for/)
  })

  it('uses a join picked by hand', () => {
    const k = load({ keyChoices: { 'weights.xlsx › TBCD Weights': { keyColumns: ['Animal ID'], dataColumn: 'Animal' } } }).keys[0]
    expect(k.auto).toBe(false)
    expect(k.keyColumn).toBe('Animal ID')
    expect(k.matchedIds).toBe(0)
    expect(k.unmatchedData).toHaveLength(6)
    expect(k.keyOptions).toContain('Tag Number')
  })
})

describe('parseDay', () => {
  it.each([
    ['2026-09-24', '9/24/2026'],
    ['2026-09-24T00:00:00', '24.09.2026'],
  ])('%s = %s', (a, b) => expect(parseDay(a)).toBe(parseDay(b)))
  it('ignores non-dates', () => {
    expect(parseDay('Undefined')).toBeNull()
    expect(parseDay(20)).toBeNull()
  })
})
