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
import { MISSING, parseDay, parseNumber, toNumber, type Cell, type ParsedTable, type RawSheet } from './parse'

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

const ZONE = /\b(center|centre|periphery|peripheral|border|inner|outer)\b/i

/**
 * Splits a Prism data-set title into group, sex and (open field) arena zone:
 * "Male Jax WT Periphery n=10" → group "Jax WT", sex "M", zone "Periphery".
 */
export function parseGroupTitle(title: string): { group: string; sex: string | null; zone: string | null; interval: number | null } {
  let t = title.replace(/[([]?\bn\s*=\s*\d+[)\]]?/gi, ' ')
  // Within-session interval ("… interval 3"), used for habituation curves
  const iv = /\b(?:interval|int|bin|block)\s*#?\s*(\d+)\b/i.exec(t)
  const interval = iv ? Number(iv[1]) : null
  if (iv) t = t.replace(iv[0], ' ')
  let sex: string | null = null
  if (/\b(females?|fem|f)\b/i.test(t)) sex = 'F'
  else if (/\b(males?|m)\b/i.test(t)) sex = 'M'
  if (sex) t = t.replace(/\b(females?|fem|males?|f|m)\b/gi, ' ')
  const z = ZONE.exec(t)
  const zone = z ? z[1][0].toUpperCase() + z[1].slice(1).toLowerCase() : null
  if (z) t = t.replace(ZONE, ' ')
  const group = t.replace(/[\s,;:_\-–/()]+$/g, '').replace(/^[\s,;:_\-–/()]+/g, '').replace(/\s+/g, ' ').trim()
  return { group: group || title.trim(), sex, zone, interval }
}

/** "Total Center Time" for the Periphery groups of the same table → "Total Periphery Time". */
function zonedMeasure(measure: string, zone: string | null): string {
  if (!zone) return measure
  return ZONE.test(measure) ? measure.replace(ZONE, zone) : `${measure} ${zone}`
}

const UNIT = '(?:d|days?|wks?|weeks?|mo|mos|months?|dpi|wpi)'
const TIME_RE = new RegExp(
  `(?:^|[\\s_(,;:-])((?:<=?|>=?|≤|≥)\\s*\\d+(?:\\.\\d+)?\\s*${UNIT}|\\d+(?:\\.\\d+)?\\s*(?:-|–|to)\\s*\\d+(?:\\.\\d+)?\\s*${UNIT}|(?:day|week|wk|month|p|pnd)\\s*-?\\s*\\d+|\\d+(?:\\.\\d+)?\\s*${UNIT}(?:\\s*old)?)(?=$|[\\s_),;:\\-–])`,
  'i',
)

const SEX_PAIR = /\b(males?\s*(?:vs\.?|versus|and|&|\+|\/)\s*females?(?:\s+combined)?|females?\s*(?:vs\.?|versus|and|&|\+|\/)\s*males?(?:\s+combined)?|both\s+sexes|sexes\s+combined|combined|m\s*(?:vs\.?|\/|\+)\s*f)\b/i

/**
 * Splits a sheet title into the measure name, an age/time window and a sex, if
 * any: "Rotarod - Males 50 days" → measure "Rotarod", time "50 days", sex "M".
 * Titles naming both sexes ("Male vs Female") give no sex.
 */
export function splitSheetTitle(title: string): { measure: string; time: string | null; sex: string | null } {
  let rest = title
  let time: string | null = null
  const m = TIME_RE.exec(rest)
  if (m) {
    // "301 - 350 Days" and "301-350 days" are the same window
    time = m[1]
      .replace(/\s*([-–]|to)\s*/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/[a-z]+$/i, (u) => u.toLowerCase())
      // "≤50 day" on one sheet and "≤50 days" on another are the same window
      .replace(/\b(day|week|month|year|wk|mo)$/, (u) => u + 's')
      .trim()
    rest = rest.slice(0, m.index) + ' ' + rest.slice(m.index + m[0].length)
  }
  let sex: string | null = null
  if (SEX_PAIR.test(rest)) rest = rest.replace(SEX_PAIR, ' ')
  else if (/\bfemales?\b/i.test(rest)) sex = 'F'
  else if (/\bmales?\b/i.test(rest)) sex = 'M'
  rest = rest.replace(/\b(fe)?males?\b/gi, ' ').replace(/\ball\s+ages\b/gi, ' ')
  const measure = rest
    .replace(/[()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:_\-–]+|[\s,;:_\-–]+$/g, '')
    .trim()
  return { measure, time, sex }
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
  /** Subcolumn titles, when the table has them (ear tags, "Trial 1"…). */
  subTitles?: (string | null)[]
}

type AxisKind = 'trial' | 'replicate' | 'row'

interface RecordRow {
  animal: string
  /** The ID is a real label (row or subcolumn title) rather than a position. */
  labelled: boolean
  group: string
  sex: string | null
  /** Sex came from the sheet title ("… Males …"), which beats a group title. */
  sexFromSheet: boolean
  time: string | null
  axis: string | number | null
  axisKind: AxisKind | null
  measure: string
  value: number
  /** Index of the Prism table the value came from (repeats within one table are averaged). */
  table: number
}

interface Context {
  measure: string
  time: string | null
  /** Sex stated in the sheet title. */
  sex: string | null
  layout: 'animals' | 'trials'
  /** Prism row numbers of the rows (1-based), used to name animals without an ID. */
  rowNumbers?: number[]
  /** Index of the table, so repeats within it are averaged rather than treated as copies. */
  table?: number
}

const TRIAL_TITLE = /^(?:trial|t|run)\s*[-_#]?\s*(\d+)$/i
const isText = (s: string | null | undefined): s is string => Boolean(s) && parseNumber(s!) === null

function blockRecords(blocks: Block[], rowLabels: (string | null)[], ctx: Context): RecordRow[] {
  const out: RecordRow[] = []
  // Prism row titles label the whole row. They identify an animal only when the
  // row holds values for a single group (one row per animal).
  // (Blocks of one group in different arena zones count as one group.)
  const groupOf = (b: Block) => {
    const p = parseGroupTitle(b.title)
    return `${p.group}\u0000${p.sex ?? ''}`
  }
  const groupsInRow = rowLabels.map((_, i) => new Set(blocks.filter((b) => b.values[i]?.some((v) => v !== null)).map(groupOf)).size)
  // When other rows have animal IDs, a value in a row without one can't be matched to an animal.
  const labelledTable = rowLabels.some((l) => isText(l))
  for (const b of blocks) {
    const parsed = parseGroupTitle(b.title)
    const group = parsed.group
    const measure = zonedMeasure(ctx.measure, parsed.zone)
    const sex = ctx.sex ?? parsed.sex
    const sexFromSheet = Boolean(ctx.sex)
    const tag = `${group}${sex ? ' ' + sex : ''}`
    const reps = Math.max(0, ...b.values.map((r) => r.length))
    // Subcolumns titled "Trial 1", "T2"… are trials; otherwise they are repeated
    // measurements of the same animal (e.g. two sessions near the target age) and are averaged.
    const trialNo = (k: number) => {
      const m = TRIAL_TITLE.exec((b.subTitles?.[k] ?? '').trim())
      return m ? Number(m[1]) : null
    }
    const subsAreTrials = reps > 1 && Array.from({ length: reps }, (_, k) => trialNo(k)).some((x) => x !== null)
    b.values.forEach((row, i) => {
      const label = rowLabels[i]
      row.forEach((v, k) => {
        if (v === null) return
        const base = { group, sex, sexFromSheet, time: ctx.time, measure, value: v, table: ctx.table ?? 0 }
        if (ctx.layout === 'animals') {
          if (labelledTable && !label) return
          const labelled = isText(label) && groupsInRow[i] <= 1
          const id = !label ? `${tag} #${ctx.rowNumbers?.[i] ?? i + 1}` : !isText(label) ? `${tag} #${label}` : groupsInRow[i] > 1 ? `${tag} ${label}` : label
          // An interval in the group title is the ordered axis; its subcolumns are repeats to average.
          if (parsed.interval !== null) {
            out.push({ ...base, measure: intervalMeasure(measure), animal: id, labelled, axis: parsed.interval, axisKind: 'trial' })
            return
          }
          const axisKind: AxisKind | null = reps > 1 ? (subsAreTrials ? 'trial' : 'replicate') : null
          out.push({ ...base, animal: id, labelled, axis: axisKind ? (subsAreTrials ? (trialNo(k) ?? k + 1) : k + 1) : null, axisKind })
        } else {
          const sub = b.subTitles?.[k]
          const labelled = isText(sub)
          const axis = label ? (parseNumber(label) ?? label) : i + 1
          out.push({ ...base, animal: labelled ? sub!.trim() : `${tag} #${k + 1}`, labelled, axis, axisKind: 'row' })
        }
      })
    })
  }
  return out
}

function axisColumn(kind: AxisKind): string {
  if (kind === 'row') return program().rowAxis
  return kind === 'trial' ? (program().trialColumn ?? 'Trial') : 'Replicate'
}

/** "Resting time v interval" → "Resting time per interval" */
function intervalMeasure(measure: string): string {
  const base = measure.replace(/\s*\bv(s)?\.?\s+intervals?\b/i, '').replace(/\s*\bper\s+interval\b/i, '').trim()
  return `${base} per interval`
}

/**
 * Joins records into one table: one row per animal × time × trial, one column
 * per measure. Animals with a real ID are matched across tables by that ID, so
 * pooled and per-sex copies of the same data are combined rather than counted twice.
 */
function recordsToSheet(records: RecordRow[], file: string, notes: string[]): RawSheet {
  const kinds = (['trial', 'replicate', 'row'] as AxisKind[]).filter((k) => records.some((r) => r.axisKind === k))
  const axisCols = kinds.map(axisColumn).filter((c, i, a) => a.indexOf(c) === i)
  const hasSex = records.some((r) => r.sex)
  const hasTime = records.some((r) => r.time)
  // A "Time point" row axis (CatWalk) folds into the time column.
  const sameCol = hasTime && axisCols.includes('Time point')
  const extra = axisCols.filter((c) => !(sameCol && c === 'Time point'))
  const measures: string[] = []
  for (const r of records) if (!measures.includes(r.measure)) measures.push(r.measure)
  const headers = ['Animal', 'Group', ...(hasSex ? ['Sex'] : []), ...(hasTime ? ['Time point'] : []), ...extra, ...measures]
  const col = (h: string) => headers.indexOf(h)
  const rows = new Map<string, Cell[]>()
  const sexSure = new Map<string, boolean>()
  // Labelled animals: ID × time × trial → keys of rows already made (one per sex stated by a sheet).
  const byId = new Map<string, string[]>()
  let repeated = 0
  let conflicts = 0
  const sums = new Map<string, { s: number; n: number; table: number }>()
  const groupConflicts = new Map<string, Set<string>>()
  for (const r of records) {
    const axisCol = r.axisKind ? axisColumn(r.axisKind) : null
    const time = sameCol && axisCol === 'Time point' ? [r.time, r.axis].filter((x) => x !== null).join(', ') : r.time
    const axisKey = axisCol && !(sameCol && axisCol === 'Time point') ? `${axisCol}=${r.axis}` : ''
    let key: string
    if (r.labelled) {
      // The same ID in a male and a female sheet is two animals; a pooled sheet (no sex in its
      // title) joins whichever row matches, using its group-title sex only to break a tie.
      const idKey = [r.animal.toLowerCase(), time, axisKey].join('\u0000')
      const existing = byId.get(idKey) ?? []
      const sexKey = (k: string) => rows.get(k)![col('Sex')] ?? null
      let match: string | undefined
      if (r.sexFromSheet) match = existing.find((k) => !hasSex || sexKey(k) === r.sex || !sexSure.get(k))
      else match = existing.length === 1 ? existing[0] : (existing.find((k) => sexKey(k) === r.sex) ?? existing[0])
      key = match ?? `${idKey}\u0000${existing.length}`
      if (!match) byId.set(idKey, [...existing, key])
    } else key = [`pos:${r.animal}`, r.group, r.sex, time, axisKey].join('\u0000')
    let row = rows.get(key)
    if (!row) {
      row = new Array<Cell>(headers.length).fill(null)
      row[0] = r.animal
      row[1] = r.group
      if (hasTime) row[col('Time point')] = time
      if (axisKey) row[col(axisCol!)] = r.axis
      rows.set(key, row)
    } else if (row[1] !== r.group) {
      const set = groupConflicts.get(r.animal) ?? new Set<string>([String(row[1])])
      set.add(r.group)
      groupConflicts.set(r.animal, set)
    }
    if (hasSex && r.sex && (!row[col('Sex')] || (r.sexFromSheet && !sexSure.get(key)))) {
      row[col('Sex')] = r.sex
      if (r.sexFromSheet) sexSure.set(key, true)
    }
    const mi = headers.length - measures.length + measures.indexOf(r.measure)
    const prev = row[mi]
    const cell = `${key}\u0000${mi}`
    const acc = sums.get(cell)
    if (prev === null) {
      row[mi] = r.value
      sums.set(cell, { s: r.value, n: 1, table: r.table })
    } else if (acc && acc.table === r.table) {
      // Another value for the same animal and interval in the same table (e.g. a second test date): average
      acc.s += r.value
      acc.n++
      row[mi] = +(acc.s / acc.n).toFixed(6)
    } else {
      repeated++
      if (typeof prev === 'number' && Math.abs(prev - r.value) > 1e-9 * Math.max(1, Math.abs(prev))) conflicts++
    }
  }
  if (repeated)
    notes.push(
      `${file}: ${repeated} value${repeated === 1 ? '' : 's'} appeared in more than one table (e.g. pooled and per-sex sheets) and ${repeated === 1 ? 'was' : 'were'} counted once, matched by animal ID and timepoint.${conflicts ? ` ${conflicts} of them differed between tables; the first table's value was kept, so check those sheets.` : ''}`,
    )
  if (groupConflicts.size) {
    const ex = [...groupConflicts].slice(0, 3).map(([id, gs]) => `${id}: ${[...gs].join(' / ')}`)
    notes.push(
      `${file}: ${groupConflicts.size} animal${groupConflicts.size === 1 ? ' is' : 's are'} listed under different groups in different tables (${ex.join('; ')}${groupConflicts.size > 3 ? '; …' : ''}). The group from the sex-specific table was kept; merge or exclude groups under Setup if they should be analysed together.`,
    )
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
    sex: string | null
    blocks: Block[]
    rowLabels: (string | null)[]
    rowNumbers: number[]
    xy: boolean
  }
  const sheets: SheetData[] = []
  const notes: string[] = []
  const noteSeen = new Set<string>()
  for (const id of sheetIds) {
    const sheet = json(`data/sheets/${id}/sheet.json`)
    const table = sheet?.table as Json | undefined
    if (!sheet || !table) continue
    const csv = zip[`data/tables/${uid(table)}/data.csv`]
    if (!csv) continue
    const title = text(sheet.title) || `Data ${sheets.length + 1}`
    // Floating notes on the sheet (e.g. "X and Y were necropsied the day before") are passed on.
    for (const k of Object.keys(zip).filter((k) => k.startsWith(`data/sheets/${id}/floating_notes/`) && k.endsWith('.json'))) {
      const t = text(json(k)?.text).replace(/\s+/g, ' ').trim()
      if (t && !noteSeen.has(t)) {
        noteSeen.add(t)
        notes.push(`${file}, note on "${title}": ${t}`)
      }
    }
    const reps = Math.max(1, Number(table.replicatesCount) || 1)
    const setIds = Array.isArray(table.dataSets) ? table.dataSets.map(uid) : []
    const titles = setIds.map((s, i) => text(json(`data/sets/${s}.json`)?.title) || `Group ${i + 1}`)
    // Subcolumn titles (ear tags in per-animal XY sheets, or "Trial 1"…), keyed by data set and replicate.
    const subTitle = new Map<string, string>()
    const subSet = typeof table.subcolumnTitlesDataSet === 'string' ? json(`data/sets/${table.subcolumnTitlesDataSet}.json`) : null
    if (Array.isArray(subSet?.titles))
      for (const c of subSet.titles as Json[])
        if (Array.isArray(c.replicates)) for (const r of c.replicates as Json[]) subTitle.set(`${c.column}:${r.replicate}`, text(r.name).trim())
    const grid = Papa.parse<string[]>(strFromU8(csv), { skipEmptyLines: false }).data
    const cell = (s: string | undefined) => {
      const t = (s ?? '').trim()
      return t === '' || MISSING.test(t) ? null : t
    }
    const width = Math.max(0, ...grid.map((r) => r.length))
    const offset = width === titles.length * reps ? 0 : 1
    let body = grid.filter((r) => r.slice(offset).some((c) => cell(c) !== null))
    // A header row of column titles, if the CSV has one
    if (body.length && body[0].slice(offset).some((c) => cell(c) !== null && parseNumber(c) === null) && body.slice(1).some((r) => r.slice(offset).some((c) => parseNumber(c ?? '') !== null)))
      body = body.slice(1)
    const blocks: Block[] = titles.map((t, g) => ({
      title: t,
      values: body.map((r) => Array.from({ length: reps }, (_, k) => parseNumber(cell(r[offset + g * reps + k]) ?? '') ?? null)),
      subTitles: subTitle.size ? Array.from({ length: reps }, (_, k) => subTitle.get(`${g}:${k}`) || null) : undefined,
    }))
    const split = splitSheetTitle(title)
    sheets.push({
      title,
      ...split,
      blocks,
      rowLabels: body.map((r) => (offset ? cell(r[0]) : null)),
      rowNumbers: body.map((r) => grid.indexOf(r) + 1),
      xy: table.format === 'xy' || /xy/i.test(String(table['@class'] ?? '')),
    })
  }
  if (!sheets.length) throw new Error(`${file}: no data tables found in this Prism file.`)

  // Files with age-binned sheets often also hold per-animal master sheets ("Males",
  // "Females", "all ages") that repeat the same values; those are skipped.
  const timed = sheets.filter((s) => s.time)
  const timedMeasures = new Set(timed.map((s) => normalizeKey(s.measure)))
  const skipped = timed.length
    ? sheets.filter((s) => !s.time && (!s.measure || MASTER_SHEET.test(s.measure) || timedMeasures.has(normalizeKey(s.measure))))
    : []
  if (skipped.length)
    notes.unshift(
      `${file}: skipped ${skipped.length} sheet${skipped.length === 1 ? '' : 's'} without an age or time window in the title (${skipped.map((s) => `"${s.title}"`).join(', ')}), because they repeat the values of the age-binned sheets.${skipped.some((s) => s.xy) ? ' (Per-animal XY sheets with exact ages are not used yet.)' : ''}`,
    )
  // Within-session interval sheets ("Resting time v interval", groups "… interval 1…4") give habituation curves.
  const intervals = sheets.filter((s) => !skipped.includes(s) && s.blocks.some((b) => parseGroupTitle(b.title).interval !== null))
  if (intervals.length)
    notes.push(
      `${file}: read ${intervals.length} within-session interval sheet${intervals.length === 1 ? '' : 's'} (${intervals.map((s) => `"${s.title}"`).join(', ')}) as values per ${(program().trialColumn ?? 'trial').toLowerCase()}, for habituation curves and first-to-last change.`,
    )
  // Sheets that state one sex come first, so their sex labels and values take precedence over pooled sheets.
  const used = sheets.filter((s) => !skipped.includes(s)).sort((a, b) => Number(!a.sex) - Number(!b.sex))
  const generic = used.filter((s) => !s.measure || GENERIC_SHEET.test(s.measure))
  const records: RecordRow[] = []
  let anyTrials = false
  for (const s of used) {
    const layout: 'animals' | 'trials' = opts.prismLayout === 'animals' || opts.prismLayout === 'trials' ? opts.prismLayout : s.xy ? 'trials' : 'animals'
    if (layout === 'trials') anyTrials = true
    const measure = !s.measure || GENERIC_SHEET.test(s.measure) ? (generic.length > 1 && s.measure ? `${baseName(file)} (${s.measure})` : baseName(file)) : s.measure
    records.push(...blockRecords(s.blocks, s.rowLabels, { measure, time: s.time, sex: s.sex, layout, rowNumbers: s.rowNumbers, table: sheets.indexOf(s) }))
  }
  if (!records.length) throw new Error(`${file}: the Prism data tables are empty.`)
  // Rows with values but no animal ID in a table where other rows have IDs are usually a deleted or missing label.
  const unlabelled: string[] = []
  for (const s of used) {
    if (s.xy || !s.rowLabels.some((l) => isText(l))) continue
    s.rowLabels.forEach((l, i) => {
      if (!l && s.blocks.some((b) => b.values[i]?.some((v) => v !== null))) unlabelled.push(`"${s.title}" row ${s.rowNumbers[i]}`)
    })
  }
  if (unlabelled.length)
    notes.push(
      `${file}: ${unlabelled.length} row${unlabelled.length === 1 ? ' has' : 's have'} values but no animal ID (${unlabelled.slice(0, 4).join('; ')}${unlabelled.length > 4 ? '; …' : ''}). They were left out because they can't be matched to an animal; add the ear tag in Prism to include them.`,
    )
  // Group titles often carry a hand-typed "n=" that goes stale as animals are added or removed.
  const stale: string[] = []
  for (const s of used) {
    if (s.xy) continue
    for (const b of s.blocks) {
      const stated = /\bn\s*=\s*(\d+)/i.exec(b.title)
      if (!stated) continue
      const actual = b.values.filter((row) => row.some((v) => v !== null)).length
      if (actual !== Number(stated[1])) stale.push(`"${s.title}" › ${b.title.trim()} holds ${actual}`)
    }
  }
  if (stale.length)
    notes.push(
      `${file}: ${stale.length} group title${stale.length === 1 ? '' : 's'} state an n that differs from the number of animals in the table (${stale.slice(0, 4).join('; ')}${stale.length > 4 ? '; …' : ''}). The app counts the animals actually present; update the titles in Prism if they are used in figures.`,
    )
  const reps = records.some((r) => r.axisKind === 'replicate')
  const trials = records.some((r) => r.axisKind === 'trial')
  notes.splice(
    skipped.length ? 1 : 0,
    0,
    anyTrials
      ? `${file}: read ${used.length} Prism table${used.length === 1 ? '' : 's'} with rows as ${program().rowAxis.toLowerCase()}s and subcolumns as animals. If rows are animals instead, change "Prism tables" on the start screen and add the file again.`
      : `${file}: read ${used.length} Prism table${used.length === 1 ? '' : 's'} with rows as animals${trials ? ' and subcolumns as trials' : ''}.${reps ? ' Values in several subcolumns of the same animal (e.g. two sessions near the target age) are averaged.' : ''}`,
  )
  return [recordsToSheet(records, file, notes)]
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
  /** ISO date of a date-headed column (a weigh-in), for programs that read those. */
  date?: string
  measure: string
}

/** Wide layout: one column per trial, day or time bin → one row per animal × trial. */
function meltWide(t: ParsedTable): ParsedTable | null {
  if (t.headers.some((h) => roleOf(h) === 'run')) return null
  const dateCol = program().dateColumn
  const parse = (h: string, i: number): WideCol | null => {
    if (numericShare(t, i) < 0.8) return null
    const name = h.trim()
    if (dateCol) {
      const day = parseDay(name)
      if (day !== null) return { i, day: null, trial: null, bin: null, date: new Date(day * 864e5).toISOString().slice(0, 10), measure: '' }
    }
    let m = TRIAL_COL.exec(name)
    if (m) return { i, day: m[1] ? +m[1] : null, trial: +m[2], bin: null, measure: m[3] }
    m = BIN_COL.exec(name)
    if (m && (m[3] || /^\d+(\.\d+)?\s*(-|–|to)\s*\d+(\.\d+)?$/.test(name))) return { i, day: null, trial: null, bin: `${m[1]}–${m[2]} ${m[3] ? m[3].replace(/^(m|mins|minutes)$/i, 'min').replace(/^(secs?|seconds)$/i, 's') : 'min'}`, measure: m[4] }
    m = DAY_COL.exec(name)
    if (m) return { i, day: +m[1], trial: null, bin: null, measure: m[2] }
    return null
  }
  let cols = t.headers.map(parse).filter((c): c is WideCol => c !== null)
  // Date-headed columns are weigh-ins only when every value is positive (a sheet of
  // z-scores with the same dates is not).
  if (cols.some((c) => c.date) && cols.some((c) => c.date && t.rows.some((r) => r[c.i] !== null && !(Number(r[c.i]) > 0)))) cols = cols.filter((c) => !c.date)
  if (cols.length < 2) return null
  const keep = t.headers.map((_, i) => i).filter((i) => !cols.some((c) => c.i === i))
  const measureName = (c: WideCol) => (!c.measure || isUnitsOnly(c.measure) ? program().primaryColumn : c.measure.trim())
  const measures: string[] = []
  for (const c of cols) if (!measures.includes(measureName(c))) measures.push(measureName(c))
  const hasDay = cols.some((c) => c.day !== null)
  const hasTrial = cols.some((c) => c.trial !== null)
  const hasBin = cols.some((c) => c.bin !== null)
  const hasDate = cols.some((c) => c.date)
  const trialName = program().trialDerived?.length ? (program().trialColumn ?? 'Trial') : 'Replicate'
  const headers = [...keep.map((i) => t.headers[i]), ...(hasDay ? ['Day'] : []), ...(hasTrial ? [trialName] : []), ...(hasBin ? ['Time bin'] : []), ...(hasDate ? [dateCol!] : []), ...measures]
  const rows: Cell[][] = []
  for (const r of t.rows) {
    const byPos = new Map<string, Cell[]>()
    for (const c of cols) {
      if (r[c.i] === null) continue
      const pos = `${c.day}|${c.trial}|${c.bin}|${c.date}`
      let row = byPos.get(pos)
      if (!row) {
        row = [
          ...keep.map((i) => r[i]),
          ...(hasDay ? [c.day === null ? null : `Day ${c.day}`] : []),
          ...(hasTrial ? [c.trial] : []),
          ...(hasBin ? [c.bin] : []),
          ...(hasDate ? [c.date ?? null] : []),
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
  for (const b of blocks) {
    b.values = rows.map((r) => colsOf.get(b)!.map((i) => toNumber(r[i])))
    if (subHeader) b.subTitles = colsOf.get(b)!.map((i) => (typeof first[i] === 'string' ? (first[i] as string).trim() : null))
  }
  const labels = rows.map((r) => (labelCol >= 0 && r[labelCol] !== null ? String(r[labelCol]).trim() : null))
  const title = t.sheet && !GENERIC_SHEET.test(t.sheet.trim()) ? t.sheet : baseName(t.file)
  const { measure, time, sex } = splitSheetTitle(title)
  const layout: 'animals' | 'trials' = opts.prismLayout === 'trials' ? 'trials' : 'animals'
  const records = blockRecords(blocks, labels, { measure: measure || baseName(t.file), time, sex, layout })
  if (!records.length) return null
  const sheet = recordsToSheet(records, t.file, [])
  const [headers, ...body] = sheet.cells
  return { file: t.file, sheet: t.sheet, headerRow: 0, headers: headers.map(String), rows: body }
}
