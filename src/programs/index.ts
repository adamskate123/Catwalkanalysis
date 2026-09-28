// Program registry. Gait Lab hosts several behavioural test programs
// (CatWalk gait, rotarod, open field). The analysis engine is shared; each
// program supplies its parameter catalogue, column recognition, phenotype
// patterns, wording and demo data. The active program is module state so the
// engine (parse → aggregate → analyse → interpret) can stay free of props.

import type { ColumnMatch, MetaRole, ParamDef } from '../lib/catalog'
import { metaRole as genericMetaRole } from '../lib/catalog'
import type { Domain } from '../lib/interpret'
import type { RawSheet } from '../lib/parse'
import { catwalk } from './catwalk'
import { rotarod } from './rotarod'
import { openfield } from './openfield'

export type ProgramId = 'catwalk' | 'rotarod' | 'openfield'

/** Per-animal values derived from the ordered trials of one session. */
export interface TrialDerived {
  /** New parameter id (must exist in the program's params). */
  id: string
  /** Source parameter id measured on every trial. */
  from: string
  how: 'max' | 'first' | 'last' | 'improvement'
}

export interface ProgramDef {
  id: ProgramId
  /** Name shown in the header and switcher. */
  name: string
  /** Short noun for the test, e.g. "rotarod". */
  test: string
  /** Instrument / software the program expects exports from. */
  instrument: string
  tagline: string
  lede: string
  params: ParamDef[]
  categoryLabels: Record<string, string>
  categoryOrder: string[]
  matchColumn: (name: string) => ColumnMatch | null
  /** Program-specific metadata role overrides; return undefined to fall back to the generic rules. */
  metaRole?: (name: string) => MetaRole | null | undefined
  domains: Domain[]
  /** What one row of an export represents ("run", "trial"). */
  runNoun: string
  runsNoun: string
  trialDerived?: TrialDerived[]
  demo: () => RawSheet
  demoFile: string
  /** Steps shown on the start screen. */
  steps: { title: string; text: string }[]
  /** A table with fewer recognised parameters than this is treated as an animal key. */
  keyMinParams: number
  /** Column name for the row labels of a Prism table whose rows are trials or time bins. */
  rowAxis: string
  /** Column name used when a sheet holds one unnamed measure (e.g. "Trial 1…Trial 5" columns). */
  primaryColumn: string
  /** CatWalk-only views: walking-speed check/adjustment and per-paw fingerprint. */
  features: { speed: boolean; paws: boolean }
  /** Prefix for exported file names. */
  filePrefix: string
}

export const PROGRAMS: ProgramDef[] = [catwalk, rotarod, openfield]

let active: ProgramDef = catwalk
const byId: Record<string, Record<string, ParamDef>> = {}

export function program(): ProgramDef {
  return active
}

export function setProgram(id: ProgramId): ProgramDef {
  active = PROGRAMS.find((p) => p.id === id) ?? catwalk
  return active
}

export function getProgram(id: string | undefined): ProgramDef {
  return PROGRAMS.find((p) => p.id === id) ?? catwalk
}

/** Parameter lookup for the active program. */
export function paramById(id: string): ParamDef | undefined {
  const map = (byId[active.id] ??= Object.fromEntries(active.params.map((p) => [p.id, p])))
  return map[id]
}

/** Metadata role of a column name under the active program. */
export function roleOf(name: string): MetaRole | null {
  const o = active.metaRole?.(name)
  return o === undefined ? genericMetaRole(name) : o
}
