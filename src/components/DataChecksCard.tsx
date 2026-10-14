import { CHECK_KINDS, isExcluded, type DataCheck } from '../lib/dataChecks'
import type { AnalysisConfig } from '../lib/analysis'
import type { BirthDateConflict } from '../lib/parse'

interface Props {
  checks: DataCheck[]
  /** Animals whose dates of birth differ between rows of a weights file. */
  birthDates?: BirthDateConflict[]
  cfg: AnalysisConfig
  update: (patch: Partial<AnalysisConfig>) => void
}

/** Setup → Data checks: runs flagged on import, each with a checkbox to leave it out. */
export function DataChecksCard({ checks, birthDates = [], cfg, update }: Props) {
  const ex = cfg.runExclusions
  const excluded = checks.filter((c) => isExcluded(c, ex)).length
  const set = (list: DataCheck[], value: boolean) => {
    const next = { ...(ex ?? {}) }
    for (const c of list) {
      // Store only choices that differ from the default, so new defaults still apply.
      if (value === c.defaultExclude) delete next[c.recording]
      else next[c.recording] = value
    }
    update({ runExclusions: Object.keys(next).length ? next : undefined })
  }
  const changed = Object.keys(ex ?? {}).length > 0

  return (
    <div className="card" id="data-checks">
      <h2>Data checks</h2>
      {checks.length > 0 && (
        <p className="small">
          {checks.length} run{checks.length === 1 ? '' : 's'} look{checks.length === 1 ? 's' : ''} inconsistent; <b>{excluded}</b> {excluded === 1 ? 'is' : 'are'}{' '}
          left out of the analysis. Tick or untick a run to change that. Nothing is deleted: excluded runs stay in the data and can be brought back at any time.
        </p>
      )}
      {changed && (
        <button className="btn sm" onClick={() => update({ runExclusions: undefined })} style={{ marginBottom: 8 }}>
          Reset to the defaults
        </button>
      )}
      {CHECK_KINDS.map(({ kind, title, text }) => {
        const list = checks.filter((c) => c.issues.some((i) => i.kind === kind))
        if (!list.length) return null
        const n = list.filter((c) => isExcluded(c, ex)).length
        return (
          <details key={kind} open={list.length <= 12} style={{ marginTop: 12 }}>
            <summary>
              <b>{title}</b>{' '}
              <span className="badge">
                {list.length} run{list.length === 1 ? '' : 's'} · {n} excluded
              </span>
            </summary>
            {text && <p className="small muted" style={{ margin: '6px 0' }}>{text}</p>}
            <div className="row" style={{ gap: 6, margin: '6px 0' }}>
              <button className="btn sm" onClick={() => set(list, true)} disabled={n === list.length}>
                Exclude all {list.length}
              </button>
              <button className="btn sm" onClick={() => set(list, false)} disabled={n === 0}>
                Keep all {list.length}
              </button>
            </div>
            <div className="table-wrap" style={{ maxHeight: 420 }}>
              <table className="small">
                <thead>
                  <tr>
                    <th>Exclude</th>
                    <th>Animal</th>
                    <th>Date</th>
                    <th>Run</th>
                    <th>Issue</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.recording}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isExcluded(c, ex)}
                          onChange={(e) => set([c], e.target.checked)}
                          aria-label={`Exclude ${c.subject} on ${c.date} (${c.recording})`}
                        />
                      </td>
                      <td>{c.subject}</td>
                      <td>{c.date}</td>
                      <td>{c.recording}</td>
                      <td style={{ whiteSpace: 'normal', minWidth: 260 }}>
                        {c.issues
                          .filter((i) => i.kind === kind)
                          .map((i) => i.text)
                          .join('; ')}
                        {c.issues.some((i) => i.kind !== kind) && (
                          <span className="muted">
                            {' '}
                            (also: {c.issues.filter((i) => i.kind !== kind).map((i) => i.text).join('; ')})
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )
      })}
      {birthDates.length > 0 && (
        <details open={birthDates.length <= 12} style={{ marginTop: 12 }}>
          <summary>
            <b>Dates of birth that differ between rows of the weights file</b> <span className="badge">{birthDates.length} animals</span>
          </summary>
          <p className="small muted" style={{ margin: '6px 0' }}>
            Usually a typo in one row (often the year). The date on most of the animal's rows is used for its age; correct the other rows in the weights
            file to remove the warning. If two animals share an ID (a tag reused in a new litter), give them different IDs.
          </p>
          <div className="table-wrap" style={{ maxHeight: 420 }}>
            <table className="small">
              <thead>
                <tr>
                  <th>Animal</th>
                  <th>Date used</th>
                  <th>Dates in the file (rows)</th>
                </tr>
              </thead>
              <tbody>
                {birthDates.map((c) => (
                  <tr key={`${c.file}|${c.id}`}>
                    <td>{c.id}</td>
                    <td>{c.used}</td>
                    <td style={{ whiteSpace: 'normal' }}>{c.dates.map((d) => `${d.date} (${d.rows})`).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}
