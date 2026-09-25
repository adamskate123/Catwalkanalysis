import { useMemo, useState } from 'react'
import type { AggregateResult, AnalysisConfig, Measure, TimeResults } from '../lib/analysis'
import { DEFAULT_INTERPRET, type InterpretOptions } from '../lib/interpret'
import type { Dataset } from '../lib/parse'
import { seriesColor, type ChartTheme } from '../lib/theme'
import { Setup } from './Setup'
import { Summary } from './tabs/Summary'
import { Fingerprint } from './tabs/Fingerprint'
import { Explore } from './tabs/Explore'
import { TimeTab } from './tabs/TimeTab'
import { SpeedTab } from './tabs/SpeedTab'
import { DataTab } from './tabs/DataTab'
import type { TabProps } from './tabs/types'

interface Props {
  ds: Dataset
  measures: Measure[]
  cfg: AnalysisConfig
  setCfg: (c: AnalysisConfig) => void
  agg: AggregateResult
  results: TimeResults[]
  theme: ChartTheme
  onReset: () => void
  onLearn: (anchor?: string) => void
}

type Tab = 'summary' | 'fingerprint' | 'explore' | 'time' | 'speed' | 'data' | 'setup'

export function Results(props: Props) {
  const { ds, measures, cfg, setCfg, agg, results, theme, onReset, onLearn } = props
  const [tab, setTab] = useState<Tab>('summary')
  const [opt, setOpt] = useState<InterpretOptions>(DEFAULT_INTERPRET)
  const [timePick, setTime] = useState<string>(results[results.length - 1]?.time ?? '')
  const time = results.some((r) => r.time === timePick) ? timePick : (results[results.length - 1]?.time ?? '')
  const [measureKey, setMeasureKey] = useState<string | null>(null)

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

  const tabProps: TabProps = { ds, measures, cfg, agg, results, theme, opt, time, colorOf, openMeasure, onLearn }
  const hasTime = results.length > 1
  const tabs: [Tab, string][] = [
    ['summary', 'Summary'],
    ['fingerprint', 'Gait fingerprint'],
    ['explore', 'Parameters'],
    ...(hasTime ? ([['time', 'Over time']] as [Tab, string][]) : []),
    ['speed', 'Speed check'],
    ['data', 'Data & export'],
    ['setup', 'Setup'],
  ]

  const showTimePicker = hasTime && tab !== 'time' && tab !== 'setup' && tab !== 'data'

  return (
    <>
      <div className="row no-print" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="small muted" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          {ds.sources.join(' · ')} — {agg.subjects.length} animal-timepoints, {measures.length} parameters
        </div>
        <button className="btn sm" onClick={onReset}>
          Load other files
        </button>
      </div>
      <div className="tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {showTimePicker && (
        <div className="row no-print" style={{ marginBottom: 12 }}>
          <span className="small muted">Timepoint:</span>
          {results.map((r) => (
            <button key={r.time} className={`btn sm${r.time === time ? ' primary' : ''}`} onClick={() => setTime(r.time)} aria-pressed={r.time === time}>
              {r.time}
            </button>
          ))}
        </div>
      )}
      {tab === 'summary' && <Summary {...tabProps} goSetup={() => setTab('setup')} />}
      {tab === 'fingerprint' && <Fingerprint {...tabProps} />}
      {tab === 'explore' && <Explore {...tabProps} selected={measureKey} setSelected={setMeasureKey} />}
      {tab === 'time' && <TimeTab {...tabProps} />}
      {tab === 'speed' && <SpeedTab {...tabProps} goSetup={() => setTab('setup')} />}
      {tab === 'data' && <DataTab {...tabProps} />}
      {tab === 'setup' && <Setup ds={ds} measures={measures} cfg={cfg} setCfg={setCfg} opt={opt} setOpt={setOpt} colorOf={colorOf} onLearn={onLearn} />}
    </>
  )
}
