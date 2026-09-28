import { useRef, useState, type ReactElement } from 'react'
import { pickTables } from '../lib/parse'
import { sheetToCsv } from '../lib/demo'
import { download } from '../lib/export'
import type { ExperimentSummary } from '../lib/experiment'
import { getImportOptions, setImportOptions, type PrismLayout } from '../lib/importers'
import { isBackupFile, readSpreadsheets, type LoadedFile } from '../lib/readFiles'
import { PROGRAMS, program } from '../programs'
import { ArenaDiagram, RotarodDiagram, WalkwayDiagram } from './diagrams'

interface Props {
  onLoaded: (files: LoadedFile[]) => void
  onLearn: () => void
  experiments: ExperimentSummary[]
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onImport: (file: File) => Promise<void>
  /** Saved experiments that belong to the other programs, by program id. */
  otherCounts: Record<string, number>
  onSwitch: (id: string) => void
}

const HERO: Record<string, { title: string; figure: () => ReactElement; caption: string; learn: string }> = {
  catwalk: {
    title: 'Turn CatWalk XT exports into graphs and a readable gait summary',
    figure: WalkwayDiagram,
    caption: 'CatWalk: light trapped in a glass walkway escapes where a paw touches it, so a high-speed camera below sees bright paw prints.',
    learn: 'How CatWalk works →',
  },
  rotarod: {
    title: 'Turn rotarod results into learning curves and a readable motor summary',
    figure: RotarodDiagram,
    caption: 'Rotarod: mice walk on a rod that gradually speeds up; the time until each mouse falls measures coordination, balance and motor learning.',
    learn: 'How the rotarod works →',
  },
  openfield: {
    title: 'Turn open field tracking into graphs and a readable activity summary',
    figure: ArenaDiagram,
    caption: 'Open field: a camera tracks the mouse in a novel arena. Distance measures activity; time near the walls versus the centre reflects anxiety-like behaviour.',
    learn: 'How the open field works →',
  },
}

/** How Prism tables (and Prism-style spreadsheets) are read. */
export function ImportOptionsField() {
  const [layout, setLayout] = useState<PrismLayout>(getImportOptions().prismLayout ?? 'auto')
  return (
    <label className="field" style={{ maxWidth: 420, marginTop: 12 }}>
      Prism tables and group-per-column sheets
      <select
        value={layout}
        onChange={(e) => {
          const v = e.target.value as PrismLayout
          setLayout(v)
          setImportOptions({ prismLayout: v })
        }}
      >
        <option value="auto">Automatic (rows are animals unless it's an XY table)</option>
        <option value="animals">Rows are animals, subcolumns are {program().runsNoun}</option>
        <option value="trials">Rows are {program().rowAxis.toLowerCase()}s, subcolumns are animals</option>
      </select>
      <span className="hint">Applies to files you add after changing it.</span>
    </label>
  )
}

function when(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function Loader({ onLoaded, onLearn, experiments, onOpen, onDelete, onImport, otherCounts, onSwitch }: Props) {
  const prog = program()
  const hero = HERO[prog.id]
  const Figure = hero.figure
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
          <h1>{hero.title}</h1>
          <p className="lede">{prog.lede}</p>
          <div className="row">
            <button className="btn primary" onClick={() => onLoaded([{ name: 'Demo data (simulated)', tables: pickTables([prog.demo()]), isKey: false }])}>
              Try with demo data
            </button>
            <button className="btn" onClick={onLearn}>
              {hero.learn}
            </button>
          </div>
        </div>
        <figure className="figure" style={{ margin: 0 }}>
          <Figure />
          <figcaption>{hero.caption}</figcaption>
        </figure>
      </section>

      {Object.values(otherCounts).some((n) => n > 0) && (
        <p className="small muted" style={{ margin: '0 0 12px' }}>
          Also saved on this device:{' '}
          {PROGRAMS.filter((p) => otherCounts[p.id]).map((p, i) => (
            <span key={p.id}>
              {i > 0 && ', '}
              <button className="btn ghost sm" style={{ padding: 0, minHeight: 0 }} onClick={() => onSwitch(p.id)}>
                {otherCounts[p.id]} in {p.name}
              </button>
            </span>
          ))}
          .
        </p>
      )}

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
            accept=".xlsx,.xlsm,.csv,.txt,.tsv,.prism,.json,.gaitlab,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <p style={{ fontWeight: 600, marginBottom: 4 }}>{busy ? 'Reading…' : 'Drop files here or tap to choose'}</p>
          <p className="muted small" style={{ margin: 0 }}>
            {prog.instrument} exports, Excel (.xlsx), text (.csv, .txt, .tsv) or Prism 10 (.prism). Spreadsheets can hold one row per{' '}
            {prog.runNoun}, one column per {prog.runNoun} or group (Prism style), or a measure/value list. Add several files to combine cohorts or
            timepoints, or drop a backup (.gaitlab.json) to restore a saved experiment.
          </p>
        </div>
        <ImportOptionsField />
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
                        : ((n) => `${n} parameter${n === 1 ? '' : 's'} recognised`)(f.tables[0]?.headers.filter((h) => prog.matchColumn(h)).length ?? 0)}
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
        {prog.steps.map((st, k) => (
          <div className="card" key={st.title}>
            <h3>
              <span className="step-n">{k + 1}</span>
              {st.title}
            </h3>
            <p className="small">{st.text}</p>
          </div>
        ))}
      </div>
      <p className="small muted">
        Want to see the expected layout?{' '}
        <button className="btn ghost sm" onClick={() => download(prog.demoFile, sheetToCsv(prog.demo()), 'text/csv')}>
          Download the demo file
        </button>
      </p>
    </>
  )
}
