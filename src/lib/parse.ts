import Papa from 'papaparse'
import readXlsxFile from 'read-excel-file/universal'
import { matchColumn, metaRole, type ColumnMatch, type MetaRole } from './catalog'

export type Cell = string | number | null

export interface RawSheet {
  file: string
  sheet: string
  cells: Cell[][]
}

export interface ParsedTable {
  file: string
  sheet: string
  headerRow: number
  headers: string[]
  rows: Cell[][]
}

export interface ColumnInfo {
  name: string
  numericShare: number
  distinct: number
  match: ColumnMatch | null
  meta: MetaRole | null
  fromKey?: boolean
}

// ---------------------------------------------------------------------------
// Reading files

function normaliseCell(v: unknown): Cell {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = String(v).trim()
  return s === '' || MISSING.test(s) ? null : s
}

/** Placeholders CatWalk and Excel use for "no value". */
export const MISSING = /^(nan|n\/a|na|-|—|null|#n\/a|#div\/0!|#value!)$/i

export async function readFile(file: File): Promise<RawSheet[]> {
  const name = file.name
  const lower = name.toLowerCase()
  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) {
    const buf = await file.arrayBuffer()
    return readWorkbook(buf, name)
  }
  if (lower.endsWith('.xls')) {
    throw new Error(
      `${name}: legacy .xls workbooks aren't supported. In Excel, use "Save As" → .xlsx or .csv and load that file instead.`,
    )
  }
  const text = await file.text()
  return [readDelimited(text, name)]
}

export async function readWorkbook(buf: ArrayBuffer, name: string): Promise<RawSheet[]> {
  const sheets = await readXlsxFile(buf)
  return sheets.map((s) => ({
    file: name,
    sheet: s.sheet,
    cells: s.data.map((row) => row.map(normaliseCell)),
  }))
}

export function readDelimited(text: string, name: string): RawSheet {
  const firstLines = text.split(/\r?\n/, 20).join('\n')
  const delims = ['\t', ';', ',']
  let best = ','
  let bestCount = -1
  for (const d of delims) {
    const c = firstLines.split(d).length
    if (c > bestCount) {
      best = d
      bestCount = c
    }
  }
  const res = Papa.parse<string[]>(text, { delimiter: best, skipEmptyLines: false })
  const commaDecimal = best !== ',' && /\d,\d/.test(firstLines) && !/\d\.\d/.test(firstLines)
  const cells = res.data.map((row) =>
    row.map((raw): Cell => {
      const s = (raw ?? '').trim()
      if (s === '' || MISSING.test(s)) return null
      const num = parseNumber(s, commaDecimal)
      return num ?? s
    }),
  )
  return { file: name, sheet: '', cells }
}

export function parseNumber(s: string, commaDecimal = false): number | null {
  let t = s.trim()
  if (t === '' || /^(nan|n\/a|na|-|—|null|#n\/a|#div\/0!)$/i.test(t)) return null
  if (commaDecimal) t = t.replace(/\./g, '').replace(',', '.')
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?%?$/i.test(t)) return null
  const n = Number(t.replace('%', ''))
  return Number.isFinite(n) ? n : null
}

export function toNumber(c: Cell): number | null {
  if (typeof c === 'number') return c
  if (typeof c === 'string') return parseNumber(c) ?? parseNumber(c, true)
  return null
}

// ---------------------------------------------------------------------------
// Header detection

const STAT_WORDS = /^(mean|average|avg|stdev|st\.?\s?dev|std|sd|sem|se|median|min|minimum|max|maximum|cv)$/i

function headerScore(row: Cell[]): number {
  let score = 0
  for (const c of row) {
    if (typeof c !== 'string') continue
    if (matchColumn(c)) score += 2
    else if (metaRole(c)) score += 1
  }
  return score
}

/**
 * Finds the header row of a CatWalk export, skipping any preamble lines.
 * Handles the two-row header layout (parameter names over a Mean/StDev row)
 * by merging the rows and forward-filling merged cells.
 */
export function detectTable(sheet: RawSheet): ParsedTable | null {
  const cells = sheet.cells
  if (cells.length === 0) return null
  const scan = Math.min(cells.length, 40)
  let bestRow = -1
  let bestScore = 0
  for (let r = 0; r < scan; r++) {
    const s = headerScore(cells[r])
    if (s > bestScore) {
      bestScore = s
      bestRow = r
    }
  }
  if (bestRow < 0) {
    // Fall back to the first row with at least two text cells.
    bestRow = cells.findIndex((row) => row.filter((c) => typeof c === 'string').length >= 2)
    if (bestRow < 0) return null
  }

  const width = Math.max(...cells.slice(bestRow, bestRow + 50).map((r) => r.length))
  let headers: string[] = []
  const top = cells[bestRow]
  let last = ''
  const next = cells[bestRow + 1] ?? []
  const nextIsStats =
    next.filter((c) => typeof c === 'string' && STAT_WORDS.test(c)).length >= 2
  for (let c = 0; c < width; c++) {
    const t = top[c]
    let h = t === null || t === undefined ? '' : String(t).trim()
    if (nextIsStats) {
      if (h) last = h
      else h = last
      const sub = next[c]
      if (typeof sub === 'string' && STAT_WORDS.test(sub)) h = `${h}_${sub}`
    }
    headers.push(h)
  }
  // Blank and duplicate header names
  const seen = new Map<string, number>()
  headers = headers.map((h, i) => {
    let name = h || `Column ${i + 1}`
    const n = seen.get(name) ?? 0
    seen.set(name, n + 1)
    if (n > 0) name = `${name} (${n + 1})`
    return name
  })

  const dataStart = bestRow + (nextIsStats ? 2 : 1)
  const rows = cells
    .slice(dataStart)
    .map((r) => Array.from({ length: width }, (_, i) => r[i] ?? null))
    .filter((r) => r.some((c) => c !== null))
    // Drop summary rows some exports append (e.g. "Mean", "StDev" footers)
    .filter((r) => !(typeof r[0] === 'string' && STAT_WORDS.test(r[0]) && r.slice(1, 3).every((c) => c === null || typeof c === 'number')))

  // Drop entirely empty columns
  const keep = headers.map((_, i) => rows.some((r) => r[i] !== null))
  return {
    file: sheet.file,
    sheet: sheet.sheet,
    headerRow: bestRow,
    headers: headers.filter((_, i) => keep[i]),
    rows: rows.map((r) => r.filter((_, i) => keep[i])),
  }
}

/** Picks the sheet(s) in a workbook that look like CatWalk run statistics. */
export function pickTables(sheets: RawSheet[]): ParsedTable[] {
  const tables = sheets.map(detectTable).filter((t): t is ParsedTable => t !== null && t.rows.length > 0)
  const scored = tables.map((t) => ({
    t,
    s: t.headers.filter((h) => matchColumn(h)).length,
  }))
  const max = Math.max(0, ...scored.map((x) => x.s))
  if (max === 0) return tables.slice(0, 1)
  // keep sheets that have at least half as many recognised columns as the best one
  return scored.filter((x) => x.s >= max / 2).map((x) => x.t)
}

// ---------------------------------------------------------------------------
// Merging and column classification

export interface KeyJoin {
  file: string
  keyColumn: string
  dataColumn: string
  added: string[]
  matchedIds: number
  unmatchedData: string[]
  unusedKeyIds: string[]
  notes: string[]
}

export interface Dataset {
  headers: string[]
  rows: Cell[][]
  columns: ColumnInfo[]
  sources: string[]
  keys: KeyJoin[]
  notices: string[]
}

export const SOURCE_COL = 'Source file'

/** A table with (almost) no CatWalk parameters is treated as an animal key / metadata sheet. */
export function isKeyTable(t: ParsedTable): boolean {
  return t.headers.filter((h) => matchColumn(h)).length < 3
}

const norm = (c: Cell) => (c === null ? '' : String(c).trim().toLowerCase().replace(/\s+/g, ' '))

const isTrialLevel = (t: ParsedTable) => t.headers.some((h) => metaRole(h) === 'nruns')
const isRunLevel = (t: ParsedTable) => t.headers.some((h) => metaRole(h) === 'run')

export function mergeTables(tables: ParsedTable[]): Dataset {
  const notices: string[] = []
  let dataTables = tables.filter((t) => !isKeyTable(t))
  const keyTables = dataTables.length ? tables.filter(isKeyTable) : []
  // Run and trial statistics describe the same animals; combining them would count animals twice.
  if (dataTables.some(isRunLevel) && dataTables.some(isTrialLevel)) {
    const skipped = dataTables.filter((t) => isTrialLevel(t) && !isRunLevel(t))
    dataTables = dataTables.filter((t) => !skipped.includes(t))
    notices.push(
      `${skipped.map((t) => t.file).join(', ')} (trial statistics) was not combined with the run statistics, because both describe the same animals. The app averages the runs itself; load the trial-statistics file on its own to analyse CatWalk's own trial averages.`,
    )
  }
  const main = dataTables.length ? dataTables : tables

  const headers: string[] = []
  const index = new Map<string, number>()
  const add = (h: string) => {
    if (!index.has(h)) {
      index.set(h, headers.length)
      headers.push(h)
    }
  }
  const multi = main.length > 1
  if (multi) add(SOURCE_COL)
  for (const t of main) t.headers.forEach(add)
  const rows: Cell[][] = []
  const sources: string[] = []
  for (const t of main) {
    const label = t.sheet && main.filter((x) => x.file === t.file).length > 1 ? `${t.file} › ${t.sheet}` : t.file
    sources.push(label)
    for (const r of t.rows) {
      const out: Cell[] = new Array(headers.length).fill(null)
      if (multi) out[0] = label
      t.headers.forEach((h, i) => {
        out[index.get(h)!] = r[i]
      })
      rows.push(out)
    }
  }

  const keys: KeyJoin[] = []
  const keyCols = new Set<string>()
  for (const kt of keyTables) {
    const j = joinKey(headers, rows, kt)
    if (!j) continue
    keys.push(j.info)
    for (const h of j.info.added) keyCols.add(h)
    headers.push(...j.info.added)
    rows.forEach((r, i) => r.push(...j.values[i]))
  }
  return { headers, rows, columns: classifyColumns(headers, rows, keyCols), sources, keys, notices }
}

/**
 * Joins a key table to the data by the (key column, data column) pair whose
 * values overlap most, e.g. "CatWalk trial name" ↔ "Trial".
 */
function joinKey(headers: string[], rows: Cell[][], kt: ParsedTable): { info: KeyJoin; values: Cell[][] } | null {
  let best: { kc: number; dc: number; hits: number } | null = null
  for (let kc = 0; kc < kt.headers.length; kc++) {
    const kv = new Set(kt.rows.map((r) => norm(r[kc])).filter(Boolean))
    if (kv.size < 3) continue
    for (let dc = 0; dc < headers.length; dc++) {
      const dv = new Set(rows.map((r) => norm(r[dc])).filter(Boolean))
      let hits = 0
      for (const v of dv) if (kv.has(v)) hits++
      if (hits >= 2 && (!best || hits > best.hits)) best = { kc, dc, hits }
    }
  }
  if (!best) return null
  const { kc, dc } = best
  const lookup = new Map<string, Cell[]>()
  const notes: string[] = []
  for (const r of kt.rows) {
    const k = norm(r[kc])
    const filled = r.filter((c) => c !== null)
    if (k && !lookup.has(k) && filled.length > 1) lookup.set(k, r)
    // Free-text rows below the table (e.g. "Notes", then sentences) are kept as notes.
    else if (filled.length === 1 && typeof filled[0] === 'string' && filled[0].length > 20) notes.push(filled[0])
  }
  const cols = kt.headers.map((h, i) => ({ h, i })).filter(({ i }) => i !== kc && kt.rows.some((r) => r[i] !== null))
  const added = cols.map(({ h }) => (headers.includes(h) ? `${h} (key)` : h))
  const dataIds = new Set<string>()
  const unmatched = new Set<string>()
  const values = rows.map((r) => {
    const id = norm(r[dc])
    const k = lookup.get(id)
    if (id) (k ? dataIds : unmatched).add(String(r[dc]))
    return cols.map(({ i }) => (k ? k[i] : null))
  })
  const matchedKeys = new Set([...dataIds].map((d) => norm(d)))
  return {
    info: {
      file: kt.sheet ? `${kt.file} › ${kt.sheet}` : kt.file,
      keyColumn: kt.headers[kc],
      dataColumn: headers[dc],
      added,
      matchedIds: dataIds.size,
      unmatchedData: [...unmatched],
      unusedKeyIds: [...lookup.keys()].filter((k) => !matchedKeys.has(k)).map((k) => String(lookup.get(k)![kc])),
      notes,
    },
    values,
  }
}

export function classifyColumns(headers: string[], rows: Cell[][], keyCols: Set<string> = new Set()): ColumnInfo[] {
  return headers.map((name, i) => {
    let nonNull = 0
    let numeric = 0
    const distinct = new Set<string>()
    for (const r of rows) {
      const c = r[i]
      if (c === null) continue
      nonNull++
      if (toNumber(c) !== null) numeric++
      if (distinct.size < 1000) distinct.add(String(c))
    }
    // Columns from an animal key are always descriptive metadata, never gait parameters.
    const meta = name === SOURCE_COL ? 'other' : keyCols.has(name) ? (metaRole(name.replace(/ \(key\)$/, '')) ?? 'other') : metaRole(name)
    return {
      name,
      numericShare: nonNull ? numeric / nonNull : 0,
      distinct: distinct.size,
      match: meta ? null : matchColumn(name),
      meta,
      fromKey: keyCols.has(name),
    }
  })
}
