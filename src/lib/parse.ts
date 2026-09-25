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
}

// ---------------------------------------------------------------------------
// Reading files

function normaliseCell(v: unknown): Cell {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = String(v).trim()
  return s === '' ? null : s
}

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
      if (s === '') return null
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

export interface Dataset {
  headers: string[]
  rows: Cell[][]
  columns: ColumnInfo[]
  sources: string[]
}

export const SOURCE_COL = 'Source file'

export function mergeTables(tables: ParsedTable[]): Dataset {
  const headers: string[] = []
  const index = new Map<string, number>()
  const add = (h: string) => {
    if (!index.has(h)) {
      index.set(h, headers.length)
      headers.push(h)
    }
  }
  const multi = tables.length > 1
  if (multi) add(SOURCE_COL)
  for (const t of tables) t.headers.forEach(add)
  const rows: Cell[][] = []
  const sources: string[] = []
  for (const t of tables) {
    const label = t.sheet && tables.filter((x) => x.file === t.file).length > 1 ? `${t.file} › ${t.sheet}` : t.file
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
  return { headers, rows, columns: classifyColumns(headers, rows), sources }
}

export function classifyColumns(headers: string[], rows: Cell[][]): ColumnInfo[] {
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
    const meta = name === SOURCE_COL ? 'other' : metaRole(name)
    return {
      name,
      numericShare: nonNull ? numeric / nonNull : 0,
      distinct: distinct.size,
      match: meta ? null : matchColumn(name),
      meta,
    }
  })
}
