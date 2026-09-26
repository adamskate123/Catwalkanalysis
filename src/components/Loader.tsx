import { useRef, useState } from 'react'
import { pickTables } from '../lib/parse'
import { demoSheet, sheetToCsv } from '../lib/demo'
import { download } from '../lib/export'
import { matchColumn } from '../lib/catalog'
import type { ExperimentSummary } from '../lib/experiment'
import { isBackupFile, readSpreadsheets, type LoadedFile } from '../lib/readFiles'
import { WalkwayDiagram } from './diagrams'

interface Props {
  onLoaded: (files: LoadedFile[]) => void
  onLearn: () => void
  experiments: ExperimentSummary[]
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onImport: (file: File) => Promise<void>
}

function when(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function Loader({ onLoaded, onLearn, experiments, onOpen, onDelete, onImport }: Props) {
  const [files, setFiles] = useState<LoadedFile[]>([])
  const [errors, setErrors] = useState<{ text: string; level: 'info' | 'warning' }[]>([])
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const addFiles = async (list: FileList | File[]) => {
    setBusy(true)
    const all = Array.from(list)
    const msgs: { text: string; level: 'info' | 'warning' }[] = []
    for (const b of all.filter(isBackupFile)) {
      try {
        await onImport(b)
      } catch (e) {
        msgs.push({ level: 'warning', text: e instanceof Error ? e.message : `${b.name}: could not be imported.` })
      }
    }
    const { files: added, messages } = await readSpreadsheets(all.filter((f) => !isBackupFile(f)))
    setFiles((prev) => [...prev, ...added])
    setErrors([...msgs, ...messages])
    setBusy(false)
  }

  const analyse = () => onLoaded(files)

  return (
    <>
      <section className="hero">
        <div>
          <h1>Turn CatWalk XT exports into graphs and a readable gait summary</h1>
          <p className="lede">
            Load one or more run-statistics files exported from CatWalk XT. Gait Lab recognises the parameters, averages runs per animal, compares groups
            and timepoints, and points out patterns linked to specific kinds of neurological deficit.
          </p>
          <div className="row">
            <button className="btn primary" onClick={() => onLoaded([{ name: 'Demo data (simulated)', tables: pickTables([demoSheet()]), isKey: false }])}>
              Try with demo data
            </button>
            <button className="btn" onClick={onLearn}>
              How CatWalk works →
            </button>
          </div>
        </div>
        <figure className="figure" style={{ margin: 0 }}>
          <WalkwayDiagram />
          <figcaption>
            CatWalk: light trapped in a glass walkway escapes where a paw touches it, so a high-speed camera below sees bright paw prints.
          </figcaption>
        </figure>
      </section>

      {experiments.length > 0 && (
        <div className="card">
          <h2>Your experiments</h2>
          <p className="small muted">Saved on this device. Open one to see its results or add new data.</p>
          <ul className="file-list">
            {experiments.map((e) => (
              <li key={e.id}>
                <span>
                  <b>{e.name}</b>
                  <span className="muted">
                    {' '}
                    · {e.files} file{e.files === 1 ? '' : 's'}, {e.rows} rows · updated {when(e.updatedAt)}
                  </span>
                </span>
                <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                  <button className="btn sm primary" onClick={() => onOpen(e.id)}>
                    Open
                  </button>
                  <button
                    className="btn sm ghost"
                    aria-label={`Delete ${e.name}`}
                    onClick={() => {
                      if (confirm(`Delete "${e.name}" from this device? Export a backup first if you may need it again.`)) onDelete(e.id)
                    }}
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2>{experiments.length ? 'Start a new experiment' : 'Load your files'}</h2>
        <div
          className={`drop${over ? ' over' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
          }}
        >
          <input
            ref={input}
            type="file"
            multiple
            accept=".xlsx,.xlsm,.csv,.txt,.tsv,.json,.gaitlab,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <p style={{ fontWeight: 600, marginBottom: 4 }}>{busy ? 'Reading…' : 'Drop files here or tap to choose'}</p>
          <p className="muted small" style={{ margin: 0 }}>
            Excel (.xlsx) or text (.csv, .txt, .tsv). Add several files to combine cohorts or timepoints, or drop a Gait Lab backup (.gaitlab.json) to
            restore a saved experiment.
          </p>
        </div>
        {errors.map((e) => (
          <div key={e.text} className={`notice${e.level === 'warning' ? ' warning' : ''}`} style={{ marginTop: 10 }}>
            <span className="ic">{e.level === 'warning' ? '!' : 'i'}</span>
            <span>{e.text}</span>
          </div>
        ))}
        {files.length > 0 && (
          <>
            <ul className="file-list">
              {files.map((f, i) => (
                <li key={f.name + i}>
                  <span>
                    <b>{f.name}</b>
                    <span className="muted">
                      {' '}
                      · {f.tables.reduce((s, t) => s + t.rows.length, 0)} rows
                      {f.tables.length > 1 ? ` from ${f.tables.length} sheets` : ''} ·{' '}
                      {f.isKey
                        ? 'animal key'
                        : `${f.tables[0]?.headers.filter((h) => matchColumn(h)).length} parameters recognised`}
                    </span>
                  </span>
                  <button className="btn ghost sm" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={analyse}>
                Analyze {files.length} file{files.length > 1 ? 's' : ''}
              </button>
              <span className="small muted">A new experiment is created and saved on this device; you can add more data to it later.</span>
            </div>
          </>
        )}
      </div>

      <div className="steps">
        <div className="card">
          <h3>
            <span className="step-n">1</span>Export from CatWalk XT
          </h3>
          <p className="small">
            After classifying runs, open <i>Analysis → Statistics</i> and export the <b>run statistics</b> (one row per run) to Excel or text. Include your
            independent variables (e.g. genotype, treatment, timepoint) and the animal/trial ID.
          </p>
        </div>
        <div className="card">
          <h3>
            <span className="step-n">2</span>Check the setup
          </h3>
          <p className="small">
            Gait Lab guesses which columns hold the animal ID, group and timepoint and which group is the control. You can change any of these, reorder
            groups, exclude non-compliant runs and adjust for walking speed.
          </p>
        </div>
        <div className="card">
          <h3>
            <span className="step-n">3</span>Read the results
          </h3>
          <p className="small">
            Get a written summary, a gait "fingerprint" heatmap, per-paw plots, time courses and tables. Everything can be exported as CSV, SVG or PNG.
          </p>
        </div>
      </div>
      <p className="small muted">
        Want to see the expected layout?{' '}
        <button className="btn ghost sm" onClick={() => download('demo_catwalk_runs.csv', sheetToCsv(demoSheet()), 'text/csv')}>
          Download the demo file
        </button>
      </p>
    </>
  )
}
