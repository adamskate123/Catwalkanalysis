// Weight Lab: body weight over time from a colony weight log (one row per animal,
// one column per weigh-in date, or one row per weigh-in). Groups are compared with
// the control group at each week of age, and every weigh-in is compared with a
// reference strain (C57BL/6J by default) of the same sex and age.

import { BODY_WEIGHT, matchByParams, metaRole as genericMetaRole, type MetaRole, type ParamDef } from '../lib/catalog'
import { gauss, rng } from '../lib/demo'
import type { Domain } from '../lib/interpret'
import { parseDay, type Cell, type ParsedTable, type RawSheet } from '../lib/parse'
import { C57BL6J, referenceAt, referenceFromTable, sexOf, type WeightReference } from '../lib/weightRef'
import type { ProgramDef } from './index'

export const WEIGH_DATE_COL = 'Weigh date'
export const AGE_DAYS_COL = 'Age (d)'
export const WEEK_COL = 'Age (weeks)'
export const Z_COL = 'Weight z vs reference (SD)'
export const PCT_COL = 'Weight, % of reference'

const PARAMS: ParamDef[] = [
  {
    ...BODY_WEIGHT,
    description: 'Body weight at each weigh-in (the mean when an animal was weighed more than once in the same week or window).',
  },
  {
    id: 'weight_z',
    label: 'Weight z-score vs reference',
    short: 'z vs ref',
    unit: 'SD',
    category: 'reference',
    perPaw: false,
    match: /^weightzvsreference/,
    description:
      "How far each weigh-in sits from the reference strain's mean for the same sex and week of age, in reference standard deviations: (weight − reference mean) ÷ reference SD. It removes the effect of sex and age, so groups with different sex mixes can be compared. z ≤ −2 is roughly the bottom 2.5% of the reference colony.",
    down: 'Lighter than the reference strain at the same age: growth restriction, failure to thrive or weight loss (or a lighter genetic background).',
    up: 'Heavier than the reference strain at the same age.',
    noWeightAdjust: true,
    noPercent: true,
  },
  {
    id: 'weight_pct_ref',
    label: 'Weight, % of reference mean',
    short: '% of ref',
    unit: '%',
    category: 'reference',
    perPaw: false,
    match: /^weightofreference$/,
    description: "Each weigh-in as a percentage of the reference strain's mean for the same sex and week of age (100% = the reference mean).",
    down: 'Below the reference mean.',
    up: 'Above the reference mean.',
    noWeightAdjust: true,
  },
]

const CATEGORY_LABELS: Record<string, string> = {
  body: 'Body weight',
  reference: 'Compared with the reference strain',
  other: 'Other / unrecognised numeric columns',
}

const DOMAINS: Domain[] = [
  {
    id: 'wt_low',
    title: 'Low body weight / growth restriction',
    summary: 'Lighter than control, and below the reference strain for sex and age.',
    conditions:
      'Systemic or metabolic disease, feeding or swallowing difficulty, motor impairment that limits access to food and water, malabsorption, and many neurodevelopmental and neurodegenerative models; also a lighter genetic background.',
    meaning:
      'The animals weigh less than controls, and less than the sex- and age-matched reference strain. Weight that falls further behind over time points to an active disease process; a constant offset from birth suggests smaller size or background rather than decline. Check the z-score trajectory in the Reference strain tab.',
    followUp: [
      'Compare with littermate controls on the same genetic background; the reference strain is not background-matched.',
      'Track food intake and check access to food and water (gel diet, food on the cage floor).',
      'Body composition (EchoMRI or DEXA) to separate lean from fat mass.',
      'Apply your institution’s weight-loss humane endpoints; plot each animal against its own peak weight.',
    ],
    items: [
      { param: 'body_weight', where: 'run', dir: -1 },
      { param: 'weight_z', where: 'run', dir: -1 },
      { param: 'weight_pct_ref', where: 'run', dir: -1 },
    ],
  },
  {
    id: 'wt_high',
    title: 'Higher body weight than control',
    summary: 'Heavier than control and above the reference strain for sex and age.',
    conditions: 'Obesity or metabolic models, hypothalamic or endocrine dysfunction, reduced activity, or a heavier genetic background.',
    meaning: 'The animals weigh more than controls and more than the sex- and age-matched reference strain.',
    followUp: ['Body composition (EchoMRI or DEXA).', 'Food intake, activity (open field or home-cage running) and glucose tolerance.'],
    items: [
      { param: 'body_weight', where: 'run', dir: 1 },
      { param: 'weight_z', where: 'run', dir: 1 },
      { param: 'weight_pct_ref', where: 'run', dir: 1 },
    ],
  },
]

function metaRole(name: string): MetaRole | null | undefined {
  const n = name.trim()
  if (n === WEEK_COL || /^age\s*\((weeks?|wks?)\)$/i.test(n)) return 'time'
  if (n === SHEET_ID_COL) return 'other'
  // Each weigh-in is like a run: several in the same week are averaged per animal.
  if (n === WEIGH_DATE_COL || DATE.test(n)) return 'run'
  const g = genericMetaRole(n)
  if (g) return g
  // A weight log has many per-animal summary columns (latest weight, % change, flags…):
  // only recognised weight measures are analysed.
  return matchColumn(n) ? null : 'other'
}

function matchColumn(name: string) {
  return matchByParams(name.replace(/\((g|grams|sd|%)\)/gi, ''), PARAMS)
}

export const ANIMAL_COL = 'Animal'
export const SHEET_ID_COL = 'Animal ID (sheet)'
const TAG = /^(tag|ear ?tag|tag ?(number|no\.?|#)|litter( ?(id|no\.?|number))?)$/i
const MARK = /^((toe|ear)\s*(\/\s*(toe|ear))?\s*(mark|notch|punch|clip)s?|mark(ing)?)$/i

/**
 * Colony logs often reuse short IDs across litters ("RF" in two litters). When an ID
 * belongs to more than one tag + mark, animals are identified by tag + mark instead
 * (e.g. "L2.1 RF"), the form CatWalk animal keys use; the sheet's ID is kept.
 */
function prepare(t: ParsedTable): { table: ParsedTable; notice?: string } {
  const si = t.headers.findIndex((h) => genericMetaRole(h) === 'subject')
  const ti = t.headers.findIndex((h) => TAG.test(h.trim()))
  const mi = t.headers.findIndex((h) => MARK.test(h.trim()))
  if (si < 0 || ti < 0 || mi < 0) return { table: t }
  const text = (c: Cell) => (c === null ? '' : String(c).trim())
  const owners = new Map<string, Set<string>>()
  for (const r of t.rows) {
    const id = text(r[si])
    if (!id) continue
    owners.set(id, (owners.get(id) ?? new Set()).add(`${text(r[ti])} ${text(r[mi])}`))
  }
  const repeated = [...owners].filter(([, s]) => s.size > 1)
  if (!repeated.length) return { table: t }
  const headers = t.headers.map((h, i) => (i === si ? SHEET_ID_COL : h))
  headers.push(ANIMAL_COL)
  const rows = t.rows.map((r) => [...r, text(r[ti]) && text(r[mi]) ? `${text(r[ti])} ${text(r[mi])}` : text(r[si]) || null])
  const eg = repeated[0]
  return {
    table: { ...t, headers, rows },
    notice: `Animal IDs repeat across litters (e.g. ${eg[0]} is ${[...eg[1]].join(' and ')}), so animals are identified by ${t.headers[ti]} + ${t.headers[mi]} (e.g. ${[...eg[1]][0]}). The sheet's IDs are kept as "${SHEET_ID_COL}".`,
  }
}

const DOB = /^(dob|d\.?o\.?b\.?|date of birth|birth ?date|birthday|born)$/i
const DATE = /^(weigh(ing)?[- ]?(in )?date|date( weighed)?|weighed on)$/i

/**
 * Adds age at each weigh-in, its week of age (the timepoint), and the z-score and
 * % of the reference mean for the animal's sex at that week.
 */
function augment(headers: string[], rows: Cell[][], references: ParsedTable[]): { notices: string[]; reference: WeightReference | null } {
  const notices: string[] = []
  const find = (re: RegExp) => headers.findIndex((h) => re.test(h.trim()))
  const wi = headers.findIndex((h) => matchColumn(h)?.paramId === 'body_weight')
  const sexi = headers.findIndex((h) => genericMetaRole(h) === 'sex')
  const dobi = find(DOB)
  const datei = headers.indexOf(WEIGH_DATE_COL) >= 0 ? headers.indexOf(WEIGH_DATE_COL) : find(DATE)
  const fromFile = references.map((t) => referenceFromTable(t, t.title)).find((r): r is WeightReference => r !== null)
  const ref = fromFile ?? C57BL6J
  if (wi < 0) return { notices, reference: ref }

  const ages = rows.map((r) => {
    const birth = dobi >= 0 ? parseDay(r[dobi]) : null
    const day = datei >= 0 ? parseDay(r[datei]) : null
    return birth !== null && day !== null && day >= birth ? day - birth : null
  })
  if (!headers.includes(AGE_DAYS_COL) && ages.some((a) => a !== null)) {
    headers.push(AGE_DAYS_COL, WEEK_COL)
    rows.forEach((r, i) => r.push(ages[i], ages[i] === null ? null : `Week ${Math.round(ages[i]! / 7)}`))
  }
  let scored = 0
  let outside = 0
  let noSex = 0
  const z: Cell[] = []
  const pct: Cell[] = []
  rows.forEach((r, i) => {
    const w = typeof r[wi] === 'number' ? (r[wi] as number) : Number(r[wi])
    const sex = sexi >= 0 ? sexOf(r[sexi]) : null
    const age = ages[i]
    const at = age !== null && Number.isFinite(w) && w > 0 ? referenceAt(ref, sex, age) : null
    if (at) {
      scored++
      z.push((w - at.mean) / at.sd)
      pct.push((w / at.mean) * 100)
    } else {
      if (age !== null && Number.isFinite(w) && w > 0) {
        if (!sex) noSex++
        else outside++
      }
      z.push(null)
      pct.push(null)
    }
  })
  if (scored) {
    headers.push(Z_COL, PCT_COL)
    rows.forEach((r, i) => r.push(z[i], pct[i]))
  }
  const weeks = ref.weeks.map((w) => w.week)
  const withAge = ages.filter((a) => a !== null).length
  notices.push(
    withAge
      ? `${withAge} weigh-ins with an age (from date of birth and weigh date); timepoints are weeks of age. ${scored} compared with ${ref.name}${fromFile ? ' (reference table in the file)' : ''}, matched for sex and age to the nearest week (weeks ${Math.min(...weeks)}-${Math.max(...weeks)}).` +
          (outside ? ` ${outside} fall outside those weeks and have no reference comparison.` : '') +
          (noSex ? ` ${noSex} have no sex recorded and have no reference comparison.` : '')
      : 'No age at weighing: add a date-of-birth column (DOB) and weigh dates to get weeks of age and the reference comparison.',
  )
  return { notices, reference: ref }
}

/** A simulated colony weight log: one row per animal, one column per weekly weigh-in. */
function demo(seed = 11): RawSheet {
  const r = rng(seed)
  const n = (sd: number) => gauss(r) * sd
  const start = Date.UTC(2026, 6, 1) / 864e5
  const iso = (d: number) => new Date(d * 864e5).toISOString().slice(0, 10)
  const dates = Array.from({ length: 10 }, (_, k) => start + 7 * k)
  const rows: Cell[][] = []
  let a = 0
  for (const group of ['WT', 'Mutant']) {
    for (const sex of ['Male', 'Female']) {
      for (let k = 0; k < 8; k++) {
        a++
        const dob = start - 28 - (k % 3) * 3
        const ref = C57BL6J.weeks
        const size = 1 + n(0.06)
        const cells: Cell[] = [`${group === 'WT' ? 'W' : 'M'}${String(a).padStart(2, '0')}`, sex, group, iso(dob)]
        for (const d of dates) {
          const week = Math.round((d - dob) / 7)
          const row = ref.find((x) => x.week === week)
          const mean = row ? (sex === 'Male' ? row.m!.mean : row.f!.mean) : NaN
          // Mutants fall progressively behind from about 6 weeks of age.
          const lag = group === 'Mutant' ? Math.max(0, week - 5) * 0.025 : 0
          cells.push(Number.isFinite(mean) ? +(mean * size * (1 - Math.min(lag, 0.18)) * (1 + n(0.02))).toFixed(1) : null)
        }
        rows.push(cells)
      }
    }
  }
  return {
    file: 'demo_weight_log.csv',
    sheet: '',
    cells: [['Colony weight log (DEMO — simulated data, not from a real study)'], [], ['Animal ID', 'Sex', 'Genotype', 'DOB', ...dates.map(iso)], ...rows],
  }
}

export const weight: ProgramDef = {
  id: 'weight',
  name: 'Weight Lab',
  test: 'body weight',
  instrument: 'Colony weight log',
  tagline: 'Body weight over time against controls and a reference strain',
  lede:
    'Load a colony weight log (Excel or CSV). Weight Lab works out each animal’s age at every weigh-in, compares groups with the control group week by week, and compares every weigh-in with a reference strain such as C57BL/6J of the same sex and age.',
  params: PARAMS,
  categoryLabels: CATEGORY_LABELS,
  categoryOrder: ['body', 'reference', 'other'],
  matchColumn,
  metaRole,
  domains: DOMAINS,
  runNoun: 'weigh-in',
  runsNoun: 'weigh-ins',
  demo: () => demo(),
  demoFile: 'demo_weight_log.csv',
  keyMinParams: 1,
  rowAxis: 'Weigh-in',
  primaryColumn: 'Body weight (g)',
  features: { speed: false, paws: false },
  filePrefix: 'weight',
  dateColumn: WEIGH_DATE_COL,
  prepare,
  augment,
  steps: [
    {
      title: 'Load the weight log',
      text: 'An Excel or CSV file with one row per animal (animal ID, sex, genotype or group, date of birth) and one column per weigh-in date, or one row per weigh-in with a date column. A sheet of reference weights (age in weeks, female and male mean and SD) in the same workbook replaces the built-in C57BL/6J table.',
    },
    {
      title: 'Check the setup',
      text: 'Weight Lab uses the genotype or group column for groups and the week of age for timepoints. Choose the control group, or switch timepoints to age windows (Setup → Age windows) to match other tests binned by age.',
    },
    {
      title: 'Read the results',
      text: 'Group differences at each week (body weight and z-score vs reference), the Reference strain tab with growth curves against the reference and one-sample tests of each group against it, and exports for Prism.',
    },
  ],
}
