// Combining groups (e.g. several wild-type cohorts) for analysis.

import { afterEach, describe, expect, it } from 'vitest'
import { setProgram } from '../programs'
import { aggregate, analyse, autoConfig, buildMeasures, combineGroups, groupList, groupMembers, splitGroup } from './analysis'
import { reconcileConfig } from './experiment'
import { DEFAULT_INTERPRET } from './interpret'
import { detectTable, mergeTables, type Cell } from './parse'
import { refinements } from './refine'

afterEach(() => setProgram('catwalk'))

function dataset(extra: Cell[][] = []) {
  const rows: Cell[][] = [['Animal', 'Group', 'Latency (s)']]
  const add = (group: string, prefix: string, vals: number[]) => vals.forEach((v, i) => rows.push([`${prefix}${i}`, group, v]))
  add('Jax WT', 'j', [80, 82, 84, 86, 78, 81])
  add('EIF Jax WT', 'e', [79, 83, 85])
  add('New Jax WT', 'n', [81, 80, 84])
  add('A477T', 'a', [50, 52, 55, 48, 51, 53])
  rows.push(...extra)
  return mergeTables([detectTable({ file: 'rr.csv', sheet: '', cells: rows })!])
}

describe('combining groups', () => {
  it('analyses several groups as one and splits them again', () => {
    setProgram('rotarod')
    const ds = dataset()
    const cfg = autoConfig(ds)
    expect(cfg.controlGroup).toBe('Jax WT')
    const measures = buildMeasures(ds)
    const combined = combineGroups(ds, cfg, ['Jax WT', 'EIF Jax WT', 'New Jax WT'], 'All WT')
    expect(groupList(ds, combined)).toEqual(['A477T', 'All WT'])
    expect(combined.controlGroup).toBe('All WT')
    expect(combined.groupOrder[0]).toBe('All WT')
    expect(groupMembers(ds, combined, 'All WT')).toEqual(['EIF Jax WT', 'Jax WT', 'New Jax WT'])
    const agg = aggregate(ds, measures, combined)
    expect(agg.groups).toEqual(['All WT', 'A477T'])
    expect(agg.subjects.filter((s) => s.group === 'All WT')).toHaveLength(12)
    const tr = analyse(agg, measures, combined)[0]
    expect(tr.results[0].comparisons[0]).toMatchObject({ group: 'A477T', reference: 'All WT' })

    const split = splitGroup(ds, combined, 'All WT')
    expect(groupList(ds, split)).toEqual(['A477T', 'EIF Jax WT', 'Jax WT', 'New Jax WT'])
    expect(split.controlGroup).toBe('Jax WT')
    expect(aggregate(ds, measures, split).groups).toHaveLength(4)
  })

  it('can keep an existing name for the combined group', () => {
    setProgram('rotarod')
    const ds = dataset()
    const cfg = combineGroups(ds, autoConfig(ds), ['Jax WT', 'New Jax WT'], 'Jax WT')
    expect(groupList(ds, cfg)).toEqual(['A477T', 'EIF Jax WT', 'Jax WT'])
    expect(cfg.groupMerge).toEqual({ 'New Jax WT': 'Jax WT' })
    expect(groupList(ds, splitGroup(ds, cfg, 'Jax WT'))).toContain('New Jax WT')
  })

  it('keeps the combination when more data are added, including new animals of a combined group', () => {
    setProgram('rotarod')
    const ds = dataset()
    const cfg = combineGroups(ds, autoConfig(ds), ['Jax WT', 'EIF Jax WT', 'New Jax WT'], 'Jax WT')
    const ds2 = dataset([['n9', 'New Jax WT', 83], ['b0', 'P1125L', 60]])
    const cfg2 = reconcileConfig(cfg, ds2)
    expect(cfg2.groupMerge).toEqual(cfg.groupMerge)
    expect(cfg2.groupOrder).toEqual(['Jax WT', 'A477T', 'P1125L'])
    expect(aggregate(ds2, buildMeasures(ds2), cfg2).subjects.filter((s) => s.group === 'Jax WT')).toHaveLength(13)
  })

  it('offers a Story switch that combines control cohorts, left out of "Apply all"', () => {
    setProgram('rotarod')
    const ds = dataset()
    const cfg = autoConfig(ds)
    const measures = buildMeasures(ds)
    const agg = aggregate(ds, measures, cfg)
    const tr = analyse(agg, measures, cfg)[0]
    const r = refinements(ds, measures, agg, tr, cfg, DEFAULT_INTERPRET).find((x) => x.id === 'controls')!
    expect(r.title).toBe('Combine control cohorts into Jax WT')
    expect(r.why).toMatch(/EIF Jax WT, New Jax WT/)
    expect(r.manualOnly).toBe(true)
    const on = r.options[0].apply(cfg)
    expect(groupList(ds, on)).toEqual(['A477T', 'Jax WT'])
    expect(r.options[0].active(on)).toBe(true)
    const again = refinements(ds, measures, aggregate(ds, measures, on), undefined, on, DEFAULT_INTERPRET).find((x) => x.id === 'controls')!
    expect(again.active).toBe(true)
    expect(groupList(ds, again.reset(on))).toHaveLength(4)
  })
})
