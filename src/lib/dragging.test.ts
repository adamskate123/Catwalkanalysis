// Print elongation, hind ÷ front ratios, body-contact columns and the
// hind-paw dragging pattern. Synthetic CatWalk XT run statistics.

import { afterEach, describe, expect, it } from 'vitest'
import { setProgram } from '../programs'
import { aggregate, analyse, autoConfig, buildMeasures } from './analysis'
import { interpret, isReported, isShown } from './interpret'
import { detectTable, mergeTables, type Cell } from './parse'

const PAWS = ['LF', 'RF', 'LH', 'RH'] as const

/** Deterministic noise so the tests don't depend on a random seed. */
const wiggle = (i: number) => Math.sin(i * 12.9898) * 0.04

function sheet(opts: { dragging: boolean; slowHind: boolean; abdomen?: boolean }) {
  const headers = ['Animal', 'Group', 'Run']
  for (const p of PAWS) headers.push(`${p}_PrintLength_(cm)_Mean`, `${p}_PrintWidth_(cm)_Mean`, `${p}_SwingSpeed_(cm/s)_Mean`, `${p}_Stand_(s)_Mean`, `${p}_StrideLength_(cm)_Mean`)
  headers.push('StepSequence_RegularityIndex_(%)')
  if (opts.abdomen) headers.push('Abdomen_(%)')
  const rows: Cell[][] = []
  let k = 0
  for (const group of ['WT', 'Mut']) {
    for (let a = 1; a <= 8; a++) {
      for (let run = 1; run <= 3; run++) {
        const mut = group === 'Mut'
        const row: Cell[] = [`${group}${a}`, group, run]
        for (const p of PAWS) {
          const hind = p.endsWith('H')
          const e = () => 1 + wiggle(++k)
          const len = (hind ? 1.0 : 0.6) * (mut && hind && opts.dragging ? 1.5 : 1) * e()
          const wid = (hind ? 0.5 : 0.5) * e()
          const swing = 60 * (mut && hind && opts.slowHind ? 0.7 : 1) * e()
          const stand = 0.12 * (mut && hind && opts.slowHind ? 1.3 : 1) * e()
          const stride = 6 * (mut && hind && opts.slowHind ? 0.8 : 1) * e()
          row.push(+len.toFixed(4), +wid.toFixed(4), +swing.toFixed(3), +stand.toFixed(4), +stride.toFixed(3))
        }
        row.push(+(100 * (1 + wiggle(++k) / 4)).toFixed(2))
        if (opts.abdomen) row.push(+((mut ? 12 : 1) * (1 + wiggle(++k))).toFixed(3))
        rows.push(row)
      }
    }
  }
  return { file: 'runs.csv', sheet: '', cells: [headers, ...rows] }
}

function run(opts: Parameters<typeof sheet>[0]) {
  const ds = mergeTables([detectTable(sheet(opts))!])
  const measures = buildMeasures(ds)
  const cfg = { ...autoConfig(ds), controlGroup: 'WT', maxVariation: null }
  const agg = aggregate(ds, measures, cfg)
  const [tr] = analyse(agg, measures, cfg)
  return { measures, agg, tr, cfg }
}

afterEach(() => setProgram('catwalk'))

describe('print elongation and hind ÷ front ratios', () => {
  it('computes length ÷ width per paw and its hind ÷ front ratio', () => {
    setProgram('catwalk')
    const { measures, agg } = run({ dragging: true, slowHind: false })
    const keys = measures.map((m) => m.key)
    for (const p of PAWS) expect(keys).toContain(`print_elongation|${p}`)
    expect(keys).toEqual(expect.arrayContaining(['print_elongation|HIND', 'print_elongation|HF', 'print_length|HF']))
    // Ratios only for print size and intensity measures, not for swing speed
    expect(keys).not.toContain('swing_speed|HF')
    const s = agg.subjects.find((x) => x.id === 'Mut1')!
    expect(s.values['print_elongation|LH']).toBeCloseTo(s.values['print_length|LH'] / s.values['print_width|LH'], 10)
    const e = (p: string) => s.values[`print_elongation|${p}`]
    expect(s.values['print_elongation|HF']).toBeCloseTo((e('LH') + e('RH')) / (e('LF') + e('RF')), 10)
    expect(s.values['print_elongation|HIND']).toBeGreaterThan(2.5) // 1.5 cm ÷ 0.5 cm
  })

  it('reads labelled body contacts as their own parameters', () => {
    setProgram('catwalk')
    const { measures } = run({ dragging: false, slowHind: false, abdomen: true })
    expect(measures.find((m) => m.def.id === 'contact_abdomen')?.def.category).toBe('body_contact')
  })
})

describe('hind-paw dragging pattern', () => {
  const dragging = (opts: Parameters<typeof sheet>[0]) => {
    setProgram('catwalk')
    const { tr, cfg } = run(opts)
    return interpret(tr, cfg).find((f) => f.domain.id === 'dragging')!
  }

  it('is reported when hind prints lengthen and hind swing slows', () => {
    const f = dragging({ dragging: true, slowHind: true })
    expect(isShown(f)).toBe(true)
    expect(isReported(f)).toBe(true)
    expect(f.supporting.map((e) => e.result.measure.key)).toEqual(expect.arrayContaining(['print_elongation|HIND', 'print_elongation|HF', 'swing_speed|HIND']))
  })

  it('is not shown from slower swing, longer stance and shorter strides alone', () => {
    const f = dragging({ dragging: false, slowHind: true })
    expect(f.supporting.length).toBeGreaterThanOrEqual(3) // the shared markers did change
    expect(isShown(f)).toBe(false)
    expect(isReported(f)).toBe(false)
  })

  it('counts body contact as a key marker', () => {
    const f = dragging({ dragging: false, slowHind: true, abdomen: true })
    expect(f.supporting.some((e) => e.result.measure.def.id === 'contact_abdomen')).toBe(true)
    expect(isReported(f)).toBe(true)
  })
})
