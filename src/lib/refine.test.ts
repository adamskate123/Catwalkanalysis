import { describe, expect, it } from 'vitest'
import { aggregate, analyse, autoConfig, buildMeasures, DEFAULT_MAX_VARIATION } from './analysis'
import { DEFAULT_INTERPRET } from './interpret'
import { detectTable, mergeTables, pickTables } from './parse'
import { MIN_RECOMMENDED_RUNS, outcome, refinements } from './refine'
import { demoSheet } from './demo'
import { keySheet, sheet } from './__fixtures__/xt10'

const opt = DEFAULT_INTERPRET

describe('refinements', () => {
  const ds = mergeTables([detectTable(sheet('run'))!, detectTable(keySheet)!])
  const measures = buildMeasures(ds)
  const cfg = autoConfig(ds)
  const agg = aggregate(ds, measures, cfg)
  const tr = analyse(agg, measures, cfg)[0]
  const refs = refinements(ds, measures, agg, tr, cfg, opt)
  const byId = (id: string) => refs.find((r) => r.id === id)!

  it('offers switches for the problems present in the data', () => {
    expect(refs.map((r) => r.id)).toEqual(expect.arrayContaining(['variation', 'sex', 'age']))
    expect(refs.every((r) => !r.active)).toBe(true)
    expect(byId('sex').options.map((o) => o.label)).toEqual(['F only', 'M only'])
    expect(byId('age').options).toHaveLength(0) // can only be noted
  })

  it('applies and resets each switch without touching other settings', () => {
    const v = byId('variation').options[0].apply(cfg)
    expect(v.maxVariation).toBe(DEFAULT_MAX_VARIATION)
    expect(byId('variation').reset(v)).toEqual(cfg)

    const males = byId('sex').options[1].apply({ ...cfg, maxVariation: 60 })
    expect(males.filters).toEqual([{ col: 'Sex', values: ['M'] }])
    expect(males.maxVariation).toBe(60)
    expect(byId('sex').options[1].active(males)).toBe(true)
    expect(byId('sex').reset(males).filters).toEqual([])
  })

  it('reports active refinements and previews their effect', () => {
    const on = { ...cfg, maxVariation: DEFAULT_MAX_VARIATION, filters: [{ col: 'Sex', values: ['M'] }] }
    const agg2 = aggregate(ds, measures, on)
    const refs2 = refinements(ds, measures, agg2, analyse(agg2, measures, on)[0], on, opt)
    expect(refs2.find((r) => r.id === 'variation')!.active).toBe(true)
    expect(refs2.find((r) => r.id === 'sex')!.active).toBe(true)
    expect(outcome(ds, measures, on, opt, '').animals).toBe(5)
    expect(outcome(ds, measures, cfg, opt, '').animals).toBe(6)
  })
})

describe('refinements on the demo data', () => {
  it('offers speed adjustment when groups walk at different speeds and a minimum-runs switch', () => {
    const ds = mergeTables(pickTables([demoSheet()]))
    const measures = buildMeasures(ds)
    const cfg = autoConfig(ds)
    const agg = aggregate(ds, measures, cfg)
    const tr = analyse(agg, measures, cfg).find((t) => t.time === '12 wk')!
    const refs = refinements(ds, measures, agg, tr, cfg, opt)
    const speed = refs.find((r) => r.id === 'speed')!
    expect(speed.options[0].apply(cfg).speedAdjust).toBe(true)
    const runs = refs.find((r) => r.id === 'runs')
    if (runs) expect(runs.options[0].apply(cfg).minRuns).toBe(MIN_RECOMMENDED_RUNS)
  })
})
