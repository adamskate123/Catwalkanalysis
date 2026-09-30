import Papa from 'papaparse'
import readXlsxFile from 'read-excel-file/universal'
import type { ColumnMatch, MetaRole } from './catalog'
import { program, roleOf } from '../programs'
import { readPrismProject, reshapeTable, type ImportOptions } from './importers'

const matchColumn = (name: string) => program().matchColumn(name)
const metaRole = roleOf

export type Cell = string | number | null

export interface RawSheet {
  file: string
  sheet: string
  cells: Cell[][]
  /** Messages from the importer (e.g. sheets it skipped), shown when the file is loaded. */
  notes?: string[]
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

export async function readFile(file: File, opts: ImportOptions = {}): Promise<RawSheet[]> {
  const name = file.name
  const lower = name.toLowerCase()
  if (lower.endsWith('.prism')) return readPrismProject(new Uint8Array(await file.arrayBuffer()), name, opts)
  if (lower.endsWith('.pzfx')) {
    throw new Error(`${name}: older Prism .pzfx files aren't read yet. In Prism 10, save the project as .prism, or copy the data table into Excel.`)
  }
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

/** Picks the sheet(s) in a workbook that hold the program's measurements. */
export function pickTables(sheets: RawSheet[], opts: ImportOptions = {}): ParsedTable[] {
  const tables = reshapeTables(sheets.map(detectTable).filter((t): t is ParsedTable => t !== null && t.rows.length > 0), opts)
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
  /** Key columns combined into the ID (one, or e.g. Tag Number + Toe/Ear Mark). */
  keyColumns: string[]
  /** False when the join was picked by hand in Setup. */
  auto: boolean
  /** IDs matched by words rather than identically ("JAX NM" ↔ "Jax Ctrl NM"). */
  fuzzy: number
  /** Text columns the join could use, for choosing by hand. */
  keyOptions: string[]
  dataOptions: string[]
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

/** A table with (almost) no recognised parameters is treated as an animal key / metadata sheet. */
export function isKeyTable(t: ParsedTable): boolean {
  return t.headers.filter((h) => !metaRole(h) && matchColumn(h)).length < program().keyMinParams
}

/**
 * Converts Prism-style (groups as columns), long (measure/value) and wide-trial
 * layouts to one row per animal (and trial), and joins sheets of the same file
 * that were reshaped that way into one table.
 */
function reshapeTables(tables: ParsedTable[], opts: ImportOptions): ParsedTable[] {
  const out: ParsedTable[] = []
  const joined = new Map<string, ParsedTable[]>()
  for (const t of tables) {
    const r = reshapeTable(t, opts)
    if (r === t) out.push(t)
    else joined.set(t.file, [...(joined.get(t.file) ?? []), r])
  }
  for (const list of joined.values()) out.push(joinOnIds(list))
  return out
}

/** Full outer join of tables on their shared ID columns (animal, group, sex, time, trial). */
export function joinOnIds(tables: ParsedTable[]): ParsedTable {
  if (tables.length === 1) return tables[0]
  const headers: string[] = []
  for (const t of tables) for (const h of t.headers) if (!headers.includes(h)) headers.push(h)
  const isId = (h: string) => {
    const role = metaRole(h)
    return role === 'subject' || role === 'group' || role === 'sex' || role === 'time' || role === 'run' || role === 'trial'
  }
  const idHeaders = headers.filter(isId)
  const rows = new Map<string, Cell[]>()
  for (const t of tables) {
    for (const r of t.rows) {
      const get = (h: string) => (t.headers.includes(h) ? r[t.headers.indexOf(h)] : null)
      const key = idHeaders.map((h) => norm(get(h))).join('\u0000')
      const row = rows.get(key) ?? new Array<Cell>(headers.length).fill(null)
      headers.forEach((h, i) => {
        const v = get(h)
        if (v !== null) row[i] = v
      })
      rows.set(key, row)
    }
  }
  return { file: tables[0].file, sheet: '', headerRow: 0, headers, rows: [...rows.values()] }
}

const norm = (c: Cell) => (c === null ? '' : String(c).trim().toLowerCase().replace(/\s+/g, ' '))

const isTrialLevel = (t: ParsedTable) => t.headers.some((h) => metaRole(h) === 'nruns')
const isRunLevel = (t: ParsedTable) => t.headers.some((h) => metaRole(h) === 'run')

export function mergeTables(all: ParsedTable[], opts: MergeOptions = {}): Dataset {
  const notices: string[] = []
  // Body-weight tables are joined onto the other data as a covariate when there are other data.
  const weightOnly = all.filter(isWeightTable)
  const weightTables = weightOnly.length < all.filter((t) => !isKeyTable(t) || isWeightTable(t)).length ? weightOnly : []
  const tables = all.filter((t) => !weightTables.includes(t))
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

  // Updated exports usually repeat earlier rows. A later row with the same
  // experiment/animal/trial/timepoint/session/run replaces the earlier one. Sex
  // only separates rows when both state it and it differs (ear tags can repeat
  // across sexes), so a file without sex still matches the same animals in a
  // file with sex.
  const idCols = headers
    .map((h, i) => ({ h, i, role: metaRole(h) }))
    .filter(({ h, role }) => /^experiment$/i.test(h.trim()) || role === 'subject' || role === 'trial' || role === 'run' || (role === 'time' && !/description/i.test(h)))
  const sexCol = headers.findIndex((h) => metaRole(h) === 'sex')
  let replaced = 0
  if (idCols.some((c) => c.role === 'subject' || c.role === 'trial')) {
    const seen = new Map<string, number[]>()
    const keep: boolean[] = rows.map(() => true)
    rows.forEach((r, i) => {
      const id = idCols.map(({ i: c }) => norm(r[c])).join('\u0000')
      const sex = sexCol >= 0 ? norm(r[sexCol]) : ''
      const list = seen.get(id) ?? []
      const at = list.findIndex((p) => {
        const other = sexCol >= 0 ? norm(rows[p][sexCol]) : ''
        return !sex || !other || sex === other
      })
      if (at >= 0) {
        const prev = list[at]
        keep[prev] = false
        replaced++
        // Values the newer row lacks (e.g. a measure only in the older file, or sex) are kept.
        rows[prev].forEach((c, j) => {
          if (r[j] === null) r[j] = c
        })
        list[at] = i
      } else list.push(i)
      seen.set(id, list)
    })
    if (replaced) {
      const kept = rows.filter((_, i) => keep[i])
      rows.length = 0
      rows.push(...kept)
      notices.push(
        `${replaced} row${replaced === 1 ? '' : 's'} appeared in more than one file (same animal, trial, timepoint and run); the most recently added version was used.`,
      )
    }
  }

  const keys: KeyJoin[] = []
  const keyCols = new Set<string>()
  let keyWeights: Cell[] | null = null
  let keyWeightFile = ''
  for (const kt of mergeKeyTables(keyTables)) {
    const label = kt.sheet ? `${kt.file} › ${kt.sheet}` : kt.file
    const j = joinKey(headers, rows, kt, opts.keyChoices?.[label], !weightTables.length && !keyWeights && !headers.includes(WEIGHT_COL))
    if (!j) continue
    keys.push(j.info)
    for (const h of j.info.added) keyCols.add(h)
    headers.push(...j.info.added)
    rows.forEach((r, i) => r.push(...j.values[i]))
    if (j.weights) {
      keyWeights = j.weights
      keyWeightFile = j.info.file
    }
  }
  if (keyWeights) {
    headers.push(WEIGHT_COL)
    rows.forEach((r, i) => r.push(keyWeights![i]))
    const n = keyWeights.filter((w) => w !== null).length
    notices.push(
      `Body weight from ${keyWeightFile} was added to ${n} of ${rows.length} runs, using each animal's weigh-in nearest the test date (within ${WEIGH_WINDOW_DAYS} days).${n < rows.length ? ` ${rows.length - n} runs had no weigh-in that close; log a weight for those test days to include them.` : ''} Weight appears as a parameter and can be used as a covariate (Setup → Statistics).`,
    )
  }
  if (weightTables.length) {
    const w = joinWeights(headers, rows, weightTables)
    if (w) {
      headers.push(WEIGHT_COL)
      rows.forEach((r, i) => r.push(w.values[i]))
      notices.push(w.notice)
    }
  }
  return { headers, rows, columns: classifyColumns(headers, rows, keyCols), sources, keys, notices }
}

export const WEIGHT_COL = 'Body weight (g)'

/** Numeric age window of a label: "≤50 days" → [0, 50], "51-100 days" → [51, 100], "100 days" → [100, 100]. */
function ageWindow(label: string): [number, number] | null {
  const t = label.toLowerCase()
  let m = /(?:<=?|≤)\s*(\d+(?:\.\d+)?)/.exec(t)
  if (m) return [0, +m[1]]
  m = /(?:>=?|≥)\s*(\d+(?:\.\d+)?)/.exec(t)
  if (m) return [+m[1], Infinity]
  m = /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/.exec(t)
  if (m) return [+m[1], +m[2]]
  m = /(\d+(?:\.\d+)?)/.exec(t)
  return m ? [+m[1], +m[1]] : null
}

/** A point age matches the window that contains it; two windows match when identical. */
function overlaps(a: [number, number], b: [number, number] | null): boolean {
  if (!b) return false
  const point = (x: [number, number]) => x[0] === x[1]
  if (point(a) && point(b)) return a[0] === b[0]
  if (point(b)) return b[0] >= a[0] && b[0] <= a[1]
  if (point(a)) return a[0] >= b[0] && a[0] <= b[1]
  return a[0] === b[0] && a[1] === b[1]
}
const isWeightName = (h: string) => !metaRole(h) && matchColumn(h)?.paramId === 'body_weight'

/** A table whose only measurement is body weight (e.g. a weights Prism file), with an animal ID column. */
export function isWeightTable(t: ParsedTable): boolean {
  const measured = t.headers.filter((h) => !metaRole(h) && matchColumn(h))
  return measured.length > 0 && measured.every(isWeightName) && t.headers.some((h) => metaRole(h) === 'subject')
}

/**
 * Adds body weight to each data row from weight tables, matched by animal ID
 * and, when both have one, by timepoint (and sex). Several weighings in the
 * same window are averaged.
 */
function joinWeights(headers: string[], rows: Cell[][], tables: ParsedTable[]): { values: Cell[]; notice: string } | null {
  const role = (hs: string[], r: MetaRole) => hs.findIndex((h) => metaRole(h) === r)
  const di = role(headers, 'subject') >= 0 ? role(headers, 'subject') : role(headers, 'trial')
  if (di < 0) return null
  const dt = headers.findIndex((h) => metaRole(h) === 'time' && !/description/i.test(h))
  const ds = role(headers, 'sex')
  // Weighings per animal (and sex), then per time label
  const byAnimal = new Map<string, { time: string; s: number; n: number }[]>()
  let useTime = false
  let useSex = false
  for (const t of tables) {
    const wi = t.headers.findIndex(isWeightName)
    const ti = role(t.headers, 'subject')
    const tt = t.headers.findIndex((h) => metaRole(h) === 'time')
    const ts = role(t.headers, 'sex')
    const byTime = dt >= 0 && tt >= 0
    const bySex = ds >= 0 && ts >= 0
    useTime ||= byTime
    useSex ||= bySex
    for (const r of t.rows) {
      const v = toNumber(r[wi])
      if (v === null || !norm(r[ti])) continue
      const k = [norm(r[ti]), bySex ? norm(r[ts]) : ''].join('\u0000')
      const time = byTime ? norm(r[tt]) : ''
      const list = byAnimal.get(k) ?? []
      const e = list.find((x) => x.time === time) ?? (list[list.push({ time, s: 0, n: 0 }) - 1])
      e.s += v
      e.n++
      byAnimal.set(k, list)
    }
  }
  if (!byAnimal.size) return null
  const seen = new Set<string>()
  const hit = new Set<string>()
  let bridged = 0
  const values = rows.map((r) => {
    const time = useTime && dt >= 0 ? norm(r[dt]) : ''
    const rowKey = [norm(r[di]), time, useSex && ds >= 0 ? norm(r[ds]) : ''].join('\u0000')
    seen.add(rowKey)
    // A row without sex takes the animal's weights whatever sex they were filed under.
    const sex = useSex && ds >= 0 ? norm(r[ds]) : ''
    const lists = sex || !useSex ? [byAnimal.get([norm(r[di]), sex].join('\u0000')) ?? []] : [...byAnimal].filter(([k]) => k.startsWith(norm(r[di]) + '\u0000')).map(([, l]) => l)
    const entries = lists.flat()
    if (!entries.length) return null
    let use = entries.filter((e) => e.time === time)
    if (!use.length && time) {
      // Different binning in the two files, e.g. weight "100 days" within the "51-100 days" window
      const win = ageWindow(time)
      use = win ? entries.filter((e) => overlaps(win, ageWindow(e.time))) : []
      if (use.length) bridged++
    }
    if (!use.length) return null
    hit.add(rowKey)
    const s = use.reduce((a, e) => a + e.s, 0)
    const n = use.reduce((a, e) => a + e.n, 0)
    return +(s / n).toFixed(3)
  })
  const matched = hit.size
  const files = [...new Set(tables.map((t) => t.file))].join(', ')
  const by = ['animal ID', useTime ? 'timepoint' : '', useSex ? 'sex' : ''].filter(Boolean).join(', ')
  return {
    values,
    notice: `Body weight from ${files} was added for ${matched} of ${seen.size} animal${useTime ? '-timepoint' : ''}s, matched by ${by}; several weighings in one window are averaged.${bridged ? ' Where the two files bin ages differently, weights whose age falls inside the data’s age window were used (e.g. “100 days” for “51-100 days”).' : ''} Body weight appears as a parameter and can be used as a covariate (Setup → Statistics).`,
  }
}

/** Combines several animal-key sheets (e.g. an original and an updated key) into one. */
function mergeKeyTables(tables: ParsedTable[]): ParsedTable[] {
  if (tables.length < 2) return tables
  const headers: string[] = []
  for (const t of tables) for (const h of t.headers) if (!headers.includes(h)) headers.push(h)
  const rows = tables.flatMap((t) => t.rows.map((r) => headers.map((h) => (t.headers.includes(h) ? r[t.headers.indexOf(h)] : null))))
  return [{ file: tables.map((t) => t.file).filter((f, i, a) => a.indexOf(f) === i).join(' + '), sheet: '', headerRow: 0, headers, rows }]
}

/** A key column (or combination of columns) chosen by hand in Setup → Animal key. */
export interface KeyChoice {
  keyColumns: string[]
  dataColumn: string
}

export interface MergeOptions {
  /** Hand-picked joins, by key file label (KeyJoin.file). */
  keyChoices?: Record<string, KeyChoice>
}

const tokens = (s: string) => s.split(/[\s_\-/,;:]+/).filter(Boolean)

/** Share of non-empty cells that are numbers. */
function numericShareOf(values: Cell[]): number {
  const filled = values.filter((c) => c !== null && String(c).trim() !== '')
  return filled.length ? filled.filter((c) => toNumber(c) !== null).length / filled.length : 0
}

/** "2026-09-24", "9/24/2026" or "24.09.2026" → UTC day number; null for anything else. */
export function parseDay(c: Cell): number | null {
  if (c === null) return null
  const s = String(c).trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(s)
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (m) return Date.UTC(+m[3], +m[1] - 1, +m[2]) / 864e5
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s)
  if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]) / 864e5
  return null
}

/** Days a weigh-in may lie from the test date and still be used. */
export const WEIGH_WINDOW_DAYS = 7
export const AGE_AT_TEST_COL = 'Age at test (d)'

/**
 * Joins a key table to the data through an ID. Only text columns take part:
 * numeric columns (counts, weights) can overlap by chance and would join the
 * wrong animals. The key ID may combine two columns (e.g. Tag Number + Toe/Ear
 * Mark → "KX9.1 LF"), and an ID matches when it is identical or when all of
 * the data ID's words appear in exactly one key entry ("JAX NM" ↔ "Jax Ctrl NM").
 * A weekly weight log (date-headed columns) supplies the weigh-in nearest each
 * test date instead of every weekly column, and a DOB column gives the age at test.
 */
function joinKey(
  headers: string[],
  rows: Cell[][],
  kt: ParsedTable,
  choice?: KeyChoice,
  allowWeight = true,
): { info: KeyJoin; values: Cell[][]; weights: Cell[] | null } | null {
  const file = kt.sheet ? `${kt.file} › ${kt.sheet}` : kt.file
  const keyText = kt.headers
    .map((h, i) => ({ h, i }))
    .filter(({ i }) => {
      const vals = kt.rows.map((r) => r[i])
      return numericShareOf(vals) < 0.5 && parseDayShare(vals) < 0.5 && new Set(vals.map(norm).filter(Boolean)).size >= 2
    })
    .map(({ i }) => i)
  const dataText = headers
    .map((h, i) => ({ h, i }))
    .filter(({ h, i }) => {
      if (h === SOURCE_COL) return false
      const role = metaRole(h)
      if (!role && matchColumn(h)) return false
      if (role === 'equipment' || role === 'time' || role === 'nruns' || role === 'run') return false
      const vals = rows.map((r) => r[i])
      return numericShareOf(vals) < 0.5 && new Set(vals.map(norm).filter(Boolean)).size >= 2
    })
    .map(({ i }) => i)

  const idOf = (r: Cell[], cols: number[]) => norm(cols.map((c) => (r[c] === null ? '' : String(r[c]))).join(' '))
  const evaluate = (kcs: number[], dc: number) => {
    // Free-text rows below the table (e.g. "Notes", then a sentence) are notes, not animals.
    const entries = kt.rows
      .map((r, ri) => ({ ri, id: idOf(r, kcs) }))
      .filter((e) => e.id && kcs.every((c) => kt.rows[e.ri][c] !== null) && kt.rows[e.ri].filter((c) => c !== null).length > 1)
    const exact = new Map<string, number>()
    for (const e of entries) exact.set(e.id, e.ri)
    const map = new Map<string, number>()
    let exactHits = 0
    let fuzzyHits = 0
    for (const v of new Set(rows.map((r) => norm(r[dc])).filter(Boolean))) {
      if (exact.has(v)) {
        map.set(v, exact.get(v)!)
        exactHits++
        continue
      }
      const want = tokens(v)
      const found = entries.filter((e) => {
        const have = tokens(e.id)
        return want.every((w) => have.includes(w))
      })
      if (want.length && found.length === 1) {
        map.set(v, found[0].ri)
        fuzzyHits++
      }
    }
    return { map, exactHits, fuzzyHits, hits: exactHits + fuzzyHits }
  }

  type Best = { kcs: number[]; dc: number; map: Map<string, number>; exactHits: number; fuzzyHits: number; hits: number }
  let best: Best | null = null
  let auto = true
  if (choice) {
    const kcs = choice.keyColumns.map((h) => kt.headers.indexOf(h))
    const dc = headers.indexOf(choice.dataColumn)
    if (kcs.length && kcs.every((i) => i >= 0) && dc >= 0) {
      best = { kcs, dc, ...evaluate(kcs, dc) }
      auto = false
    }
  }
  if (!best) {
    const combos: number[][] = keyText.map((i) => [i])
    for (const a of keyText) for (const b of keyText) if (a !== b) combos.push([a, b])
    for (const kcs of combos) {
      for (const dc of dataText) {
        const r = evaluate(kcs, dc)
        if (r.hits < 2) continue
        const better =
          !best ||
          r.hits > best.hits ||
          (r.hits === best.hits && (r.exactHits > best.exactHits || (r.exactHits === best.exactHits && kcs.length < best.kcs.length)))
        if (better) best = { kcs, dc, ...r }
      }
    }
  }
  if (!best) return null
  const { kcs, dc, map } = best

  // Weekly weight log: date-headed numeric columns.
  const looksWeight = /weigh|\bwt\b|body ?mass/i.test(`${kt.file} ${kt.sheet} ${kt.headers.join(' ')}`)
  const dateCols = kt.headers
    .map((h, i) => ({ h, i, day: parseDay(h) }))
    .filter(({ i, day }) => day !== null && numericShareOf(kt.rows.map((r) => r[i])) >= 0.9 && kt.rows.some((r) => r[i] !== null))
  const weightLog = allowWeight && looksWeight && dateCols.length >= 2
  const timeIdx = headers.findIndex((h) => metaRole(h) === 'time' && !/description/i.test(h))
  const dayOf = (r: Cell[]) => (timeIdx >= 0 ? parseDay(r[timeIdx]) : null)
  const dobIdx = kt.headers.findIndex((h) => /^(dob|d\.o\.b\.?|date of birth|birth ?date)$/i.test(h.trim()))

  const notes: string[] = []
  for (const r of kt.rows) {
    const filled = r.filter((c) => c !== null)
    if (filled.length === 1 && typeof filled[0] === 'string' && filled[0].length > 20) notes.push(filled[0])
  }
  const skip = new Set<number>([...kcs.length === 1 ? kcs : [], ...(weightLog ? dateCols.map((d) => d.i) : [])])
  const cols = kt.headers.map((h, i) => ({ h, i })).filter(({ i }) => !skip.has(i) && kt.rows.some((r) => r[i] !== null))
  const canAge = dobIdx >= 0 && rows.some((r) => dayOf(r) !== null)
  const added = [...(canAge ? [AGE_AT_TEST_COL] : []), ...cols.map(({ h }) => (headers.includes(h) ? `${h} (key)` : h))]
  const dataIds = new Set<string>()
  const unmatched = new Set<string>()
  let weighed = 0
  const weights: Cell[] = []
  const values = rows.map((r) => {
    const id = norm(r[dc])
    const ri = map.get(id)
    const k = ri === undefined ? undefined : kt.rows[ri]
    if (id) (k ? dataIds : unmatched).add(String(r[dc]))
    const day = dayOf(r)
    if (weightLog) {
      let w: Cell = null
      if (k && day !== null) {
        let bestD = Infinity
        for (const d of dateCols) {
          const v = toNumber(k[d.i])
          if (v === null) continue
          const dist = Math.abs(d.day! - day)
          // On a tie, the earlier weigh-in (before the test) wins.
          if (dist <= WEIGH_WINDOW_DAYS && (dist < bestD || (dist === bestD && d.day! < day))) {
            bestD = dist
            w = v
          }
        }
        if (w !== null) weighed++
      }
      weights.push(w)
    }
    const age: Cell[] = canAge ? [k && day !== null && parseDay(k[dobIdx]) !== null ? day - parseDay(k[dobIdx])! : null] : []
    return [...age, ...cols.map(({ i }) => (k ? k[i] : null))]
  })
  if (weightLog && (timeIdx < 0 || !rows.some((r) => dayOf(r) !== null)))
    notes.push('This is a weekly weight log, but the data have no test dates (Time_Point), so weights could not be matched to a test day.')
  if (canAge) notes.push(`${AGE_AT_TEST_COL} is calculated from DOB and the test date, not from ages stored in the key (those change with the date the file was opened).`)
  const matchedRows = new Set(map.values())
  return {
    info: {
      file,
      keyColumn: kcs.map((c) => kt.headers[c]).join(' + '),
      keyColumns: kcs.map((c) => kt.headers[c]),
      dataColumn: headers[dc],
      added,
      matchedIds: dataIds.size,
      unmatchedData: [...unmatched],
      unusedKeyIds: kt.rows
        .map((r, ri) => ({ r, ri }))
        .filter(({ r, ri }) => !matchedRows.has(ri) && kcs.every((c) => r[c] !== null) && r.filter((c) => c !== null).length > 1)
        .map(({ r }) => kcs.map((c) => String(r[c])).join(' ')),
      notes,
      auto,
      fuzzy: best.fuzzyHits,
      keyOptions: keyText.map((i) => kt.headers[i]),
      dataOptions: dataText.map((i) => headers[i]),
    },
    values,
    weights: weightLog && weighed ? weights : null,
  }
}

function parseDayShare(values: Cell[]): number {
  const filled = values.filter((c) => c !== null)
  return filled.length ? filled.filter((c) => parseDay(c) !== null).length / filled.length : 0
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
