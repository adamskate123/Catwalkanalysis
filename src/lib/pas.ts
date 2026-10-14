// San Diego Instruments Photobeam Activity System (PAS) open field databases.
//
// PAS keeps everything in one Access database (.mdb): Sessions (one run of up to
// 8 chambers), SessionChambers (the animal and a free-text label per chamber),
// IntervalData (PAS's own beam-break counts per interval: fine and ambulatory,
// centre and periphery, rearing) and Activities (every beam event with its time
// in 0.1 s and the animal's beam position). PAS's data reduction (distance,
// resting, zones) is only stored for sessions someone reduced, so distance,
// resting time and centre measures are recalculated here from the beam events
// the way PAS does it. Checked against PAS's own reduced results: distance,
// resting time and centre entries match exactly, time in centre to 0.1 s.
//
// One row per animal × run × interval. Session totals repeat on each interval
// row (so the per-animal mean is the total); per-interval values feed the
// habituation curves. Runs that look wrong are flagged in a "Data check" column
// so they can be reviewed and excluded in Setup → Data checks.

import type { Cell, RawSheet } from './parse'
import { packEvents, type TrackSet } from './tracks'

export const PAS_GENOTYPE_COL = 'Genotype (PAS)'
export const PAS_SEX_COL = 'Sex (PAS)'
export const PAS_LABEL_COL = 'PAS label'
export const PAS_SESSION_COL = 'PAS session'
export const TEST_DATE_COL = 'Test date'
export const RECORDING_COL = 'Recording'
export const CHECK_COL = 'Data check'
export const CHECK_DEFAULT_COL = 'Data check default'
export const LABEL_SOURCE_COL = 'Label source'

/** Distance PAS counts for a move to the neighbouring beam (its data reduction reports 2.5 cm). */
export const BEAM_CM = 2.5
/** PAS's default resting threshold: a pause of at least this long counts as resting. */
export const DEFAULT_REST_S = 5

// Measures: [column name, per-interval column name]
const M = {
  distance: ['Distance moved (cm)', 'Distance moved (cm) per interval'],
  speed: ['Mean speed (cm/s)', 'Mean speed (cm/s) per interval'],
  rest: ['Resting time (s)', 'Resting time (s) per interval'],
  // Not "Time in centre": names starting with "Time" are read as timepoint columns.
  centreTime: ['Centre time (s)', 'Centre time (s) per interval'],
  centrePct: ['Centre time (%)', 'Centre time (%) per interval'],
  centreEntries: ['Centre entries', 'Centre entries per interval'],
  amb: ['Ambulatory counts', 'Ambulatory counts per interval'],
  ambCentre: ['Centre ambulatory counts', 'Centre ambulatory counts per interval'],
  ambPeriphery: ['Periphery ambulatory counts', 'Periphery ambulatory counts per interval'],
  fine: ['Fine movements', 'Fine movements per interval'],
  rear: ['Rearing counts', 'Rearing counts per interval'],
} as const
type MeasureId = keyof typeof M
const MEASURES = Object.keys(M) as MeasureId[]

export const PAS_HEADERS = [
  'Animal ID',
  PAS_GENOTYPE_COL,
  PAS_SEX_COL,
  PAS_LABEL_COL,
  TEST_DATE_COL,
  PAS_SESSION_COL,
  'Chamber',
  'Interval',
  RECORDING_COL,
  CHECK_COL,
  CHECK_DEFAULT_COL,
  ...MEASURES.map((m) => M[m][0]),
  ...MEASURES.map((m) => M[m][1]),
]

// ---------------------------------------------------------------------------
// Database contents

export interface PasSession {
  id: string
  status: string
  runDate: Date | null
  intervalSecs: number
  intervalsPerPhase: number
}

export interface PasChamber {
  session: string
  chamber: number
  subject: string | null
  label: string | null
}

export interface PasInterval {
  session: string
  chamber: number
  phase: number
  interval: number
  subject: string | null
  endState: number
  /** Start and end of the interval, 0.1 s. */
  start: number
  end: number
  cenF: number
  cenA: number
  perF: number
  perA: number
  rear: number
}

export interface PasDb {
  app: string
  xBeams: number
  yBeams: number
  sessions: PasSession[]
  chambers: PasChamber[]
  intervals: PasInterval[]
  /** Zone of each beam position ("x,y" → zone ID) for the centre/periphery map. */
  zones: Map<string, string>
  restSecs: number
  /** Ambulatory beam events per "session\u0000chamber": flat [t (0.1 s), x, y, interval, event number, …]. */
  events: Map<string, number[]>
  /** Rearing events per run: flat [t (0.1 s), x, y, …] (the animal's position when it reared). */
  rears?: Map<string, number[]>
  /** Beam events of any type read from the database. */
  eventCount: number
}

const runKey = (session: string, chamber: number) => `${session}\u0000${chamber}`

// ---------------------------------------------------------------------------
// Labels: "AA F", "WT M", "PA M " → genotype code and sex

export interface PasLabel {
  code: string
  sex: 'M' | 'F' | null
}

/** Splits a PAS chamber label into a genotype code and sex: "AA F" → AA, F; "AAF" → AA, F; "PHD" → PHD. */
export function parsePasLabel(raw: string | null): PasLabel | null {
  const s = (raw ?? '').trim().replace(/\s+/g, ' ')
  if (!s) return null
  let m = /^(.*\S)\s+(m|f|male|female)$/i.exec(s)
  if (!m) {
    // Sex written straight after the code ("AAF"), when the code keeps two characters or more
    const g = /^(\S{2,}?)(m|f)$/i.exec(s.replace(/\s+/g, ''))
    if (g && !/\s/.test(s)) m = g
  }
  const code = (m ? m[1] : s).replace(/\s+/g, '').toUpperCase()
  const sex = m ? (m[2][0].toUpperCase() as 'M' | 'F') : null
  return { code, sex }
}

/** Most frequent value; on a tie, the latest. */
function majority<T>(values: T[]): T | null {
  const n = new Map<T, number>()
  let best: T | null = null
  for (const v of values) {
    n.set(v, (n.get(v) ?? 0) + 1)
    if (best === null || n.get(v)! >= n.get(best)!) best = v
  }
  return best
}

// ---------------------------------------------------------------------------
// Beam events → distance, resting, centre

interface EventMeasures {
  distance: number
  rest: number
  centreTime: number
  centreEntries: number
}

/** The zone that holds the centre: the one zone none of whose cells lies on the arena edge. */
export function centreZone(zones: Map<string, string>, xBeams: number, yBeams: number): string | null {
  const edge = new Map<string, boolean>()
  for (const [xy, z] of zones) {
    const [x, y] = xy.split(',').map(Number)
    const onEdge = x <= 1 || y <= 1 || x >= xBeams || y >= yBeams
    edge.set(z, (edge.get(z) ?? false) || onEdge)
  }
  const inner = [...edge].filter(([, e]) => !e).map(([z]) => z)
  return inner.length === 1 ? inner[0] : null
}

/**
 * PAS's data reduction for one run, per interval: each step between consecutive
 * ambulatory events moves 2.5 cm per beam (Euclidean, rounded to 0.1 cm), a pause
 * of 5 s or more (split at interval boundaries) is resting, and centre time and
 * entries follow the zone of each event, a zone carried into the next interval
 * counting as a new entry.
 */
export function reduceEvents(
  ev: number[],
  bounds: Map<number, [number, number]>,
  zones: Map<string, string>,
  centre: string | null,
  restSecs: number,
): Map<number, EventMeasures> {
  // Sort by time, then event number
  const idx = Array.from({ length: ev.length / 5 }, (_, i) => i).sort((a, b) => ev[a * 5] - ev[b * 5] || ev[a * 5 + 4] - ev[b * 5 + 4])
  const byInterval = new Map<number, number[]>()
  for (const i of idx) {
    const k = ev[i * 5 + 3]
    if (!byInterval.has(k)) byInterval.set(k, [])
    byInterval.get(k)!.push(i)
  }
  const out = new Map<number, EventMeasures>()
  let px: number | null = null
  let py = 0
  let zone: string | null = null
  const restTenths = restSecs * 10
  for (const k of [...bounds.keys()].sort((a, b) => a - b)) {
    const [t0, t1] = bounds.get(k)!
    let distance = 0
    let rest = 0
    let centreTime = 0
    let entries = zone !== null && zone === centre ? 1 : 0
    let last = t0
    let zStart = t0
    for (const i of byInterval.get(k) ?? []) {
      const t = ev[i * 5]
      const x = ev[i * 5 + 1]
      const y = ev[i * 5 + 2]
      if (px !== null) distance += Math.round(Math.hypot((x - px) * BEAM_CM, (y - py) * BEAM_CM) * 10) / 10
      if (t - last >= restTenths) rest += t - last
      last = t
      px = x
      py = y
      const z = zones.get(`${x},${y}`) ?? null
      if (z !== zone) {
        if (zone !== null && zone === centre) centreTime += t - zStart
        if (z !== null && z === centre) entries++
        zone = z
        zStart = t
      }
    }
    if (t1 - last >= restTenths) rest += t1 - last
    if (zone !== null && zone === centre) centreTime += t1 - zStart
    out.set(k, { distance: Math.round(distance * 10) / 10, rest: rest / 10, centreTime: centreTime / 10, centreEntries: entries })
  }
  return out
}

// ---------------------------------------------------------------------------
// Rows and data checks

interface Run {
  session: PasSession
  chamber: number
  subject: string
  label: string | null
  parsed: PasLabel | null
  date: string
  intervals: PasInterval[]
  expected: number
  complete: boolean
  issues: string[]
  exclude: boolean
}

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '')
const fmt = (n: number) => n.toLocaleString('en-US')
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d

/** Turns the database contents into one table, with notes for the loader. */
export function pasSheet(db: PasDb, file: string): RawSheet {
  const notes: string[] = []
  const sessions = new Map(db.sessions.map((s) => [s.id, s]))
  const label = new Map(db.chambers.map((c) => [runKey(c.session, c.chamber), c]))
  const byRun = new Map<string, PasInterval[]>()
  for (const iv of db.intervals) {
    const k = runKey(iv.session, iv.chamber)
    if (!byRun.has(k)) byRun.set(k, [])
    byRun.get(k)!.push(iv)
  }

  const runs: Run[] = []
  let noSubject = 0
  for (const [k, list] of byRun) {
    const first = list[0]
    const session = sessions.get(first.session)
    if (!session) continue
    const ch = label.get(k)
    const subject = (first.subject ?? ch?.subject ?? '').trim()
    if (!subject) {
      noSubject++
      continue
    }
    const perPhase = Math.max(1, session.intervalsPerPhase)
    const ivs = list
      .map((iv) => ({ ...iv, interval: (Math.max(1, iv.phase) - 1) * perPhase + iv.interval }))
      .sort((a, b) => a.interval - b.interval)
    const phases = Math.max(...ivs.map((iv) => Math.max(1, iv.phase)))
    const expected = perPhase * phases
    const len = session.intervalSecs * 10
    const short = ivs.filter((iv) => iv.endState === 0 || iv.end - iv.start < len - 10)
    const complete = ivs.length >= expected && short.length === 0
    const issues: string[] = []
    if (!complete) {
      const done = ivs.length - short.length
      issues.push(`Run stopped early: ${done} of ${expected} intervals complete`)
    }
    const lbl = ch?.label?.trim() || null
    runs.push({
      session,
      chamber: first.chamber,
      subject,
      label: lbl,
      parsed: parsePasLabel(lbl),
      date: day(session.runDate),
      intervals: ivs,
      expected,
      complete,
      issues,
      exclude: !complete,
    })
  }
  runs.sort((a, b) => (a.session.runDate?.getTime() ?? 0) - (b.session.runDate?.getTime() ?? 0) || a.session.id.localeCompare(b.session.id) || a.chamber - b.chamber)

  // The same animal tested more than once on one day: keep the most complete, latest run.
  const byDay = new Map<string, Run[]>()
  for (const r of runs) {
    const k = `${r.subject.toLowerCase()}\u0000${r.date}`
    if (!byDay.has(k)) byDay.set(k, [])
    byDay.get(k)!.push(r)
  }
  let repeats = 0
  for (const list of byDay.values()) {
    if (list.length < 2) continue
    repeats++
    const keep = [...list].sort((a, b) => Number(b.complete) - Number(a.complete) || b.intervals.length - a.intervals.length)[0]
    const best = list.filter((r) => r.complete === keep.complete && r.intervals.length === keep.intervals.length).at(-1)!
    const allComplete = list.every((r) => r.complete)
    const hint = allComplete ? '; all runs are complete, so check whether an ID was typed wrongly' : ''
    for (const r of list) {
      const others = list.filter((o) => o !== r).map((o) => `${o.session.id} chamber ${o.chamber}`).join(', ')
      if (r === best) r.issues.push(`Tested ${list.length}× on ${r.date}: this run is used (also ${others})${hint}`)
      else {
        r.issues.push(`Tested ${list.length}× on ${r.date}: ${best.session.id} chamber ${best.chamber} is used instead${hint}`)
        r.exclude = true
      }
    }
  }

  // PAS labels that disagree with the animal's other runs
  const byAnimal = new Map<string, Run[]>()
  for (const r of runs) {
    const k = r.subject.toLowerCase()
    if (!byAnimal.has(k)) byAnimal.set(k, [])
    byAnimal.get(k)!.push(r)
  }
  let labelConflicts = 0
  for (const list of byAnimal.values()) {
    const code = majority(list.map((r) => r.parsed?.code).filter((c): c is string => Boolean(c)))
    const sex = majority(list.map((r) => r.parsed?.sex).filter((s): s is 'M' | 'F' => Boolean(s)))
    const usual = [code, sex].filter(Boolean).join(' ')
    let any = false
    for (const r of list) {
      const what = [
        r.parsed?.code && code && r.parsed.code !== code ? 'genotype' : '',
        r.parsed?.sex && sex && r.parsed.sex !== sex ? 'sex' : '',
      ].filter(Boolean)
      if (!what.length) continue
      any = true
      const n = list.filter((o) => o.parsed?.code === code && (!sex || o.parsed?.sex === sex)).length
      r.issues.push(`PAS label "${r.label}" differs from this animal's other runs ("${usual}", ${n} of ${list.length} runs): ${what.join(' and ')}`)
    }
    if (any) labelConflicts++
  }

  // Beam events → distance, resting and centre per interval
  const centre = centreZone(db.zones, db.xBeams, db.yBeams)
  let noEvents = 0
  const rows: Cell[][] = []
  const tracks: TrackSet = {
    version: 1,
    beamCm: BEAM_CM,
    xBeams: db.xBeams,
    yBeams: db.yBeams,
    centre: centre ? [...db.zones].filter(([, z]) => z === centre).map(([xy]) => xy) : [],
    runs: {},
  }
  for (const r of runs) {
    const len = r.session.intervalSecs * 10
    const bounds = new Map<number, [number, number]>()
    for (const iv of r.intervals) {
      const t0 = (iv.interval - 1) * len
      const d = iv.end - iv.start
      bounds.set(iv.interval, [t0, t0 + (Math.abs(d - len) <= 10 || d <= 0 ? len : Math.min(d, len))])
    }
    const ev = db.events.get(runKey(r.session.id, r.chamber))
    const red = ev && ev.length ? reduceEvents(ev, bounds, db.zones, centre, db.restSecs) : null
    // The movement track (positions at each ambulatory break and rearing) for the Tracks tab
    if (ev && ev.length) {
      const list: [number, number, number, boolean, number][] = []
      for (let i = 0; i < ev.length; i += 5) list.push([ev[i], ev[i + 1], ev[i + 2], false, ev[i + 4]])
      const rs = db.rears?.get(runKey(r.session.id, r.chamber)) ?? []
      for (let i = 0; i < rs.length; i += 3) list.push([rs[i], rs[i + 1], rs[i + 2], true, Infinity])
      list.sort((a, b) => a[0] - b[0] || a[4] - b[4])
      const secs = [...bounds.values()].reduce((a, [t0, t1]) => a + (t1 - t0), 0) / 10
      tracks.runs[`${r.session.id} · chamber ${r.chamber}`] = { secs, intervalSecs: r.session.intervalSecs, ...packEvents(list.map(([t, x, y, rear]) => [t, x, y, rear])) }
    }
    if (!red) {
      noEvents++
      r.issues.push('No beam-event log for this run: distance, speed, resting and centre measures are blank')
    }
    const per = r.intervals.map((iv) => {
      const e = red?.get(iv.interval)
      const [t0, t1] = bounds.get(iv.interval)!
      const secs = (t1 - t0) / 10
      const v: Record<MeasureId, number | null> = {
        distance: e ? e.distance : null,
        speed: e && secs > 0 ? e.distance / secs : null,
        rest: e ? e.rest : null,
        centreTime: e && centre ? e.centreTime : null,
        centrePct: e && centre && secs > 0 ? (e.centreTime / secs) * 100 : null,
        centreEntries: e && centre ? e.centreEntries : null,
        amb: iv.cenA + iv.perA,
        ambCentre: iv.cenA,
        ambPeriphery: iv.perA,
        fine: iv.cenF + iv.perF,
        rear: iv.rear,
      }
      return { iv, v, secs }
    })
    const total = {} as Record<MeasureId, number | null>
    const sum = (m: MeasureId) => (per.every((p) => p.v[m] !== null) ? per.reduce((s, p) => s + p.v[m]!, 0) : null)
    const secs = per.reduce((s, p) => s + p.secs, 0)
    for (const m of MEASURES) total[m] = sum(m)
    total.speed = total.distance !== null && secs > 0 ? total.distance / secs : null
    total.centrePct = total.centreTime !== null && secs > 0 ? (total.centreTime / secs) * 100 : null
    const rec = `${r.session.id} · chamber ${r.chamber}`
    const check = r.issues.join(' · ')
    for (const p of per) {
      rows.push([
        r.subject,
        r.parsed?.code || null,
        r.parsed?.sex ?? null,
        r.label,
        r.date || null,
        r.session.id,
        r.chamber,
        p.iv.interval,
        rec,
        check || null,
        check ? (r.exclude ? 'exclude' : 'keep') : null,
        ...MEASURES.map((m) => (total[m] === null ? null : round(total[m]!, 2))),
        ...MEASURES.map((m) => (p.v[m] === null ? null : round(p.v[m]!, 2))),
      ])
    }
  }

  const animals = new Set(runs.map((r) => r.subject.toLowerCase())).size
  const usedSessions = new Set(runs.map((r) => r.session.id)).size
  const lenMin = [...new Set(runs.map((r) => r.session.intervalSecs / 60))].map((n) => round(n, 2)).join('/')
  const perRun = majority(runs.map((r) => r.expected)) ?? 1
  const about = [db.app, db.xBeams ? `${db.xBeams} × ${db.yBeams} beams` : ''].filter(Boolean).join(', ')
  notes.push(
    `${file}: SDI PAS open field database${about ? ` (${about})` : ''}: ${usedSessions} sessions, ${animals} animals, ${fmt(runs.length)} runs of ${perRun} × ${lenMin} min. ` +
      `Ambulatory, fine and rearing counts are PAS's own; distance, speed, resting time and centre measures were calculated from ${fmt(db.eventCount)} beam events the way PAS's data reduction does it (${BEAM_CM} cm per beam, resting = pause of ${db.restSecs} s or more${centre ? `, centre = zone "${centre}"` : ''}).` +
      (centre ? '' : ' No centre zone was found in the zone map, so centre measures are blank.'),
  )
  const flagged = runs.filter((r) => r.issues.length)
  if (flagged.length) {
    notes.push(
      `${file}: ${flagged.length} runs are flagged for review (Setup → Data checks)` +
        [
          runs.some((r) => !r.complete) ? `; ${runs.filter((r) => !r.complete).length} stopped early` : '',
          repeats ? `; ${repeats} animal-days tested more than once` : '',
          labelConflicts ? `; ${labelConflicts} animals with PAS labels that disagree between runs` : '',
          noEvents ? `; ${noEvents} without a beam-event log` : '',
        ].join('') +
        `. ${runs.filter((r) => r.exclude).length} are left out by default (incomplete runs and repeats); you can change that.`,
    )
  }
  if (noSubject) notes.push(`${file}: ${noSubject} chamber recordings had no animal ID and were skipped.`)
  const assigned = db.chambers.filter((c) => c.subject?.trim() && sessions.has(c.session) && !byRun.has(runKey(c.session, c.chamber)))
  if (assigned.length) {
    const ses = [...new Set(assigned.map((c) => c.session))]
    notes.push(`${file}: ${assigned.length} chambers had an animal assigned but no recorded data (${ses.slice(0, 4).join(', ')}${ses.length > 4 ? ', …' : ''}).`)
  }
  return { file, sheet: '', cells: [PAS_HEADERS, ...rows], notes, tracks: Object.keys(tracks.runs).length ? tracks : undefined }
}

// ---------------------------------------------------------------------------
// Reading the .mdb

/** The part of mdb-reader used here (also lets tests supply tables directly). */
export interface TableReader {
  getTableNames(): string[]
  getTable(name: string): {
    rowCount: number
    getColumnNames(): string[]
    getData(o?: { columns?: string[]; rowOffset?: number; rowLimit?: number }): Record<string, unknown>[]
  }
}

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const str = (v: unknown) => (v === null || v === undefined ? null : String(v))
const date = (v: unknown) => (v instanceof Date && !Number.isNaN(v.getTime()) ? v : null)
const CHUNK = 50_000

/** Reads the PAS tables. `onProgress` gets the share of beam events read (0–1). */
export async function readPasTables(r: TableReader, onProgress?: (share: number) => void): Promise<PasDb> {
  const names = new Set(r.getTableNames())
  for (const t of ['Sessions', 'SessionChambers', 'IntervalData']) {
    if (!names.has(t)) throw new Error(`This Access database isn't from SDI PAS (no ${t} table). Export the data to Excel or CSV and load that instead.`)
  }
  const rows = (t: string) => (names.has(t) ? r.getTable(t).getData() : [])
  const info = rows('SessionsDBInfo')[0] ?? {}
  const sessions: PasSession[] = rows('Sessions').map((s) => ({
    id: String(s.SessionId ?? '').trim(),
    status: String(s.Status ?? ''),
    runDate: date(s.RunDate),
    intervalSecs: num(s.Interval_Secs, 300),
    intervalsPerPhase: num(s.IntPerPhase, 1),
  }))
  const chambers: PasChamber[] = rows('SessionChambers').map((c) => ({
    session: String(c.SessionId ?? '').trim(),
    chamber: num(c.ChamberNum),
    subject: str(c.SubjectId),
    label: str(c.SubjectVars),
  }))
  const intervals: PasInterval[] = rows('IntervalData').map((d) => ({
    session: String(d.SessionId ?? '').trim(),
    chamber: num(d.ChamberNum),
    phase: num(d.PhaseNum, 1),
    interval: num(d.IntervalNum, 1),
    subject: str(d.SubjectId),
    endState: num(d.EndState, 1),
    start: num(d.Start_t),
    end: num(d.End_t),
    cenF: num(d.CenF),
    cenA: num(d.CenA),
    perF: num(d.PerF),
    perA: num(d.PerA),
    rear: num(d.Rear),
  }))
  // Zone map: the one PAS used for its zone results, else the only (or centre/periphery) map.
  const zoneRows = rows('Zones')
  const maps = [...new Set(zoneRows.map((z) => String(z.ZoneMapId)))]
  const used = rows('ZScoredZonesIndex').map((z) => String(z.ZoneMapId))
  const described = rows('ZoneMaps').find((m) => /cent/i.test(String(m.Descr ?? '')))
  const map = used.find((m) => maps.includes(m)) ?? (maps.length === 1 ? maps[0] : described ? String(described.ZoneMapId) : maps[0])
  const zones = new Map(zoneRows.filter((z) => String(z.ZoneMapId) === map).map((z) => [`${num(z.X)},${num(z.Y)}`, String(z.ZoneId)]))
  const restSecs = num(rows('ZScoredDSRIndex')[0]?.RestingParam, DEFAULT_REST_S) || DEFAULT_REST_S

  const perPhase = new Map(sessions.map((s) => [s.id, Math.max(1, s.intervalsPerPhase)]))
  const events = new Map<string, number[]>()
  const rears = new Map<string, number[]>()
  let eventCount = 0
  if (names.has('Activities')) {
    const t = r.getTable('Activities')
    const columns = ['SessionId', 'ChamberNum', 'PhaseNum', 'IntervalNum', 'EventNum', 'EventType', 'T', 'X', 'Y']
    for (let off = 0; off < t.rowCount; off += CHUNK) {
      for (const a of t.getData({ columns, rowOffset: off, rowLimit: CHUNK })) {
        eventCount++
        if (a.EventType === 'R') {
          const k = runKey(String(a.SessionId ?? '').trim(), num(a.ChamberNum))
          let list = rears.get(k)
          if (!list) rears.set(k, (list = []))
          list.push(num(a.T), num(a.X), num(a.Y))
          continue
        }
        if (a.EventType !== 'A') continue
        const ses = String(a.SessionId ?? '').trim()
        const k = runKey(ses, num(a.ChamberNum))
        let list = events.get(k)
        if (!list) events.set(k, (list = []))
        const interval = (Math.max(1, num(a.PhaseNum, 1)) - 1) * (perPhase.get(ses) ?? 1) + num(a.IntervalNum, 1)
        list.push(num(a.T), num(a.X), num(a.Y), interval, num(a.EventNum))
      }
      onProgress?.(Math.min(1, (off + CHUNK) / t.rowCount))
      // Let the page repaint between chunks.
      await new Promise((res) => setTimeout(res, 0))
    }
  }
  return {
    app: [str(info.AppName), str(info.AppVersion)].filter(Boolean).join(' '),
    xBeams: num(info.XBeams, 16),
    yBeams: num(info.YBeams, 16),
    sessions,
    chambers,
    intervals,
    zones,
    restSecs,
    events,
    rears,
    eventCount,
  }
}

/** Reads a PAS .mdb file in the browser (mdb-reader is loaded on first use). */
export async function readPasFile(bytes: Uint8Array, file: string, onProgress?: (share: number) => void): Promise<RawSheet[]> {
  const { Buffer } = await import('buffer')
  const g = globalThis as { Buffer?: unknown }
  // mdb-reader expects Node's Buffer; the browser build uses this polyfill.
  if (!g.Buffer) g.Buffer = Buffer
  const { default: MDBReader } = await import('mdb-reader')
  let reader: TableReader
  try {
    reader = new MDBReader(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)) as unknown as TableReader
  } catch {
    throw new Error(`${file}: this file could not be opened as an Access database.`)
  }
  const db = await readPasTables(reader, onProgress)
  return [pasSheet(db, file)]
}

// ---------------------------------------------------------------------------
// Genotype and sex: the animal key first, PAS labels as the backup

const sexOfText = (v: Cell): 'M' | 'F' | null => {
  const s = v === null ? '' : String(v).trim()
  return /^(m|male|man|♂)$/i.test(s) ? 'M' : /^(f|female|woman|♀)$/i.test(s) ? 'F' : null
}

/**
 * After the animal key is joined: animals the key lists take its genotype and
 * sex; the others take their most common PAS label, translated into the key's
 * genotype names where the key shows what a PAS code stands for (e.g. "AA" is
 * "A477T/A477T" for most animals in both). Runs whose PAS label contradicts the
 * key are flagged. `role` gives a column's metadata role.
 */
export function pasAugment(headers: string[], rows: Cell[][], role: (h: string) => string | null): { notices: string[] } | null {
  const pci = headers.indexOf(PAS_GENOTYPE_COL)
  const psi = headers.indexOf(PAS_SEX_COL)
  const ri = headers.indexOf(RECORDING_COL)
  const ai = headers.indexOf('Animal ID')
  if (pci < 0 || psi < 0 || ri < 0 || ai < 0) return null
  const notices: string[] = []
  const t = (c: Cell) => (c === null ? '' : String(c).trim())
  // The key's genotype column; one with a single value throughout (e.g. "Untreated") doesn't group anything.
  let gi = headers.findIndex((h, i) => h !== PAS_GENOTYPE_COL && role(h) === 'group' && new Set(rows.map((r) => t(r[i])).filter(Boolean)).size >= 2)
  let si = headers.findIndex((h) => h !== PAS_SEX_COL && role(h) === 'sex')
  const keyGroup = gi >= 0
  const keySex = si >= 0

  // Each animal's PAS labels, by run, and its key values
  interface Animal {
    codes: string[]
    sexes: ('M' | 'F')[]
    keyG: string
    keyS: Cell
  }
  const animals = new Map<string, Animal>()
  const seenRun = new Set<string>()
  for (const r of rows) {
    const id = t(r[ai]).toLowerCase()
    if (!id) continue
    const a = animals.get(id) ?? { codes: [], sexes: [], keyG: '', keyS: null }
    animals.set(id, a)
    if (keyGroup && !a.keyG) a.keyG = t(r[gi])
    if (keySex && a.keyS === null && t(r[si])) a.keyS = r[si]
    const rec = t(r[ri])
    if (seenRun.has(rec)) continue
    seenRun.add(rec)
    if (t(r[pci])) a.codes.push(t(r[pci]))
    const s = sexOfText(r[psi])
    if (s) a.sexes.push(s)
  }
  const usualCode = (a: Animal) => majority(a.codes)
  const usualSex = (a: Animal) => majority(a.sexes)

  // What each PAS code means in the key: the key genotype of most animals with that code
  const pairs = new Map<string, Map<string, number>>()
  for (const a of animals.values()) {
    const code = usualCode(a)
    if (!code || !a.keyG) continue
    const m = pairs.get(code) ?? new Map<string, number>()
    m.set(a.keyG, (m.get(a.keyG) ?? 0) + 1)
    pairs.set(code, m)
  }
  const meaning = new Map<string, string>()
  for (const [code, m] of pairs) {
    const total = [...m.values()].reduce((s, n) => s + n, 0)
    const [g, n] = [...m].sort((a, b) => b[1] - a[1])[0]
    if (n >= 2 && n / total >= 0.75) meaning.set(code, g)
  }

  // Sex is written in the key's style (Male/Female or M/F).
  const keySexStyle = keySex && rows.some((r) => /^(male|female)$/i.test(t(r[si]))) ? 'word' : 'letter'
  const sexText = (s: 'M' | 'F') => (keySexStyle === 'word' ? (s === 'M' ? 'Male' : 'Female') : s)

  if (!keyGroup) {
    headers.push('Genotype')
    rows.forEach((r) => r.push(null))
    gi = headers.length - 1
  }
  if (!keySex) {
    headers.push('Sex')
    rows.forEach((r) => r.push(null))
    si = headers.length - 1
  }
  headers.push(LABEL_SOURCE_COL)
  const fromKey = new Set<string>()
  const fromPas = new Set<string>()
  for (const r of rows) {
    const id = t(r[ai]).toLowerCase()
    const a = animals.get(id)
    let source = ''
    if (a) {
      if (a.keyG) {
        fromKey.add(id)
        source = 'Animal key'
      } else {
        const code = usualCode(a)
        if (code) {
          r[gi] = meaning.get(code) ?? code
          fromPas.add(id)
          source = 'PAS label'
        }
      }
      const s = usualSex(a)
      if (!t(r[si]) && s) r[si] = sexText(s)
    }
    r.push(source || null)
  }

  // Runs whose PAS label contradicts the key
  let conflicts = 0
  if (keyGroup || keySex) {
    const done = new Set<string>()
    for (const r of rows) {
      const rec = t(r[ri])
      if (done.has(rec)) continue
      done.add(rec)
      const a = animals.get(t(r[ai]).toLowerCase())
      if (!a) continue
      const label = t(r[headers.indexOf(PAS_LABEL_COL)]) || [t(r[pci]), t(r[psi])].filter(Boolean).join(' ')
      const ks = sexOfText(a.keyS)
      const ps = sexOfText(r[psi])
      const code = t(r[pci])
      const issues: string[] = []
      if (keySex && ks && ps && ks !== ps) issues.push(`PAS label "${label}" says ${ps === 'M' ? 'male' : 'female'}, but the animal key says ${ks === 'M' ? 'male' : 'female'} (the key is used)`)
      if (keyGroup && a.keyG && code && meaning.has(code) && meaning.get(code) !== a.keyG)
        issues.push(`PAS label "${label}" usually means ${meaning.get(code)} in the animal key, but the key lists ${a.keyG} for this animal (the key is used)`)
      for (const msg of issues) addIssue(headers, rows, rec, msg)
      if (issues.length) conflicts++
    }
  }

  const unknown = new Set(rows.filter((r) => !t(r[gi]) && t(r[ai])).map((r) => t(r[ai])))
  if (unknown.size)
    notices.push(
      `${unknown.size} animal${unknown.size === 1 ? ' has' : 's have'} no genotype (not in the animal key and no PAS label) and ${unknown.size === 1 ? 'is' : 'are'} left out: ${[...unknown].join(', ')}.`,
    )
  if (keyGroup) {
    const translated = [...meaning].map(([c, g]) => `${c} → ${g}`)
    notices.push(
      `Genotype and sex: from the animal key for ${fromKey.size} animals` +
        (fromPas.size
          ? `; ${fromPas.size} animal${fromPas.size === 1 ? ' is' : 's are'} not in the key, so ${fromPas.size === 1 ? 'its' : 'their'} most common PAS label is used${translated.length ? `, translated into the key's names where the key shows what a PAS code means (${translated.join(', ')})` : ''}.`
          : '.') +
        (conflicts ? ` ${conflicts} runs have a PAS label that contradicts the key (Setup → Data checks).` : ''),
    )
  } else {
    notices.push(
      `Genotype and sex come from the PAS chamber labels (each animal's most common label, e.g. "AA F" → genotype AA, female), as no animal key with a genotype column was loaded. A key listing each animal's genotype and sex takes precedence; PAS labels then fill in only the animals it doesn't list.`,
    )
  }
  return { notices }
}

/** Adds a message to every row of one run (kept by default unless already flagged otherwise). */
export function addIssue(headers: string[], rows: Cell[][], recording: string, msg: string) {
  const ci = headers.indexOf(CHECK_COL)
  const ri = headers.indexOf(RECORDING_COL)
  const di = headers.indexOf(CHECK_DEFAULT_COL)
  if (ci < 0 || ri < 0) return
  const t = (c: Cell) => (c === null ? '' : String(c).trim())
  for (const r of rows) {
    if (t(r[ri]) !== recording) continue
    const now = t(r[ci])
    if (now.split(' · ').includes(msg)) continue
    r[ci] = now ? `${now} · ${msg}` : msg
    if (di >= 0 && !t(r[di])) r[di] = 'keep'
  }
}
