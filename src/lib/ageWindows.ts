// Age at test and age windows: each animal's age on the test day (from its date
// of birth and the test date) placed in windows the user sets, e.g. "≤50 days",
// "51-100 days" or "100 days (93-107)". The window becomes a timepoint column, so
// runs can be analysed by the instrument's own timepoints or by age windows that
// match other tests (rotarod, open field) binned by age.

import { roleOf } from '../programs'
import { AGE_AT_TEST_COL, parseDay, type Cell } from './parse'

export const AGE_WINDOW_COL = 'Age window'

export interface AgeWindowSettings {
  /** Bins: consecutive windows ending at each value. Targets: each value ± tolerance. */
  mode: 'bins' | 'targets'
  values: number[]
  /** Days either side of a target age (targets mode). */
  tolerance: number
  /** Dates of birth entered in the app (ISO date), by animal ID; they override the key. */
  birthDates?: Record<string, string>
  /** Test dates entered in the app (ISO date), by timepoint / session value ('' when there is none). */
  testDates?: Record<string, string>
}

/** A timepoint as written on an exported chart: age windows say "Age ≤50 days". */
export function timeCaption(timeCol: string | null, time: string): string {
  if (!time) return ''
  return timeCol === AGE_WINDOW_COL ? `Age ${time}` : time
}

export interface AgeWindow {
  label: string
  lo: number
  hi: number
  /** Target age (targets mode), to assign an age that falls in two windows to the nearer. */
  target?: number
}

/** What the age calculation found, for Setup → Age windows. */
export interface AgeInfo {
  /** Column whose values identify animals for the birth-date table. */
  idColumn: string
  ids: string[]
  /** Date of birth per ID from the loaded files (key), as ISO dates. */
  fileBirthDates: Record<string, string>
  /** Where the dates of birth, test dates and ages come from, in words. */
  dobSource: string | null
  testSource: string | null
  ageColumn: string | null
  /** Timepoint / session values that have no test date (enter them in Setup). */
  missingTestDates: string[]
  /** Runs with an age, runs in total, runs in a window (when windows are set). */
  aged: number
  total: number
  inWindow: number | null
}

const DOB = /^(dob|d\.?o\.?b\.?|date of birth|birth ?date|birthday|born)$/i
const TEST_DATE = /test(ing)? ?date|date (of )?test|date tested|test ?day|testdate|^weigh(ing)?[- ]?(in )?date$/i

export function windowsOf(s: Pick<AgeWindowSettings, 'mode' | 'values' | 'tolerance'>): AgeWindow[] {
  const vals = [...new Set(s.values.filter((v) => Number.isFinite(v) && v > 0))].sort((a, b) => a - b)
  if (!vals.length) return []
  if (s.mode === 'targets') {
    const tol = Math.max(0, s.tolerance)
    return vals.map((t) => ({ label: `${t} days (${fmt(t - tol)}-${fmt(t + tol)})`, lo: t - tol, hi: t + tol, target: t }))
  }
  const out: AgeWindow[] = [{ label: `≤${fmt(vals[0])} days`, lo: -Infinity, hi: vals[0] }]
  for (let i = 1; i < vals.length; i++) out.push({ label: `${fmt(vals[i - 1] + 1)}-${fmt(vals[i])} days`, lo: vals[i - 1], hi: vals[i] })
  out.push({ label: `>${fmt(vals[vals.length - 1])} days`, lo: vals[vals.length - 1], hi: Infinity })
  return out
}

const fmt = (n: number) => String(Math.round(n * 10) / 10)

/** The window an age falls in: bins are (lo, hi]; targets are [lo, hi], the nearer target winning. */
export function windowOf(age: number, windows: AgeWindow[]): AgeWindow | null {
  let best: AgeWindow | null = null
  for (const w of windows) {
    const inside = w.target === undefined ? age > w.lo && age <= w.hi : age >= w.lo && age <= w.hi
    if (!inside) continue
    if (!best || (w.target !== undefined && Math.abs(age - w.target) < Math.abs(age - best.target!))) best = w
  }
  return best
}

const text = (c: Cell) => (c === null ? '' : String(c).trim())
const iso = (day: number) => new Date(day * 864e5).toISOString().slice(0, 10)

/** "TBCD cohort 9-24-2026" → day of 9/24/2026: the date in an experiment name, as a last resort. */
function dateInText(c: Cell): number | null {
  const m = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(text(c))
  return m ? parseDay(`${m[1]}/${m[2]}/${m[3]}`) : null
}

/**
 * Adds "Age at test (d)" (when calculated from dates) and, with window settings,
 * "Age window" to the rows. `idHint` is the data column the animal key was
 * joined on, which holds the IDs people use (e.g. CatWalk trial names).
 */
export function addAgeColumns(
  headers: string[],
  rows: Cell[][],
  settings: AgeWindowSettings | undefined,
  idHint: string | undefined,
): { info: AgeInfo | null; valueOrder: Record<string, string[]>; notice: string | null } {
  const find = (re: RegExp) => headers.findIndex((h) => re.test(h.trim()))
  const role = (r: string) => headers.findIndex((h) => roleOf(h) === r)
  let idx = idHint ? headers.indexOf(idHint) : -1
  if (idx < 0) idx = role('subject')
  if (idx < 0) idx = role('trial')
  if (idx < 0) return { info: null, valueOrder: {}, notice: null }

  const dobi = find(DOB)
  const testi = find(TEST_DATE)
  const timei = headers.findIndex((h) => roleOf(h) === 'time' && h !== AGE_WINDOW_COL)
  const sessioni = headers.indexOf('Session')
  const slotOf = (r: Cell[]) => text(r[sessioni >= 0 ? sessioni : timei]) // timepoint / session label
  const expi = headers.findIndex((h) => /^experiment$/i.test(h.trim()))
  const agei = headers.findIndex((h) => /^age\b/i.test(h.trim()) && h !== AGE_AT_TEST_COL)

  const fileBirthDates: Record<string, string> = {}
  const ids = new Set<string>()
  for (const r of rows) {
    const id = text(r[idx])
    if (!id) continue
    ids.add(id)
    const d = dobi >= 0 ? parseDay(r[dobi]) : null
    if (d !== null && !fileBirthDates[id]) fileBirthDates[id] = iso(d)
  }
  const entered = settings?.birthDates ?? {}
  const dobOf = (id: string) => parseDay(entered[id] ?? fileBirthDates[id] ?? null)

  // Test date: a date in the timepoint column, a test-date column, a date entered per
  // timepoint/session, or a date in the experiment name.
  const sources = new Set<string>()
  const missing = new Set<string>()
  const testOf = (r: Cell[]): number | null => {
    const fromTime = timei >= 0 ? parseDay(r[timei]) : null
    if (fromTime !== null) return sources.add(`the ${headers[timei]} column`), fromTime
    const fromCol = testi >= 0 ? parseDay(r[testi]) : null
    if (fromCol !== null) return sources.add(`the ${headers[testi]} column`), fromCol
    const slot = slotOf(r)
    const typed = settings?.testDates?.[slot]
    if (typed && parseDay(typed) !== null) return sources.add('test dates entered in Setup'), parseDay(typed)
    const fromName = expi >= 0 ? dateInText(r[expi]) : null
    if (fromName !== null) return sources.add(`the date in the ${headers[expi]} name`), fromName
    missing.add(slot)
    return null
  }

  let computed = 0
  let fromColumn = 0
  const ages = rows.map((r) => {
    const id = text(r[idx])
    const dob = id ? dobOf(id) : null
    if (dob !== null) {
      const t = testOf(r)
      if (t !== null && t >= dob) {
        computed++
        return t - dob
      }
    }
    const a = agei >= 0 && r[agei] !== null && r[agei] !== '' ? Number(r[agei]) : NaN
    if (Number.isFinite(a)) {
      fromColumn++
      return a
    }
    return null
  })

  const valueOrder: Record<string, string[]> = {}
  if (computed > 0 && !headers.includes(AGE_AT_TEST_COL)) {
    headers.push(AGE_AT_TEST_COL)
    rows.forEach((r, i) => r.push(ages[i]))
  }
  let inWindow: number | null = null
  let notice: string | null = null
  const windows = settings ? windowsOf(settings) : []
  if (windows.length) {
    headers.push(AGE_WINDOW_COL)
    inWindow = 0
    rows.forEach((r, i) => {
      const w = ages[i] === null ? null : windowOf(ages[i]!, windows)
      if (w) inWindow!++
      r.push(w ? w.label : null)
    })
    valueOrder[AGE_WINDOW_COL] = windows.map((w) => w.label)
    const noAge = ages.filter((a) => a === null).length
    const outside = rows.length - inWindow - noAge
    notice =
      `Age windows: ${inWindow} of ${rows.length} runs fall in a window (${windows.map((w) => w.label).join(', ')}).` +
      (noAge ? ` ${noAge} have no age at test (no date of birth or test date) and are left out when timepoints are age windows.` : '') +
      (outside ? ` ${outside} lie outside every window and are left out.` : '')
  }
  const aged = ages.filter((a) => a !== null).length
  const dobSource = Object.keys(entered).length
    ? Object.keys(fileBirthDates).length
      ? `dates of birth entered in Setup and the ${headers[dobi]} column`
      : 'dates of birth entered in Setup'
    : dobi >= 0
      ? `the ${headers[dobi]} column`
      : null
  return {
    info: {
      idColumn: headers[idx],
      ids: [...ids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      fileBirthDates,
      dobSource,
      testSource: sources.size ? [...sources].join(' and ') : null,
      ageColumn: fromColumn > 0 && agei >= 0 ? headers[agei] : null,
      missingTestDates: [...missing].sort(),
      aged,
      total: rows.length,
      inWindow,
    },
    valueOrder,
    notice,
  }
}
