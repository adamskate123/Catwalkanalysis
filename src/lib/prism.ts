// GraphPad Prism export (.pzfx, Prism's XML project format; opens in Prism 5–10).
//
// Two table layouts are produced:
//  - Column tables: one per parameter × timepoint, one column per group, one row per animal.
//  - Grouped tables: one per parameter, rows = timepoints, columns = groups, and replicate
//    subcolumns = animals. Each animal keeps the same subcolumn at every timepoint, so Prism's
//    repeated-measures two-way ANOVA / mixed-effects analysis can be run directly.

import type { AggregateResult, AnalysisConfig, Measure } from './analysis'
import { naturalCompare } from './analysis'

export interface PrismOptions {
  measures: Measure[]
  layout: 'column' | 'grouped' | 'both'
  appVersion: string
  notes?: string
}

export interface PzfxTable {
  title: string
  type: 'OneWay' | 'TwoWay'
  rowTitles: string[]
  columns: { title: string; subcolumns: (number | null)[][] }[]
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function num(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '<d/>'
  return `<d>${+v.toPrecision(8)}</d>`
}

/** Prism truncates long table titles in the navigator; keep them short and unique. */
function uniqueTitles(titles: string[]): string[] {
  const seen = new Map<string, number>()
  return titles.map((t) => {
    const base = t.length > 70 ? t.slice(0, 69) + '…' : t
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return n ? `${base} (${n + 1})` : base
  })
}

export function buildPrismTables(agg: AggregateResult, opt: PrismOptions): PzfxTable[] {
  const tables: PzfxTable[] = []
  const times = agg.times.length ? agg.times : ['']
  const unitOf = (m: Measure) => (m.derived?.startsWith('ASYM') ? '% L−R' : m.def.unit)
  const titleOf = (m: Measure, time?: string) => {
    const u = unitOf(m)
    return `${m.label}${u ? ` [${u}]` : ''}${time ? ` · ${time}` : ''}`
  }

  if (opt.layout === 'column' || opt.layout === 'both') {
    for (const time of times) {
      for (const m of opt.measures) {
        const cols = agg.groups.map((g) => {
          const subs = agg.subjects
            .filter((s) => s.time === time && s.group === g && Number.isFinite(s.values[m.key]))
            .sort((a, b) => naturalCompare(a.id, b.id))
          return { title: g, vals: subs.map((s) => s.values[m.key]) }
        })
        const nRows = Math.max(0, ...cols.map((c) => c.vals.length))
        if (nRows === 0) continue
        tables.push({
          title: titleOf(m, time || undefined),
          type: 'OneWay',
          // Rows in a column table don't pair animals across groups, so rows stay untitled.
          rowTitles: Array.from({ length: nRows }, () => ''),
          columns: cols.map((c) => ({ title: c.title, subcolumns: [Array.from({ length: nRows }, (_, i) => c.vals[i] ?? null)] })),
        })
      }
    }
  }

  if ((opt.layout === 'grouped' || opt.layout === 'both') && times.length > 1) {
    // Fixed animal → subcolumn mapping per group, shared by every parameter.
    const animalsByGroup = new Map<string, string[]>()
    for (const g of agg.groups) {
      const ids = [...new Set(agg.subjects.filter((s) => s.group === g).map((s) => s.id))].sort(naturalCompare)
      animalsByGroup.set(g, ids)
    }
    for (const m of opt.measures) {
      const columns = agg.groups.map((g) => {
        const ids = animalsByGroup.get(g)!
        return {
          title: g,
          subcolumns: ids.map((id) =>
            times.map((t) => {
              const s = agg.subjects.find((x) => x.group === g && x.id === id && x.time === t)
              const v = s?.values[m.key]
              return v !== undefined && Number.isFinite(v) ? v : null
            }),
          ),
        }
      })
      if (!columns.some((c) => c.subcolumns.some((sc) => sc.some((v) => v !== null)))) continue
      tables.push({ title: `${titleOf(m)} · over time`, type: 'TwoWay', rowTitles: times, columns })
    }
  }

  const titles = uniqueTitles(tables.map((t) => t.title))
  tables.forEach((t, i) => (t.title = titles[i]))
  return tables
}

function tableXml(t: PzfxTable, i: number): string {
  const maxSub = Math.max(1, ...t.columns.map((c) => c.subcolumns.length))
  const out: string[] = []
  out.push(`<Table ID="Table${i}" XFormat="none"${t.type === 'TwoWay' ? ` YFormat="replicates" Replicates="${maxSub}"` : ''} TableType="${t.type}" EVFormat="AsteriskAfterNumber">`)
  out.push(`<Title>${esc(t.title)}</Title>`)
  if (t.rowTitles.some(Boolean)) {
    out.push('<RowTitlesColumn Width="120"><Subcolumn>')
    for (const r of t.rowTitles) out.push(r ? `<d>${esc(r)}</d>` : '<d/>')
    out.push('</Subcolumn></RowTitlesColumn>')
  }
  for (const c of t.columns) {
    // In a grouped table every data set must have the same number of replicate subcolumns.
    const subs = t.type === 'TwoWay' ? [...c.subcolumns, ...Array.from({ length: maxSub - c.subcolumns.length }, () => t.rowTitles.map(() => null))] : c.subcolumns
    out.push(`<YColumn Width="${Math.max(81, 60 * subs.length)}" Decimals="4" Subcolumns="${subs.length}">`)
    out.push(`<Title>${esc(c.title)}</Title>`)
    for (const sc of subs) {
      out.push('<Subcolumn>')
      for (let r = 0; r < t.rowTitles.length; r++) out.push(num(sc[r] ?? null))
      out.push('</Subcolumn>')
    }
    out.push('</YColumn>')
  }
  out.push('</Table>')
  return out.join('\n')
}

export function toPzfx(tables: PzfxTable[], opt: { appVersion: string; notes?: string; created?: Date }): string {
  const when = (opt.created ?? new Date()).toISOString().replace(/\.\d+Z$/, '')
  const notes =
    `Exported from Gait Lab (CatWalk Analyzer) v${opt.appVersion} on ${when.slice(0, 10)}.` + (opt.notes ? ` ${opt.notes}` : '')
  const parts: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<GraphPadPrismFile PrismXMLVersion="5.00">',
    `<Created><OriginalVersion CreatedByProgram="GraphPad Prism" CreatedByVersion="6.0f.254" Login="" DateTime="${when}+00:00"/></Created>`,
    '<InfoSequence><Ref ID="Info0" Selected="1"/></InfoSequence>',
    '<Info ID="Info0"><Title>Project info 1</Title>',
    `<Notes>${esc(notes)}</Notes>`,
    '<Constant><Name>Experiment Date</Name><Value></Value></Constant>',
    '<Constant><Name>Experiment ID</Name><Value></Value></Constant>',
    '<Constant><Name>Notebook ID</Name><Value></Value></Constant>',
    '<Constant><Name>Project</Name><Value>CatWalk gait analysis</Value></Constant>',
    '<Constant><Name>Experimenter</Name><Value></Value></Constant>',
    '<Constant><Name>Protocol</Name><Value></Value></Constant>',
    '</Info>',
    '<TableSequence Selected="1">',
    ...tables.map((_, i) => `<Ref ID="Table${i}"${i === 0 ? ' Selected="1"' : ''}/>`),
    '</TableSequence>',
    ...tables.map(tableXml),
    '</GraphPadPrismFile>',
  ]
  return parts.join('\n')
}

export function describeSettings(cfg: AnalysisConfig): string {
  return [
    'Values are per-animal means of',
    cfg.onlyCompliant && cfg.compliantCol ? 'compliant runs' : 'all runs',
    cfg.speedAdjust ? '(speed-adjusted).' : '(not speed-adjusted).',
    `Groups: ${cfg.groupCol ?? 'none'}; control: ${cfg.controlGroup ?? '—'}${cfg.diseaseGroup ? `; untreated disease: ${cfg.diseaseGroup}` : ''}.`,
  ].join(' ')
}
