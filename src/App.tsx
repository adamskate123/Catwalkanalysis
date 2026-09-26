import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader } from './components/Loader'
import { Results } from './components/Results'
import { Learn } from './components/Learn'
import { Logo } from './components/Logo'
import { Changelog } from './components/Changelog'
import { APP_VERSION } from './version'
import { mergeTables } from './lib/parse'
import { aggregate, analyse, buildMeasures, type AnalysisConfig } from './lib/analysis'
import { DEFAULT_INTERPRET, type InterpretOptions } from './lib/interpret'
import { experimentTables, fromBundle, newId, reconcileConfig, suggestName, type Experiment, type ExperimentSummary, type StoredFile } from './lib/experiment'
import { deleteExperiment, getExperiment, listExperiments, requestPersistence, saveExperiment } from './lib/store'
import type { LoadedFile } from './lib/readFiles'
import { useChartTheme } from './lib/theme'

type View = 'analyze' | 'learn' | 'changes'

function initialView(): View {
  if (location.hash.startsWith('#learn')) return 'learn'
  if (location.hash === '#changes') return 'changes'
  return 'analyze'
}

export default function App() {
  const [view, setView] = useState<View>(initialView)
  const [experiment, setExperiment] = useState<Experiment | null>(null)
  const [cfg, setCfg] = useState<AnalysisConfig | null>(null)
  const [opt, setOpt] = useState<InterpretOptions>(DEFAULT_INTERPRET)
  const [library, setLibrary] = useState<ExperimentSummary[]>([])
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error' | 'off'>('saved')
  const [themePref, setThemePref] = useState<'auto' | 'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('theme') as 'light' | 'dark' | null) ?? 'auto'
    } catch {
      return 'auto'
    }
  })
  const theme = useChartTheme()

  useEffect(() => {
    const root = document.documentElement
    if (themePref === 'auto') delete root.dataset.theme
    else root.dataset.theme = themePref
    try {
      if (themePref === 'auto') localStorage.removeItem('theme')
      else localStorage.setItem('theme', themePref)
    } catch {
      /* storage unavailable */
    }
  }, [themePref])

  useEffect(() => {
    const onHash = () => setView(initialView())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (v: View, anchor?: string) => {
    setView(v)
    const hash = v === 'learn' ? `#learn${anchor ? '-' + anchor : ''}` : v === 'changes' ? '#changes' : ''
    history.replaceState(null, '', hash || location.pathname)
    if (anchor) setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' }), 50)
    else window.scrollTo({ top: 0 })
  }

  const refreshLibrary = useCallback(() => {
    listExperiments()
      .then(setLibrary)
      .catch(() => setLibrary([]))
  }, [])
  useEffect(refreshLibrary, [refreshLibrary])

  const tables = useMemo(() => (experiment ? experimentTables(experiment) : null), [experiment])
  const ds = useMemo(() => (tables ? mergeTables(tables) : null), [tables])
  const measures = useMemo(() => (ds ? buildMeasures(ds) : []), [ds])
  const agg = useMemo(() => (ds && cfg ? aggregate(ds, measures, cfg) : null), [ds, measures, cfg])
  const results = useMemo(() => (agg && cfg ? analyse(agg, measures, cfg) : null), [agg, measures, cfg])

  // Autosave the open experiment (data, settings and thresholds) shortly after any change.
  const saveTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!experiment || !cfg) return
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      saveExperiment({ ...experiment, cfg, opt, appVersion: APP_VERSION })
        .then(() => {
          setSaveState('saved')
          refreshLibrary()
        })
        .catch(() => setSaveState('error'))
    }, 400)
    return () => window.clearTimeout(saveTimer.current)
  }, [experiment, cfg, opt, refreshLibrary])

  const toStored = (files: LoadedFile[], session?: string): StoredFile[] =>
    files.map((f) => ({ id: newId(), name: f.name, addedAt: new Date().toISOString(), session: session || undefined, tables: f.tables }))

  const openExperiment = (e: Experiment, persistNow = false) => {
    const ds0 = mergeTables(experimentTables(e))
    const cfg0 = reconcileConfig(e.cfg, ds0)
    setExperiment(e)
    setCfg(cfg0)
    setSaveState(persistNow ? 'saving' : 'saved')
    if (persistNow) {
      // Save new experiments straight away rather than waiting for the autosave.
      saveExperiment({ ...e, cfg: cfg0, opt: e.opt ?? DEFAULT_INTERPRET, appVersion: APP_VERSION })
        .then(() => {
          setSaveState('saved')
          refreshLibrary()
        })
        .catch(() => setSaveState('error'))
    }
    setOpt(e.opt ?? DEFAULT_INTERPRET)
    requestPersistence()
    window.scrollTo({ top: 0 })
  }

  const onLoaded = (files: LoadedFile[]) => {
    const now = new Date().toISOString()
    const stored = toStored(files)
    const all = stored.flatMap((f) => f.tables)
    openExperiment({
      id: newId(),
      name: suggestName(all, files.find((f) => !f.isKey)?.name ?? files[0]?.name ?? 'Experiment'),
      createdAt: now,
      updatedAt: now,
      files: stored,
      appVersion: APP_VERSION,
    }, true)
  }

  /** Adds files to the open experiment; returns what changed, for display. */
  const addToExperiment = (files: LoadedFile[], session?: string): string => {
    if (!experiment || !ds || !cfg) return ''
    const before = aggregate(ds, measures, cfg)
    const next: Experiment = { ...experiment, files: [...experiment.files, ...toStored(files, session)], updatedAt: new Date().toISOString() }
    const ds2 = mergeTables(experimentTables(next))
    const cfg2 = reconcileConfig(cfg, ds2)
    const after = aggregate(ds2, buildMeasures(ds2), cfg2)
    setSaveState('saving')
    setExperiment(next)
    setCfg(cfg2)
    const ids = (a: typeof before) => new Set(a.subjects.map((x) => x.id))
    const newAnimals = [...ids(after)].filter((x) => !ids(before).has(x))
    const newTimes = after.times.filter((t) => !before.times.includes(t))
    const newGroups = after.groups.filter((g) => !before.groups.includes(g))
    const keyNote = ds2.keys
      .filter((k) => files.some((f) => f.isKey && k.file.includes(f.name)))
      .map((k) => `animal key joined on ${k.dataColumn} (${k.matchedIds} animals matched; columns ${k.added.join(', ')})`)
    const newRows = after.rowsTotal - before.rowsTotal
    const parts = [
      files.some((f) => !f.isKey) ? `${Math.max(0, newRows)} new rows` : '',
      ...keyNote,
      newAnimals.length ? `${newAnimals.length} new animal${newAnimals.length === 1 ? '' : 's'}` : '',
      newTimes.length ? `new timepoint${newTimes.length === 1 ? '' : 's'}: ${newTimes.join(', ')}` : '',
      newGroups.length ? `new group${newGroups.length === 1 ? '' : 's'}: ${newGroups.join(', ')}` : '',
    ].filter(Boolean)
    return `Added ${files.length} file${files.length === 1 ? '' : 's'}: ${parts.join('; ')}.`
  }

  const updateExperiment = (e: Experiment) => {
    setSaveState('saving')
    const ds2 = mergeTables(experimentTables(e))
    setExperiment({ ...e, updatedAt: new Date().toISOString() })
    setCfg((c) => reconcileConfig(c ?? undefined, ds2))
  }

  const openById = async (id: string) => {
    const e = await getExperiment(id)
    if (e) openExperiment(e)
  }

  const importBackup = async (file: File) => {
    const e = fromBundle(await file.text())
    const exists = library.some((x) => x.id === e.id)
    const copy = exists ? { ...e, id: newId(), name: `${e.name} (imported)` } : e
    await saveExperiment(copy)
    refreshLibrary()
    openExperiment(copy)
  }

  const removeExperiment = async (id: string) => {
    await deleteExperiment(id)
    if (experiment?.id === id) reset()
    refreshLibrary()
  }

  const reset = () => {
    setExperiment(null)
    setCfg(null)
    setOpt(DEFAULT_INTERPRET)
    refreshLibrary()
  }

  const cycleTheme = () => setThemePref(theme.mode === 'dark' ? 'light' : 'dark')

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <Logo />
            <span>Gait Lab</span>
          </div>
          <nav className="nav" aria-label="Main">
            <button aria-current={view === 'analyze' ? 'page' : undefined} onClick={() => go('analyze')}>
              Analyze
            </button>
            <button aria-current={view === 'learn' ? 'page' : undefined} onClick={() => go('learn')}>
              Learn
            </button>
          </nav>
          <button className="icon-btn" onClick={cycleTheme} aria-label={`Switch to ${theme.mode === 'dark' ? 'light' : 'dark'} mode`} title="Toggle light/dark">
            {theme.mode === 'dark' ? '☀' : '☾'}
          </button>
        </div>
      </header>
      <main>
        {view === 'changes' ? (
          <Changelog />
        ) : view === 'learn' ? (
          <Learn onAnalyze={() => go('analyze')} />
        ) : ds && cfg && agg && results ? (
          <Results
            ds={ds}
            measures={measures}
            cfg={cfg}
            setCfg={(c) => {
              setSaveState('saving')
              setCfg(c)
            }}
            opt={opt}
            setOpt={(o) => {
              setSaveState('saving')
              setOpt(o)
            }}
            agg={agg}
            results={results}
            theme={theme}
            experiment={experiment!}
            saveState={saveState}
            onUpdateExperiment={updateExperiment}
            onAddFiles={addToExperiment}
            onDeleteExperiment={() => removeExperiment(experiment!.id)}
            onReset={reset}
            onLearn={(anchor) => go('learn', anchor)}
          />
        ) : (
          <Loader
            onLoaded={onLoaded}
            onLearn={() => go('learn')}
            experiments={library}
            onOpen={openById}
            onDelete={removeExperiment}
            onImport={importBackup}
          />
        )}
      </main>
      <footer className="app-footer">
        <button className="btn ghost sm" style={{ padding: 0, minHeight: 0 }} onClick={() => go('changes')}>
          Gait Lab v{APP_VERSION} · What's new
        </button>
        <br />
        All processing happens on this device; your files are never uploaded. For research use; automated interpretations are not diagnoses.
      </footer>
    </>
  )
}
