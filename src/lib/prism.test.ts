import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { aggregate, analyse, autoConfig, buildMeasures } from './analysis'
import { demoSheet } from './demo'
import { mergeTables, pickTables } from './parse'
import { buildPrismTables, buildStatsTables, describeStatistics, toPzfx } from './prism'

const ds = mergeTables(pickTables([demoSheet()]))
const measures = buildMeasures(ds)
const cfg = autoConfig(ds)
const agg = aggregate(ds, measures, cfg)
const key = measures.filter((m) => m.key === 'speed|' || m.key === 'print_area|HIND')

describe('Prism export', () => {
  it('builds column tables per parameter × timepoint', () => {
    const t = buildPrismTables(agg, { measures: key, layout: 'column', appVersion: 'test' })
    expect(t).toHaveLength(2 * 3)
    const first = t[0]
    expect(first.type).toBe('OneWay')
    expect(first.columns.map((c) => c.title)).toEqual(['WT', 'Model + Vehicle', 'Model + AAV'])
    expect(first.columns[0].subcolumns[0]).toHaveLength(8)
    expect(first.title).toContain('4 wk')
  })

  it('keeps each animal in the same replicate subcolumn across timepoints', () => {
    const [t] = buildPrismTables(agg, { measures: key.slice(0, 1), layout: 'grouped', appVersion: 'test' })
    expect(t.type).toBe('TwoWay')
    expect(t.rowTitles).toEqual(['4 wk', '8 wk', '12 wk'])
    const wt = t.columns[0]
    expect(wt.subcolumns).toHaveLength(8)
    // subcolumn 0 is animal W01 at every timepoint
    const m = key[0]
    const w01 = agg.times.map((time) => agg.subjects.find((s) => s.id === 'W01' && s.time === time)!.values[m.key])
    expect(wt.subcolumns[0]).toEqual(w01)
  })

  it('writes a well-formed .pzfx document', () => {
    const tables = buildPrismTables(agg, { measures: key, layout: 'both', appVersion: '9.9.9' })
    const xml = toPzfx(tables, { appVersion: '9.9.9', notes: 'a < b & c', created: new Date('2026-01-02T03:04:05Z') })
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('<GraphPadPrismFile PrismXMLVersion="5.00">')
    expect(xml).toContain('a &lt; b &amp; c')
    expect(xml).toContain('v9.9.9')
    expect((xml.match(/<Table ID=/g) ?? []).length).toBe(tables.length)
    expect((xml.match(/<Ref ID="Table/g) ?? []).length).toBe(tables.length)
    expect(xml).toContain('YFormat="replicates" Replicates="8" TableType="TwoWay"')
    // Balanced tags for the elements we emit
    for (const tag of ['Table', 'YColumn', 'Subcolumn', 'Title', 'Info', 'TableSequence']) {
      const open = (xml.match(new RegExp(`<${tag}[ >]`, 'g')) ?? []).length
      const close = (xml.match(new RegExp(`</${tag}>`, 'g')) ?? []).length
      expect(open, tag).toBe(close)
    }
    // Title uniqueness
    const titles = tables.map((t) => t.title)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it("carries the app's statistics unchanged as one table per timepoint", () => {
    const results = analyse(agg, measures, cfg)
    const tables = buildStatsTables(results, agg.groups, key)
    expect(tables.map((t) => t.title)).toEqual(['Statistics · 4 wk', 'Statistics · 8 wk', 'Statistics · 12 wk'])
    const t = tables[1]
    expect(t.rowTitles).toEqual(key.map((m) => m.label))
    const r = results[1].results.find((x) => x.measure.key === key[0].key)!
    const cmp = r.comparisons.find((c) => c.group === 'Model + Vehicle' && c.reference === 'WT')!
    const cell = (title: string) => t.columns.find((c) => c.title === title)!.subcolumns[0][0]
    expect(cell('WT n')).toBe(r.groups.WT.n)
    expect(cell('WT mean')).toBe(r.groups.WT.mean)
    expect(cell('Model + Vehicle SEM')).toBe(r.groups['Model + Vehicle'].sem)
    expect(cell('Model + Vehicle vs WT: Hedges g')).toBe(cmp.g)
    expect(cell('Model + Vehicle vs WT: p')).toBe(cmp.test.p)
    expect(cell('Model + Vehicle vs WT: p (Holm)')).toBe(cmp.pAdj)
    expect(cell('Model + Vehicle vs WT: Welch t statistic')).toBe(cmp.test.statistic)
    expect(cell('Model + Vehicle vs WT: df')).toBe(cmp.test.df)
    expect(cell('FDR q (BH)')).toBe(r.q)
    expect(cell('Omnibus p')).toBe(r.omnibus!.p)
    // Treated vs untreated disease comparisons are included too
    expect(t.columns.some((c) => c.title === 'Model + AAV vs Model + Vehicle: Hedges g')).toBe(true)
    const xml = toPzfx(tables, { appVersion: 'x' })
    expect(xml).toContain('<Title>Model + Vehicle vs WT: Hedges g</Title>')
    const text = describeStatistics(results, cfg)
    expect(text).toContain("Welch's t-test")
    expect(text).toContain('Holm')
    expect(text).toContain('Benjamini-Hochberg')
  })
})

describe('versioning', () => {
  it('CHANGELOG lists the package.json version as the latest release', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
    const log = readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8')
    const first = /^## \[(\d+\.\d+\.\d+)\]/m.exec(log)
    expect(first?.[1]).toBe(pkg.version)
  })
})
