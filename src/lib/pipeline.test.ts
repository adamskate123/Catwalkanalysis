import { describe, expect, it } from 'vitest'
import { matchColumn } from './catalog'
import { detectTable, mergeTables, pickTables, readDelimited } from './parse'
import { aggregate, analyse, autoConfig, buildMeasures, primaryComparison } from './analysis'
import { demoSheet, sheetToCsv } from './demo'
import { interpret } from './interpret'

describe('column recognition', () => {
  it.each([
    ['RF Stand (s)_Mean', 'stand', 'RF', 'mean'],
    ['RF_Stand_(s)_Mean', 'stand', 'RF', 'mean'],
    ['LH Print Area (cm²)', 'print_area', 'LH', 'value'],
    ['LH Print Area (cm^2) StDev', 'print_area', 'LH', 'sd'],
    ['Left Hind Max Contact Area', 'max_contact_area', 'LH', 'value'],
    ['RH Swing Speed (cm/s)_Mean', 'swing_speed', 'RH', 'mean'],
    ['RH Swing (s)', 'swing', 'RH', 'value'],
    ['LF Max Contact Max Intensity_Mean', 'max_contact_max_intensity', 'LF', 'mean'],
    ['LF Max Intensity At (%)', 'max_intensity_at', 'LF', 'value'],
    ['RF StepCycle', 'step_cycle', 'RF', 'value'],
    ['Stand_RF', 'stand', 'RF', 'value'],
    ['Average Speed (cm/s)', 'speed', undefined, 'value'],
    ['Run Average Speed (cm/s)', 'speed', undefined, 'value'],
    ['Cadence (Steps / Second)', 'cadence', undefined, 'value'],
    ['Regularity Index (%)', 'regularity_index', undefined, 'value'],
    ['Step Sequence_RegularityIndex_(%)', 'regularity_index', undefined, 'value'],
    ['BOS_HindPaws_Mean_(cm)', 'bos_hind', undefined, 'mean'],
    ['Base Of Support Front Paws', 'bos_front', undefined, 'value'],
    ['Support Diagonal (%)', 'support_diagonal', undefined, 'value'],
    ['Print Positions Right Paws (cm)', 'print_pos_right', undefined, 'value'],
    ['Step Sequence AB (%)', 'step_seq_ab', undefined, 'value'],
    ['Maximum Variation (%)', 'speed_variation', undefined, 'value'],
    ['Run Duration (s)', 'run_duration', undefined, 'value'],
  ])('%s', (name, id, paw, stat) => {
    const m = matchColumn(name)
    expect(m?.paramId).toBe(id)
    expect(m?.paw).toBe(paw)
    expect(m?.stat).toBe(stat)
  })

  it('recognises paired coordination parameters', () => {
    const m = matchColumn('Phase Dispersions LF->RH (%)')
    expect(m?.paramId).toBe('phase_dispersion')
    expect(m?.variant).toBe('LF→RH')
    expect(matchColumn('Couplings_RF->LF_Mean')?.paramId).toBe('coupling')
  })

  it('ignores unrelated text', () => {
    expect(matchColumn('Animal ID')).toBeNull()
    expect(matchColumn('Comments')).toBeNull()
  })
})

describe('header detection', () => {
  it('skips a preamble', () => {
    const t = detectTable(demoSheet())!
    expect(t.headerRow).toBe(3)
    expect(t.headers[1]).toBe('Animal ID')
    expect(t.rows.length).toBe(3 * 8 * 3 * 4)
  })

  it('merges a two-row Mean/StDev header', () => {
    const t = detectTable({
      file: 'x',
      sheet: '',
      cells: [
        ['Animal', 'Group', 'RF Print Area', null, 'LF Print Area', null],
        [null, null, 'Mean', 'StDev', 'Mean', 'StDev'],
        ['A1', 'WT', 0.3, 0.02, 0.31, 0.01],
      ],
    })!
    expect(t.headers).toEqual(['Animal', 'Group', 'RF Print Area_Mean', 'RF Print Area_StDev', 'LF Print Area_Mean', 'LF Print Area_StDev'])
    expect(matchColumn(t.headers[3])?.stat).toBe('sd')
  })

  it('parses semicolon CSV with decimal commas', () => {
    const s = readDelimited('Animal;Group;Average Speed (cm/s)\nA1;WT;20,5\nA2;KO;18,25\n', 'x.csv')
    const t = detectTable(s)!
    expect(t.rows[0][2]).toBe(20.5)
    expect(t.rows[1][2]).toBe(18.25)
  })

  it('round-trips the demo through CSV', () => {
    const csv = sheetToCsv(demoSheet())
    const tables = pickTables([readDelimited(csv, 'demo.csv')])
    expect(tables).toHaveLength(1)
    expect(tables[0].rows.length).toBe(288)
  })
})

describe('analysis on demo data', () => {
  const ds = mergeTables(pickTables([demoSheet()]))
  const measures = buildMeasures(ds)
  const cfg = autoConfig(ds)

  it('auto-configures roles', () => {
    expect(cfg.subjectCol).toBe('Animal ID')
    expect(cfg.groupCol).toBe('Group')
    expect(cfg.timeCol).toBe('Time point')
    expect(cfg.compliantCol).toBe('Compliant')
    expect(cfg.controlGroup).toBe('WT')
    expect(cfg.diseaseGroup).toBe('Model + Vehicle')
    expect(cfg.timeOrder).toEqual(['4 wk', '8 wk', '12 wk'])
  })

  it('prefers Mean columns over StDev', () => {
    const m = measures.find((m) => m.key === 'print_area|RH')!
    expect(ds.headers[m.col!]).toBe('RH Print Area (cm²)_Mean')
    expect(measures.some((m) => m.key === 'print_area|ASYM_H')).toBe(true)
    expect(measures.every((m) => !m.def.id.startsWith('other:'))).toBe(true)
  })

  const agg = aggregate(ds, measures, cfg)
  const res = analyse(agg, measures, cfg)

  it('aggregates runs to animals', () => {
    expect(agg.subjects).toHaveLength(3 * 8 * 3)
    expect(agg.rowsNonCompliant).toBeGreaterThan(0)
    expect(agg.groups).toEqual(['WT', 'Model + Vehicle', 'Model + AAV'])
  })

  it('detects the simulated hind-limb deficit at 12 wk and partial rescue', () => {
    const t12 = res.find((t) => t.time === '12 wk')!
    const r = t12.results.find((r) => r.measure.key === 'regularity_index|')!
    const c = primaryComparison(r, cfg)!
    expect(c.group).toBe('Model + Vehicle')
    expect(c.g).toBeLessThan(-1.5)
    expect(c.pAdj).toBeLessThan(0.01)
    expect(r.rescuePct).toBeGreaterThan(30)
    expect(r.rescuePct).toBeLessThan(100)
    const findings = interpret(t12, cfg)
    expect(findings[0].supporting.length).toBeGreaterThan(2)
    expect(['hindlimb', 'ataxia', 'hypokinesia']).toContain(findings[0].domain.id)
  })

  it('speed adjustment runs and keeps effects', () => {
    const adj = analyse(aggregate(ds, measures, { ...cfg, speedAdjust: true }), measures, cfg)
    const r = adj.find((t) => t.time === '12 wk')!.results.find((r) => r.measure.key === 'bos_hind|')!
    expect(primaryComparison(r, cfg)!.g).toBeGreaterThan(1)
  })
})
