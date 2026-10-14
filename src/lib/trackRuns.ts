// Which runs have a movement track, with each run's animal, group and timepoint as
// analysed (see lib/tracks.ts for the tracks themselves).

import { groupOf, type AnalysisConfig } from './analysis'
import { excludedRecordings, type DataCheck } from './dataChecks'
import type { Cell } from './parse'
import type { TrackSet } from './tracks'

export interface TrackRunInfo {
  recording: string
  subject: string
  group: string
  time: string
  date: string
  /** Left out under Setup → Data checks. */
  excluded: boolean
}

const text = (c: Cell) => (c === null ? '' : String(c).trim())

/**
 * The runs that have a track, with the animal, group (as analysed, combined groups
 * folded together) and timepoint of each, honouring excluded groups and filters.
 */
export function trackRuns(
  ds: { headers: string[]; rows: Cell[][]; checks?: DataCheck[]; tracks?: TrackSet },
  cfg: Pick<AnalysisConfig, 'subjectCol' | 'groupCol' | 'timeCol' | 'groupMerge' | 'excludedGroups' | 'filters' | 'runExclusions'>,
): TrackRunInfo[] {
  if (!ds.tracks) return []
  const col = (h: string | null) => (h ? ds.headers.indexOf(h) : -1)
  const ri = ds.headers.indexOf('Recording')
  const si = col(cfg.subjectCol)
  const gi = col(cfg.groupCol)
  const ti = col(cfg.timeCol)
  const di = ds.headers.indexOf('Test date')
  if (ri < 0) return []
  const filters = cfg.filters.map((f) => ({ i: col(f.col), values: new Set(f.values) })).filter((f) => f.i >= 0)
  const out = new Map<string, TrackRunInfo>()
  const excluded = excludedRecordings(ds.checks, cfg.runExclusions)
  for (const r of ds.rows) {
    const rec = text(r[ri])
    if (!rec || out.has(rec) || !ds.tracks.runs[rec]) continue
    if (filters.some((f) => !f.values.has(text(r[f.i])))) continue
    const group = gi >= 0 ? groupOf(cfg, text(r[gi])) : 'All animals'
    if (!group || cfg.excludedGroups.includes(group)) continue
    out.set(rec, {
      recording: rec,
      subject: si >= 0 ? text(r[si]) : rec,
      group,
      time: ti >= 0 ? text(r[ti]) : '',
      date: di >= 0 ? text(r[di]) : '',
      excluded: excluded.has(rec),
    })
  }
  return [...out.values()]
}
