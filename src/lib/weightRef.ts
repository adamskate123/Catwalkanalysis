// Reference body weights for a standard strain (mean ± SD by sex and week of age),
// and the per-weigh-in comparison against them (z-score and % of the mean).

import type { Cell, ParsedTable } from './parse'

export interface WeightReference {
  name: string
  source: string
  /** Rows by age in whole weeks. */
  weeks: { week: number; f: { mean: number; sd: number } | null; m: { mean: number; sd: number } | null }[]
}

/**
 * C57BL/6J (JAX stock 000664), weeks 3-24: mean ± SD of up to 120 females and 120
 * males per age, standard diet, ages ± 3 days. The Jackson Laboratory, "Body Weight
 * Info - B6J (000664)".
 */
export const C57BL6J: WeightReference = {
  name: 'C57BL/6J (JAX 000664)',
  source: 'The Jackson Laboratory, Body Weight Info - B6J (000664), https://www.jax.org/jax-mice-and-services/strain-data-sheet-pages/body-weight-chart-000664',
  weeks: (
    [
      [3, 10.1, 1.6, 10.1, 2.0],
      [4, 14.9, 1.6, 16.1, 2.7],
      [5, 17.4, 1.0, 19.2, 2.3],
      [6, 18.0, 1.0, 21.7, 2.0],
      [7, 18.9, 1.1, 23.4, 1.9],
      [8, 19.5, 1.2, 24.7, 1.8],
      [9, 20.0, 1.2, 26.1, 1.9],
      [10, 20.2, 1.2, 26.7, 2.0],
      [11, 21.1, 1.4, 28.2, 2.0],
      [12, 21.7, 1.5, 29.3, 2.3],
      [13, 22.1, 1.6, 29.8, 2.4],
      [14, 22.6, 1.7, 30.4, 2.5],
      [15, 22.9, 1.7, 31.2, 2.7],
      [16, 22.9, 1.8, 31.5, 2.4],
      [17, 23.6, 2.1, 32.2, 2.6],
      [18, 23.8, 2.1, 32.5, 2.8],
      [19, 24.2, 2.2, 32.9, 3.0],
      [20, 24.7, 2.5, 33.6, 3.0],
      [21, 24.5, 2.5, 34.1, 3.5],
      [22, 25.2, 2.7, 34.5, 3.6],
      [23, 25.4, 2.9, 34.9, 3.8],
      [24, 25.7, 3.0, 35.3, 3.9],
    ] as const
  ).map(([week, fm, fs, mm, ms]) => ({ week, f: { mean: fm, sd: fs }, m: { mean: mm, sd: ms } })),
}

const num = (c: Cell) => (typeof c === 'number' ? c : c !== null && String(c).trim() !== '' && Number.isFinite(Number(c)) ? Number(c) : NaN)

/** A sheet of reference weights: age in weeks, female and male mean and SD. */
export function referenceColumns(headers: string[]): { week: number; fm: number; fs: number; mm: number; ms: number } | null {
  const find = (re: RegExp) => headers.findIndex((h) => re.test(h.trim()))
  const week = find(/^age\s*\(?(weeks?|wks?)\)?$|^weeks?$/i)
  const fm = find(/^(female|f)\s*mean/i)
  const fs = find(/^(female|f)\s*(sd|s\.d\.|std)/i)
  const mm = find(/^(male|m)\s*mean/i)
  const ms = find(/^(male|m)\s*(sd|s\.d\.|std)/i)
  return week >= 0 && fm >= 0 && fs >= 0 && mm >= 0 && ms >= 0 ? { week, fm, fs, mm, ms } : null
}

export const isReferenceTable = (t: ParsedTable) => referenceColumns(t.headers) !== null

/** Reads a reference sheet; its name comes from the sheet's title line when there is one. */
export function referenceFromTable(t: ParsedTable, title?: string): WeightReference | null {
  const c = referenceColumns(t.headers)
  if (!c) return null
  const pair = (m: number, s: number) => (Number.isFinite(m) && Number.isFinite(s) && s > 0 ? { mean: m, sd: s } : null)
  const weeks = t.rows
    .map((r) => ({ week: num(r[c.week]), f: pair(num(r[c.fm]), num(r[c.fs])), m: pair(num(r[c.mm]), num(r[c.ms])) }))
    .filter((w) => Number.isInteger(w.week) && w.week > 0 && (w.f || w.m))
  if (weeks.length < 2) return null
  return { name: title?.trim() || `Reference from ${t.sheet || t.file}`, source: `${t.file}${t.sheet ? ` › ${t.sheet}` : ''}`, weeks }
}

/**
 * The reference mean and SD for a sex at an age: the age is rounded to the nearest
 * whole week and must match a week in the table exactly (no extrapolation).
 */
export function referenceAt(ref: WeightReference, sex: 'F' | 'M' | null, ageDays: number): { week: number; mean: number; sd: number } | null {
  if (!sex || !Number.isFinite(ageDays)) return null
  const week = Math.round(ageDays / 7)
  const row = ref.weeks.find((w) => w.week === week)
  const v = row?.[sex === 'F' ? 'f' : 'm']
  return v ? { week, ...v } : null
}

/** "Female", "F", "♀" → F; "Male", "M" → M. */
export function sexOf(c: Cell): 'F' | 'M' | null {
  const s = c === null ? '' : String(c).trim().toLowerCase()
  if (/^(f|female|fem|♀|w|woman)$/.test(s)) return 'F'
  if (/^(m|male|♂)$/.test(s)) return 'M'
  return null
}
