// Rotarod program: latency to fall from a rotating rod, usually several trials
// per day over 1–3 days (accelerating protocol). Exports come from San Diego
// Instruments (SDI) Rotor-Rod software, or from Excel/Prism tables typed up by
// hand.

import { BODY_WEIGHT, matchByParams, type MetaRole, type ParamDef } from '../lib/catalog'
import { gauss, rng } from '../lib/demo'
import type { Domain } from '../lib/interpret'
import type { Cell, RawSheet } from '../lib/parse'
import type { ProgramDef } from './index'

const PARAMS: ParamDef[] = [
  // Per-animal summaries typed into a spreadsheet (checked before the per-trial names)
  {
    id: 'latency_best',
    label: 'Best latency to fall',
    short: 'Best latency',
    unit: 's',
    category: 'performance',
    perPaw: false,
    match: /^(best|max(imum)?|longest|top)(latency|time|fall)/,
    description: "The animal's longest time on the rod across the trials of a session. Less affected by a single early slip than the mean.",
    down: 'Poorer peak motor coordination or balance, weakness or fatigue.',
    up: 'Better peak performance.',
  },
  {
    id: 'latency_first',
    label: 'Latency to fall, first trial',
    short: 'First trial',
    unit: 's',
    category: 'learning',
    perPaw: false,
    match: /^(first|initial|baseline)(trial)?(latency|time)|^(latency|time)(first|initial)trial/,
    description: 'Time on the rod on the first trial of the session: baseline coordination before practice.',
    down: 'Impaired baseline coordination or balance, or reduced exploration of the rod.',
  },
  {
    id: 'latency_last',
    label: 'Latency to fall, last trial',
    short: 'Last trial',
    unit: 's',
    category: 'learning',
    perPaw: false,
    match: /^(last|final)(trial)?(latency|time)|^(latency|time)(last|final)trial/,
    description: 'Time on the rod on the last trial of the session, after within-session practice.',
    down: 'Poorer performance after practice: reduced motor learning or fatigue.',
  },
  {
    id: 'latency_improvement',
    label: 'Improvement, last − first trial',
    short: 'Improvement',
    unit: 's',
    category: 'learning',
    perPaw: false,
    match: /improvement|learning|delta|change|gain/,
    description:
      'Latency on the last trial minus the first trial of a session. A simple index of within-session motor learning; across-day learning shows in the Over time tab when days are a timepoint column.',
    down: 'Less within-session motor learning (cerebellar or striatal learning deficits), or fatigue that offsets learning.',
    up: 'Greater within-session improvement.',
  },
  // Per-trial measures
  {
    id: 'latency',
    label: 'Latency to fall',
    short: 'Latency',
    unit: 's',
    category: 'performance',
    perPaw: false,
    match: /^(mean|average|avg)?(latency|latencytofall|timetofall|falllatency|fall(time)?|timeonrod|rodtime|timeonthero?d|rotarod|seconds?|secs?|time(s)?|duration)$|^latency|timeonrod|timetofall/,
    description:
      'Time from the start of the trial until the animal falls (or completes a full passive rotation, if you score those as falls). The main rotarod readout; values are averaged over the trials of a session.',
    down: 'Impaired motor coordination or balance, weakness, reduced endurance, or poor learning of the task. Heavier animals also fall sooner.',
    up: 'Better coordination and balance, or a lighter body weight.',
  },
  {
    id: 'rpm_at_fall',
    label: 'Rod speed at fall',
    short: 'RPM at fall',
    unit: 'rpm',
    category: 'performance',
    perPaw: false,
    match: /(rpm|speed|velocity)(at)?fall|fall(rpm|speed)|^(final|end)?rpm$|^rpm/,
    description: 'Rotation speed of the rod when the animal fell. On an accelerating protocol it rises in step with latency; it is the fairer measure when protocols differ.',
    down: 'The animal could not keep up with slower rod speeds: poorer coordination or weakness.',
    up: 'Kept up with faster rod speeds.',
  },
  {
    id: 'distance',
    label: 'Distance travelled on rod',
    short: 'Distance',
    unit: 'cm',
    category: 'performance',
    perPaw: false,
    match: /distance|revolutions|^revs?$/,
    description: 'Distance walked on the rod (or number of rod revolutions) before falling. Combines latency and rod speed.',
    down: 'Poorer coordination or endurance.',
  },
  {
    id: 'passive_rotations',
    label: 'Passive rotations',
    short: 'Passive rot.',
    unit: 'n',
    category: 'performance',
    perPaw: false,
    match: /passive|cartwheel|rotations?$|flips?$|clinging|clings?$/,
    description: 'Times the animal gripped the rod and rotated with it instead of walking. Many labs count the first full passive rotation as a fall.',
    up: 'Gripping instead of stepping: impaired coordination with preserved grip strength, or a strategy change.',
  },
  BODY_WEIGHT,
]

const CATEGORY_LABELS: Record<string, string> = {
  performance: 'Performance on the rod',
  learning: 'Learning across trials',
  body: 'Body weight',
  other: 'Other / unrecognised numeric columns',
}

const DOMAINS: Domain[] = [
  {
    id: 'rr_coordination',
    title: 'Impaired motor coordination and balance',
    summary: 'Shorter time on the rod, falling at lower rod speeds.',
    conditions:
      'Cerebellar ataxias (SCA models), basal ganglia disease (Parkinson and Huntington disease models), motor neuron disease and neuromuscular weakness (ALS, SMA, myopathy), peripheral and sensory neuropathy, demyelinating and leukodystrophy models.',
    meaning:
      'Staying on an accelerating rod needs balance, interlimb coordination, grip and endurance. A shorter latency shows that one or more of these is reduced; the rotarod alone cannot say which. Body weight matters: heavier animals fall sooner, so check that groups weigh the same.',
    followUp: [
      'Compare body weight between groups at the same age.',
      'Grip strength (and hanging wire) to test whether weakness explains the result.',
      'CatWalk gait analysis or beam walking to separate ataxia from weakness.',
      'Open-field activity to check general activity and motivation.',
    ],
    items: [
      { param: 'latency', where: 'run', dir: -1 },
      { param: 'latency_best', where: 'run', dir: -1 },
      { param: 'rpm_at_fall', where: 'run', dir: -1 },
      { param: 'distance', where: 'run', dir: -1 },
    ],
  },
  {
    id: 'rr_learning',
    title: 'Reduced motor learning',
    summary: 'Little improvement across trials, with a similar first trial.',
    conditions:
      'Cerebellar and striatal dysfunction (e.g. Purkinje cell, dopamine or corticostriatal plasticity deficits), intellectual disability and autism-related models, and some models with fatigue.',
    meaning:
      'Healthy mice stay on the rod longer with practice, within a day and across days. A group that starts at the same level but improves less points to impaired motor skill learning rather than a basic coordination problem. Fatigue across trials can look the same, so check inter-trial intervals.',
    followUp: [
      'Test across 2–3 consecutive days to separate within-day learning from across-day consolidation (Over time tab).',
      'Fixed-speed rotarod at several speeds to separate learning from capacity.',
      'Complex running wheel or skilled reaching for other motor learning tasks.',
    ],
    items: [
      // Only the change from first to last trial: a lower last trial alone just mirrors an overall deficit.
      { param: 'latency_improvement', where: 'run', dir: -1 },
    ],
  },
  {
    id: 'rr_grip',
    title: 'Gripping instead of walking',
    summary: 'More passive rotations with the rod.',
    conditions: 'Cerebellar and basal ganglia models, and animals that have learnt to cling rather than walk.',
    meaning:
      'The animal holds on and rotates with the rod rather than stepping forward. Grip strength is preserved but coordinated stepping is not, or the animal has adopted a clinging strategy. Scoring the first passive rotation as a fall makes latencies more comparable between labs.',
    followUp: ['Score videos for passive rotations if not already counted.', 'Grip strength to confirm preserved grip.'],
    items: [{ param: 'passive_rotations', where: 'run', dir: 1 }],
  },
  {
    id: 'rr_better',
    title: 'Longer time on the rod than control',
    summary: 'Latency or rod speed at fall above the control group.',
    conditions: 'Effective treatment in a disease model, lower body weight than controls, or hyperactivity in some models.',
    meaning:
      'The group stays on longer than control. In a treatment study this can reflect rescue; otherwise check body weight first, since lighter mice stay on longer regardless of coordination.',
    followUp: ['Compare body weight between groups.', 'Check that trial cut-offs (maximum trial time) were the same for every group.'],
    items: [
      { param: 'latency', where: 'run', dir: 1 },
      { param: 'latency_best', where: 'run', dir: 1 },
      { param: 'rpm_at_fall', where: 'run', dir: 1 },
    ],
  },
]

function metaRole(name: string): MetaRole | null | undefined {
  const n = name.trim().replace(/_/g, ' ')
  // Trials are repeated measurements within a session, like CatWalk runs.
  if (/^(trial|t|run|attempt)\s*(#|no\.?|nr|number|id)?$/i.test(n)) return 'run'
  if (/^(lane|station|rod|position|chamber|box)\b/i.test(n)) return 'other'
  if (/^(start|end|initial|max(imum)?|target|top)\s*(rpm|speed)$|^accel|^ramp|^protocol|^(trial\s*)?(length|max(imum)?\s*time|cut\s*-?off)/i.test(n)) return 'equipment'
  if (/^fall\s*(type|reason|mode)$|^cause/i.test(n)) return 'other'
  return undefined
}

function demo(seed = 11): RawSheet {
  const r = rng(seed)
  const n = (sd: number) => gauss(r) * sd
  const groups = ['WT', 'Model + Vehicle', 'Model + AAV']
  const rows: Cell[][] = []
  // Accelerating 4–40 rpm over 300 s; rod diameter 3 cm.
  const rpmAt = (t: number) => 4 + (36 * t) / 300
  const distAt = (t: number) => (Math.PI * 3 * (4 * t + (18 * t * t) / 300)) / 60
  for (const group of groups) {
    for (let a = 1; a <= 10; a++) {
      const id = `${group === 'WT' ? 'W' : group === 'Model + Vehicle' ? 'V' : 'T'}${String(a).padStart(2, '0')}`
      const sex = a % 2 ? 'M' : 'F'
      const ability = 1 + n(0.12)
      const deficit = group === 'WT' ? 0 : group === 'Model + Vehicle' ? 1 : 0.35
      for (let day = 1; day <= 3; day++) {
        for (let trial = 1; trial <= 3; trial++) {
          const practice = (day - 1) * 3 + (trial - 1)
          const learn = 1 + practice * (0.07 - 0.05 * deficit)
          let t = 125 * ability * learn * (1 - 0.38 * deficit) * (1 + n(0.18))
          t = Math.min(300, Math.max(5, t))
          const passive = Math.max(0, Math.round(deficit * 1.2 + n(0.8)))
          rows.push([id, group, sex, `Day ${day}`, trial, ((a - 1) % 5) + 1, +t.toFixed(1), +rpmAt(t).toFixed(1), +distAt(t).toFixed(1), passive])
        }
      }
    }
  }
  return {
    file: 'demo_rotarod_trials.csv',
    sheet: '',
    cells: [
      ['Protocol:', 'Accelerating 4–40 rpm over 300 s (DEMO — simulated data, not from a real study)'],
      [],
      ['Subject ID', 'Group', 'Sex', 'Day', 'Trial', 'Lane', 'Latency to fall (s)', 'RPM at fall', 'Distance (cm)', 'Passive rotations'],
      ...rows,
    ],
  }
}

export const rotarod: ProgramDef = {
  id: 'rotarod',
  name: 'Rotarod Lab',
  test: 'rotarod',
  instrument: 'SDI Rotor-Rod',
  tagline: 'Rotarod motor coordination and learning',
  lede:
    'Load rotarod results exported from the SDI Rotor-Rod software, or Excel and Prism tables. Rotarod Lab averages trials per animal, works out best, first and last trials and within-session improvement, compares groups across days, and points out patterns of impaired coordination or motor learning.',
  params: PARAMS,
  categoryLabels: CATEGORY_LABELS,
  categoryOrder: ['performance', 'learning', 'body', 'other'],
  matchColumn: (name) => matchByParams(name.replace(/\((s|sec|secs|seconds|rpm|cm|mm|m|n)\)/gi, ''), PARAMS),
  metaRole,
  domains: DOMAINS,
  runNoun: 'trial',
  runsNoun: 'trials',
  trialDerived: [
    { id: 'latency_best', from: 'latency', how: 'max' },
    { id: 'latency_first', from: 'latency', how: 'first' },
    { id: 'latency_last', from: 'latency', how: 'last' },
    { id: 'latency_improvement', from: 'latency', how: 'improvement' },
  ],
  demo: () => demo(),
  demoFile: 'demo_rotarod_trials.csv',
  keyMinParams: 1,
  rowAxis: 'Trial',
  primaryColumn: 'Latency to fall (s)',
  features: { speed: false, paws: false },
  filePrefix: 'rotarod',
  steps: [
    {
      title: 'Export the trials',
      text: 'From the SDI Rotor-Rod software, export the results (one row per animal per trial) to Excel or CSV. A spreadsheet with an animal column, a group column and one column per trial ("Trial 1", "Trial 2"…) or a Prism (.prism) file works too.',
    },
    {
      title: 'Check the setup',
      text: 'Rotarod Lab guesses which columns hold the animal ID, group, day and trial, and which group is the control. Days become timepoints, so learning across days shows up in the Over time tab.',
    },
    {
      title: 'Read the results',
      text: 'Get a written summary, learning curves across trials, per-animal plots and statistics. Everything can be exported as CSV, SVG, PNG or a Prism file.',
    },
  ],
}
