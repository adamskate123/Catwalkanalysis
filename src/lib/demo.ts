// Synthetic CatWalk-style export used for the "Try demo data" button and in
// tests. Values are plausible for adult mice but entirely simulated.

import type { Cell, RawSheet } from './parse'
import { PAWS, type Paw } from './catalog'

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gauss(r: () => number) {
  let u = 0
  while (u === 0) u = r()
  const v = r()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

const GROUPS = ['WT', 'Model + Vehicle', 'Model + AAV'] as const
const TIMES = ['4 wk', '8 wk', '12 wk'] as const

const isFront = (p: Paw) => p === 'LF' || p === 'RF'

export function demoSheet(seed = 7): RawSheet {
  const r = rng(seed)
  const n = (sd: number) => gauss(r) * sd

  const pawParams: [string, (p: Paw, ctx: Ctx) => number, boolean][] = [
    ['Stand (s)', (p, c) => (isFront(p) ? 0.11 : 0.125) * c.slow * (1 + 0.12 * c.sevHind * +!isFront(p)) * (1 + n(0.08)), true],
    ['Max Contact At (%)', (p, c) => (isFront(p) ? 45 : 50) * (1 + 0.1 * c.sevHind * +!isFront(p)) * (1 + n(0.08)), false],
    ['Max Contact Area (cm²)', (p, c) => (isFront(p) ? 0.13 : 0.19) * c.size * (1 - 0.28 * c.sevHind * +!isFront(p)) * (1 + n(0.1)), true],
    ['Max Contact Max Intensity', (p, c) => (isFront(p) ? 118 : 112) * (1 - 0.15 * c.sevHind * +!isFront(p)) * (1 + n(0.06)), false],
    ['Print Length (cm)', (p, c) => (isFront(p) ? 0.55 : 0.85) * Math.sqrt(c.size) * (1 - 0.12 * c.sevHind * +!isFront(p)) * (1 + n(0.07)), false],
    ['Print Width (cm)', (p, c) => (isFront(p) ? 0.55 : 0.65) * Math.sqrt(c.size) * (1 - 0.15 * c.sevHind * +!isFront(p)) * (1 + n(0.07)), false],
    ['Print Area (cm²)', (p, c) => (isFront(p) ? 0.24 : 0.34) * c.size * (1 - 0.3 * c.sevHind * +!isFront(p)) * (1 + n(0.1)), true],
    ['Max Intensity', (p, c) => (isFront(p) ? 125 : 118) * (1 - 0.17 * c.sevHind * +!isFront(p)) * (1 + n(0.06)), true],
    ['Mean Intensity', (p, c) => (isFront(p) ? 82 : 78) * (1 - 0.13 * c.sevHind * +!isFront(p)) * (1 + n(0.05)), true],
    ['Swing (s)', (p, c) => 0.085 * c.slow ** 0.6 * (1 + 0.18 * c.sevHind * +!isFront(p)) * (1 + n(0.08)), true],
    ['Swing Speed (cm/s)', (p, c) => 62 * c.fast * (1 - 0.22 * c.sevHind * +!isFront(p)) * (1 + n(0.07)), true],
    ['Stride Length (cm)', (p, c) => 6.1 * c.fast ** 0.4 * (1 - 0.14 * c.sevHind * +!isFront(p)) * (1 + n(0.05)), true],
    ['Step Cycle (s)', (_p, c) => 0.2 * c.slow * (1 + 0.1 * c.sevHind) * (1 + n(0.05)), true],
    ['Duty Cycle (%)', (p, c) => (isFront(p) ? 57 : 60) * (1 + 0.05 * c.sevHind * +!isFront(p)) * (1 + n(0.04)), true],
    ['Single Stance (s)', (_p, c) => 0.052 * c.slow * (1 - 0.1 * c.sevHind) * (1 + n(0.1)), false],
    ['Initial Dual Stance (s)', (p, c) => (isFront(p) ? 0.02 : 0.028) * c.slow * (1 + 0.35 * c.sevHind) * (1 + n(0.15)), false],
    ['Terminal Dual Stance (s)', (p, c) => (isFront(p) ? 0.02 : 0.028) * c.slow * (1 + 0.35 * c.sevHind) * (1 + n(0.15)), false],
  ]

  interface Ctx {
    sevHind: number
    slow: number
    fast: number
    size: number
  }

  const runHeaders = [
    'Run Duration (s)',
    'Average Speed (cm/s)',
    'Maximum Variation (%)',
    'Cadence (Steps/s)',
    'Number Of Steps',
    'Regularity Index (%)',
    'Step Sequence AA (%)',
    'Step Sequence AB (%)',
    'Step Sequence CA (%)',
    'Step Sequence CB (%)',
    'Step Sequence RA (%)',
    'Step Sequence RB (%)',
    'BOS Front Paws (cm)',
    'BOS Hind Paws (cm)',
    'Print Positions Right Paws (cm)',
    'Print Positions Left Paws (cm)',
    'Support Zero (%)',
    'Support Single (%)',
    'Support Diagonal (%)',
    'Support Girdle (%)',
    'Support Lateral (%)',
    'Support Three (%)',
    'Support Four (%)',
    'Phase Dispersions LF->RH (%)',
    'Phase Dispersions RF->LH (%)',
  ]
  const pawHeaders: string[] = []
  for (const p of PAWS) {
    for (const [name, , withSd] of pawParams) {
      pawHeaders.push(`${p} ${name}_Mean`)
      if (withSd) pawHeaders.push(`${p} ${name}_StDev`)
    }
  }
  const header = ['Trial', 'Animal ID', 'Group', 'Sex', 'Time point', 'Run', 'Compliant', ...runHeaders, ...pawHeaders]
  const rows: Cell[][] = []
  let trial = 0
  for (const group of GROUPS) {
    for (let a = 1; a <= 8; a++) {
      const id = `${group === 'WT' ? 'W' : group === 'Model + Vehicle' ? 'V' : 'T'}${String(a).padStart(2, '0')}`
      const sex = a % 2 ? 'M' : 'F'
      const animalSize = 1 + n(0.07) + (sex === 'M' ? 0.05 : -0.05)
      const animalSpeed = 1 + n(0.08)
      const vulnerability = 0.6 + r() * 0.8
      // A right-sided dominance of the model's deficit, to make the asymmetry view interesting.
      TIMES.forEach((time, ti) => {
        trial++
        const progression = [0.25, 0.65, 1][ti]
        const deficit = group === 'WT' ? 0 : group === 'Model + Vehicle' ? progression : progression * 0.35
        const sev = 0.6 * deficit * vulnerability
        const nRuns = 4
        for (let run = 1; run <= nRuns; run++) {
          const speedFactor = animalSpeed * (1 - 0.15 * sev) * (1 + n(0.1))
          const ctx: Ctx = {
            sevHind: sev,
            slow: 1 / speedFactor,
            fast: speedFactor,
            size: animalSize * (1 + 0.03 * ti),
          }
          const speed = 21 * speedFactor
          const ri = Math.min(100, 98 - 12 * sev + n(2.5))
          const bosH = 2.2 * (1 + 0.25 * sev) * (1 + n(0.06))
          const three = 22 + 12 * sev + n(4)
          const four = 8 + 6 * sev + n(3)
          const diag = 55 - 16 * sev + n(5)
          const single = 6 - 2 * sev + n(1.5)
          const girdle = 3 + n(1)
          const lateral = 3 + 3 * sev + n(1)
          const compliant = !(run === 4 && r() < 0.2)
          const runVals = [
            8 / speed + n(0.05),
            speed,
            compliant ? 20 + r() * 25 : 65 + r() * 20,
            10.5 * speedFactor ** 0.6 * (1 + n(0.05)),
            Math.round(16 / speedFactor ** 0.3 + n(1)),
            ri,
            12 + n(4),
            68 - 8 * sev + n(6),
            10 + 5 * sev + n(3),
            6 + n(2),
            2 + 2 * sev + Math.abs(n(1)),
            2 + Math.abs(n(1)),
            1.25 * Math.sqrt(ctx.size) * (1 + n(0.07)),
            bosH,
            0.35 * (1 + 1.2 * sev) + Math.abs(n(0.12)),
            0.35 * (1 + 1.0 * sev) + Math.abs(n(0.12)),
            Math.max(0, n(0.3)),
            Math.max(0, single),
            diag,
            Math.max(0, girdle),
            Math.max(0, lateral),
            three,
            Math.max(0, four),
            2 + 6 * sev + n(4),
            -1 + 6 * sev + n(4),
          ]
          const pawVals: number[] = []
          for (const p of PAWS) {
            // Right hind carries a slightly larger share of the deficit.
            const side = p === 'RH' ? 1.2 : p === 'LH' ? 0.8 : 1
            const pctx = { ...ctx, sevHind: ctx.sevHind * side }
            for (const [, f, withSd] of pawParams) {
              const v = f(p, pctx)
              pawVals.push(v)
              if (withSd) pawVals.push(Math.abs(v * (0.08 + r() * 0.06)))
            }
          }
          rows.push([
            `Trial ${trial}`,
            id,
            group,
            sex,
            time,
            run,
            compliant ? 'Yes' : 'No',
            ...runVals.map((v) => +v.toFixed(4)),
            ...pawVals.map((v) => +v.toFixed(4)),
          ])
        }
      })
    }
  }
  return {
    file: 'demo_catwalk_runs.xlsx',
    sheet: 'Run Statistics',
    cells: [
      ['Experiment:', 'DEMO — simulated data, not from a real study'],
      ['Exported:', '2026-01-01'],
      [],
      header,
      ...rows,
    ],
  }
}

export function sheetToCsv(sheet: RawSheet): string {
  return sheet.cells
    .map((row) =>
      row
        .map((c) => {
          if (c === null) return ''
          const s = String(c)
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(','),
    )
    .join('\n')
}
