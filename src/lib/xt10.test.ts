// Regression tests for the CatWalk XT 10 export layout. The header lists are
// copied from real Run/Trial Statistics exports; all values are synthetic.

import { describe, expect, it } from 'vitest'
import headers from './__fixtures__/catwalk_xt10_headers.json'
import { matchColumn, metaRole } from './catalog'
import { aggregate, analyse, autoConfig, buildMeasures } from './analysis'
import { detectTable, mergeTables, type Cell, type RawSheet } from './parse'
import { dataWarnings } from './report'

const ANIMALS = [
  { animal: 'Animal0001', trial: 'JAX NM', group: 'JAX WT ', type: 'Control', sex: 'M', age: 51 },
  { animal: 'Animal0002', trial: 'JAX L', group: 'JAX WT ', type: 'Control', sex: 'M', age: 51 },
  { animal: 'Animal0003', trial: 'JAX R', group: 'JAX WT ', type: 'Control', sex: 'M', age: 51 },
  { animal: 'Animal0004', trial: 'MUT LF', group: 'Mutant', type: 'Experimental', sex: 'M', age: 79 },
  { animal: 'Animal0005', trial: 'MUT RF', group: 'Mutant', type: 'Experimental', sex: 'M', age: 79 },
  { animal: 'Animal0006', trial: 'MUT NM', group: 'Mutant', type: 'Experimental', sex: 'F', age: 31 },
]

function cellFor(h: string, a: (typeof ANIMALS)[number], run: number, seed: number): Cell {
  switch (h) {
    case 'Experiment':
      return 'Test experiment'
    case 'Group':
      return a.group
    case 'Group_Type':
      return a.type
    case 'Animal':
      return a.animal
    case 'Time_Point':
      return 'Undefined'
    case 'Trial':
      return a.trial
    case 'Run':
      return `Run00${run}`
    case 'NumberOfRunsUsedForCalculatingTrialStatistics':
      return 3
    case 'Run_Maximum_Variation_(%)':
      return run === 3 ? 150 : 20
    case 'Camera_Gain_(dB)':
      return 28.1
  }
  if (metaRole(h) === 'equipment') return 10
  if (/Description$/.test(h)) return null
  // Manually measured parameters are not filled in, as in real exports.
  if (/ToeSpread|ManualPrintLength|PawAngle|Functional_Index/.test(h)) return '-'
  if (/_SD$| SD$| AD$/.test(h)) return 0.1
  if (/ R$/.test(h)) return 0.8 + ((seed % 7) / 100)
  return 1 + ((seed * 13 + run * 7) % 17) / 10 + (a.group === 'Mutant' ? 0.5 : 0)
}

function sheet(kind: 'run' | 'trial'): RawSheet {
  const h = headers[kind] as string[]
  const rows: Cell[][] = []
  ANIMALS.forEach((a, ai) => {
    const runs = kind === 'run' ? [1, 2, 3] : [1]
    for (const run of runs) rows.push(h.map((col, ci) => cellFor(col, a, run, ai * 31 + ci)))
  })
  return { file: `${kind}.xlsx`, sheet: kind === 'run' ? 'RunStatistics' : 'TrialStatistics', cells: [h, ...rows] }
}

const keySheet: RawSheet = {
  file: 'key.xlsx',
  sheet: 'Animals',
  cells: [
    ['CatWalk trial name', 'Genotype', 'Sex', 'Date of birth', 'CatWalk test date', 'Age at test (days)'],
    ...ANIMALS.map((a) => [a.trial, a.group.trim() === 'JAX WT' ? 'WT' : 'Mut', a.sex, '2026-08-04', '2026-09-24', a.age] as Cell[]),
    [null, null, null, null, null, null],
    ['Notes', null, null, null, null, null],
    ['Controls are all male, so analyse males separately.', null, null, null, null, null],
  ],
}

describe('CatWalk XT 10 column names', () => {
  const run = headers.run as string[]

  it.each([
    ['Run_Duration_(s)', 'run_duration'],
    ['Run_Average_Speed_(cm/s)', 'speed'],
    ['Run_Maximum_Variation_(%)', 'speed_variation'],
    ['OtherStatistics_Cadence', 'cadence'],
    ['OtherStatistics_NumberOfSteps', 'number_of_steps'],
    ['OtherStatistics_Sciatic_Functional_Index', 'sfi'],
    ['OtherStatistics_Posterior_Tibial_Functional_Index', 'tfi'],
    ['StepSequence_RegularityIndex_(%)', 'regularity_index'],
    ['StepSequence_NumberOfPatterns', 'step_patterns'],
    ['BOS_HindPaws_Mean_(cm)', 'bos_hind'],
    ['PrintPositions_LeftPaws_Mean_(cm)', 'print_pos_left'],
    ['Support_Diagonal_(%)', 'support_diagonal'],
    ['RF_MeanIntensityOfThe15MostIntensePixels_Mean', 'mean_intensity_15'],
    ['LH_ToeSpread_(cm)_Mean', 'toe_spread'],
    ['LH_IntermediateToeSpread_(cm)_Mean', 'intermediate_toe_spread'],
    ['RH_PawAngleBodyAxis_(°)_Mean', 'paw_angle_body_axis'],
  ])('%s → %s', (name, id) => {
    expect(run).toContain(name)
    expect(matchColumn(name)?.paramId).toBe(id)
  })

  it('separates circular statistics of phase dispersions', () => {
    expect(matchColumn('PhaseDispersions_RF->LH_CStat Mean')).toMatchObject({ paramId: 'phase_dispersion', variant: 'RF→LH', stat: 'mean' })
    expect(matchColumn('PhaseDispersions_RF->LH_CStat R')).toMatchObject({ paramId: 'phase_dispersion_r', variant: 'RF→LH' })
    expect(matchColumn('PhaseDispersions_RF->LH_CStat AD')?.stat).toBe('sd')
    expect(matchColumn('Couplings_LH->RF_CStat R')?.paramId).toBe('coupling_r')
  })

  it('classifies metadata and acquisition settings', () => {
    expect(metaRole('Group_Type')).toBe('grouptype')
    expect(metaRole('Time_Point')).toBe('time')
    expect(metaRole('Trial_Description')).toBe('other')
    expect(metaRole('NumberOfRunsUsedForCalculatingTrialStatistics')).toBe('nruns')
    expect(metaRole('Green_Intensity_Threshold')).toBe('equipment')
    expect(metaRole('X-Unit_(mm/pixel)')).toBe('equipment')
  })

  it('recognises every column except the undocumented OtherStatistics codes', () => {
    const unknown = run.filter((h) => !metaRole(h) && !matchColumn(h))
    expect(unknown.sort()).toEqual(
      ['AB', 'GT', 'LK', 'LM', 'NO', 'RK', 'RM', 'TA'].map((c) => `OtherStatistics_${c}_(%)`).sort(),
    )
  })
})

describe('run statistics + animal key', () => {
  const ds = mergeTables([detectTable(sheet('run'))!, detectTable(keySheet)!])
  const measures = buildMeasures(ds)
  const cfg = autoConfig(ds)

  it('joins the key on the trial name and keeps its notes', () => {
    expect(ds.keys).toHaveLength(1)
    expect(ds.keys[0]).toMatchObject({ keyColumn: 'CatWalk trial name', dataColumn: 'Trial', matchedIds: 6, unmatchedData: [] })
    expect(ds.keys[0].added).toEqual(['Genotype', 'Sex', 'Date of birth', 'CatWalk test date', 'Age at test (days)'])
    expect(ds.keys[0].notes).toEqual(['Controls are all male, so analyse males separately.'])
    // Key columns are never analysed as gait parameters
    expect(measures.some((m) => /^age|birth|test date/i.test(m.label))).toBe(false)
  })

  it('auto-configures from CatWalk metadata', () => {
    expect(cfg.subjectCol).toBe('Animal')
    expect(cfg.groupCol).toBe('Group')
    expect(cfg.timeCol).toBeNull() // only "Undefined"
    expect(cfg.controlGroup).toBe('JAX WT') // from Group_Type, trailing space trimmed
  })

  it('does not treat acquisition settings or manual-only parameters as data', () => {
    expect(measures.some((m) => /camera|gain|threshold/i.test(m.label))).toBe(false)
    expect(measures.some((m) => m.def.id === 'toe_spread')).toBe(false) // all "-"
    expect(measures.some((m) => m.def.id === 'phase_dispersion_r')).toBe(true)
  })

  it('averages runs, filters by speed variation and by sex', () => {
    const all = aggregate(ds, measures, cfg)
    expect(all.subjects).toHaveLength(6)
    expect(all.subjects.every((s) => s.nRuns === 3)).toBe(true)
    expect(all.rowsAboveDefaultVariation).toBe(6)
    const strict = aggregate(ds, measures, { ...cfg, maxVariation: 60, filters: [{ col: 'Sex', values: ['M'] }] })
    expect(strict.subjects).toHaveLength(5)
    expect(strict.subjects.every((s) => s.nRuns === 2)).toBe(true)
    expect(strict.rowsHighVariation).toBe(5)
    expect(strict.rowsFiltered).toBe(3)
  })

  it('warns about sex and age imbalance and fast/stop-start runs', () => {
    const agg = aggregate(ds, measures, cfg)
    const tr = analyse(agg, measures, cfg)[0]
    const text = dataWarnings(agg, tr, cfg, ds).map((w) => w.text).join('\n')
    expect(text).toMatch(/Sex is not balanced/)
    expect(text).toMatch(/Groups differ in age/)
    expect(text).toMatch(/6 of 18 runs have a maximum speed variation above 60%/)
    expect(text).toMatch(/analyse males separately/)
  })
})

describe('trial statistics', () => {
  it('uses the run count column and skips the trial file when run statistics are also loaded', () => {
    const trial = mergeTables([detectTable(sheet('trial'))!])
    const m = buildMeasures(trial)
    const agg = aggregate(trial, m, autoConfig(trial))
    expect(agg.subjects.every((s) => s.nRuns === 3)).toBe(true)
    expect(m.some((x) => /NumberOfRuns/.test(x.label))).toBe(false)

    const both = mergeTables([detectTable(sheet('run'))!, detectTable(sheet('trial'))!])
    expect(both.rows).toHaveLength(18)
    expect(both.notices[0]).toMatch(/not combined/)
  })
})
