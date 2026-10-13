// Data checks: runs flagged on import (e.g. a PAS run that stopped early, an
// animal tested twice on one day, labels that disagree) with a default of
// keeping or excluding them. Setup → Data checks lists them; the user's choices
// (AnalysisConfig.runExclusions) override the defaults, and excluded runs are
// left out of every analysis without changing the loaded data.

import { CHECK_COL, CHECK_DEFAULT_COL, PAS_SESSION_COL, RECORDING_COL, TEST_DATE_COL } from './pas'
import type { Cell } from './parse'

export type CheckKind = 'incomplete' | 'repeat' | 'label' | 'key' | 'events' | 'other'

export interface DataCheck {
  /** Run identifier (Recording column). */
  recording: string
  subject: string
  date: string
  session: string
  /** One message per problem. */
  issues: { kind: CheckKind; text: string }[]
  /** Left out unless the user includes it. */
  defaultExclude: boolean
  /** Rows (intervals) of this run. */
  rows: number
}

export const CHECK_KINDS: { kind: CheckKind; title: string; text: string }[] = [
  {
    kind: 'incomplete',
    title: 'Runs that stopped early',
    text: 'Fewer intervals were recorded than the session was set up for (the run was stopped or the chamber dropped out). Their totals cover less time than complete runs, so they are left out by default.',
  },
  {
    kind: 'repeat',
    title: 'Animals tested more than once on one day',
    text: 'The same animal ID appears in two runs on the same date. The most complete, latest run is used and the other is left out. When both runs are complete, check whether one ID was typed wrongly.',
  },
  {
    kind: 'label',
    title: 'PAS labels that disagree between runs',
    text: "The genotype or sex typed in PAS for this run differs from the animal's other runs. Group and sex come from the animal key (or the animal's usual label), so these runs are kept; exclude them if the run itself may be the wrong animal.",
  },
  {
    kind: 'key',
    title: 'PAS labels that disagree with the animal key',
    text: 'The PAS label for this run contradicts the genotype or sex in the animal key. The key is used for grouping; exclude the run if you think the wrong animal was recorded.',
  },
  {
    kind: 'events',
    title: 'Runs without a beam-event log',
    text: "PAS saved its interval counts but no beam events, so distance, speed, resting and centre measures are blank. The counts are still analysed.",
  },
  { kind: 'other', title: 'Other', text: '' },
]

export function kindOf(text: string): CheckKind {
  if (/^run stopped early/i.test(text)) return 'incomplete'
  if (/^tested \d+× on/i.test(text)) return 'repeat'
  if (/animal key/i.test(text)) return 'key'
  if (/^PAS label .* differs/i.test(text)) return 'label'
  if (/beam-event log/i.test(text)) return 'events'
  return 'other'
}

const text = (c: Cell) => (c === null ? '' : String(c).trim())

/** Flagged runs in the rows, one entry per recording. */
export function collectChecks(headers: string[], rows: Cell[][]): DataCheck[] {
  const ci = headers.indexOf(CHECK_COL)
  const ri = headers.indexOf(RECORDING_COL)
  if (ci < 0 || ri < 0) return []
  const di = headers.indexOf(CHECK_DEFAULT_COL)
  const si = headers.findIndex((h) => /^animal id$/i.test(h))
  const ti = headers.indexOf(TEST_DATE_COL)
  const pi = headers.indexOf(PAS_SESSION_COL)
  const out = new Map<string, DataCheck>()
  for (const r of rows) {
    const msg = text(r[ci])
    const rec = text(r[ri])
    if (!msg || !rec) continue
    const c = out.get(rec)
    if (c) {
      c.rows++
      continue
    }
    out.set(rec, {
      recording: rec,
      subject: si >= 0 ? text(r[si]) : '',
      date: ti >= 0 ? text(r[ti]) : '',
      session: pi >= 0 ? text(r[pi]) : rec,
      issues: msg.split(' · ').map((t) => ({ kind: kindOf(t), text: t })),
      defaultExclude: di >= 0 && /^exclude$/i.test(text(r[di])),
      rows: 1,
    })
  }
  return [...out.values()]
}

export const isExcluded = (c: DataCheck, exclusions: Record<string, boolean> | undefined) => exclusions?.[c.recording] ?? c.defaultExclude

/** Recordings left out of the analysis: the defaults, overridden by the user's choices. */
export function excludedRecordings(checks: DataCheck[] | undefined, exclusions: Record<string, boolean> | undefined): Set<string> {
  return new Set((checks ?? []).filter((c) => isExcluded(c, exclusions)).map((c) => c.recording))
}
