import { useState } from 'react'
import { distinctValues, type AnalysisConfig } from '../lib/analysis'
import { AGE_WINDOW_COL, windowsOf, type AgeWindowSettings } from '../lib/ageWindows'
import type { Dataset } from '../lib/parse'
import { parseDay } from '../lib/parse'

interface Props {
  ds: Dataset
  cfg: AnalysisConfig
  update: (patch: Partial<AnalysisConfig>) => void
  settings: AgeWindowSettings | undefined
  /** Saves the settings; `timeCol` switches the timepoints at the same time. */
  onChange: (s: AgeWindowSettings | undefined, timeCol?: string | null) => void
}

const DEFAULT: AgeWindowSettings = { mode: 'bins', values: [50, 100, 150, 200, 250, 300, 350], tolerance: 7 }

const parseValues = (s: string) =>
  s
    .split(/[\s,;]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0)

/** "JAX NM, 2026-08-04" / "JAX NM<tab>8/4/2026" lines → { id: ISO date }. */
function parsePairs(text: string, ids: string[]): { dates: Record<string, string>; unknown: string[] } {
  const dates: Record<string, string> = {}
  const unknown: string[] = []
  const byLower = new Map(ids.map((id) => [id.toLowerCase(), id]))
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(.+?)\s*[\t,;]\s*(\S+)\s*$/.exec(line)
    if (!m) continue
    const day = parseDay(m[2])
    const id = byLower.get(m[1].toLowerCase())
    if (day === null) continue
    if (!id) {
      unknown.push(m[1])
      continue
    }
    dates[id] = new Date(day * 864e5).toISOString().slice(0, 10)
  }
  return { dates, unknown }
}

export function AgeWindowsCard({ ds, cfg, update, settings, onChange }: Props) {
  const info = ds.ageInfo
  const s = settings ?? DEFAULT
  const [mode, setMode] = useState(s.mode)
  const [valuesText, setValuesText] = useState(s.values.join(', '))
  const [tolerance, setTolerance] = useState(s.tolerance)
  const [paste, setPaste] = useState('')
  const [pasteMsg, setPasteMsg] = useState<string | null>(null)
  if (!info) return null

  const active = Boolean(settings && windowsOf(settings).length && ds.headers.includes(AGE_WINDOW_COL))
  const preview = windowsOf({ mode, values: parseValues(valuesText), tolerance })
  const timeCols = ds.columns.filter((c) => c.meta === 'time' && c.name !== AGE_WINDOW_COL).map((c) => c.name)
  // Entering dates alone doesn't switch windows on: without saved settings the base has no windows.
  const save = (patch: Partial<AgeWindowSettings>, timeCol?: string | null) => onChange({ ...(settings ?? { ...DEFAULT, values: [] }), ...patch }, timeCol)
  const entered = settings?.birthDates ?? {}
  const setDob = (id: string, value: string) => {
    const next = { ...entered }
    if (value) next[id] = value
    else delete next[id]
    save({ birthDates: next })
  }
  const counts = new Map<string, Set<string>>()
  if (active) {
    const wi = ds.headers.indexOf(AGE_WINDOW_COL)
    const ii = ds.headers.indexOf(info.idColumn)
    for (const r of ds.rows) {
      const w = r[wi]
      if (w === null || w === '') continue
      const set = counts.get(String(w)) ?? new Set<string>()
      set.add(String(r[ii]))
      counts.set(String(w), set)
    }
  }

  return (
    <div className="card">
      <h2>Age windows</h2>
      <p className="small">
        Group runs by each animal's age on the test day, in windows you set (e.g. ≤50, 51-100 days), to compare with other tests binned by age. The instrument's own
        timepoints stay available; switch between them below.
      </p>
      <p className="small">
        <b>
          {info.aged} of {info.total} runs
        </b>{' '}
        have an age at test
        {info.dobSource && info.testSource ? `, from ${info.dobSource} and ${info.testSource}` : ''}
        {info.ageColumn ? `${info.dobSource && info.testSource ? ', or' : ', from'} the ${info.ageColumn} column` : ''}.
        {info.aged < info.total && !info.dobSource && ' Add dates of birth below, or load an animal key with a date-of-birth column.'}
        {info.missingTestDates.length > 0 && ' Some runs have a date of birth but no test date: enter it below.'}
      </p>

      <div className="form-grid">
        <label className="field">
          Windows
          <select value={mode} onChange={(e) => setMode(e.target.value as AgeWindowSettings['mode'])}>
            <option value="bins">Consecutive bins (≤50, 51-100, … days)</option>
            <option value="targets">Target ages ± days (e.g. 50 ± 7)</option>
          </select>
        </label>
        <label className="field">
          {mode === 'bins' ? 'Bin edges (days)' : 'Target ages (days)'}
          <input type="text" value={valuesText} onChange={(e) => setValuesText(e.target.value)} placeholder="50, 100, 150" />
          <span className="hint">{preview.length ? preview.map((w) => w.label).join(' · ') : 'Enter ages in days, separated by commas.'}</span>
        </label>
        {mode === 'targets' && (
          <label className="field">
            ± days
            <input type="number" min={0} value={tolerance} onChange={(e) => setTolerance(Math.max(0, Number(e.target.value) || 0))} />
          </label>
        )}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn primary" disabled={!preview.length} onClick={() => save({ mode, values: parseValues(valuesText), tolerance }, AGE_WINDOW_COL)}>
          {active ? 'Update windows' : 'Apply age windows'}
        </button>
        {active && (
          <button className="btn" onClick={() => onChange(settings ? { ...settings, values: [] } : undefined, cfg.timeCol === AGE_WINDOW_COL ? (timeCols[0] ?? null) : undefined)}>
            Remove windows
          </button>
        )}
      </div>

      {active && (
        <>
          <label className="field" style={{ marginTop: 12, maxWidth: 420 }}>
            Analyse timepoints by
            <select value={cfg.timeCol ?? ''} onChange={(e) => update({ timeCol: e.target.value || null, timeOrder: distinctValues(ds, e.target.value || null) })}>
              <option value={AGE_WINDOW_COL}>Age windows</option>
              {timeCols.map((c) => (
                <option key={c} value={c}>
                  {c} (from the data files)
                </option>
              ))}
              <option value="">No timepoints (all runs together)</option>
            </select>
          </label>
          <table className="small" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Window</th>
                <th className="num">Animals</th>
              </tr>
            </thead>
            <tbody>
              {windowsOf(settings!).map((w) => (
                <tr key={w.label}>
                  <td>{w.label}</td>
                  <td className="num">{counts.get(w.label)?.size ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {info.inWindow !== null && info.inWindow < info.total && (
            <p className="small muted">
              {info.total - info.inWindow} of {info.total} runs have no age or fall outside every window; they are left out when timepoints are age windows.
            </p>
          )}
        </>
      )}

      {info.missingTestDates.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h3 style={{ fontSize: '0.95rem' }}>Test dates</h3>
          <div className="form-grid">
            {info.missingTestDates.map((slot) => (
              <label className="field" key={slot}>
                {slot || 'All runs'}
                <input
                  type="date"
                  value={settings?.testDates?.[slot] ?? ''}
                  onChange={(e) => save({ testDates: { ...(settings?.testDates ?? {}), [slot]: e.target.value } })}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          Dates of birth ({info.ids.filter((id) => entered[id] || info.fileBirthDates[id]).length} of {info.ids.length} animals, by {info.idColumn})
        </summary>
        <p className="small muted">
          Dates from the loaded files are shown in grey; a date entered here replaces it. Paste "ID, date" lines (e.g. from Excel) to fill many at once.
        </p>
        <textarea rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'JAX NM, 2026-08-04\nKX9.1 LF\t8/4/2026'} style={{ width: '100%' }} />
        <div className="row" style={{ margin: '6px 0' }}>
          <button
            className="btn sm"
            disabled={!paste.trim()}
            onClick={() => {
              const { dates, unknown } = parsePairs(paste, info.ids)
              save({ birthDates: { ...entered, ...dates } })
              setPasteMsg(`${Object.keys(dates).length} date(s) added.${unknown.length ? ` Not found in the data: ${unknown.join(', ')}.` : ''}`)
              setPaste('')
            }}
          >
            Add pasted dates
          </button>
          {pasteMsg && <span className="small muted">{pasteMsg}</span>}
        </div>
        <div className="table-wrap" style={{ maxHeight: 360 }}>
          <table className="small">
            <thead>
              <tr>
                <th>{info.idColumn}</th>
                <th>Date of birth</th>
              </tr>
            </thead>
            <tbody>
              {info.ids.map((id) => (
                <tr key={id}>
                  <td>{id}</td>
                  <td>
                    <input
                      type="date"
                      value={entered[id] ?? ''}
                      onChange={(e) => setDob(id, e.target.value)}
                      aria-label={`Date of birth of ${id}`}
                      style={{ width: 'auto' }}
                    />{' '}
                    {!entered[id] && info.fileBirthDates[id] && <span className="muted">{info.fileBirthDates[id]} (file)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
