// A weights file (one row per weigh-in, with each animal's date of birth,
// genotype and sex) loaded with behavioural data: the weights become a
// covariate and the animal descriptions are joined like an animal key.
// Synthetic animals only.

import { afterEach, describe, expect, it } from 'vitest'
import { setProgram } from '../programs'
import { autoConfig } from './analysis'
import { AGE_AT_TEST_COL, WEIGHT_COL, isWeightTable, mergeTables, pickTables, weightKeyTable, type Cell, type RawSheet } from './parse'
import { LABEL_SOURCE_COL, PAS_HEADERS, RECORDING_COL } from './pas'

afterEach(() => setProgram('catwalk'))

/** Open field runs in the PAS import's layout: two animals, two test dates. */
function pasRuns(): RawSheet {
  const h = PAS_HEADERS
  const rows: Cell[][] = []
  const runs: [string, string, string, number][] = [
    ['KX7.1 LF', 'AA F', '2026-03-02', 1200],
    ['KX7.1 RF', 'WT F', '2026-03-02', 1500],
    ['KX7.2 LF', 'AA M', '2026-03-02', 1100],
    ['KX7.2 RF', 'WT M', '2026-03-02', 1650],
    ['KX7.1 LF', 'AA F', '2026-04-06', 1250],
    ['KX7.1 RF', 'WT F', '2026-04-06', 1450],
    ['KX7.2 LF', 'AA M', '2026-04-06', 1080],
    ['KX7.2 RF', 'WT M', '2026-04-06', 1700],
  ]
  runs.forEach(([id, label, date, dist], k) => {
    for (let i = 1; i <= 2; i++) {
      const row: Cell[] = h.map(() => null)
      const set = (name: string, v: Cell) => (row[h.indexOf(name)] = v)
      set('Animal ID', id)
      set('Genotype (PAS)', label.split(' ')[0])
      set('Sex (PAS)', label.split(' ')[1])
      set('PAS label', label)
      set('Test date', date)
      set('PAS session', `S${k}`)
      set('Chamber', 1)
      set('Interval', i)
      set(RECORDING_COL, `S${k} · chamber 1`)
      set('Distance moved (cm)', dist)
      set('Distance moved (cm) per interval', dist / 2 + (i === 1 ? 50 : -50))
      set('Ambulatory counts', dist / 2)
      rows.push(row)
    }
  })
  return { file: 'PASdata_002.mdb', sheet: '', cells: [h, ...rows] }
}

/** One row per weigh-in, with the animal's date of birth, genotype and sex on every row. */
function weighLog(): RawSheet {
  const animals: [string, string, string, string][] = [
    ['KX7.1 LF', 'F', 'Mut/Mut', '2026-01-05'],
    ['KX7.1 RF', 'F', 'WT', '2026-01-05'],
    ['KX7.2 LF', 'M', 'Mut/Mut', '2026-01-12'],
    ['KX7.2 RF', 'M', 'WT', '2026-01-12'],
  ]
  const rows: Cell[][] = []
  for (const [id, sex, g, dob] of animals)
    for (const [date, w] of [
      ['2026-02-27', 18],
      ['2026-03-05', 19],
      ['2026-04-06', 21],
    ] as const)
      rows.push([id, sex, g, dob, date, w + (g === 'WT' ? 2 : 0)])
  return { file: 'weights.xlsx', sheet: 'Log', cells: [['Animal ID', 'Sex', 'Genotype', 'DOB', 'Weigh date', 'Weight (g)'], ...rows] }
}

const load = (sheets: RawSheet[]) => mergeTables(sheets.flatMap((s) => pickTables([s])))

describe('weights file as an animal key', () => {
  it('finds the columns that describe each animal', () => {
    setProgram('openfield')
    const t = pickTables([weighLog()])[0]
    expect(isWeightTable(t)).toBe(true)
    const k = weightKeyTable(t, [])!
    expect(k.headers).toEqual(['Animal ID', 'Sex', 'Genotype', 'DOB'])
    expect(k.rows).toHaveLength(4)
    // Columns the data already have are not repeated
    expect(weightKeyTable(t, ['Sex', 'Genotype'])!.headers).toEqual(['Animal ID', 'DOB'])
    expect(weightKeyTable(t, ['Sex', 'Genotype', 'DOB'])).toBeNull()
  })

  it('leaves out values an animal\'s rows disagree on (a tag reused in another colony)', () => {
    setProgram('openfield')
    const log = weighLog()
    log.cells.push(['KX7.1 LF', 'M', 'WT', '2025-06-01', '2026-03-01', 30])
    const k = weightKeyTable(pickTables([log])[0], [])!
    const row = k.rows.find((r) => r[0] === 'KX7.1 LF')!
    expect(row.slice(1)).toEqual([null, null, null])
    expect(k.rows.find((r) => r[0] === 'KX7.2 LF')!.slice(1)).toEqual(['M', 'Mut/Mut', '2026-01-12'])
  })

  it('gives PAS runs genotype, sex, age at test and the nearest weigh-in', () => {
    setProgram('openfield')
    const ds = load([pasRuns(), weighLog()])
    const h = (n: string) => ds.headers.indexOf(n)
    const row = (id: string, date: string) => ds.rows.find((r) => r[h('Animal ID')] === id && r[h('Test date')] === date)!
    expect(ds.keys).toHaveLength(1)
    expect(row('KX7.2 LF', '2026-03-02')[h('Genotype')]).toBe('Mut/Mut')
    expect(row('KX7.2 LF', '2026-03-02')[h(LABEL_SOURCE_COL)]).toBe('Animal key')
    expect(row('KX7.1 RF', '2026-03-02')[h('Sex')]).toBe('F')
    expect(row('KX7.2 LF', '2026-03-02')[h(AGE_AT_TEST_COL)]).toBe(49)
    // 2026-03-02 is 3 days after 02-27 and 3 days before 03-05: the earlier weigh-in wins.
    expect(row('KX7.1 LF', '2026-03-02')[h(WEIGHT_COL)]).toBe(18)
    expect(row('KX7.1 RF', '2026-04-06')[h(WEIGHT_COL)]).toBe(23)
    expect(ds.ageInfo?.dobSource).toBe('the DOB column')
    expect(ds.notices.some((n) => /weigh-in nearest the test date/.test(n))).toBe(true)
    expect(autoConfig(ds).groupCol).toBe('Genotype')
  })

  it('fills gaps when two keys hold dates of birth for different animals', () => {
    setProgram('openfield')
    const key: RawSheet = {
      file: 'key.xlsx',
      sheet: 'Animals',
      cells: [
        ['Tag Number', 'Toe/Ear Mark', 'Genotype', 'DOB'],
        ['KX7.9', 'LF', 'WT', '2025-12-01'],
        ['KX7.9', 'RF', 'WT', '2025-12-01'],
        ['KX7.8', 'LF', 'WT', '2025-11-20'],
      ],
    }
    const pas = pasRuns()
    // Two more animals that only the key knows
    const extra = pas.cells.slice(1, 5).map((r, i) => {
      const c = [...r]
      c[PAS_HEADERS.indexOf('Animal ID')] = i < 2 ? 'KX7.9 LF' : 'KX7.9 RF'
      c[PAS_HEADERS.indexOf(RECORDING_COL)] = `X${i < 2 ? 1 : 2} · chamber 1`
      return c
    })
    pas.cells.push(...extra)
    const ds = load([pas, weighLog(), key])
    const h = (n: string) => ds.headers.indexOf(n)
    expect(ds.headers.filter((x) => /^DOB/.test(x))).toEqual(['DOB'])
    expect(ds.headers.filter((x) => x === AGE_AT_TEST_COL)).toHaveLength(1)
    const dob = (id: string) => ds.rows.find((r) => r[h('Animal ID')] === id)![h('DOB')]
    expect(dob('KX7.9 LF')).toBe('2025-12-01')
    expect(dob('KX7.2 LF')).toBe('2026-01-12')
    expect(Object.keys(ds.ageInfo!.fileBirthDates).sort()).toEqual(['KX7.1 LF', 'KX7.1 RF', 'KX7.2 LF', 'KX7.2 RF', 'KX7.9 LF', 'KX7.9 RF'])
  })
})
