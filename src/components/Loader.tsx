import { useRef, useState } from 'react'
import { pickTables, readFile, type ParsedTable } from '../lib/parse'
import { demoSheet, sheetToCsv } from '../lib/demo'
import { download } from '../lib/export'
import { matchColumn } from '../lib/catalog'
import { WalkwayDiagram } from './diagrams'

interface Props {
  onLoaded: (tables: ParsedTable[]) => void
  onLearn: () => void
}

interface Loaded {
  name: string
  tables: ParsedTable[]
}

export function Loader({ onLoaded, onLearn }: Props) {
  const [files, setFiles] = useState<Loaded[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const addFiles = async (list: FileList | File[]) => {
    setBusy(true)
    const errs: string[] = []
    const added: Loaded[] = []
    for (const f of Array.from(list)) {
      try {
        const sheets = await readFile(f)
        const tables = pickTables(sheets)
        if (!tables.length || !tables.some((t) => t.rows.length)) throw new Error(`${f.name}: no data rows found.`)
        const recognised = tables.reduce((s, t) => s + t.headers.filter((h) => matchColumn(h)).length, 0)
        if (recognised < 3)
          errs.push(
            `${f.name}: no CatWalk parameters found, so it will be used as an animal key. Its columns (e.g. genotype, sex, age) are joined to the gait data through a matching ID column such as the trial name.`,
          )
        added.push({ name: f.name, tables })
      } catch (e) {
        errs.push(e instanceof Error ? e.message : `${f.name}: could not be read.`)
      }
    }
    setFiles((prev) => [...prev, ...added])
    setErrors(errs)
    setBusy(false)
  }

  const analyse = () => onLoaded(files.flatMap((f) => f.tables))

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
            <button className="btn primary" onClick={() => onLoaded(pickTables([demoSheet()]))}>
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

      <div className="card">
        <h2>Load your files</h2>
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
            accept=".xlsx,.xlsm,.csv,.txt,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <p style={{ fontWeight: 600, marginBottom: 4 }}>{busy ? 'Reading…' : 'Drop files here or tap to choose'}</p>
          <p className="muted small" style={{ margin: 0 }}>
            Excel (.xlsx) or text (.csv, .txt, .tsv). Add several files to combine cohorts or timepoints.
          </p>
        </div>
        {errors.map((e) => (
          <div key={e} className={`notice${e.includes('animal key') ? '' : ' warning'}`} style={{ marginTop: 10 }}>
            <span className="ic">{e.includes('animal key') ? 'i' : '!'}</span>
            <span>{e}</span>
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
                      {(f.tables[0]?.headers.filter((h) => matchColumn(h)).length ?? 0) < 3
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
