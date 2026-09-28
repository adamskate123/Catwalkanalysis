// Rotarod and open field programs, and the Prism/Excel importers. All values
// are synthetic.

import { afterEach, describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { program, setProgram } from '../programs'
import { aggregate, analyse, autoConfig, buildMeasures } from './analysis'
import { interpret } from './interpret'
import { parseGroupTitle, readPrismProject, splitSheetTitle } from './importers'
import { detectTable, mergeTables, pickTables, type Cell, type RawSheet } from './parse'

afterEach(() => {
  setProgram('catwalk')
})

const load = (sheets: RawSheet[]) => mergeTables(pickTables(sheets))
const sheet = (cells: Cell[][], name = 'data.xlsx', tab = 'Sheet1'): RawSheet => ({ file: name, sheet: tab, cells })

describe('program registry', () => {
  it('switches the active program', () => {
    expect(program().id).toBe('catwalk')
    expect(setProgram('rotarod').name).toBe('Rotarod Lab')
    expect(program().matchColumn('Latency to fall (s)')?.paramId).toBe('latency')
  })
})

describe('rotarod', () => {
  it.each([
    ['Latency to fall (s)', 'latency'],
    ['Latency', 'latency'],
    ['Time on rod', 'latency'],
    ['RPM at fall', 'rpm_at_fall'],
    ['Fall RPM', 'rpm_at_fall'],
    ['Distance (cm)', 'distance'],
    ['Passive rotations', 'passive_rotations'],
    ['Best latency', 'latency_best'],
    ['Max latency (s)', 'latency_best'],
  ])('%s → %s', (name, id) => {
    setProgram('rotarod')
    expect(program().matchColumn(name)?.paramId).toBe(id)
  })

  it('treats trials as repeated measurements and days as timepoints', () => {
    setProgram('rotarod')
    const ds = load([program().demo()])
    const cfg = autoConfig(ds)
    expect(cfg.subjectCol).toBe('Subject ID')
    expect(cfg.timeCol).toBe('Day')
    expect(cfg.controlGroup).toBe('WT')
    expect(ds.columns.find((c) => c.name === 'Trial')?.meta).toBe('run')
    expect(ds.columns.find((c) => c.name === 'Lane')?.meta).toBe('other')
    const measures = buildMeasures(ds)
    expect(measures.map((m) => m.def.id)).toEqual(
      expect.arrayContaining(['latency', 'rpm_at_fall', 'distance', 'passive_rotations', 'latency_best', 'latency_first', 'latency_last', 'latency_improvement']),
    )
    const agg = aggregate(ds, measures, cfg)
    expect(agg.times).toEqual(['Day 1', 'Day 2', 'Day 3'])
    expect(agg.subjects).toHaveLength(90)
    expect(agg.subjects.every((s) => s.nRuns === 3)).toBe(true)
    const results = analyse(agg, measures, cfg)
    const day3 = results.find((r) => r.time === 'Day 3')!
    const lat = day3.results.find((r) => r.measure.def.id === 'latency')!
    expect(lat.comparisons.find((c) => c.group === 'Model + Vehicle')!.g).toBeLessThan(-1)
    const ids = interpret(day3, cfg).filter((f) => f.supporting.length).map((f) => f.domain.id)
    expect(ids).toContain('rr_coordination')
  })

  it('computes best, first, last and improvement from ordered trials', () => {
    setProgram('rotarod')
    const ds = load([
      sheet([
        ['Animal', 'Group', 'Trial', 'Latency (s)'],
        ['A1', 'WT', 3, 150],
        ['A1', 'WT', 1, 100],
        ['A1', 'WT', 2, 180],
        ['A2', 'KO', 1, 60],
        ['A2', 'KO', 2, 70],
        ['A2', 'KO', 3, 90],
      ]),
    ])
    const measures = buildMeasures(ds)
    const agg = aggregate(ds, measures, autoConfig(ds))
    const a1 = agg.subjects.find((s) => s.id === 'A1')!
    const v = (id: string) => a1.values[measures.find((m) => m.def.id === id)!.key]
    expect(v('latency')).toBeCloseTo(143.33, 1)
    expect(v('latency_best')).toBe(180)
    expect(v('latency_first')).toBe(100)
    expect(v('latency_last')).toBe(150)
    expect(v('latency_improvement')).toBe(50)
  })

  it('melts one column per trial ("Day 1 Trial 1"…) into rows', () => {
    setProgram('rotarod')
    const ds = load([
      sheet([
        ['Mouse ID', 'Genotype', 'Day 1 Trial 1', 'Day 1 Trial 2', 'Day 2 Trial 1', 'Day 2 Trial 2'],
        ['M1', 'WT', 100, 120, 140, 160],
        ['M2', 'KO', 50, 55, 60, null],
      ]),
    ])
    expect(ds.headers).toEqual(['Mouse ID', 'Genotype', 'Day', 'Trial', 'Latency to fall (s)'])
    expect(ds.rows).toHaveLength(7)
    const cfg = autoConfig(ds)
    expect(cfg.timeCol).toBe('Day')
    const measures = buildMeasures(ds)
    const agg = aggregate(ds, measures, cfg)
    const m1d2 = agg.subjects.find((s) => s.id === 'M1' && s.time === 'Day 2')!
    expect(m1d2.values[measures.find((m) => m.def.id === 'latency_improvement')!.key]).toBe(20)
  })
})

describe('open field', () => {
  it.each([
    ['Distance moved Center-point Total cm', 'distance'],
    ['Velocity Center-point Mean cm/s', 'velocity'],
    ['In zone Center / Center-point Cumulative Duration s', 'center_time'],
    ['In zone Center / Center-point Frequency', 'center_entries'],
    ['In zone Center / Center-point Latency to first s', 'center_latency'],
    ['In zone Border / Center-point Cumulative Duration s', 'periphery_time'],
    ['Movement Moving / Center-point Cumulative Duration s', 'moving_time'],
    ['Movement Not Moving / Center-point Cumulative Duration s', 'immobile_time'],
    ['Time in center (%)', 'center_time_pct'],
    ['Center time (s)', 'center_time'],
    ['Total distance (cm)', 'distance'],
    ['Rearing Frequency', 'rearing'],
    ['Fecal boli', 'defecation'],
  ])('%s → %s', (name, id) => {
    setProgram('openfield')
    expect(program().matchColumn(name)?.paramId).toBe(id)
  })

  it('analyses an EthoVision-style statistics export', () => {
    setProgram('openfield')
    const ds = load([program().demo()])
    const cfg = autoConfig(ds)
    expect(cfg.subjectCol).toBe('Subject')
    expect(cfg.groupCol).toBe('Genotype')
    expect(cfg.timeCol).toBe('Time point')
    expect(ds.columns.find((c) => c.name === 'Arena')?.meta).toBe('other')
    const measures = buildMeasures(ds)
    expect(measures.filter((m) => m.def.category === 'other')).toEqual([])
    const results = analyse(aggregate(ds, measures, cfg), measures, cfg)
    const p60 = results.find((r) => r.time === 'P60')!
    const ids = interpret(p60, cfg).filter((f) => f.supporting.length).map((f) => f.domain.id)
    expect(ids).toEqual(expect.arrayContaining(['of_hypo', 'of_anxiety']))
  })
})

describe('Prism-style spreadsheets', () => {
  it('reads one column per group (rows = animals) and names the measure after the sheet', () => {
    setProgram('openfield')
    const ds = load([
      sheet([['WT Males n=3', 'KO Males n=2'], [3000, 2000], [3200, 2100], [3100, null]], 'of.xlsx', 'Distance moved'),
      sheet([['WT Males n=3', 'KO Males n=2'], [60, 30], [70, 25], [65, null]], 'of.xlsx', 'Center time'),
    ])
    expect(ds.headers).toEqual(['Animal', 'Group', 'Sex', 'Distance moved', 'Center time'])
    expect(ds.rows).toHaveLength(5)
    const measures = buildMeasures(ds)
    expect(measures.map((m) => m.def.id).sort()).toEqual(['center_time', 'distance'])
    const agg = aggregate(ds, measures, autoConfig(ds))
    expect(agg.groups.sort()).toEqual(['KO', 'WT'])
    expect(agg.subjects.find((s) => s.id === 'WT M #1')!.values).toMatchObject({ 'distance|': 3000, 'center_time|': 60 })
  })

  it('reads grouped tables with replicate subcolumns as trials', () => {
    setProgram('rotarod')
    const ds = load([
      sheet(
        [
          ['', 'WT', null, 'KO', null],
          [null, 'Y1', 'Y2', 'Y1', 'Y2'],
          ['m1', 100, 120, 60, 70],
          ['m2', 110, 130, 50, 65],
        ],
        'rr.xlsx',
        'Latency 51-100 days',
      ),
    ])
    expect(ds.headers).toEqual(['Animal', 'Group', 'Time point', 'Trial', 'Latency'])
    expect(ds.rows).toHaveLength(8)
    expect(ds.rows[0]).toEqual(['WT m1', 'WT', '51-100 days', 1, 100])
  })

  it('pivots long measure/value tables', () => {
    setProgram('openfield')
    const ds = load([
      sheet([
        ['Animal', 'Group', 'Measure', 'Value'],
        ['a', 'WT', 'Distance', 3000],
        ['a', 'WT', 'Rearing', 40],
        ['b', 'KO', 'Distance', 2000],
        ['b', 'KO', 'Rearing', 20],
      ]),
    ])
    expect(ds.headers).toEqual(['Animal', 'Group', 'Distance', 'Rearing'])
    expect(ds.rows).toEqual([
      ['a', 'WT', 3000, 40],
      ['b', 'KO', 2000, 20],
    ])
  })
})

describe('titles', () => {
  it('parses group titles', () => {
    expect(parseGroupTitle('A477T Affected Males n=19')).toEqual({ group: 'A477T Affected', sex: 'M' })
    expect(parseGroupTitle('Jax_WT Females (n=7)')).toEqual({ group: 'Jax_WT', sex: 'F' })
    expect(parseGroupTitle('Vehicle')).toEqual({ group: 'Vehicle', sex: null })
  })
  it('splits age windows off sheet titles', () => {
    expect(splitSheetTitle('Latency 51-100 days')).toEqual({ measure: 'Latency', time: '51-100 days' })
    expect(splitSheetTitle('<=50d')).toEqual({ measure: '', time: '<=50d' })
    expect(splitSheetTitle('Distance (P30)')).toEqual({ measure: 'Distance', time: 'P30' })
    expect(splitSheetTitle('Males')).toEqual({ measure: 'Males', time: null })
  })
})

// A minimal Prism 10 project: document.json lists sheets; each sheet points to a
// table (CSV) and its data sets (group titles).
function prismFile(sheets: { title: string; groups: string[]; reps: number; csv: string }[]): Uint8Array {
  const files: Record<string, Uint8Array> = {}
  const sheetIds: string[] = []
  sheets.forEach((s, i) => {
    const sid = `S${i}`
    const tid = `T${i}`
    const sets = s.groups.map((_, g) => `D${i}_${g}`)
    sheetIds.push(sid)
    files[`data/sheets/${sid}/sheet.json`] = strToU8(JSON.stringify({ title: s.title, table: { uid: tid, replicatesCount: s.reps, dataSets: sets } }))
    s.groups.forEach((g, k) => (files[`data/sets/${sets[k]}.json`] = strToU8(JSON.stringify({ title: { string: g } }))))
    files[`data/tables/${tid}/data.csv`] = strToU8(s.csv)
  })
  files['document.json'] = strToU8(JSON.stringify({ sheets: { data: sheetIds } }))
  return zipSync(files, { level: 0 })
}

describe('Prism 10 (.prism) projects', () => {
  const file = prismFile([
    { title: '<=50 days', groups: ['WT Males n=2', 'A477T Affected Males n=2'], reps: 2, csv: 'a1,100,120,60,70\na2,110,130,50,\n' },
    { title: '51-100 days', groups: ['WT Males n=2', 'A477T Affected Males n=2'], reps: 2, csv: 'a1,150,160,70,80\na2,140,,55,65\n' },
    { title: 'Males', groups: ['WT', 'A477T'], reps: 1, csv: '1,1\n' },
  ])

  it('reads age-binned sheets, groups, sex and replicate trials', () => {
    setProgram('rotarod')
    const [raw] = readPrismProject(file, 'rotarod.prism')
    expect(raw.notes?.[0]).toMatch(/skipped 1 sheet .*"Males"/)
    const ds = mergeTables(pickTables([raw]))
    expect(ds.headers).toEqual(['Animal', 'Group', 'Sex', 'Time point', 'Trial', 'rotarod'])
    const cfg = autoConfig(ds)
    expect(cfg.timeCol).toBe('Time point')
    expect(cfg.controlGroup).toBe('WT')
    const measures = buildMeasures(ds)
    expect(measures.find((m) => m.def.id === 'latency')).toBeTruthy()
    const agg = aggregate(ds, measures, cfg)
    expect(agg.times).toEqual(['<=50 days', '51-100 days'])
    const a1 = agg.subjects.find((s) => s.id === 'WT M a1' && s.time === '<=50 days')!
    expect(a1.values[measures.find((m) => m.def.id === 'latency')!.key]).toBe(110)
    expect(a1.values[measures.find((m) => m.def.id === 'latency_best')!.key]).toBe(120)
    expect(a1.sex).toBe('M')
  })

  it('can read rows as trials with subcolumns as animals', () => {
    setProgram('rotarod')
    const f = prismFile([{ title: 'Latency', groups: ['WT', 'KO'], reps: 2, csv: '1,100,110,60,65\n2,120,130,70,72\n' }])
    const [raw] = readPrismProject(f, 'x.prism', { prismLayout: 'trials' })
    const t = detectTable(raw)!
    expect(t.headers).toEqual(['Animal', 'Group', 'Trial', 'Latency'])
    expect(t.rows).toContainEqual(['WT #2', 'WT', 2, 130])
  })

  it('rejects files that are not Prism projects', () => {
    expect(() => readPrismProject(strToU8('hello'), 'bad.prism')).toThrow(/could not open/)
  })
})
