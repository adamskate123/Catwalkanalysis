// Synthetic data in the CatWalk XT 10 export layout (real header names, fake values).

import headers from './catwalk_xt10_headers.json'
import { metaRole } from '../catalog'
import type { Cell, RawSheet } from '../parse'

export const ANIMALS = [
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

export function sheet(kind: 'run' | 'trial'): RawSheet {
  const h = headers[kind] as string[]
  const rows: Cell[][] = []
  ANIMALS.forEach((a, ai) => {
    const runs = kind === 'run' ? [1, 2, 3] : [1]
    for (const run of runs) rows.push(h.map((col, ci) => cellFor(col, a, run, ai * 31 + ci)))
  })
  return { file: `${kind}.xlsx`, sheet: kind === 'run' ? 'RunStatistics' : 'TrialStatistics', cells: [h, ...rows] }
}

export const keySheet: RawSheet = {
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

