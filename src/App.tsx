import { useEffect, useMemo, useState } from 'react'
import { Loader } from './components/Loader'
import { Results } from './components/Results'
import { Learn } from './components/Learn'
import { Logo } from './components/Logo'
import { mergeTables, type ParsedTable } from './lib/parse'
import { aggregate, analyse, autoConfig, buildMeasures, type AnalysisConfig } from './lib/analysis'
import { useChartTheme } from './lib/theme'

type View = 'analyze' | 'learn'

function initialView(): View {
  return location.hash.startsWith('#learn') ? 'learn' : 'analyze'
}

export default function App() {
  const [view, setView] = useState<View>(initialView)
  const [tables, setTables] = useState<ParsedTable[] | null>(null)
  const [cfg, setCfg] = useState<AnalysisConfig | null>(null)
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
    const hash = v === 'learn' ? `#learn${anchor ? '-' + anchor : ''}` : ''
    history.replaceState(null, '', hash || location.pathname)
    if (anchor) setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' }), 50)
    else window.scrollTo({ top: 0 })
  }

  const ds = useMemo(() => (tables ? mergeTables(tables) : null), [tables])
  const measures = useMemo(() => (ds ? buildMeasures(ds) : []), [ds])
  const agg = useMemo(() => (ds && cfg ? aggregate(ds, measures, cfg) : null), [ds, measures, cfg])
  const results = useMemo(() => (agg && cfg ? analyse(agg, measures, cfg) : null), [agg, measures, cfg])

  const onLoaded = (t: ParsedTable[]) => {
    const merged = mergeTables(t)
    setTables(t)
    setCfg(autoConfig(merged))
  }

  const reset = () => {
    setTables(null)
    setCfg(null)
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
        {view === 'learn' ? (
          <Learn onAnalyze={() => go('analyze')} />
        ) : ds && cfg && agg && results ? (
          <Results
            ds={ds}
            measures={measures}
            cfg={cfg}
            setCfg={setCfg}
            agg={agg}
            results={results}
            theme={theme}
            onReset={reset}
            onLearn={(anchor) => go('learn', anchor)}
          />
        ) : (
          <Loader onLoaded={onLoaded} onLearn={() => go('learn')} />
        )}
      </main>
      <footer className="app-footer">
        All processing happens on this device; your files are never uploaded. For research use; automated interpretations are not diagnoses.
      </footer>
    </>
  )
}
