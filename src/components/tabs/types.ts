import type { AggregateResult, AnalysisConfig, Measure, TimeResults } from '../../lib/analysis'
import type { InterpretOptions } from '../../lib/interpret'
import type { Dataset } from '../../lib/parse'
import type { ChartTheme } from '../../lib/theme'

export interface TabProps {
  ds: Dataset
  measures: Measure[]
  cfg: AnalysisConfig
  agg: AggregateResult
  results: TimeResults[]
  theme: ChartTheme
  opt: InterpretOptions
  time: string
  colorOf: (group: string) => string
  openMeasure: (key: string) => void
  onLearn: (anchor?: string) => void
}
