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

export function mergeTables(all: ParsedTable[]): Dataset {
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
  for (const kt of mergeKeyTables(keyTables)) {
    const j = joinKey(headers, rows, kt)
    if (!j) continue
    keys.push(j.info)
    for (const h of j.info.added) keyCols.add(h)
    headers.push(...j.info.added)
    rows.forEach((r, i) => r.push(...j.values[i]))
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
    // Later rows win, so an updated key overrides an older one.
    if (k && filled.length > 1) lookup.set(k, r)
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
