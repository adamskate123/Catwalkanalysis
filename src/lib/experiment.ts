// Saved experiments: a named collection of loaded files plus analysis settings,
// which can grow over time as new CatWalk exports are added.

import { distinctValues, naturalCompare, type AnalysisConfig, autoConfig } from './analysis'
import type { InterpretOptions } from './interpret'
import { isKeyTable, type Dataset, type ParsedTable } from './parse'

export const SESSION_COL = 'Session'
export const BUNDLE_FORMAT = 'gaitlab-experiment'
export const BUNDLE_VERSION = 1

export interface StoredFile {
  id: string
  name: string
  addedAt: string
  /** Optional label (e.g. "Week 8") applied to every row of this file as a Session column. */
  session?: string
  tables: ParsedTable[]
}

export interface Experiment {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  files: StoredFile[]
  cfg?: AnalysisConfig
  opt?: InterpretOptions
  notes?: string
  appVersion: string
}

export interface ExperimentSummary {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  files: number
  rows: number
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function summarise(e: Experiment): ExperimentSummary {
  return {
    id: e.id,
    name: e.name,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    files: e.files.length,
    rows: e.files.reduce((n, f) => n + f.tables.reduce((m, t) => m + t.rows.length, 0), 0),
  }
}

export const UNLABELLED_SESSION = 'Unlabelled'

/**
 * Tables of all files in the order they were added. When any file carries a
 * session label, every gait table gets a Session column (unlabelled files get
 * "Unlabelled" so their rows are not dropped); animal keys are left alone.
 */
export function experimentTables(e: Pick<Experiment, 'files'>): ParsedTable[] {
  const anySession = e.files.some((f) => f.session)
  return e.files.flatMap((f) =>
    f.tables.map((t) => {
      if (!anySession || isKeyTable(t) || t.headers.includes(SESSION_COL)) return t
      const label = f.session || UNLABELLED_SESSION
      return { ...t, headers: [...t.headers, SESSION_COL], rows: t.rows.map((r) => [...r, label]) }
    }),
  )
}

/** Suggests a name from CatWalk's Experiment column or the first file name. */
export function suggestName(tables: ParsedTable[], fallback: string): string {
  for (const t of tables) {
    const i = t.headers.findIndex((h) => /^experiment$/i.test(h.trim()))
    const v = i >= 0 ? t.rows.find((r) => r[i] !== null)?.[i] : null
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return fallback.replace(/\.(xlsx|xlsm|csv|tsv|txt)$/i, '').replace(/_(Run|Trial)Statistics$/i, '')
}

/**
 * Keeps the user's choices when the dataset grows: selected columns stay if they
 * still exist, and new groups/timepoints are appended to the existing order.
 */
export function reconcileConfig(old: AnalysisConfig | undefined, ds: Dataset): AnalysisConfig {
  const fresh = autoConfig(ds)
  if (!old) return fresh
  const has = (c: string | null) => c === null || ds.headers.includes(c)
  const keep = <K extends 'subjectCol' | 'groupCol' | 'timeCol' | 'compliantCol'>(k: K) => (has(old[k]) ? old[k] : fresh[k])
  const cfg: AnalysisConfig = {
    ...fresh,
    ...old,
    subjectCol: keep('subjectCol'),
    groupCol: keep('groupCol'),
    // A session/time column that appears for the first time is adopted automatically.
    timeCol: old.timeCol && has(old.timeCol) ? old.timeCol : fresh.timeCol,
    compliantCol: keep('compliantCol'),
    filters: old.filters.filter((f) => ds.headers.includes(f.col)),
  }
  const groups = distinctValues(ds, cfg.groupCol)
  if (cfg.groupCol !== old.groupCol) {
    Object.assign(cfg, { groupOrder: fresh.groupOrder, controlGroup: fresh.controlGroup, diseaseGroup: fresh.diseaseGroup, excludedGroups: [] })
  } else {
    cfg.groupOrder = [...old.groupOrder.filter((g) => groups.includes(g)), ...groups.filter((g) => !old.groupOrder.includes(g))]
    if (cfg.controlGroup && !groups.includes(cfg.controlGroup)) cfg.controlGroup = fresh.controlGroup
    if (cfg.diseaseGroup && !groups.includes(cfg.diseaseGroup)) cfg.diseaseGroup = null
  }
  const times = distinctValues(ds, cfg.timeCol)
  cfg.timeOrder =
    cfg.timeCol === old.timeCol
      ? [...old.timeOrder.filter((t) => times.includes(t)), ...times.filter((t) => !old.timeOrder.includes(t)).sort(naturalCompare)]
      : times
  return cfg
}

// ---------------------------------------------------------------------------
// Backup files

export function toBundle(e: Experiment): string {
  return JSON.stringify({ format: BUNDLE_FORMAT, formatVersion: BUNDLE_VERSION, exportedAt: new Date().toISOString(), experiment: e })
}

export function fromBundle(text: string): Experiment {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('This file is not a Gait Lab experiment backup.')
  }
  const d = data as { format?: string; formatVersion?: number; experiment?: Experiment }
  if (d?.format !== BUNDLE_FORMAT || !d.experiment || !Array.isArray(d.experiment.files)) {
    throw new Error('This file is not a Gait Lab experiment backup.')
  }
  if ((d.formatVersion ?? 0) > BUNDLE_VERSION) throw new Error('This backup was made by a newer version of Gait Lab. Update the app and try again.')
  const e = d.experiment
  for (const f of e.files) {
    if (!Array.isArray(f.tables) || f.tables.some((t) => !Array.isArray(t.headers) || !Array.isArray(t.rows))) {
      throw new Error('The backup file is damaged (a data table is missing).')
    }
  }
  return e
}
