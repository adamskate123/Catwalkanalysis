import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { aggregate, autoConfig, buildMeasures } from './analysis'
import { demoSheet } from './demo'
import { mergeTables, pickTables } from './parse'
import { buildPrismTables, toPzfx } from './prism'

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
})

describe('versioning', () => {
  it('CHANGELOG lists the package.json version as the latest release', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
    const log = readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8')
    const first = /^## \[(\d+\.\d+\.\d+)\]/m.exec(log)
    expect(first?.[1]).toBe(pkg.version)
  })
})
