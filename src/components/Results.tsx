import { useMemo, useRef, useState } from 'react'
import { TabGraphsExport } from './TabGraphsExport'
import { AGE_WINDOW_COL, timeCaption } from '../lib/ageWindows'
import { distinctValues } from '../lib/analysis'
import type { AggregateResult, AnalysisConfig, Measure, TimeResults } from '../lib/analysis'
import type { InterpretOptions } from '../lib/interpret'
import type { Experiment } from '../lib/experiment'
import type { LoadedFile } from '../lib/readFiles'
import { ExperimentTab } from './tabs/ExperimentTab'
import type { Dataset } from '../lib/parse'
import { seriesColor, type ChartTheme } from '../lib/theme'
import { Setup } from './Setup'
import { Summary } from './tabs/Summary'
import { StoryTab } from './tabs/StoryTab'
import { Fingerprint } from './tabs/Fingerprint'
import { Explore } from './tabs/Explore'
import { TimeTab } from './tabs/TimeTab'
import { SpeedTab } from './tabs/SpeedTab'
import { DataTab } from './tabs/DataTab'
import { TrialsTab } from './tabs/TrialsTab'
import { WeightTab } from './tabs/WeightTab'
import { hasTrialAnalysis, program } from '../programs'
import type { TabProps } from './tabs/types'

interface Props {
  ds: Dataset
  measures: Measure[]
  cfg: AnalysisConfig
  setCfg: (c: AnalysisConfig) => void
  opt: InterpretOptions
  setOpt: (o: InterpretOptions) => void
  experiment: Experiment
  saveState: 'saved' | 'saving' | 'error' | 'off'
  onUpdateExperiment: (e: Experiment, cfgPatch?: Partial<AnalysisConfig>) => void
  onAddFiles: (files: LoadedFile[], session?: string) => string
  onDeleteExperiment: () => void
  agg: AggregateResult
  results: TimeResults[]
  theme: ChartTheme
  onReset: () => void
  onLearn: (anchor?: string) => void
}

type Tab = 'summary' | 'story' | 'fingerprint' | 'explore' | 'trials' | 'time' | 'speed' | 'weight' | 'data' | 'setup' | 'experiment'

export function Results(props: Props) {
  const { ds, measures, cfg, setCfg, opt, setOpt, agg, results, theme, onReset, onLearn, experiment, saveState } = props
  const [tab, setTab] = useState<Tab>('summary')
  // Open on the timepoint with the most animals (the last one on a tie): late timepoints often have very few.
  const busiest = useMemo(() => {
    let best = results[results.length - 1]?.time ?? ''
    let n = -1
    for (const r of results) {
      const k = agg.subjects.filter((s) => s.time === r.time).length
      if (k >= n) {
        n = k
        best = r.time
      }
    }
    return best
  }, [results, agg])
  const [timePick, setTime] = useState<string | null>(null)
  const time = timePick !== null && results.some((r) => r.time === timePick) ? timePick : busiest
  const [measureKey, setMeasureKey] = useState<string | null>(null)
  const tabRef = useRef<HTMLDivElement>(null)

  const colorOf = useMemo(() => {
    // Colour follows the group's position in the full group order, so excluding
    // a group never repaints the others.
    const order = cfg.groupOrder
    return (g: string) => {
      const i = order.indexOf(g)
      return seriesColor(theme, i < 0 ? order.length : i)
    }
  }, [cfg.groupOrder, theme])

  const openMeasure = (key: string) => {
    setMeasureKey(key)
    setTab('explore')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const tabProps: TabProps = { ds, measures, cfg, setCfg, agg, results, theme, opt, time, colorOf, openMeasure, onLearn }
  const hasTime = results.length > 1
  const prog = program()
  const hasTrials = hasTrialAnalysis(prog) && agg.trials.length > 0
  const tabs: [Tab, string][] = [
    ['summary', 'Summary'],
    ['story', 'Story'],
    ['fingerprint', prog.features.paws ? 'Gait fingerprint' : 'Fingerprint'],
    ['explore', 'Parameters'],
    ...(hasTrials ? ([['trials', prog.trialsTab?.label ?? 'Trials']] as [Tab, string][]) : []),
    ...(hasTime ? ([['time', 'Over time']] as [Tab, string][]) : []),
    ...(prog.features.speed ? ([['speed', 'Speed check']] as [Tab, string][]) : []),
    ...(measures.some((m) => m.def.id === 'body_weight') ? ([['weight', 'Weight check']] as [Tab, string][]) : []),
    ['data', 'Data & export'],
    ['setup', 'Setup'],
    ['experiment', 'Experiment & data'],
  ]

  const showTimePicker = hasTime && tab !== 'time' && tab !== 'trials' && tab !== 'setup' && tab !== 'data' && tab !== 'experiment'
  // With age windows, a switch between them and the data files' own timepoints.
  const showSource = ds.headers.includes(AGE_WINDOW_COL) && tab !== 'setup' && tab !== 'data' && tab !== 'experiment'
  // Tabs that draw charts get "Export this tab's graphs".
  const chartTab = (['story', 'fingerprint', 'explore', 'trials', 'time', 'speed', 'weight'] as Tab[]).includes(tab)
  const tabLabel = tabs.find(([id]) => id === tab)?.[1] ?? tab

  return (
    <>
      <div className="exp-header no-print">
        <div style={{ minWidth: 0 }}>
          <h1 className="exp-title">{experiment.name.trim() || 'Untitled experiment'}</h1>
          <div className="small muted" style={{ overflowWrap: 'anywhere' }}>
            {experiment.files.length} file{experiment.files.length === 1 ? '' : 's'} · {agg.subjects.length} animal-timepoints · {measures.length} parameters ·{' '}
            <span className={saveState === 'error' ? 'save-error' : undefined}>
              {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Not saved: storage unavailable' : 'Saved on this device'}
            </span>
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn sm primary" onClick={() => setTab('experiment')}>
            + Add data
          </button>
          <button className="btn sm" onClick={onReset}>
            All experiments
          </button>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {(showTimePicker || chartTab || showSource) && (
        <div className="row no-print" style={{ marginBottom: 12, justifyContent: 'space-between' }}>
          {showTimePicker || showSource ? (
            <span className="row">
              {showSource && (
                <select
                  value={cfg.timeCol ?? ''}
                  onChange={(e) => setCfg({ ...cfg, timeCol: e.target.value || null, timeOrder: distinctValues(ds, e.target.value || null) })}
                  style={{ width: 'auto' }}
                  aria-label="Timepoints from"
                >
                  <option value={AGE_WINDOW_COL}>Age windows</option>
                  {ds.columns
                    .filter((c) => c.meta === 'time' && c.name !== AGE_WINDOW_COL)
                    .map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  <option value="">No timepoints</option>
                </select>
              )}
              {showTimePicker && <span className="small muted">Timepoint:</span>}
              {showTimePicker && results.map((r) => (
                <button key={r.time} className={`btn sm${r.time === time ? ' primary' : ''}`} onClick={() => setTime(r.time)} aria-pressed={r.time === time}>
                  {r.time}
                </button>
              ))}
            </span>
          ) : (
            <span />
          )}
          {chartTab && <TabGraphsExport key={tab} root={tabRef} name={tabLabel} time={showTimePicker ? time : undefined} />}
        </div>
      )}
      <div ref={tabRef} data-chart-time={showTimePicker ? timeCaption(cfg.timeCol, time) : undefined}>
      {tab === 'summary' && <Summary {...tabProps} goSetup={() => setTab('setup')} />}
      {tab === 'story' && <StoryTab {...tabProps} />}
      {tab === 'fingerprint' && <Fingerprint {...tabProps} />}
      {tab === 'explore' && <Explore {...tabProps} selected={measureKey} setSelected={setMeasureKey} />}
      {tab === 'trials' && <TrialsTab {...tabProps} />}
      {tab === 'time' && <TimeTab {...tabProps} />}
      {tab === 'speed' && <SpeedTab {...tabProps} goSetup={() => setTab('setup')} />}
      {tab === 'weight' && <WeightTab {...tabProps} goSetup={() => setTab('setup')} />}
      {tab === 'data' && <DataTab {...tabProps} />}
      {tab === 'experiment' && (
        <ExperimentTab
          experiment={experiment}
          ds={ds}
          onUpdate={props.onUpdateExperiment}
          onAddFiles={props.onAddFiles}
          onDelete={props.onDeleteExperiment}
        />
      )}
      {tab === 'setup' && (
        <Setup
          ds={ds}
          measures={measures}
          cfg={cfg}
          setCfg={setCfg}
          opt={opt}
          setOpt={setOpt}
          colorOf={colorOf}
          onLearn={onLearn}
          onKeyChoice={(file, choice) => {
            const next = { ...(experiment.keyChoices ?? {}) }
            if (choice) next[file] = choice
            else delete next[file]
            props.onUpdateExperiment({ ...experiment, keyChoices: next })
          }}
          ageWindows={experiment.ageWindows}
          onAgeWindows={(next, timeCol) => props.onUpdateExperiment({ ...experiment, ageWindows: next }, timeCol !== undefined ? { timeCol } : undefined)}
        />
      )}
      </div>
    </>
  )
}
