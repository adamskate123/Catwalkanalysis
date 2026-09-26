import { describe, expect, it } from 'vitest'
import { aggregate, autoConfig, buildMeasures } from './analysis'
import { demoSheet } from './demo'
import { experimentTables, fromBundle, reconcileConfig, suggestName, toBundle, UNLABELLED_SESSION, type Experiment, type StoredFile } from './experiment'
import { detectTable, mergeTables, pickTables, type Cell, type ParsedTable } from './parse'

const HEAD = ['Experiment', 'Group', 'Animal', 'Trial', 'Run', 'Run_Average_Speed_(cm/s)', 'RF_PrintArea_(cm²)_Mean', 'LF_PrintArea_(cm²)_Mean', 'RH_PrintArea_(cm²)_Mean', 'LH_PrintArea_(cm²)_Mean']

function table(file: string, rows: Cell[][]): ParsedTable {
  return detectTable({ file, sheet: 'RunStatistics', cells: [HEAD, ...rows] })!
}
const row = (exp: string, group: string, animal: string, trial: string, run: string, v: number): Cell[] => [exp, group, animal, trial, run, 20, v, v, v, v]
const file = (name: string, tables: ParsedTable[], session?: string): StoredFile => ({ id: name, name, addedAt: '2026-09-26T00:00:00Z', session, tables })

const week4 = table('w4.xlsx', [
  row('Cohort A', 'WT', 'Animal0001', 'M1', 'Run001', 0.3),
  row('Cohort A', 'WT', 'Animal0001', 'M1', 'Run002', 0.31),
  row('Cohort A', 'KO', 'Animal0002', 'M2', 'Run001', 0.2),
  row('Cohort A', 'KO', 'Animal0002', 'M2', 'Run002', 0.21),
])

describe('adding data to an experiment', () => {
  it('replaces rows repeated in an updated export instead of duplicating them', () => {
    // Updated export: same experiment re-exported with a corrected value and a new animal
    const updated = table('w4_updated.xlsx', [
      row('Cohort A', 'WT', 'Animal0001', 'M1', 'Run001', 0.35),
      row('Cohort A', 'WT', 'Animal0001', 'M1', 'Run002', 0.31),
      row('Cohort A', 'KO', 'Animal0002', 'M2', 'Run001', 0.2),
      row('Cohort A', 'KO', 'Animal0002', 'M2', 'Run002', 0.21),
      row('Cohort A', 'KO', 'Animal0003', 'M3', 'Run001', 0.22),
    ])
    const ds = mergeTables([week4, updated])
    expect(ds.rows).toHaveLength(5)
    expect(ds.notices.join(' ')).toMatch(/4 rows appeared in more than one file/)
    const i = ds.headers.indexOf('RF_PrintArea_(cm²)_Mean')
    const a = ds.headers.indexOf('Animal')
    const run = ds.headers.indexOf('Run')
    expect(ds.rows.find((r) => r[a] === 'Animal0001' && r[run] === 'Run001')![i]).toBe(0.35)
  })

  it('uses session labels as timepoints and keeps sessions apart', () => {
    const week8 = table('w8.xlsx', week4.rows.map((r) => r.map((c, j) => (j === 6 ? (c as number) + 0.05 : c))))
    const e = { files: [file('w4.xlsx', [week4], 'Week 4'), file('w8.xlsx', [week8], 'Week 8')] }
    const ds = mergeTables(experimentTables(e))
    expect(ds.rows).toHaveLength(8) // same animals and runs, different sessions: no de-duplication
    const cfg = autoConfig(ds)
    expect(cfg.timeCol).toBe('Session')
    expect(cfg.timeOrder).toEqual(['Week 4', 'Week 8'])
    const agg = aggregate(ds, buildMeasures(ds), cfg)
    expect(agg.subjects).toHaveLength(4)
  })

  it('keeps rows from unlabelled files once other files use sessions', () => {
    const e = { files: [file('w4.xlsx', [week4]), file('w8.xlsx', [week4], 'Week 8')] }
    const ds = mergeTables(experimentTables(e))
    const cfg = autoConfig(ds)
    expect(cfg.timeOrder).toEqual([UNLABELLED_SESSION, 'Week 8'])
    expect(aggregate(ds, buildMeasures(ds), cfg).subjects).toHaveLength(4)
  })

  it('identifies animals by trial name when CatWalk animal numbers restart in a new experiment', () => {
    const cohortB = table('b.xlsx', [row('Cohort B', 'WT', 'Animal0001', 'M9', 'Run001', 0.3), row('Cohort B', 'KO', 'Animal0002', 'M8', 'Run001', 0.2)])
    const ds = mergeTables([week4, cohortB])
    const cfg = autoConfig(ds)
    expect(cfg.subjectCol).toBe('Trial')
    expect(aggregate(ds, buildMeasures(ds), cfg).subjects).toHaveLength(4)
  })

  it('keeps user choices and appends new groups and timepoints', () => {
    const ds1 = mergeTables(pickTables([demoSheet()]))
    const old = { ...autoConfig(ds1), speedAdjust: true, groupOrder: ['Model + AAV', 'WT', 'Model + Vehicle'], timeOrder: ['12 wk', '8 wk', '4 wk'] }
    const cfg = reconcileConfig(old, ds1)
    expect(cfg.speedAdjust).toBe(true)
    expect(cfg.groupOrder).toEqual(['Model + AAV', 'WT', 'Model + Vehicle'])
    expect(cfg.timeOrder).toEqual(['12 wk', '8 wk', '4 wk'])
    expect(cfg.controlGroup).toBe('WT')
  })
})

describe('backups', () => {
  it('round-trips an experiment and rejects other files', () => {
    const e: Experiment = {
      id: 'x',
      name: 'Cohort A',
      createdAt: '2026-09-26T00:00:00Z',
      updatedAt: '2026-09-26T00:00:00Z',
      files: [file('w4.xlsx', [week4], 'Week 4')],
      appVersion: 'test',
    }
    expect(fromBundle(toBundle(e))).toEqual(e)
    expect(() => fromBundle('{"hello":1}')).toThrow(/not a Gait Lab/)
    expect(() => fromBundle('not json')).toThrow(/not a Gait Lab/)
  })

  it('suggests a name from the CatWalk Experiment column', () => {
    expect(suggestName([week4], 'w4.xlsx')).toBe('Cohort A')
    expect(suggestName([], 'TBCD_RunStatistics.xlsx')).toBe('TBCD')
  })
})
