// Cage hang (inverted screen / cage-lid hanging) program: the time a mouse holds
// on to an inverted wire cage lid or grid before falling, usually over several
// trials with a cut-off (e.g. 60 s). Data come from spreadsheets or Prism tables.

import { BODY_WEIGHT, matchByParams, type MetaRole, type ParamDef } from '../lib/catalog'
import { gauss, rng } from '../lib/demo'
import type { Domain } from '../lib/interpret'
import type { Cell, RawSheet } from '../lib/parse'
import type { ProgramDef } from './index'

const PARAMS: ParamDef[] = [
  // Per-animal summaries typed into a spreadsheet (checked before the per-trial names)
  {
    id: 'hang_best',
    label: 'Best hang time',
    short: 'Best hang',
    unit: 's',
    category: 'strength',
    perPaw: false,
    match: /^(best|max(imum)?|longest|top)(hang|latency|time|fall)/,
    description: "The animal's longest hang across the trials of a session; the usual summary of the test.",
    down: 'Weaker grip or lower endurance: neuromuscular disease, neuropathy, or impaired motor control.',
    up: 'Stronger grip and better endurance, or a lighter animal.',
  },
  {
    id: 'hang_first',
    label: 'Hang time, first trial',
    short: 'First trial',
    unit: 's',
    category: 'trials',
    perPaw: false,
    match: /^(first|initial)(trial)?(hang|latency|time)|^(hang|latency|time)(first|initial)trial/,
    description: 'Hang time on the first trial of the session.',
    down: 'Weaker grip from the start of the session.',
  },
  {
    id: 'hang_last',
    label: 'Hang time, last trial',
    short: 'Last trial',
    unit: 's',
    category: 'trials',
    perPaw: false,
    match: /^(last|final)(trial)?(hang|latency|time)|^(hang|latency|time)(last|final)trial/,
    description: 'Hang time on the last trial of the session, after the earlier trials.',
    down: 'Poorer performance late in the session: fatigue.',
  },
  {
    id: 'hang_improvement',
    label: 'Change, last − first trial',
    short: 'Last − first',
    unit: 's',
    category: 'trials',
    perPaw: false,
    match: /improvement|change|delta|fatigue|decline/,
    description:
      'Hang time on the last trial minus the first trial of the session. Healthy mice often do as well or better on later trials; a larger drop than in controls suggests fatigability.',
    down: 'Fatigue across trials: a feature of many neuromuscular disorders (e.g. myasthenic syndromes, muscular dystrophy).',
    up: 'Improvement across trials (practice).',
  },
  // Per-trial measures
  {
    id: 'hang_latency',
    label: 'Hang time (latency to fall)',
    short: 'Hang time',
    unit: 's',
    category: 'strength',
    perPaw: false,
    match: /^(mean|average|avg)?(cagehang|hang(ing)?|hangtime|latency|latencytofall|timetofall|fall(time|latency)?|time(s)?|duration|seconds?|secs?)$|hang|^latency|timetofall|invertedscreen|screen|wire|grid|lid/,
    description:
      'Time from turning the lid or grid upside down until the mouse falls, up to the cut-off. It combines grip strength, endurance and the motivation to hold on; values are averaged over the trials of a session.',
    down: 'Weaker grip or endurance: neuromuscular disease (SMA, DMD, ALS models), peripheral neuropathy, myopathy, or impaired motor control. Heavier animals also fall sooner.',
    up: 'Stronger grip or endurance, or a lighter body weight.',
  },
  {
    id: 'falls',
    label: 'Falls / re-grips',
    short: 'Falls',
    unit: 'n',
    category: 'strength',
    perPaw: false,
    match: /^(number(of)?)?falls?$|reaches|regrips?|attempts/,
    description: 'Number of falls (or re-grips) in protocols where the mouse is put back after falling within the trial time.',
    up: 'More falls: weaker grip or poorer coordination.',
  },
  {
    id: 'holding_impulse',
    label: 'Holding impulse (weight × hang time)',
    short: 'Holding impulse',
    unit: 'g·s',
    category: 'strength',
    perPaw: false,
    match: /holdingimpulse|impulse/,
    description:
      'Body weight multiplied by the best hang time (or the mean when there is one trial). Heavier mice must hold more weight, so the holding impulse compares strength fairly across animals of different size. Calculated automatically when body weight is available.',
    down: 'Less force held over time: weakness independent of body size.',
    up: 'More force held over time.',
    needs: ['body_weight', 'hang_latency'],
    compute: (get) => {
      const hang = Number.isFinite(get('hang_best')) ? get('hang_best') : get('hang_latency')
      return get('body_weight') * hang
    },
    noWeightAdjust: true,
  },
  BODY_WEIGHT,
]

const CATEGORY_LABELS: Record<string, string> = {
  strength: 'Hanging performance',
  trials: 'Across trials',
  body: 'Body weight',
  other: 'Other / unrecognised numeric columns',
}

const DOMAINS: Domain[] = [
  {
    id: 'ch_weakness',
    title: 'Reduced grip strength and endurance',
    summary: 'Shorter hang times and a lower holding impulse.',
    conditions:
      'Neuromuscular disease (SMA, Duchenne muscular dystrophy, ALS models), peripheral neuropathy, myopathy and mitochondrial disease, and central motor disorders that impair limb control.',
    meaning:
      'The animals cannot hold their own weight upside down for as long. That reflects reduced grip strength or muscular endurance, although poor coordination or low motivation can also shorten hang times. When the holding impulse is also reduced, the deficit is not explained by body weight.',
    followUp: [
      'Forelimb grip strength (grip meter) for a direct force measure.',
      'Compare body weight; check the holding impulse, which corrects for weight.',
      'Rotarod and gait analysis to separate weakness from incoordination.',
      'Muscle histology, electrophysiology (CMAP) or nerve conduction if a neuromuscular process is suspected.',
    ],
    items: [
      { param: 'hang_latency', where: 'run', dir: -1 },
      { param: 'hang_best', where: 'run', dir: -1 },
      { param: 'holding_impulse', where: 'run', dir: -1 },
      { param: 'falls', where: 'run', dir: 1 },
    ],
  },
  {
    id: 'ch_fatigue',
    title: 'Fatigue across trials',
    summary: 'Hang time falls from the first to the last trial more than in controls.',
    conditions: 'Neuromuscular junction disorders (myasthenic syndromes), muscular dystrophies, metabolic and mitochondrial myopathies.',
    meaning:
      'Performance declines with repeated effort within a session. Fatigability points to the neuromuscular junction or muscle energy metabolism rather than a fixed loss of strength. Short inter-trial intervals make fatigue more visible.',
    followUp: ['Repeat with longer rest between trials to confirm fatigability.', 'Repetitive nerve stimulation or single-fibre EMG for neuromuscular junction function.'],
    items: [
      { param: 'hang_improvement', where: 'run', dir: -1 },
      { param: 'hang_last', where: 'run', dir: -1 },
    ],
  },
  {
    id: 'ch_better',
    title: 'Longer hang times than control',
    summary: 'Hang time or holding impulse above the control group.',
    conditions: 'Effective treatment in a disease model, or lighter body weight than controls.',
    meaning:
      'The group holds on longer than control. In a treatment study this can reflect rescue; otherwise check body weight first, since lighter mice hang longer. The holding impulse corrects for weight.',
    followUp: ['Compare body weight and the holding impulse.', 'Check that the cut-off was the same for every group.'],
    items: [
      { param: 'hang_latency', where: 'run', dir: 1 },
      { param: 'hang_best', where: 'run', dir: 1 },
      { param: 'holding_impulse', where: 'run', dir: 1 },
    ],
  },
]

function metaRole(name: string): MetaRole | null | undefined {
  const n = name.trim().replace(/_/g, ' ')
  // Trials are repeated attempts within a session, like CatWalk runs.
  if (/^(trial|t|run|attempt)\s*(#|no\.?|nr|number|id)?$/i.test(n)) return 'run'
  // "Age" holding labels such as "50 days" is the timepoint (numeric ages in an animal key stay descriptive)
  if (/^age(\s*(window|bin|group))?$/i.test(n)) return 'time'
  if (/^(cut\s*-?off|max(imum)?\s*(time|duration)|trial\s*(length|duration)|apparatus|grid|lid\s*type)/i.test(n)) return 'equipment'
  return undefined
}

function demo(seed = 5): RawSheet {
  const r = rng(seed)
  const n = (sd: number) => gauss(r) * sd
  const groups = ['WT', 'Model + Vehicle', 'Model + AAV']
  const rows: Cell[][] = []
  const cutoff = 60
  for (const group of groups) {
    for (let a = 1; a <= 10; a++) {
      const id = `${group === 'WT' ? 'W' : group === 'Model + Vehicle' ? 'V' : 'T'}${String(a).padStart(2, '0')}`
      const sex = a % 2 ? 'M' : 'F'
      const strength = 1 + n(0.3)
      const deficit = group === 'WT' ? 0 : group === 'Model + Vehicle' ? 1 : 0.4
      for (const [ti, age] of ['50 days', '100 days'].entries()) {
        const weight = (sex === 'M' ? 22 : 18) * (1 + 0.15 * ti) * (1 - 0.08 * deficit * (ti + 1)) * (1 + n(0.05))
        const fatigue = 0.06 + 0.08 * deficit * (ti + 1)
        for (let trial = 1; trial <= 3; trial++) {
          let t = 48 * strength * (1 - 0.3 * deficit * (0.6 + 0.4 * ti)) * (1 - fatigue * (trial - 1)) * (1 + n(0.2))
          t = Math.min(cutoff, Math.max(2, t))
          rows.push([id, group, sex, age, trial, +t.toFixed(1), +weight.toFixed(1)])
        }
      }
    }
  }
  return {
    file: 'demo_cage_hang.csv',
    sheet: '',
    cells: [
      ['Protocol:', 'Inverted cage lid, 60 s cut-off, 3 trials (DEMO — simulated data, not from a real study)'],
      [],
      ['Animal', 'Group', 'Sex', 'Age', 'Trial', 'Hang time (s)', 'Body weight (g)'],
      ...rows,
    ],
  }
}

export const cagehang: ProgramDef = {
  id: 'cagehang',
  name: 'Cage Hang Lab',
  test: 'cage hang',
  instrument: 'Inverted cage lid / grid',
  tagline: 'Cage hang (inverted screen) grip strength and endurance',
  lede:
    'Load cage hang results from Excel or Prism. Cage Hang Lab averages trials per animal, works out the best, first and last trial and the change across trials, calculates the holding impulse when body weight is available, and points out patterns of weakness or fatigue.',
  params: PARAMS,
  categoryLabels: CATEGORY_LABELS,
  categoryOrder: ['strength', 'trials', 'body', 'other'],
  matchColumn: (name) => matchByParams(name.replace(/\((s|sec|secs|seconds|g|n|g·s|g\*s)\)/gi, ''), PARAMS),
  metaRole,
  domains: DOMAINS,
  runNoun: 'trial',
  runsNoun: 'trials',
  trialDerived: [
    { id: 'hang_best', from: 'hang_latency', how: 'max' },
    { id: 'hang_first', from: 'hang_latency', how: 'first' },
    { id: 'hang_last', from: 'hang_latency', how: 'last' },
    { id: 'hang_improvement', from: 'hang_latency', how: 'improvement' },
  ],
  trialsTab: {
    label: 'Trials',
    title: 'Hang time across trials',
    text: 'Group mean ± SEM for every trial of every session. Healthy mice usually hold on as long or longer on later trials; a curve that falls more steeply than in controls suggests fatigue, and one that is lower throughout suggests weakness.',
  },
  ceilingParam: 'hang_latency',
  demo: () => demo(),
  demoFile: 'demo_cage_hang.csv',
  keyMinParams: 1,
  rowAxis: 'Trial',
  primaryColumn: 'Hang time (s)',
  features: { speed: false, paws: false },
  filePrefix: 'cagehang',
  steps: [
    {
      title: 'Load the hang times',
      text: 'A spreadsheet with one row per animal per trial (animal, group, age, trial, hang time), one column per trial ("Trial 1", "Trial 2"…), or a Prism (.prism) file with age-binned tables. Add a body-weight column or weights file to get the holding impulse.',
    },
    {
      title: 'Check the setup',
      text: 'Cage Hang Lab guesses which columns hold the animal ID, group, age and trial, and which group is the control. Ages become timepoints, so progression shows in the Over time tab.',
    },
    {
      title: 'Read the results',
      text: 'Get a written summary, hang time across trials, per-animal plots, holding impulse and statistics. Everything can be exported as CSV, SVG, PNG or a Prism file.',
    },
  ],
}
