// SDI PAS open field databases. Synthetic sessions, animals and beam events in
// PAS's table layout (no real data).

import { afterEach, describe, expect, it } from 'vitest'
import { setProgram } from '../programs'
import { aggregate, autoConfig, buildMeasures } from './analysis'
import { collectChecks, excludedRecordings } from './dataChecks'
import { mergeTables, pickTables, type RawSheet } from './parse'
import {
  CHECK_COL,
  LABEL_SOURCE_COL,
  RECORDING_COL,
  centreZone,
  parsePasLabel,
  pasSheet,
  readPasTables,
  reduceEvents,
  type PasChamber,
  type PasDb,
  type PasInterval,
  type TableReader,
} from './pas'
import { unpackEvents } from './tracks'
import { trackRuns } from './trackRuns'

afterEach(() => setProgram('catwalk'))

/** 16 × 16 beams, centre = beams 4–13 in both directions (PAS's "CvP" map). */
function zoneMap(): Map<string, string> {
  const m = new Map<string, string>()
  for (let x = 1; x <= 16; x++) for (let y = 1; y <= 16; y++) m.set(`${x},${y}`, x >= 4 && x <= 13 && y >= 4 && y <= 13 ? 'C' : 'P')
  return m
}

describe('PAS labels', () => {
  it('splits genotype code and sex, however they were typed', () => {
    expect(parsePasLabel('AA F')).toEqual({ code: 'AA', sex: 'F' })
    expect(parsePasLabel('PA M ')).toEqual({ code: 'PA', sex: 'M' })
    expect(parsePasLabel(' P A M')).toEqual({ code: 'PA', sex: 'M' })
    expect(parsePasLabel('AAF')).toEqual({ code: 'AA', sex: 'F' })
    expect(parsePasLabel('WT')).toEqual({ code: 'WT', sex: null })
    expect(parsePasLabel('PHD')).toEqual({ code: 'PHD', sex: null })
    expect(parsePasLabel('A/N M')).toEqual({ code: 'A/N', sex: 'M' })
    expect(parsePasLabel('Het female')).toEqual({ code: 'HET', sex: 'F' })
    expect(parsePasLabel('  ')).toBeNull()
  })
})

describe('PAS data reduction', () => {
  const zones = zoneMap()
  it('finds the centre zone as the one away from the walls', () => {
    expect(centreZone(zones, 16, 16)).toBe('C')
    expect(centreZone(new Map([['1,1', 'A'], ['2,2', 'B']]), 16, 16)).toBe('B')
  })

  it('reproduces distance, resting and centre measures per interval', () => {
    // [t (0.1 s), x, y, interval, event]
    const ev = [
      [0, 2, 2, 1, 1], // periphery
      [10, 3, 3, 1, 2], // diagonal: √(2.5² + 2.5²) = 3.54 → 3.5 cm
      [20, 5, 3, 1, 3], // 5 cm
      [30, 5, 5, 1, 4], // 5 cm, enters the centre
      [130, 6, 5, 1, 5], // 10 s pause (resting), 2.5 cm, still centre
      [280, 6, 2, 1, 6], // 15 s pause, 7.5 cm, back to the periphery
      // Interval 2 (300–600): the 20 s pause spans the boundary, 2 s before it (too short to count) and 18 s after
      [480, 6, 6, 2, 7], // 10 cm, centre
      [490, 6, 7, 2, 8],
    ].flat()
    const bounds = new Map<number, [number, number]>([
      [1, [0, 300]],
      [2, [300, 600]],
    ])
    const r = reduceEvents(ev, bounds, zones, 'C', 5)
    expect(r.get(1)).toEqual({ distance: 3.5 + 5 + 5 + 2.5 + 7.5, rest: 10 + 15, centreTime: 25, centreEntries: 1 })
    // Interval 2: rest 18 s after the boundary, 11 s at the end; centre from 48 s to the end; one entry.
    expect(r.get(2)).toEqual({ distance: 10 + 2.5, rest: 18 + 11, centreTime: 12, centreEntries: 1 })
  })

  it('counts a centre visit carried over an interval boundary as an entry', () => {
    const ev = [
      [0, 5, 5, 1, 1],
      [350, 6, 5, 2, 2],
    ].flat()
    const bounds = new Map<number, [number, number]>([
      [1, [0, 300]],
      [2, [300, 600]],
    ])
    const r = reduceEvents(ev, bounds, zones, 'C', 5)
    expect(r.get(1)!.centreEntries).toBe(1)
    expect(r.get(2)!.centreEntries).toBe(1)
    expect(r.get(1)!.centreTime + r.get(2)!.centreTime).toBe(60)
  })
})

// ---------------------------------------------------------------------------
// A small synthetic database

const D = (s: string) => new Date(`${s}T14:00:00Z`)

function interval(session: string, chamber: number, subject: string, n: number, counts: Partial<PasInterval> = {}): PasInterval {
  const c = { cenF: 10 + n, cenA: 300 - n * 20, perF: 20 + chamber, perA: 200 + chamber * 3 + n, rear: 30 - n + chamber }
  return { session, chamber, phase: 1, interval: n, subject, endState: 1, start: 500, end: 3500, ...c, ...counts }
}

/** A walk back and forth along one row of beams: `steps` moves of one beam per interval. */
function walk(steps: number, y = 8): number[] {
  const out: number[] = []
  let e = 0
  for (let i = 1; i <= 4; i++) {
    for (let s = 0; s < steps; s++) {
      const x = 2 + (s % 12)
      out.push((i - 1) * 3000 + 10 + s * 20, x, y, i, ++e)
    }
  }
  return out
}

function db(): PasDb {
  const sessions = [
    { id: 'S0', status: 'Completed', runDate: D('2025-12-15'), intervalSecs: 300, intervalsPerPhase: 4 },
    { id: 'S1', status: 'Completed', runDate: D('2026-01-05'), intervalSecs: 300, intervalsPerPhase: 4 },
    { id: 'S1_redo', status: 'Completed', runDate: D('2026-01-05'), intervalSecs: 300, intervalsPerPhase: 4 },
    { id: 'S2', status: 'Completed', runDate: D('2026-02-02'), intervalSecs: 300, intervalsPerPhase: 4 },
  ]
  const animals = [
    { id: 'KX9.1 LF', label: 'AA F' },
    { id: 'KX9.1 RF', label: 'AA F' },
    { id: 'KX9.2 LF', label: 'WT F' },
    { id: 'KX9.2 RF', label: 'WT F' },
    { id: 'KX9.3 NM', label: 'AA M' }, // not in the key
  ]
  const chambers: PasChamber[] = []
  const intervals: PasInterval[] = []
  const events = new Map<string, number[]>()
  // An earlier run of one animal only
  chambers.push({ session: 'S0', chamber: 2, subject: 'KX9.1 RF', label: 'AA F' })
  for (let k = 1; k <= 4; k++) intervals.push(interval('S0', 2, 'KX9.1 RF', k))
  events.set('S0\u00002', walk(40))
  for (const s of ['S1', 'S2']) {
    animals.forEach((a, i) => {
      // One run typed with the wrong sex
      const label = s === 'S2' && a.id === 'KX9.1 RF' ? 'AA M' : a.label
      chambers.push({ session: s, chamber: i + 1, subject: a.id, label })
      // The first animal's first run stopped after two intervals
      const n = s === 'S1' && i === 0 ? 2 : 4
      for (let k = 1; k <= n; k++) intervals.push(interval(s, i + 1, a.id, k, k === 2 && n === 2 ? { endState: 0, end: 1100 } : {}))
      events.set(`${s}\u0000${i + 1}`, walk(a.label.startsWith('AA') ? 40 : 80))
    })
  }
  // The first animal again the same day, complete
  chambers.push({ session: 'S1_redo', chamber: 1, subject: 'KX9.1 LF', label: 'AA F' })
  for (let k = 1; k <= 4; k++) intervals.push(interval('S1_redo', 1, 'KX9.1 LF', k))
  events.set('S1_redo\u00001', walk(40))
  return { app: 'PASUSB 1.0', xBeams: 16, yBeams: 16, sessions, chambers, intervals, zones: zoneMap(), restSecs: 5, events, eventCount: 999 }
}

function key(): RawSheet {
  return {
    file: 'key.xlsx',
    sheet: 'Animals',
    cells: [
      ['Tag Number', 'Toe/Ear Mark', 'Sex', 'Genotype', 'DOB'],
      ['KX9.1', 'LF', 'Female', 'Mut/Mut', '2025-11-01'],
      ['KX9.1', 'RF', 'Female', 'Mut/Mut', '2025-11-01'],
      ['KX9.2', 'LF', 'Female', 'WT', '2025-11-02'],
      ['KX9.2', 'RF', 'Female', 'WT', '2025-11-02'],
    ],
  }
}

describe('PAS database → table', () => {
  const sheet = () => pasSheet(db(), 'PASdata_001.mdb')
  const col = (s: RawSheet, h: string) => (s.cells[0] as string[]).indexOf(h)

  it('gives one row per animal, run and interval, with totals and per-interval values', () => {
    const s = sheet()
    const rows = s.cells.slice(1)
    expect(rows).toHaveLength(2 + 4 + 4 * 10) // incomplete run, its redo, 10 complete runs
    const r = rows.filter((x) => x[col(s, RECORDING_COL)] === 'S2 · chamber 3')
    expect(r.map((x) => x[col(s, 'Interval')])).toEqual([1, 2, 3, 4])
    const per = r.map((x) => x[col(s, 'Distance moved (cm) per interval')] as number)
    expect(r[0][col(s, 'Distance moved (cm)')]).toBeCloseTo(per.reduce((a, b) => a + b, 0), 6)
    expect(r.map((x) => x[col(s, 'Ambulatory counts per interval')])).toEqual([280 + 210, 260 + 211, 240 + 212, 220 + 213])
    expect(r[0][col(s, 'Ambulatory counts')]).toBe(490 + 471 + 452 + 433)
    expect(r.map((x) => x[col(s, 'Centre ambulatory counts per interval')])).toEqual([280, 260, 240, 220])
    expect(r[0][col(s, 'Test date')]).toBe('2026-02-02')
    expect(r[0][col(s, 'Genotype (PAS)')]).toBe('WT')
    expect(s.notes?.[0]).toMatch(/SDI PAS open field database \(PASUSB 1\.0, 16 × 16 beams\): 4 sessions, 5 animals, 12 runs of 4 × 5 min/)
  })

  it('flags incomplete runs, same-day repeats and label conflicts', () => {
    const s = sheet()
    const checks = collectChecks(s.cells[0] as string[], s.cells.slice(1))
    const by = (rec: string) => checks.find((c) => c.recording === rec)!
    expect(by('S1 · chamber 1').issues.map((i) => i.kind)).toEqual(['incomplete', 'repeat'])
    expect(by('S1 · chamber 1').defaultExclude).toBe(true)
    expect(by('S1_redo · chamber 1').issues.map((i) => i.kind)).toEqual(['repeat'])
    expect(by('S1_redo · chamber 1').defaultExclude).toBe(false)
    expect(by('S2 · chamber 2').issues[0]).toMatchObject({ kind: 'label' })
    expect(by('S2 · chamber 2').issues[0].text).toMatch(/"AA M" differs from this animal's other runs \("AA F", 2 of 3 runs\): sex/)
    expect(checks).toHaveLength(3)
  })
})

describe('PAS in Open Field Lab', () => {
  // Each file is read on its own, as in the app.
  const load = (sheets: RawSheet[]) => {
    setProgram('openfield')
    return mergeTables(sheets.flatMap((s) => pickTables([s])))
  }

  it('takes genotype and sex from the key, and PAS labels for animals not in it', () => {
    const ds = load([pasSheet(db(), 'PASdata_001.mdb'), key()])
    const h = (n: string) => ds.headers.indexOf(n)
    const of = (id: string) => ds.rows.find((r) => r[h('Animal ID')] === id)!
    expect(ds.keys[0].keyColumns).toEqual(['Tag Number', 'Toe/Ear Mark'])
    expect(of('KX9.1 LF')[h('Genotype')]).toBe('Mut/Mut')
    // Not in the key: "AA" means Mut/Mut for both key animals with that label
    expect(of('KX9.3 NM')[h('Genotype')]).toBe('Mut/Mut')
    expect(of('KX9.3 NM')[h('Sex')]).toBe('Male')
    expect(of('KX9.3 NM')[h(LABEL_SOURCE_COL)]).toBe('PAS label')
    expect(of('KX9.1 LF')[h(LABEL_SOURCE_COL)]).toBe('Animal key')
    const cfg = autoConfig(ds)
    expect(cfg.groupCol).toBe('Genotype')
    expect(cfg.timeCol).toBe('Test date')
    expect(cfg.controlGroup).toBe('WT')
    expect(ds.notices.some((n) => /from the animal key for 4 animals; 1 animal is not in the key.*AA → Mut\/Mut/.test(n))).toBe(true)
  })

  it('flags runs whose PAS label contradicts the key', () => {
    const ds = load([pasSheet(db(), 'PASdata_001.mdb'), key()])
    const c = ds.checks!.find((x) => x.recording === 'S2 · chamber 2')!
    expect(c.issues.map((i) => i.kind)).toEqual(['label', 'key'])
    expect(c.issues[1].text).toMatch(/says male, but the animal key says female/)
    expect(c.defaultExclude).toBe(false)
  })

  it('uses PAS labels alone without a key', () => {
    const ds = load([pasSheet(db(), 'PASdata_001.mdb')])
    const h = (n: string) => ds.headers.indexOf(n)
    expect(autoConfig(ds).groupCol).toBe('Genotype')
    expect(ds.rows.find((r) => r[h('Animal ID')] === 'KX9.1 RF')![h('Sex')]).toBe('F')
    expect(ds.notices.some((n) => /come from the PAS chamber labels/.test(n))).toBe(true)
  })

  it('recognises the PAS measures, with habituation from per-interval values only', () => {
    const ds = load([pasSheet(db(), 'PASdata_001.mdb'), key()])
    const ms = buildMeasures(ds)
    const ids = new Set(ms.filter((m) => !m.variant && !m.trial).map((m) => m.def.id))
    for (const id of ['distance', 'velocity', 'immobile_time', 'center_time', 'center_time_pct', 'center_entries', 'crossings', 'center_ambulatory', 'periphery_ambulatory', 'fine_movements', 'rearing'])
      expect(ids.has(id), id).toBe(true)
    const change = ms.filter((m) => m.trial?.how === 'change_pct')
    expect(change.length).toBe(11)
    expect(change.every((m) => ms.find((s) => s.key === m.trial!.source)!.variant === 'per interval')).toBe(true)
  })

  it('leaves out excluded runs, following the defaults until the user chooses', () => {
    const ds = load([pasSheet(db(), 'PASdata_001.mdb'), key()])
    const ms = buildMeasures(ds)
    const cfg = autoConfig(ds)
    expect([...excludedRecordings(ds.checks, undefined)]).toEqual(['S1 · chamber 1'])
    const dist = ms.find((m) => m.def.id === 'distance' && !m.variant)!
    const first = (c: typeof cfg) => aggregate(ds, ms, c).subjects.find((s) => s.id === 'KX9.1 LF' && s.time === '2026-01-05')!
    const a = aggregate(ds, ms, cfg)
    expect(a.rowsFiltered).toBe(2)
    // Only the complete redo counts: its total, not an average with the stopped run
    const redo = ds.rows.find((r) => r[ds.headers.indexOf(RECORDING_COL)] === 'S1_redo · chamber 1')!
    expect(first(cfg).values[dist.key]).toBeCloseTo(redo[ds.headers.indexOf('Distance moved (cm)')] as number, 6)
    // Keep the stopped run and exclude the mislabelled one
    const cfg2 = { ...cfg, runExclusions: { 'S1 · chamber 1': false, 'S2 · chamber 2': true } }
    const b = aggregate(ds, ms, cfg2)
    expect(b.rowsFiltered).toBe(4)
    expect(b.subjects.some((s) => s.id === 'KX9.1 RF' && s.time === '2026-02-02')).toBe(false)
    expect(first(cfg2).values[dist.key]).not.toBe(first(cfg).values[dist.key])
  })

  it('keeps two runs of one animal on one day apart when merging', () => {
    const ds = load([pasSheet(db(), 'PASdata_001.mdb')])
    const recs = new Set(ds.rows.filter((r) => r[ds.headers.indexOf('Animal ID')] === 'KX9.1 LF').map((r) => r[ds.headers.indexOf(RECORDING_COL)]))
    expect(recs.size).toBe(3)
    expect(ds.rows.some((r) => String(r[ds.headers.indexOf(CHECK_COL)] ?? '').startsWith('Run stopped early'))).toBe(true)
  })
})

describe('reading the database tables', () => {
  /** A stand-in for mdb-reader holding plain rows. */
  function reader(tables: Record<string, Record<string, unknown>[]>): TableReader & { calls: number } {
    const r = {
      calls: 0,
      getTableNames: () => Object.keys(tables),
      getTable: (name: string) => ({
        rowCount: tables[name].length,
        getColumnNames: () => Object.keys(tables[name][0] ?? {}),
        getData: (o: { rowOffset?: number; rowLimit?: number } = {}) => {
          if (name === 'Activities') r.calls++
          const from = o.rowOffset ?? 0
          return tables[name].slice(from, o.rowLimit === undefined ? undefined : from + o.rowLimit)
        },
      }),
    }
    return r
  }
  const base = () => ({
    SessionsDBInfo: [{ AppName: 'PASUSB', AppVersion: '1.0', XBeams: 16, YBeams: 16 }],
    Sessions: [{ SessionId: 'S1', Status: 'Completed', RunDate: D('2026-03-01'), Interval_Secs: 300, IntPerPhase: 4 }],
    SessionChambers: [{ SessionId: 'S1', ChamberNum: 1, SubjectId: 'KX9.5 LF', SubjectVars: 'WT M' }],
    IntervalData: [1, 2, 3, 4].map((n) => ({ SessionId: 'S1', ChamberNum: 1, PhaseNum: 1, IntervalNum: n, SubjectId: 'KX9.5 LF', EndState: 1, Start_t: 0, End_t: 3000, CenF: 1, CenA: 2, PerF: 3, PerA: 4, Rear: 5 })),
    ZoneMaps: [{ ZoneMapId: 'CvP', Descr: 'Center vs Periphery' }],
    Zones: [...zoneMap()].map(([xy, z]) => ({ ZoneMapId: 'CvP', X: +xy.split(',')[0], Y: +xy.split(',')[1], ZoneId: z })),
    Activities: Array.from({ length: 120_001 }, (_, i) => ({
      SessionId: 'S1',
      ChamberNum: 1,
      PhaseNum: 1,
      IntervalNum: 1 + Math.floor(i / 30_001),
      EventNum: i + 1,
      EventType: i % 3 === 2 ? 'F' : 'A',
      T: Math.floor(i / 10),
      X: 2 + (i % 2),
      Y: 8,
      SubjectId: 'KX9.5 LF',
    })),
  })

  it('reads beam events in chunks and keeps only ambulatory ones', async () => {
    const r = reader(base())
    const shares: number[] = []
    const d = await readPasTables(r, (s) => shares.push(s))
    expect(r.calls).toBe(3)
    expect(shares.at(-1)).toBe(1)
    expect(d.eventCount).toBe(120_001)
    expect(d.events.get('S1\u00001')!.length / 5).toBe(80_001)
    expect(d.zones.get('5,5')).toBe('C')
    expect(d.restSecs).toBe(5)
    const s = pasSheet(d, 'x.mdb')
    expect(s.cells).toHaveLength(5)
  })

  it('says so when the database is not from PAS', async () => {
    await expect(readPasTables(reader({ Customers: [{ Name: 'x' }] }))).rejects.toThrow(/isn't from SDI PAS \(no Sessions table\)/)
  })
})

describe('instruction sheets', () => {
  it('does not read sentences as parameter names', () => {
    setProgram('openfield')
    const how: RawSheet = {
      file: 'k.xlsx',
      sheet: 'How to Use',
      cells: [
        ['Log a weigh-in', 'Type the date in the next empty header cell, then type each weight down that column. Everything else recalculates.'],
        ['Step 2', 'More text'],
      ],
    }
    const k = key()
    const tables = pickTables([k, how])
    expect(tables[0].sheet).toBe('Animals')
  })
})

describe('PAS movement tracks', () => {
  it('keeps each run\'s positions and rearing, and carries them into the dataset', () => {
    const d = db()
    d.rears = new Map([['S2\u00001', [15, 3, 8, 3010, 5, 8]]])
    const sheet = pasSheet(d, 'PASdata_001.mdb')
    const tracks = sheet.tracks!
    expect(tracks.centre).toHaveLength(100)
    expect(Object.keys(tracks.runs)).toHaveLength(12)
    const run = tracks.runs['S2 · chamber 1']
    expect(run.secs).toBe(1200)
    expect(run.intervalSecs).toBe(300)
    const ev = unpackEvents(run)
    expect([...ev.rear].filter(Boolean)).toHaveLength(2)
    expect(ev.t.every((t, i) => i === 0 || t >= ev.t[i - 1])).toBe(true)
    // The run that stopped early covers its recorded time only
    expect(tracks.runs['S1 · chamber 1'].secs).toBe(300 + 60)

    setProgram('openfield')
    const ds = mergeTables(pickTables([sheet]))
    expect(Object.keys(ds.tracks!.runs)).toHaveLength(12)
    const cfg = autoConfig(ds)
    const runs = trackRuns(ds, cfg)
    expect(runs).toHaveLength(12)
    const r = runs.find((x) => x.recording === 'S2 · chamber 3')!
    expect(r).toMatchObject({ subject: 'KX9.2 LF', group: 'WT', time: '2026-02-02', excluded: false })
    expect(runs.find((x) => x.recording === 'S1 · chamber 1')!.excluded).toBe(true)
    // Excluded groups are left out
    expect(trackRuns(ds, { ...cfg, excludedGroups: ['WT'] }).some((x) => x.group === 'WT')).toBe(false)
  })
})

