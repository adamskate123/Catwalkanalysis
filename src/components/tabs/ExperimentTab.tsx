import { useRef, useState } from 'react'
import { SESSION_COL, toBundle, type Experiment } from '../../lib/experiment'
import { download, safeName } from '../../lib/export'
import { isKeyTable, type Dataset } from '../../lib/parse'
import { readSpreadsheets, type LoadedFile } from '../../lib/readFiles'

interface Props {
  experiment: Experiment
  ds: Dataset
  onUpdate: (e: Experiment) => void
  onAddFiles: (files: LoadedFile[], session?: string) => string
  onDelete: () => void
}

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function ExperimentTab({ experiment, ds, onUpdate, onAddFiles, onDelete }: Props) {
  const [pending, setPending] = useState<LoadedFile[]>([])
  const [session, setSession] = useState('')
  const [messages, setMessages] = useState<{ text: string; level: 'info' | 'warning' }[]>([])
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const sessions = [...new Set(experiment.files.map((f) => f.session).filter((s): s is string => Boolean(s)))]
  const usesSessions = sessions.length > 0

  const pick = async (list: FileList | null) => {
    if (!list?.length) return
    setBusy(true)
    const { files, messages } = await readSpreadsheets(Array.from(list))
    setPending((p) => [...p, ...files])
    setMessages(messages)
    setBusy(false)
  }

  const add = () => {
    const summary = onAddFiles(pending, session.trim() || undefined)
    setMessages([{ level: 'info', text: summary }])
    setPending([])
    setSession('')
  }

  const update = (patch: Partial<Experiment>) => onUpdate({ ...experiment, ...patch })

  return (
    <>
      <div className="card">
        <h2>Add data</h2>
        <p className="small">
          Add new CatWalk exports, or updated versions of files you added before, plus updated animal keys. Rows that appear again (same experiment, animal, trial,
          timepoint/session and run) replace the earlier copy, so re-exporting the whole CatWalk experiment each time is fine. New animals, groups and
          timepoints are added to the analysis, and your settings are kept.
        </p>
        <div className="row">
          <input ref={input} type="file" multiple hidden accept=".xlsx,.xlsm,.csv,.txt,.tsv" onChange={(e) => (pick(e.target.files), (e.target.value = ''))} />
          <button className="btn" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? 'Reading…' : 'Choose files'}
          </button>
        </div>
        {pending.length > 0 && (
          <>
            <ul className="file-list">
              {pending.map((f, i) => (
                <li key={f.name + i}>
                  <span>
                    <b>{f.name}</b>
                    <span className="muted"> · {f.isKey ? 'animal key' : `${f.tables.reduce((n, t) => n + t.rows.length, 0)} rows`}</span>
                  </span>
                  <button className="btn ghost sm" onClick={() => setPending(pending.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <label className="field" style={{ maxWidth: 420, marginTop: 12 }}>
              Session / timepoint label (optional)
              <input type="text" list="gl-sessions" value={session} onChange={(e) => setSession(e.target.value)} placeholder="e.g. Week 8, P60, Post-dose 4 wk" />
              <datalist id="gl-sessions">
                {sessions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <span className="hint">
                Use this when CatWalk's Time_Point was left as "Undefined". Every row in these files gets this label in a "{SESSION_COL}" column, which
                becomes the timepoint for longitudinal analysis.
                {usesSessions ? ' Earlier files in this experiment use session labels, so label these too.' : ''}
              </span>
            </label>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={add}>
                Add {pending.length} file{pending.length === 1 ? '' : 's'} to “{experiment.name}”
              </button>
            </div>
          </>
        )}
        {messages.map((m) => (
          <div key={m.text} className={`notice${m.level === 'warning' ? ' warning' : ''}`} style={{ marginTop: 10 }}>
            <span className="ic">{m.level === 'warning' ? '!' : 'i'}</span>
            <span>{m.text}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Files in this experiment</h2>
        <p className="small muted">Listed oldest first. When the same row appears in several files, the one added last is used.</p>
        <ul className="file-list">
          {experiment.files.map((f) => (
            <li key={f.id}>
              <span style={{ minWidth: 0 }}>
                <b>{f.name}</b>
                <span className="muted">
                  {' '}
                  · {f.tables.some((t) => !isKeyTable(t)) ? `${f.tables.reduce((n, t) => n + t.rows.length, 0)} rows` : 'animal key'} · added {when(f.addedAt)}
                </span>
                {f.tables.some((t) => !isKeyTable(t)) && (
                <span className="row" style={{ marginTop: 4, gap: 6 }}>
                  <span className="small muted">Session:</span>
                  <input
                    type="text"
                    list="gl-sessions-all"
                    value={f.session ?? ''}
                    placeholder="none"
                    aria-label={`Session label for ${f.name}`}
                    onChange={(e) => update({ files: experiment.files.map((x) => (x.id === f.id ? { ...x, session: e.target.value || undefined } : x)) })}
                    style={{ width: 160, minHeight: 30, padding: '2px 8px' }}
                  />
                </span>
                )}
              </span>
              <button
                className="btn ghost sm"
                onClick={() => {
                  if (confirm(`Remove ${f.name} from this experiment?`)) update({ files: experiment.files.filter((x) => x.id !== f.id) })
                }}
                disabled={experiment.files.length === 1}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <datalist id="gl-sessions-all">
          {sessions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        {ds.notices.map((n) => (
          <div key={n} className="notice" style={{ marginTop: 10 }}>
            <span className="ic">i</span>
            <span>{n}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Experiment details</h2>
        <div className="form-grid">
          <label className="field">
            Name
            <input type="text" value={experiment.name} onChange={(e) => update({ name: e.target.value })} />
          </label>
        </div>
        <label className="field" style={{ marginTop: 12 }}>
          Notes
          <textarea
            value={experiment.notes ?? ''}
            onChange={(e) => update({ notes: e.target.value })}
            rows={4}
            placeholder="Cohorts, dosing dates, anything you want to remember about this experiment"
            style={{ width: '100%', font: 'inherit', padding: 8, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'inherit' }}
          />
        </label>
        <p className="small muted" style={{ marginTop: 8 }}>
          Created {when(experiment.createdAt)} · last changed {when(experiment.updatedAt)}
        </p>
      </div>

      <div className="card">
        <h2>Backup and devices</h2>
        <p className="small">
          Experiments are saved in this browser on this device only. To use one on another device, or to keep a safe copy, export a backup file and open it
          in Gait Lab elsewhere (drop it on the start screen). Browsers can clear saved data, especially Safari on iPhone and iPad for sites not added to
          the Home Screen, so export a backup after each session.
        </p>
        <div className="row">
          <button
            className="btn primary"
            onClick={() => download(`${safeName(experiment.name)}_${new Date().toISOString().slice(0, 10)}.gaitlab.json`, toBundle(experiment), 'application/json')}
          >
            Export backup
          </button>
          <button
            className="btn"
            onClick={() => {
              if (confirm(`Delete "${experiment.name}" and all its files from this device? This cannot be undone.`)) onDelete()
            }}
          >
            Delete experiment
          </button>
        </div>
      </div>
    </>
  )
}
