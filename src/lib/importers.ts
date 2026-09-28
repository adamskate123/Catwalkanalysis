// Importers for tables that are not one-row-per-run instrument exports:
//  - GraphPad Prism 10 projects (.prism, a ZIP of JSON + CSV)
//  - Prism-style spreadsheets (one column per group, one row per animal)
//  - long tables (a measure column and a value column)
//  - wide trial tables ("Trial 1", "Trial 2"… or "0-5 min", "5-10 min" columns)
// Each is converted to one row per animal (and trial/time bin) so the rest of
// the pipeline treats it like an instrument export.

import Papa from 'papaparse'
import { strFromU8, unzipSync } from 'fflate'
import { normalizeKey } from './catalog'
import { program, roleOf } from '../programs'
import { MISSING, parseNumber, toNumber, type Cell, type ParsedTable, type RawSheet } from './parse'

export type PrismLayout = 'auto' | 'animals' | 'trials'

export interface ImportOptions {
  /** How to read Prism tables: rows are animals (subcolumns = trials) or rows are trials/time bins (subcolumns = animals). */
  prismLayout?: PrismLayout
}

const PREF_KEY = 'import-prism-layout'

export function getImportOptions(): ImportOptions {
  try {
    const v = localStorage.getItem(PREF_KEY)
    if (v === 'animals' || v === 'trials') return { prismLayout: v }
  } catch {
    /* storage unavailable */
  }
  return { prismLayout: 'auto' }
}

export function setImportOptions(o: ImportOptions) {
  try {
    if (!o.prismLayout || o.prismLayout === 'auto') localStorage.removeItem(PREF_KEY)
    else localStorage.setItem(PREF_KEY, o.prismLayout)
  } catch {
    /* storage unavailable */
  }
}

// ---------------------------------------------------------------------------
// Titles: groups ("A477T Affected Males n=19") and sheets ("Latency 51-100 days")

export function parseGroupTitle(title: string): { group: string; sex: string | null } {
  let t = title.replace(/[([]?\bn\s*=\s*\d+[)\]]?/gi, ' ')
  let sex: string | null = null
  if (/\b(females?|fem|f)\b/i.test(t)) sex = 'F'
  else if (/\b(males?|m)\b/i.test(t)) sex = 'M'
  if (sex) t = t.replace(/\b(females?|fem|males?|f|m)\b/gi, ' ')
  const group = t.replace(/[\s,;:_\-–/()]+$/g, '').replace(/^[\s,;:_\-–/()]+/g, '').replace(/\s+/g, ' ').trim()
  return { group: group || title.trim(), sex }
}

const UNIT = '(?:d|days?|wks?|weeks?|mo|mos|months?|dpi|wpi)'
const TIME_RE = new RegExp(
  `(?:^|[\\s_(,;:-])((?:<=?|>=?|≤|≥)\\s*\\d+(?:\\.\\d+)?\\s*${UNIT}|\\d+(?:\\.\\d+)?\\s*(?:-|–|to)\\s*\\d+(?:\\.\\d+)?\\s*${UNIT}|(?:day|week|wk|month|p|pnd)\\s*-?\\s*\\d+|\\d+(?:\\.\\d+)?\\s*${UNIT}(?:\\s*old)?)(?=$|[\\s_),;:])`,
  'i',
)

/** Splits a sheet title into the measure name and an age/time window, if any. */
export function splitSheetTitle(title: string): { measure: string; time: string | null } {
  const m = TIME_RE.exec(title)
  if (!m) return { measure: title.trim(), time: null }
  const time = m[1].replace(/\s+/g, ' ').trim()
  const measure = (title.slice(0, m.index) + ' ' + title.slice(m.index + m[0].length))
    .replace(/[()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:_\-–]+|[\s,;:_\-–]+$/g, '')
    .trim()
  return { measure, time }
}

const baseName = (file: string) => file.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim()
const GENERIC_SHEET = /^(sheet|data|table|tabelle|feuil|hoja)\s*\d*$/i
const MASTER_SHEET = /^(males?|females?|all|all ages|all animals|master|combined|summary|raw|per[\s-]*animal|both sexes)$/i

// ---------------------------------------------------------------------------
// Group-block tables (Prism column/grouped tables)

interface Block {
  title: string
  /** rows × subcolumns */
  values: (number | null)[][]
}

interface RecordRow {
  animal: string
  group: string
  sex: string | null
  time: string | null
  axis: string | number | null
  measure: string
  value: number
}

function runColumn(): string {
  return program().id === 'rotarod' ? 'Trial' : 'Replicate'
}

function blockRecords(
  blocks: Block[],
  rowLabels: (string | null)[],
  measure: string,
  time: string | null,
  layout: 'animals' | 'trials',
): RecordRow[] {
  const out: RecordRow[] = []
  // Prism row titles label the whole row. They identify an animal only when the
  // row holds values for a single group (one row per animal).
  const groupsInRow = rowLabels.map((_, i) => blocks.filter((b) => b.values[i]?.some((v) => v !== null)).length)
  for (const b of blocks) {
    const { group, sex } = parseGroupTitle(b.title)
    const reps = Math.max(0, ...b.values.map((r) => r.length))
    b.values.forEach((row, i) => {
      const label = rowLabels[i]
      row.forEach((v, k) => {
        if (v === null) return
        if (layout === 'animals') {
          const tag = `${group}${sex ? ' ' + sex : ''}`
          const id = !label ? `${tag} #${i + 1}` : parseNumber(label) !== null ? `${tag} #${label}` : groupsInRow[i] > 1 ? `${tag} ${label}` : label
          out.push({ animal: id, group, sex, time, axis: reps > 1 ? k + 1 : null, measure, value: v })
        } else {
          const axis = label ? (parseNumber(label) ?? label) : i + 1
          out.push({ animal: `${group}${sex ? ' ' + sex : ''} #${k + 1}`, group, sex, time, axis, measure, value: v })
        }
      })
    })
  }
  return out
}

/** Joins records into one table: one row per animal × time × trial, one column per measure. */
function recordsToSheet(records: RecordRow[], file: string, layout: 'animals' | 'trials', notes: string[]): RawSheet {
  const axisName = layout === 'trials' ? program().rowAxis : runColumn()
  const hasSex = records.some((r) => r.sex)
  const hasTime = records.some((r) => r.time)
  const hasAxis = records.some((r) => r.axis !== null)
  const sameCol = hasTime && hasAxis && axisName === 'Time point'
  const measures: string[] = []
  for (const r of records) if (!measures.includes(r.measure)) measures.push(r.measure)
  const headers = ['Animal', 'Group', ...(hasSex ? ['Sex'] : []), ...(hasTime ? ['Time point'] : []), ...(hasAxis && !sameCol ? [axisName] : []), ...measures]
  const rows = new Map<string, Cell[]>()
  for (const r of records) {
    const time = sameCol ? `${r.time}, ${r.axis}` : r.time
    const key = [r.animal, r.group, r.sex, time, sameCol ? '' : r.axis].join('\u0000')
    let row = rows.get(key)
    if (!row) {
      row = [r.animal, r.group, ...(hasSex ? [r.sex] : []), ...(hasTime ? [time] : []), ...(hasAxis && !sameCol ? [r.axis] : []), ...measures.map(() => null)]
      rows.set(key, row)
    }
    row[headers.length - measures.length + measures.indexOf(r.measure)] = r.value
  }
  return { file, sheet: '', cells: [headers, ...rows.values()], notes }
}

// ---------------------------------------------------------------------------
// Prism 10 (.prism)

type Json = Record<string, unknown>

const text = (x: unknown): string => {
  if (typeof x === 'string') return x
  if (x && typeof x === 'object' && typeof (x as Json).string === 'string') return (x as Json).string as string
  return ''
}
const uid = (x: unknown): string => (typeof x === 'string' ? x : x && typeof x === 'object' ? String((x as Json).uid ?? (x as Json).id ?? '') : '')

export function readPrismProject(buf: Uint8Array, file: string, opts: ImportOptions = {}): RawSheet[] {
  let zip: Record<string, Uint8Array>
  try {
    zip = unzipSync(buf)
  } catch {
    throw new Error(`${file}: could not open this Prism file. Make sure it was saved by Prism 10 or later (.prism).`)
  }
  const json = (path: string): Json | null => {
    const f = zip[path]
    if (!f) return null
    try {
      return JSON.parse(strFromU8(f)) as Json
    } catch {
      return null
    }
  }
  const doc = json('document.json')
  const listed = (doc?.sheets as Json | undefined)?.data
  let sheetIds = Array.isArray(listed) ? listed.map(uid).filter(Boolean) : []
  if (!sheetIds.length) {
    sheetIds = Object.keys(zip)
      .map((k) => /^data\/sheets\/([^/]+)\/sheet\.json$/.exec(k)?.[1])
      .filter((x): x is string => Boolean(x))
  }

  interface SheetData {
    title: string
    measure: string
    time: string | null
    blocks: Block[]
    rowLabels: (string | null)[]
    xy: boolean
  }
  const sheets: SheetData[] = []
  for (const id of sheetIds) {
    const sheet = json(`data/sheets/${id}/sheet.json`)
    const table = sheet?.table as Json | undefined
    if (!sheet || !table) continue
    const csv = zip[`data/tables/${uid(table)}/data.csv`]
    if (!csv) continue
    const reps = Math.max(1, Number(table.replicatesCount) || 1)
    const setIds = Array.isArray(table.dataSets) ? table.dataSets.map(uid) : []
    const titles = setIds.map((s, i) => text(json(`data/sets/${s}.json`)?.title) || `Group ${i + 1}`)
    const grid = Papa.parse<string[]>(strFromU8(csv), { skipEmptyLines: false }).data
    const cell = (s: string | undefined) => {
      const t = (s ?? '').trim()
      return t === '' || MISSING.test(t) ? null : t
    }
    const width = Math.max(0, ...grid.map((r) => r.length))
    const offset = width === titles.length * reps ? 0 : 1
    let body = grid.filter((r) => r.some((c) => cell(c) !== null))
    // A header row of column titles, if the CSV has one
    if (body.length && body[0].slice(offset).some((c) => cell(c) !== null && parseNumber(c) === null) && body.slice(1).some((r) => r.slice(offset).some((c) => parseNumber(c ?? '') !== null)))
      body = body.slice(1)
    const blocks: Block[] = titles.map((title, g) => ({
      title,
      values: body.map((r) => Array.from({ length: reps }, (_, k) => parseNumber(cell(r[offset + g * reps + k]) ?? '') ?? null)),
    }))
    const title = text(sheet.title) || `Data ${sheets.length + 1}`
    const split = splitSheetTitle(title)
    sheets.push({
      title,
      measure: split.measure,
      time: split.time,
      blocks,
      rowLabels: body.map((r) => (offset ? cell(r[0]) : null)),
      xy: /"[a-z]*(type|format|kind)"\s*:\s*"[^"]*\bxy/i.test(JSON.stringify(table)),
    })
  }
  if (!sheets.length) throw new Error(`${file}: no data tables found in this Prism file.`)

  const notes: string[] = []
  // Files with age-binned sheets often also hold per-animal master sheets ("Males",
  // "Females", "all ages") that repeat the same values; those are skipped.
  const timed = sheets.filter((s) => s.time)
  const timedMeasures = new Set(timed.map((s) => normalizeKey(s.measure)))
  const skipped = timed.length ? sheets.filter((s) => !s.time && (!s.measure || MASTER_SHEET.test(s.measure.replace(/\ball ages\b/i, 'all ages')) || timedMeasures.has(normalizeKey(s.measure)))) : []
  if (skipped.length)
    notes.push(
      `${file}: skipped ${skipped.length} sheet${skipped.length === 1 ? '' : 's'} without an age or time window in the title (${skipped.map((s) => `"${s.title}"`).join(', ')}), because they usually repeat the values of the age-binned sheets.`,
    )
  const used = sheets.filter((s) => !skipped.includes(s))
  const generic = used.filter((s) => !s.measure || GENERIC_SHEET.test(s.measure))
  const records: RecordRow[] = []
  let anyTrials = false
  for (const s of used) {
    const layout: 'animals' | 'trials' = opts.prismLayout === 'animals' || opts.prismLayout === 'trials' ? opts.prismLayout : s.xy ? 'trials' : 'animals'
    if (layout === 'trials') anyTrials = true
    const measure = !s.measure || GENERIC_SHEET.test(s.measure) ? (generic.length > 1 && s.measure ? `${baseName(file)} (${s.measure})` : baseName(file)) : s.measure
    records.push(...blockRecords(s.blocks, s.rowLabels, measure, s.time, layout))
  }
  if (!records.length) throw new Error(`${file}: the Prism data tables are empty.`)
  notes.push(
    anyTrials
      ? `${file}: read ${used.length} Prism table${used.length === 1 ? '' : 's'} with rows as ${program().rowAxis.toLowerCase()}s and subcolumns as animals. If rows are animals instead, change "Prism tables" on the start screen and add the file again.`
      : `${file}: read ${used.length} Prism table${used.length === 1 ? '' : 's'} with rows as animals${used.some((s) => s.blocks.some((b) => (b.values[0]?.length ?? 0) > 1)) ? ` and subcolumns as ${runColumn().toLowerCase()}s` : ''}. Rows without an animal ID are matched across tables by their position within each group.`,
  )
  return [recordsToSheet(records, file, anyTrials ? 'trials' : 'animals', notes)]
}

// ---------------------------------------------------------------------------
// Spreadsheet layouts

const MEASURE_COL = /^(measure|measurement|parameter|variable|outcome|metric|assay|readout|dependent\s*variable|test)$/i
const VALUE_COL = /^(value|values|result|score|data|response)$/i
const TRIAL_COL = /^(?:(?:day|d)\s*[-_#]?\s*(\d+)\s*[-_,:/.]?\s*)?(?:trial|t|run)\s*[-_#]?\s*(\d+)\b\s*[-_:,.]?\s*(.*)$/i
const DAY_COL = /^(?:day|d)\s*[-_#]?\s*(\d+)\b\s*[-_:,.]?\s*(.*)$/i
const BIN_COL = /^(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*(min|mins|minutes|m|s|sec|secs|seconds)?\b\s*[-_:,.]?\s*(.*)$/i

function numericShare(t: ParsedTable, i: number): number {
  let n = 0
  let num = 0
  for (const r of t.rows) {
    if (r[i] === null) continue
    n++
    if (toNumber(r[i]) !== null) num++
  }
  return n ? num / n : 0
}

const isUnitsOnly = (s: string) => normalizeKey(s.replace(/\([^)]*\)/g, '').replace(/\b(s|sec|secs|seconds|cm|mm|rpm)\b/gi, '')) === ''

/** Returns a reshaped copy of the table, or the same table if no special layout was found. */
export function reshapeTable(t: ParsedTable, opts: ImportOptions = {}): ParsedTable {
  return pivotLong(t) ?? meltWide(t) ?? groupColumns(t, opts) ?? t
}

/** Long layout: animal, group, …, measure name, value → one column per measure. */
function pivotLong(t: ParsedTable): ParsedTable | null {
  const mi = t.headers.findIndex((h) => MEASURE_COL.test(h.trim()))
  const vi = t.headers.findIndex((h) => VALUE_COL.test(h.trim()))
  if (mi < 0 || vi < 0 || numericShare(t, vi) < 0.8) return null
  const ids = t.headers.map((_, i) => i).filter((i) => i !== mi && i !== vi && numericShare(t, i) < 1)
  const measures: string[] = []
  for (const r of t.rows) {
    const m = r[mi] === null ? '' : String(r[mi]).trim()
    if (m && !measures.includes(m)) measures.push(m)
  }
  if (measures.length === 0) return null
  const rows = new Map<string, Cell[]>()
  for (const r of t.rows) {
    const m = r[mi] === null ? '' : String(r[mi]).trim()
    if (!m) continue
    const key = ids.map((i) => String(r[i] ?? '')).join('\u0000')
    const row = rows.get(key) ?? [...ids.map((i) => r[i]), ...measures.map(() => null)]
    row[ids.length + measures.indexOf(m)] = r[vi]
    rows.set(key, row)
  }
  return { ...t, headers: [...ids.map((i) => t.headers[i]), ...measures], rows: [...rows.values()] }
}

interface WideCol {
  i: number
  day: number | null
  trial: number | null
  bin: string | null
  measure: string
}

/** Wide layout: one column per trial, day or time bin → one row per animal × trial. */
function meltWide(t: ParsedTable): ParsedTable | null {
  if (t.headers.some((h) => roleOf(h) === 'run')) return null
  const parse = (h: string, i: number): WideCol | null => {
    if (numericShare(t, i) < 0.8) return null
    const name = h.trim()
    let m = TRIAL_COL.exec(name)
    if (m) return { i, day: m[1] ? +m[1] : null, trial: +m[2], bin: null, measure: m[3] }
    m = BIN_COL.exec(name)
    if (m && (m[3] || /^\d+(\.\d+)?\s*(-|–|to)\s*\d+(\.\d+)?$/.test(name))) return { i, day: null, trial: null, bin: `${m[1]}–${m[2]} ${m[3] ? m[3].replace(/^(m|mins|minutes)$/i, 'min').replace(/^(secs?|seconds)$/i, 's') : 'min'}`, measure: m[4] }
    m = DAY_COL.exec(name)
    if (m) return { i, day: +m[1], trial: null, bin: null, measure: m[2] }
    return null
  }
  const cols = t.headers.map(parse).filter((c): c is WideCol => c !== null)
  if (cols.length < 2) return null
  const keep = t.headers.map((_, i) => i).filter((i) => !cols.some((c) => c.i === i))
  const measureName = (c: WideCol) => (!c.measure || isUnitsOnly(c.measure) ? program().primaryColumn : c.measure.trim())
  const measures: string[] = []
  for (const c of cols) if (!measures.includes(measureName(c))) measures.push(measureName(c))
  const hasDay = cols.some((c) => c.day !== null)
  const hasTrial = cols.some((c) => c.trial !== null)
  const hasBin = cols.some((c) => c.bin !== null)
  const trialName = runColumn()
  const headers = [...keep.map((i) => t.headers[i]), ...(hasDay ? ['Day'] : []), ...(hasTrial ? [trialName] : []), ...(hasBin ? ['Time bin'] : []), ...measures]
  const rows: Cell[][] = []
  for (const r of t.rows) {
    const byPos = new Map<string, Cell[]>()
    for (const c of cols) {
      if (r[c.i] === null) continue
      const pos = `${c.day}|${c.trial}|${c.bin}`
      let row = byPos.get(pos)
      if (!row) {
        row = [
          ...keep.map((i) => r[i]),
          ...(hasDay ? [c.day === null ? null : `Day ${c.day}`] : []),
          ...(hasTrial ? [c.trial] : []),
          ...(hasBin ? [c.bin] : []),
          ...measures.map(() => null),
        ]
        byPos.set(pos, row)
      }
      row[headers.length - measures.length + measures.indexOf(measureName(c))] = r[c.i]
    }
    rows.push(...byPos.values())
  }
  return { ...t, headers, rows }
}

/** Prism-style sheet: a column (or block of subcolumns) per group, a row per animal, no ID column. */
function groupColumns(t: ParsedTable, opts: ImportOptions): ParsedTable | null {
  if (t.headers.some((h) => roleOf(h) || program().matchColumn(h))) return null
  const blank = (h: string) => /^Column \d+$/.test(h)
  // A second header row of subcolumn titles (e.g. "Y1", "Trial 1") may sit above the numbers.
  const first = t.rows[0] ?? []
  const subHeader = first.slice(1).some((c) => typeof c === 'string' && toNumber(c) === null) && first.slice(1).every((c) => c === null || toNumber(c) === null)
  const rows = subHeader ? t.rows.slice(1) : t.rows
  const bodyTable: ParsedTable = { ...t, rows }
  const share = t.headers.map((_, i) => numericShare(bodyTable, i))
  const labelCol = blank(t.headers[0]) || share[0] < 0.8 ? 0 : -1
  const dataCols = t.headers.map((_, i) => i).filter((i) => i !== labelCol)
  if (!dataCols.length || dataCols.some((i) => share[i] < 0.8)) return null
  const blocks: Block[] = []
  let current: Block | null = null
  const colsOf = new Map<Block, number[]>()
  for (const i of dataCols) {
    if (!current || !blank(t.headers[i])) {
      current = { title: t.headers[i].replace(/ \(\d+\)$/, ''), values: [] }
      blocks.push(current)
      colsOf.set(current, [])
    }
    colsOf.get(current)!.push(i)
  }
  if (blocks.length && blank(blocks[0].title)) return null
  for (const b of blocks) b.values = rows.map((r) => colsOf.get(b)!.map((i) => toNumber(r[i])))
  const labels = rows.map((r) => (labelCol >= 0 && r[labelCol] !== null ? String(r[labelCol]).trim() : null))
  const title = t.sheet && !GENERIC_SHEET.test(t.sheet.trim()) ? t.sheet : baseName(t.file)
  const { measure, time } = splitSheetTitle(title)
  const layout: 'animals' | 'trials' = opts.prismLayout === 'trials' ? 'trials' : 'animals'
  const records = blockRecords(blocks, labels, measure || baseName(t.file), time, layout)
  if (!records.length) return null
  const sheet = recordsToSheet(records, t.file, layout, [])
  const [headers, ...body] = sheet.cells
  return { file: t.file, sheet: t.sheet, headerRow: 0, headers: headers.map(String), rows: body }
}
