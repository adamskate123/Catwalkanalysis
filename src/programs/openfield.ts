// Open field program: locomotor activity and centre avoidance in a novel arena,
// usually tracked with Noldus EthoVision XT. Exports are EthoVision statistics
// tables (one row per trial/animal) or Excel/Prism tables typed up by hand.

import { BODY_WEIGHT, normalizeKey, splitStat, type ColumnMatch, type MetaRole, type ParamDef } from '../lib/catalog'
import { gauss, rng } from '../lib/demo'
import type { Domain } from '../lib/interpret'
import type { Cell, RawSheet } from '../lib/parse'
import type { ProgramDef } from './index'

const CENTER = '(center|centre|inner|middle|central)'
const BORDER = '(periphery|peripheral|outer|border|wall|edge|thigmo|corner|surround)'

const PARAMS: ParamDef[] = [
  // Zone-specific activity (checked before the zone time/entry patterns and the whole-arena measures)
  {
    id: 'center_rest',
    displayOrder: 140,
    label: 'Resting time in centre',
    short: 'Centre rest',
    unit: 's',
    category: 'anxiety',
    perPaw: false,
    match: new RegExp(`(rest|immobil|notmoving|inactiv).*${CENTER}|${CENTER}.*(rest|immobil|notmoving|inactiv)`),
    description: 'Time spent resting (not moving) while in the centre zone.',
    up: 'Pausing in the exposed centre: low anxiety-like behaviour, or low activity overall.',
    down: 'Little resting in the centre: the animal crosses it quickly or avoids it.',
  },
  {
    id: 'periphery_rest',
    displayOrder: 141,
    label: 'Resting time in periphery',
    short: 'Periphery rest',
    unit: 's',
    category: 'anxiety',
    perPaw: false,
    match: new RegExp(`(rest|immobil|notmoving|inactiv).*${BORDER}|${BORDER}.*(rest|immobil|notmoving|inactiv)`),
    description: 'Time spent resting while near the walls.',
    up: 'Resting near the walls: hypoactivity together with wall-seeking (anxiety-like) behaviour.',
  },
  {
    id: 'center_speed',
    displayOrder: 142,
    label: 'Speed in centre',
    short: 'Centre speed',
    unit: 'cm/s',
    category: 'anxiety',
    perPaw: false,
    match: new RegExp(`(speed|velocity).*${CENTER}|${CENTER}.*(speed|velocity)`),
    description: 'Average speed while in the centre zone.',
    up: 'Rushing through the exposed centre, often seen with anxiety-like behaviour.',
    down: 'Slower movement in the centre.',
  },
  {
    id: 'periphery_speed',
    displayOrder: 143,
    label: 'Speed in periphery',
    short: 'Periphery speed',
    unit: 'cm/s',
    category: 'locomotion',
    perPaw: false,
    match: new RegExp(`(speed|velocity).*${BORDER}|${BORDER}.*(speed|velocity)`),
    description: 'Average speed while near the walls.',
    down: 'Slower movement along the walls: hypoactivity or motor impairment.',
    up: 'Faster movement along the walls.',
  },
  {
    id: 'periphery_distance',
    displayOrder: 144,
    label: 'Distance in periphery',
    short: 'Periphery distance',
    unit: 'cm',
    category: 'locomotion',
    perPaw: false,
    match: new RegExp(`${BORDER}.*distance|distance.*${BORDER}`),
    description: 'Distance travelled near the walls.',
    down: 'Less movement along the walls: hypoactivity.',
  },
  // Centre vs periphery (checked first: EthoVision names mention the zone and the statistic)
  {
    id: 'center_time_pct',
    label: 'Time in centre (%)',
    short: 'Centre %',
    unit: '%',
    category: 'anxiety',
    perPaw: false,
    match: new RegExp(`${CENTER}.*(pct|percent|proportion|fraction)|(pct|percent|proportion|fraction).*${CENTER}`),
    description: 'Share of the session spent in the centre zone. Independent of session length, so it compares well across protocols.',
    down: 'Centre avoidance (thigmotaxis): anxiety-like behaviour, or low activity that keeps the animal near the walls.',
    up: 'Less centre avoidance: anxiolytic effect or disinhibition.',
  },
  {
    id: 'center_latency',
    label: 'Latency to enter centre',
    short: 'Centre latency',
    unit: 's',
    category: 'anxiety',
    perPaw: false,
    match: new RegExp(`latency.*${CENTER}|${CENTER}.*latency|latencytofirst`),
    description: 'Time from the start of the session until the animal first enters the centre zone.',
    up: 'Hesitation to enter the exposed centre: anxiety-like behaviour or low activity.',
    down: 'Earlier entry: anxiolytic effect, disinhibition or hyperactivity.',
  },
  {
    id: 'center_entries',
    label: 'Centre entries',
    short: 'Centre entries',
    unit: 'n',
    category: 'anxiety',
    perPaw: false,
    match: new RegExp(`${CENTER}.*(entr|frequency|freq|crossing|visit|count|number)|(entr|frequency|freq|crossing|visit|numberof).*${CENTER}`),
    description: 'Number of times the animal entered the centre zone (EthoVision: In zone, Frequency).',
    down: 'Fewer excursions into the centre: anxiety-like behaviour or low activity.',
    up: 'More centre visits: anxiolytic effect or hyperactivity.',
  },
  {
    id: 'center_distance',
    label: 'Distance in centre',
    short: 'Centre distance',
    unit: 'cm',
    category: 'anxiety',
    perPaw: false,
    match: new RegExp(`${CENTER}.*distance|distance.*${CENTER}`),
    description: 'Distance travelled inside the centre zone.',
    down: 'Less exploration of the centre.',
  },
  {
    id: 'center_time',
    label: 'Time in centre',
    short: 'Centre time',
    unit: 's',
    category: 'anxiety',
    perPaw: false,
    match: new RegExp(`${CENTER}.*(time|duration|dur)|(time|duration)in(the)?${CENTER}|^${CENTER}(zone)?$`),
    description: 'Time spent in the centre zone (EthoVision: In zone, Cumulative duration). The classic open-field index of anxiety-like behaviour.',
    down: 'Centre avoidance (thigmotaxis): anxiety-like behaviour, or low activity.',
    up: 'Less centre avoidance: anxiolytic effect or disinhibition.',
  },
  {
    id: 'periphery_time',
    label: 'Time in periphery',
    short: 'Periphery time',
    unit: 's',
    category: 'anxiety',
    perPaw: false,
    match: new RegExp(`${BORDER}.*(time|duration|dur|pct|percent)|(time|duration)in(the)?${BORDER}|^thigmotaxis`),
    description: 'Time spent near the walls. Mirrors centre time when the arena has only two zones.',
    up: 'Wall-hugging (thigmotaxis): anxiety-like behaviour.',
    down: 'Less wall-hugging.',
  },
  // Locomotion
  {
    id: 'immobile_time',
    label: 'Time immobile',
    short: 'Immobile',
    unit: 's',
    category: 'locomotion',
    perPaw: false,
    match: /immobil|notmoving|freez|resting|inactiv|stationary/,
    description: 'Time the animal was not moving (EthoVision: Movement Not Moving, or Mobility state Immobile).',
    up: 'More resting or freezing: hypoactivity, fatigue, sickness, or fear.',
    down: 'Less resting: hyperactivity.',
  },
  {
    id: 'moving_time',
    label: 'Time moving',
    short: 'Moving',
    unit: 's',
    category: 'locomotion',
    perPaw: false,
    match: /^(?!.*(dist|count|crossing|break)).*(moving|mobile|mobility|movement|active|ambulatory)|timemoving/,
    description: 'Time the animal was moving (EthoVision: Movement Moving).',
    down: 'Hypoactivity.',
    up: 'Hyperactivity.',
  },
  {
    id: 'distance',
    label: 'Total distance moved',
    short: 'Distance',
    unit: 'cm',
    category: 'locomotion',
    perPaw: false,
    match: /distance|pathlength|travel|ambulat(ion|ory)?dist|^dist/,
    description: 'Total distance travelled during the session (EthoVision: Distance moved, Total). The main index of locomotor activity.',
    down: 'Hypoactivity: motor impairment, sedation, sickness, low motivation, or strong anxiety-driven freezing.',
    up: 'Hyperactivity: dopaminergic hyperfunction, stimulant effect, ADHD- or mania-like models, or failure to habituate.',
  },
  {
    id: 'velocity',
    label: 'Mean velocity',
    short: 'Velocity',
    unit: 'cm/s',
    category: 'locomotion',
    perPaw: false,
    match: /velocity|speed/,
    description: 'Average speed over the session (EthoVision: Velocity, Mean). Includes resting periods unless the export limits it to moving bouts.',
    down: 'Slower movement or more resting.',
    up: 'Faster movement.',
  },
  {
    id: 'crossings',
    label: 'Line crossings / beam breaks',
    short: 'Crossings',
    unit: 'n',
    category: 'locomotion',
    perPaw: false,
    match: /crossing|linecross|squares?|beambreak|breaks|ambulatorycount|counts?$/,
    description: 'Manually scored line crossings or photobeam breaks: an activity count used instead of tracked distance.',
    down: 'Hypoactivity.',
    up: 'Hyperactivity.',
  },
  // Exploration and other behaviours
  {
    id: 'rearing',
    label: 'Rearing',
    short: 'Rearing',
    unit: 'n',
    category: 'exploration',
    perPaw: false,
    match: /rear|vertical|standing|upright/,
    description: 'Times the animal stood on its hind legs (supported against the wall or unsupported). Reflects exploration; unsupported rears also need balance.',
    down: 'Less exploration, anxiety-like behaviour, or impaired hind-limb strength or balance.',
    up: 'More exploration.',
  },
  {
    id: 'grooming',
    label: 'Grooming',
    short: 'Grooming',
    unit: 's',
    category: 'exploration',
    perPaw: false,
    match: /groom/,
    description: 'Time (or bouts) spent self-grooming.',
    up: 'Repetitive self-grooming (autism-related and OCD-like models) or stress-induced grooming.',
  },
  {
    id: 'stereotypy',
    label: 'Stereotypic behaviour',
    short: 'Stereotypy',
    unit: 'n',
    category: 'exploration',
    perPaw: false,
    match: /stereotyp|circling|rotation|turn|jump/,
    description: 'Repetitive movements such as circling, jumping or stereotypic counts from beam systems.',
    up: 'Repetitive or stereotyped behaviour: dopaminergic imbalance, unilateral lesions (circling), or autism-related models.',
  },
  {
    id: 'defecation',
    label: 'Fecal boli',
    short: 'Boli',
    unit: 'n',
    category: 'exploration',
    perPaw: false,
    match: /fecal|faecal|boli|bolus|defecat|feces|droppings|urin/,
    description: 'Number of fecal boli left in the arena: an autonomic index of emotionality.',
    up: 'Higher emotionality or stress.',
  },
  BODY_WEIGHT,
]

const CATEGORY_LABELS: Record<string, string> = {
  locomotion: 'Locomotor activity',
  anxiety: 'Centre vs periphery (anxiety-like behaviour)',
  exploration: 'Exploration and other behaviours',
  body: 'Body weight',
  habituation: 'Habituation within the session',
  other: 'Other / unrecognised numeric columns',
}

const DOMAINS: Domain[] = [
  {
    id: 'of_hypo',
    title: 'Hypoactivity',
    summary: 'Less distance travelled, slower and more time immobile.',
    conditions:
      'Motor impairment (Parkinson and Huntington disease models, ataxias, neuromuscular disease), sedation, sickness or pain, depression-like states, and strong anxiety-driven freezing.',
    meaning:
      'The animals move less in a novel arena. That can reflect reduced motor capacity, reduced motivation to explore, or fear. The open field cannot separate these on its own; the pattern of centre measures and other motor tests helps.',
    followUp: [
      'Rotarod, grip strength and gait analysis to test motor capacity.',
      'Home-cage activity over 24 h to separate novelty responses from general activity.',
      'Check body weight and general health.',
    ],
    items: [
      { param: 'distance', where: 'run', dir: -1 },
      { param: 'velocity', where: 'run', dir: -1 },
      { param: 'moving_time', where: 'run', dir: -1 },
      { param: 'immobile_time', where: 'run', dir: 1 },
      { param: 'crossings', where: 'run', dir: -1 },
      { param: 'rearing', where: 'run', dir: -1 },
    ],
  },
  {
    id: 'of_hyper',
    title: 'Hyperactivity',
    summary: 'More distance travelled, faster and less time resting.',
    conditions:
      'Dopaminergic hyperfunction (DAT knockout, stimulants), ADHD- and mania-like models, some autism- and schizophrenia-related models, hippocampal and prefrontal lesions, and failure to habituate.',
    meaning:
      'The animals move more than controls. This can reflect heightened arousal, impaired inhibitory control or failure to habituate to the arena. Look at activity across time bins: hyperactive animals often fail to slow down over the session.',
    followUp: [
      'Split the session into 5-minute bins to test habituation (load a time-bin column; see Over time).',
      'Repeat the test on a second day to test between-session habituation.',
      'Home-cage activity to see whether hyperactivity is novelty-specific.',
    ],
    items: [
      { param: 'distance', where: 'run', dir: 1 },
      { param: 'velocity', where: 'run', dir: 1 },
      { param: 'moving_time', where: 'run', dir: 1 },
      { param: 'immobile_time', where: 'run', dir: -1 },
      { param: 'crossings', where: 'run', dir: 1 },
    ],
  },
  {
    id: 'of_anxiety',
    title: 'Anxiety-like behaviour (centre avoidance)',
    summary: 'Less time in and fewer entries into the centre, later first entry, more time near the walls.',
    conditions:
      'Stress and anxiety models, some autism- and neurodevelopmental-disorder models, and anxiogenic drugs. Also seen secondary to low overall activity.',
    meaning:
      'Rodents naturally avoid open, exposed areas. More wall-hugging and less centre time than controls suggests anxiety-like behaviour. If total distance is also lower, the centre change may simply follow the lower activity, so read it together with the locomotion measures.',
    followUp: [
      'Elevated plus maze or light–dark box to confirm anxiety-like behaviour.',
      'Express centre time as a share of total time or distance to control for activity.',
      'Anxiolytic challenge (e.g. diazepam) if the mechanism matters.',
    ],
    items: [
      { param: 'center_time', where: 'run', dir: -1 },
      { param: 'center_time_pct', where: 'run', dir: -1 },
      { param: 'center_entries', where: 'run', dir: -1 },
      { param: 'center_distance', where: 'run', dir: -1 },
      { param: 'center_latency', where: 'run', dir: 1 },
      { param: 'periphery_time', where: 'run', dir: 1 },
      { param: 'defecation', where: 'run', dir: 1 },
    ],
  },
  {
    id: 'of_disinhibition',
    title: 'Reduced centre avoidance (anxiolytic-like or disinhibited)',
    summary: 'More time in and more entries into the centre, earlier first entry.',
    conditions: 'Anxiolytic drugs, some frontal and hippocampal lesion models, and models with impulsivity or risk-taking.',
    meaning:
      'The animals spend more time in the exposed centre than controls. This can reflect reduced anxiety or reduced risk assessment (disinhibition). Hyperactive animals also cross the centre more often, so compare with distance travelled.',
    followUp: ['Elevated plus maze or light–dark box.', 'Tests of impulsivity or risk assessment if disinhibition is suspected.'],
    items: [
      { param: 'center_time', where: 'run', dir: 1 },
      { param: 'center_time_pct', where: 'run', dir: 1 },
      { param: 'center_entries', where: 'run', dir: 1 },
      { param: 'center_latency', where: 'run', dir: -1 },
      { param: 'periphery_time', where: 'run', dir: -1 },
    ],
  },
  {
    id: 'of_habituation',
    title: 'Reduced within-session habituation',
    summary: 'Activity falls less (or resting rises less) from the first to the last interval than in controls.',
    conditions:
      'Hippocampal and prefrontal dysfunction, ADHD-, autism- and schizophrenia-related models, dopaminergic hyperfunction, and some models of intellectual disability.',
    meaning:
      'Healthy mice explore a novel arena and then slow down as it becomes familiar. A smaller decline suggests the animals do not habituate: impaired non-associative learning, persistent novelty-driven arousal, or hyperactivity. A group that is less active from the start can also show a smaller fall simply because it has less room to decline (floor effect), so read it with the first-interval values.',
    followUp: [
      'Compare first-interval values: a group that starts lower may show a floor effect rather than impaired habituation.',
      'Test again on a second day for between-session habituation.',
      'Novel object recognition or other memory tests if a learning deficit is suspected.',
    ],
    items: [
      { param: 'distance:change', where: 'run', dir: 1 },
      { param: 'velocity:change', where: 'run', dir: 1 },
      { param: 'moving_time:change', where: 'run', dir: 1 },
      { param: 'immobile_time:change', where: 'run', dir: -1 },
    ],
  },
  {
    id: 'of_repetitive',
    title: 'Repetitive behaviour',
    summary: 'More self-grooming or stereotypic movements.',
    conditions: 'Autism-related models (e.g. Shank3, Cntnap2), OCD-like models, dopaminergic imbalance and unilateral lesions (circling).',
    meaning:
      'Increased grooming or stereotypies in a novel arena point towards repetitive behaviour. Grooming also rises with stress, so compare with the centre measures.',
    followUp: ['Score grooming in the home cage as well.', 'Marble burying and nestlet shredding.'],
    items: [
      { param: 'grooming', where: 'run', dir: 1 },
      { param: 'stereotypy', where: 'run', dir: 1 },
    ],
  },
]

/** EthoVision adds the tracked body point and the unit to each name; neither identifies the measure. */
function clean(name: string): string {
  return name
    .replace(/(center|centre|nose|tail)[\s_-]*(point|base)/gi, ' ')
    .replace(/\((cm|mm|m|s|sec|cm\/s|mm\/s|%|n|count)\)/gi, ' ')
    .replace(/[\s_]+(cm\/s|mm\/s|cm|mm|m|s|sec)\s*$/i, ' ')
}

function matchColumn(name: string): ColumnMatch | null {
  // Values per within-session interval ("Resting time per interval") are kept apart from session totals.
  const perInterval = /\bper\s+(interval|bin|block)\b/i.test(name)
  if (perInterval) name = name.replace(/\s*\bper\s+(interval|bin|block)\b/i, '')
  const pct = /%|percent|pct|proportion/i.test(name)
  const { rest, stat } = splitStat(clean(name).replace(/[\s_-]*(total|sum|cumulative\s*duration)\s*$/i, (m) => (/duration/i.test(m) ? ' duration' : '')))
  let key = normalizeKey(rest)
  if (!key) return null
  if (pct && !/pct|percent|proportion|fraction/.test(key)) key += 'percent'
  for (const def of PARAMS) if (def.match.test(key)) return { paramId: def.id, stat: stat === 'r' ? 'mean' : stat, variant: perInterval ? 'per interval' : undefined }
  return null
}

function metaRole(name: string): MetaRole | null | undefined {
  const n = name.trim().replace(/_/g, ' ')
  if (/^(arena|zone|chamber|box|tracking|video|recording|track)\b/i.test(n)) return 'other'
  // Time bins within a session (e.g. "0-5 min") behave like timepoints.
  // Intervals / time bins within a session are ordered repeats (habituation), not timepoints.
  if (/^(time\s*)?bin|^interval|^block|^epoch|^minutes?$/i.test(n)) return 'run'
  if (/^(trial|trial\s*name)$/i.test(n)) return 'trial'
  if (/^(trial\s*duration|duration\s*of\s*trial|arena\s*(size|diameter)|light|lux)/i.test(n)) return 'equipment'
  return undefined
}

function demo(seed = 23): RawSheet {
  const r = rng(seed)
  const n = (sd: number) => gauss(r) * sd
  const groups = ['WT', 'Model + Vehicle', 'Model + AAV']
  const rows: Cell[][] = []
  const dur = 600
  let trial = 0
  for (const group of groups) {
    for (let a = 1; a <= 10; a++) {
      const id = `${group === 'WT' ? 'W' : group === 'Model + Vehicle' ? 'V' : 'T'}${String(a).padStart(2, '0')}`
      const sex = a % 2 ? 'M' : 'F'
      const act = 1 + n(0.15)
      const anx = 1 + n(0.25)
      for (const [ti, time] of ['P30', 'P60'].entries()) {
        trial++
        const d = group === 'WT' ? 0 : (group === 'Model + Vehicle' ? 1 : 0.4) * (0.5 + 0.5 * ti)
        const moving = Math.min(dur - 20, 380 * act * (1 - 0.25 * d) * (1 + n(0.08)))
        const vel = 4.2 * act * (1 - 0.15 * d) * (1 + n(0.08))
        const distance = vel * dur * (1 + n(0.04))
        const centerPct = Math.max(1, 14 * anx * (1 - 0.45 * d) * (1 + n(0.2)))
        const centerTime = (centerPct / 100) * dur
        rows.push([
          `Trial ${trial}`,
          'Arena 1',
          id,
          group,
          sex,
          time,
          +distance.toFixed(1),
          +vel.toFixed(2),
          +centerTime.toFixed(1),
          Math.max(0, Math.round(centerTime / 4 + n(4))),
          +Math.max(0.5, 20 * (1 + 1.2 * d) * Math.exp(n(0.5))).toFixed(1),
          +(dur - centerTime).toFixed(1),
          +moving.toFixed(1),
          +(dur - moving).toFixed(1),
          Math.max(0, Math.round(45 * act * (1 - 0.3 * d) + n(8))),
        ])
      }
    }
  }
  return {
    file: 'demo_openfield_ethovision.csv',
    sheet: '',
    cells: [
      ['Number of header lines:', 4],
      ['Experiment', 'DEMO open field — simulated data, not from a real study'],
      ['Trial duration', '10 min'],
      [
        'Trial',
        'Arena',
        'Subject',
        'Genotype',
        'Sex',
        'Time point',
        'Distance moved Center-point Total cm',
        'Velocity Center-point Mean cm/s',
        'In zone Center / Center-point Cumulative Duration s',
        'In zone Center / Center-point Frequency',
        'In zone Center / Center-point Latency to first s',
        'In zone Border / Center-point Cumulative Duration s',
        'Movement Moving / Center-point Cumulative Duration s',
        'Movement Not Moving / Center-point Cumulative Duration s',
        'Rearing Frequency',
      ],
      ...rows,
    ],
  }
}

export const openfield: ProgramDef = {
  id: 'openfield',
  name: 'Open Field Lab',
  test: 'open field',
  instrument: 'EthoVision XT',
  tagline: 'Open field activity and anxiety-like behaviour',
  lede:
    'Load open field results exported from EthoVision XT, or Excel and Prism tables. Open Field Lab recognises activity and centre/periphery measures, compares groups and timepoints, and points out patterns of hypo- or hyperactivity and anxiety-like behaviour.',
  params: PARAMS,
  categoryLabels: CATEGORY_LABELS,
  categoryOrder: ['locomotion', 'anxiety', 'exploration', 'habituation', 'body', 'other'],
  matchColumn,
  metaRole,
  domains: DOMAINS,
  runNoun: 'trial',
  runsNoun: 'trials',
  demo: () => demo(),
  demoFile: 'demo_openfield_ethovision.csv',
  keyMinParams: 1,
  rowAxis: 'Time bin',
  trialColumn: 'Interval',
  trialSummaries: true,
  trialsTab: {
    label: 'Habituation',
    title: 'Habituation across intervals',
    text: 'Group mean ± SEM for each interval of the session. Distance and speed normally fall, and resting time rises, as the arena becomes familiar (within-session habituation). A flatter curve than in controls suggests impaired habituation, often seen with hyperactivity or hippocampal dysfunction; a curve that is lower throughout suggests hypoactivity. The first, last and % change first → last interval are tested per animal in the Parameters tab.',
  },
  primaryColumn: 'Distance moved (cm)',
  features: { speed: false, paws: false },
  filePrefix: 'openfield',
  steps: [
    {
      title: 'Export from EthoVision',
      text: 'In EthoVision XT, open Analysis → Statistics and export the trial statistics (one row per trial) to Excel. Include your independent variables (genotype, treatment, age) and zone measures for the centre and border.',
    },
    {
      title: 'Check the setup',
      text: 'Open Field Lab guesses which columns hold the animal ID, group and timepoint and which group is the control. Time bins (e.g. 0–5, 5–10 min) become timepoints, so habituation shows in the Over time tab.',
    },
    {
      title: 'Read the results',
      text: 'Get a written summary, per-animal plots of activity and centre measures, and statistics. Everything can be exported as CSV, SVG, PNG or a Prism file.',
    },
  ],
}
