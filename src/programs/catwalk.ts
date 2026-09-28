import { CATEGORY_LABELS, CATEGORY_ORDER, PARAMS, matchColumn } from '../lib/catalog'
import { demoSheet } from '../lib/demo'
import type { ProgramDef } from './index'
import { CATWALK_DOMAINS } from './catwalk-domains'

export const catwalk: ProgramDef = {
  id: 'catwalk',
  name: 'Gait Lab',
  test: 'CatWalk gait analysis',
  instrument: 'CatWalk XT',
  tagline: 'CatWalk XT gait analysis',
  lede: 'Load one or more run-statistics files exported from CatWalk XT. Gait Lab recognises the parameters, averages runs per animal, compares groups and timepoints, and points out patterns linked to specific kinds of neurological deficit.',
  params: PARAMS,
  categoryLabels: CATEGORY_LABELS,
  categoryOrder: CATEGORY_ORDER,
  matchColumn,
  domains: CATWALK_DOMAINS,
  runNoun: 'run',
  runsNoun: 'runs',
  demo: () => demoSheet(),
  demoFile: 'demo_catwalk_runs.csv',
  keyMinParams: 3,
  rowAxis: 'Time point',
  primaryColumn: 'Value',
  features: { speed: true, paws: true },
  filePrefix: 'catwalk',
  steps: [
    {
      title: 'Export from CatWalk XT',
      text: 'After classifying runs, export the run statistics (one row per run) to Excel or text. Include your independent variables (e.g. genotype, treatment, timepoint) and the animal/trial ID.',
    },
    {
      title: 'Check the setup',
      text: 'Gait Lab guesses which columns hold the animal ID, group and timepoint and which group is the control. You can change any of these, reorder groups, exclude non-compliant runs and adjust for walking speed.',
    },
    {
      title: 'Read the results',
      text: 'Get a written summary, a gait "fingerprint" heatmap, per-paw plots, time courses and tables. Everything can be exported as CSV, SVG, PNG or a Prism file.',
    },
  ],
}
