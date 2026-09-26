// Catalog of CatWalk XT parameters: how to recognise them in an export and
// what they mean. Descriptions are written for the in-app glossary and are
// reused by the interpretation engine.

export type Paw = 'LF' | 'RF' | 'LH' | 'RH'
export const PAWS: Paw[] = ['LF', 'RF', 'LH', 'RH']
export const PAW_NAMES: Record<Paw, string> = {
  LF: 'Left front',
  RF: 'Right front',
  LH: 'Left hind',
  RH: 'Right hind',
}

export type Category =
  | 'run'
  | 'static'
  | 'temporal'
  | 'spatial'
  | 'kinetic'
  | 'coordination'
  | 'support'
  | 'positioning'
  | 'other'

export const CATEGORY_LABELS: Record<Category, string> = {
  run: 'Run characteristics',
  static: 'Static paw (print) parameters',
  temporal: 'Temporal step-cycle parameters',
  spatial: 'Spatial step parameters',
  kinetic: 'Kinetic / speed parameters',
  coordination: 'Interlimb coordination',
  support: 'Support (paws on the glass)',
  positioning: 'Base of support & paw positioning',
  other: 'Other / unrecognised numeric columns',
}

export const CATEGORY_ORDER: Category[] = [
  'run',
  'static',
  'temporal',
  'spatial',
  'kinetic',
  'positioning',
  'coordination',
  'support',
  'other',
]

export interface ParamDef {
  id: string
  label: string
  short: string
  unit: string
  category: Category
  perPaw: boolean
  /** Tested against the normalised (lowercase, alphanumeric only) remainder of the column name. */
  match: RegExp
  description: string
  /** What a decrease vs. control usually indicates. */
  down?: string
  /** What an increase vs. control usually indicates. */
  up?: string
  /** Paired-paw parameter (phase dispersion / couplings). */
  pairwise?: boolean
}

// Order matters: more specific patterns first.
export const PARAMS: ParamDef[] = [
  // ---- Run characteristics -------------------------------------------------
  {
    id: 'run_duration',
    label: 'Run duration',
    short: 'Duration',
    unit: 's',
    category: 'run',
    perPaw: false,
    match: /^(run)?duration/,
    description: 'Time the animal takes to cross the recorded section of the walkway.',
    up: 'Slower crossing: hypokinesia, weakness, pain, reduced motivation or exploration.',
    down: 'Faster crossing; check whether groups differ in speed before interpreting other parameters.',
  },
  {
    id: 'speed_variation',
    label: 'Maximum speed variation',
    short: 'Max variation',
    unit: '%',
    category: 'run',
    perPaw: false,
    match: /^(run)?(maximum|max)variation|^speedvariation/,
    description:
      'Largest deviation of instantaneous speed from the run average. CatWalk uses it as a run-compliance criterion (runs above your threshold, e.g. 60%, are non-compliant).',
    up: 'Stop-and-go walking; hesitancy, ataxia, or a poorly habituated animal.',
  },
  {
    id: 'speed',
    label: 'Average speed',
    short: 'Speed',
    unit: 'cm/s',
    category: 'run',
    perPaw: false,
    match: /^(run)?(average)?speed$|^(run)?averagespeed|^velocity/,
    description:
      'Mean body speed across the run. Nearly every other CatWalk parameter depends on speed (Batka et al., 2014), so group differences in speed must be considered before interpreting anything else.',
    down: 'Bradykinesia/hypokinesia, weakness, pain, fatigue or reduced motivation.',
    up: 'Hyperactivity or anxiety-driven escape behaviour.',
  },
  {
    id: 'cadence',
    label: 'Cadence',
    short: 'Cadence',
    unit: 'steps/s',
    category: 'run',
    perPaw: false,
    match: /^cadence/,
    description: 'Number of steps per second during the run.',
    down: 'Slower stepping rhythm; often accompanies reduced speed (parkinsonism, weakness).',
    up: 'Faster, shorter steps; can be a compensation for short stride length.',
  },
  {
    id: 'number_of_steps',
    label: 'Number of steps',
    short: 'Steps',
    unit: 'n',
    category: 'run',
    perPaw: false,
    match: /^(numberof|nr|no)?steps$|^numberofsteps|^stepsnumber/,
    description: 'Total number of steps detected in the run.',
    up: 'More, shorter steps to cross the same distance.',
  },
  // ---- Coordination ----------------------------------------------------------
  {
    id: 'regularity_index',
    label: 'Regularity index',
    short: 'RI',
    unit: '%',
    category: 'coordination',
    perPaw: false,
    match: /regularityindex|^ri$/,
    description:
      'Percentage of steps that belong to one of the six normal step-sequence patterns: (4 × number of normal patterns / total paw placements) × 100. Healthy rodents are close to 100%.',
    down: 'Loss of interlimb coordination: spinal cord injury, cerebellar or vestibular ataxia, severe basal-ganglia dysfunction.',
  },
  {
    id: 'step_patterns',
    label: 'Number of step patterns',
    short: 'Patterns',
    unit: 'n',
    category: 'coordination',
    perPaw: false,
    match: /numberofpatterns|stepsequencenumber|^patterns$/,
    description: 'Number of complete normal step-sequence patterns detected in the run.',
  },
  ...(['ca', 'cb', 'aa', 'ab', 'ra', 'rb'] as const).map(
    (p): ParamDef => ({
      id: `step_seq_${p}`,
      label: `Step sequence ${p === 'ca' ? 'Ca (cruciate A)' : p === 'cb' ? 'Cb (cruciate B)' : p === 'aa' ? 'Aa (alternate A)' : p === 'ab' ? 'Ab (alternate B)' : p === 'ra' ? 'Ra (rotary A)' : 'Rb (rotary B)'}`,
      short: `Seq ${p[0].toUpperCase()}${p[1]}`,
      unit: '%',
      category: 'coordination',
      perPaw: false,
      match: new RegExp(`^(stepsequence|sequence|stepseq|pattern)${p}`),
      description:
        {
          ca: 'Cruciate pattern A: RF-LF-RH-LH.',
          cb: 'Cruciate pattern B: LF-RF-LH-RH.',
          aa: 'Alternate pattern A: RF-RH-LF-LH. The dominant pattern in healthy rats and mice.',
          ab: 'Alternate pattern B: LF-RH-RF-LH.',
          ra: 'Rotary pattern A: RF-LF-LH-RH.',
          rb: 'Rotary pattern B: LF-RF-RH-LH.',
        }[p] + ' Expressed as a percentage of all normal patterns in the run.',
      up: 'A shift toward this pattern. Shifts between patterns are common after spinal cord injury and in ataxic models.',
      down: 'Less use of this pattern.',
    }),
  ),
  {
    id: 'phase_dispersion',
    label: 'Phase dispersion',
    short: 'Phase disp.',
    unit: '%',
    category: 'coordination',
    perPaw: false,
    pairwise: true,
    match: /^phasedispersion/,
    description:
      'Timing of initial contact of a target paw relative to the step cycle of an anchor paw (0% means they land at the same moment). Diagonal pairs are about 0% and ipsilateral pairs about 50% in a normal walking gait. CatWalk XT reports circular statistics (CStat Mean, AD, R); this app averages the circular means across runs arithmetically, which is accurate unless values sit near the wrap-around point.',
    up: 'Changed phase relationship; a larger spread across runs (SD) means less consistent interlimb coupling.',
  },
  {
    id: 'coupling',
    label: 'Coupling',
    short: 'Coupling',
    unit: '%',
    category: 'coordination',
    perPaw: false,
    pairwise: true,
    match: /^coupling/,
    description:
      'Similar to phase dispersion but calculated on the step cycles of the anchor paw rather than on individual steps. It describes the temporal relationship between two paws.',
  },
  {
    id: 'phase_dispersion_r',
    label: 'Phase dispersion consistency (R)',
    short: 'Phase disp. R',
    unit: '0–1',
    category: 'coordination',
    perPaw: false,
    pairwise: true,
    match: /^phasedispersion/,
    description:
      'Mean resultant length (R) of the circular phase-dispersion statistics: how consistently the target paw lands at the same point of the anchor paw\'s step cycle. 1 = perfectly consistent, 0 = random.',
    down: 'Less consistent interlimb timing: a sensitive sign of impaired coordination (spinal, cerebellar or vestibular).',
  },
  {
    id: 'coupling_r',
    label: 'Coupling consistency (R)',
    short: 'Coupling R',
    unit: '0–1',
    category: 'coordination',
    perPaw: false,
    pairwise: true,
    match: /^coupling/,
    description: 'Mean resultant length (R) of the circular coupling statistics: consistency of the temporal relationship between two paws. 1 = perfectly consistent.',
    down: 'Less consistent coupling between the two paws.',
  },
  // ---- Support --------------------------------------------------------------
  ...(
    [
      ['zero', 'Zero', 'No paw on the glass (airborne phase). Rare during walking; more frequent when running or jumping.'],
      ['single', 'Single', 'Only one paw on the glass.'],
      ['diagonal', 'Diagonal', 'Two diagonal paws on the glass (e.g. RF + LH): the typical two-paw support of a trotting/walking rodent.'],
      ['girdle', 'Girdle', 'Both front paws or both hind paws on the glass at the same time.'],
      ['lateral', 'Lateral', 'Two ipsilateral paws on the glass (e.g. RF + RH).'],
      ['three', 'Three', 'Three paws on the glass at once.'],
      ['four', 'Four', 'All four paws on the glass at once.'],
    ] as const
  ).map(
    ([k, name, desc]): ParamDef => ({
      id: `support_${k}`,
      label: `Support ${name.toLowerCase()}`,
      short: `Sup. ${name.toLowerCase()}`,
      unit: '%',
      category: 'support',
      perPaw: false,
      match: new RegExp(`^support${k}`),
      description: `${desc} Percentage of run time in this support configuration.`,
      up:
        k === 'three' || k === 'four' || k === 'lateral' || k === 'girdle'
          ? 'More time on multiple/unstable-type support: balance compensation typical of ataxia, weakness or slow walking.'
          : k === 'single' || k === 'zero'
            ? 'More time on few paws: faster gait or hyperactivity.'
            : undefined,
      down:
        k === 'diagonal'
          ? 'Less normal diagonal support; seen in ataxic gait and after spinal cord injury.'
          : undefined,
    }),
  ),
  // ---- Positioning ------------------------------------------------------------
  {
    id: 'bos_front',
    label: 'Base of support, front paws',
    short: 'BOS front',
    unit: 'cm',
    category: 'positioning',
    perPaw: false,
    match: /^(bos|baseofsupport)front/,
    description: 'Average width between the two front paws.',
    up: 'Wider stance: postural instability or cervical/forelimb compensation.',
    down: 'Narrower stance.',
  },
  {
    id: 'bos_hind',
    label: 'Base of support, hind paws',
    short: 'BOS hind',
    unit: 'cm',
    category: 'positioning',
    perPaw: false,
    match: /^(bos|baseofsupport)hind/,
    description: 'Average width between the two hind paws.',
    up: 'Wide-based gait: a classic marker of cerebellar/proprioceptive ataxia and hind-limb instability (for example after spinal cord injury).',
    down: 'Narrower hind stance.',
  },
  {
    id: 'print_pos_right',
    label: 'Print position, right paws',
    short: 'Print pos. R',
    unit: 'cm',
    category: 'positioning',
    perPaw: false,
    match: /^printposition(s)?right/,
    description:
      'Distance between where the right hind paw lands and where the right front paw was placed in the previous step. Healthy rodents place the hind paw close to the fore paw print.',
    up: 'Imprecise hind paw placement: reduced sensorimotor integration, ataxia or corticospinal dysfunction.',
  },
  {
    id: 'print_pos_left',
    label: 'Print position, left paws',
    short: 'Print pos. L',
    unit: 'cm',
    category: 'positioning',
    perPaw: false,
    match: /^printposition(s)?left/,
    description: 'Same as print position right, for the left paws.',
    up: 'Imprecise hind paw placement: reduced sensorimotor integration, ataxia or corticospinal dysfunction.',
  },
  ...(
    [
      ['sfi', 'Sciatic functional index', 'SFI', /^sciaticfunctionalindex|^sfi$/],
      ['pfi', 'Peroneal functional index', 'PFI', /^peronealfunctionalindex|^pfi$/],
      ['tfi', 'Posterior tibial functional index', 'TFI', /^(posterior)?tibialfunctionalindex|^tfi$/],
    ] as const
  ).map(
    ([id, label, short, match]): ParamDef => ({
      id,
      label,
      short,
      unit: '',
      category: 'positioning',
      perPaw: false,
      match,
      description: `${label} calculated by CatWalk XT from print length, toe spread and intermediate toe spread of the hind paws (requires manual toe measurements). About 0 is normal and about −100 is complete loss of function.`,
      down: 'More negative: loss of nerve function (e.g. after sciatic crush or transection).',
    }),
  ),
  // ---- Per-paw static ---------------------------------------------------------
  {
    id: 'stand_index',
    label: 'Stand index',
    short: 'Stand idx',
    unit: '',
    category: 'kinetic',
    perPaw: true,
    match: /^standindex/,
    description: 'Speed at which the paw loses contact with the glass: a measure of how quickly the paw pushes off.',
    down: 'Slower push-off; reduced propulsive force.',
  },
  {
    id: 'max_contact_at',
    label: 'Max contact at',
    short: 'Max contact at',
    unit: '%',
    category: 'temporal',
    perPaw: true,
    match: /^maxcontactat/,
    description: 'Point in the stance phase, as % of stand duration, at which the paw reaches its largest contact area.',
    up: 'Maximum contact reached later: slower loading of the limb.',
    down: 'Maximum contact reached earlier.',
  },
  {
    id: 'max_contact_max_intensity',
    label: 'Max contact max intensity',
    short: 'MC max int.',
    unit: 'a.u. (0–255)',
    category: 'static',
    perPaw: true,
    match: /^maxcontactmaxintensity/,
    description: 'Maximum pixel intensity of the print at the moment of maximum contact.',
    down: 'Less pressure at peak loading: weakness, pain or unloading of this limb.',
  },
  {
    id: 'max_contact_mean_intensity',
    label: 'Max contact mean intensity',
    short: 'MC mean int.',
    unit: 'a.u. (0–255)',
    category: 'static',
    perPaw: true,
    match: /^maxcontactmeanintensity/,
    description: 'Mean pixel intensity of the print at the moment of maximum contact.',
    down: 'Less weight bearing at peak loading.',
  },
  {
    id: 'max_contact_area',
    label: 'Max contact area',
    short: 'MC area',
    unit: 'cm²',
    category: 'static',
    perPaw: true,
    match: /^maxcontactarea/,
    description: 'Paw area touching the glass at the moment of maximum contact.',
    down: 'Paw unloading (pain/guarding), weakness, digit curling or toe-walking.',
    up: 'Flatter paw placement or heavier loading; also scales with body weight.',
  },
  {
    id: 'print_length',
    label: 'Print length',
    short: 'Length',
    unit: 'cm',
    category: 'static',
    perPaw: true,
    match: /^printlength/,
    description: 'Length (horizontal direction) of the complete print, summed over all frames of the stance.',
    down: 'Toe-walking or reduced heel contact; seen with pain, spasticity or sciatic nerve deficits.',
    up: 'Heel dragging or flat-footed placement.',
  },
  {
    id: 'print_width',
    label: 'Print width',
    short: 'Width',
    unit: 'cm',
    category: 'static',
    perPaw: true,
    match: /^printwidth/,
    description: 'Width (vertical direction) of the complete print; reflects toe spread.',
    down: 'Reduced toe spread; a sensitive sign of peripheral (sciatic/tibial/peroneal) nerve dysfunction.',
  },
  {
    id: 'print_area',
    label: 'Print area',
    short: 'Area',
    unit: 'cm²',
    category: 'static',
    perPaw: true,
    match: /^printarea|^area$/,
    description: 'Total floor area contacted by the paw during the entire stance phase.',
    down: 'Paw unloading, weakness, pain or abnormal digit posture; a core deficit after spinal cord injury, stroke or nerve injury.',
    up: 'Flatter placement, heel dragging or heavier animals (print size scales with body weight).',
  },
  {
    id: 'max_intensity_at',
    label: 'Max intensity at',
    short: 'Max int. at',
    unit: '%',
    category: 'temporal',
    perPaw: true,
    match: /^maxintensityat/,
    description: 'Point in the stance phase, as % of stand duration, at which the maximum intensity is reached.',
  },
  {
    id: 'max_intensity',
    label: 'Max intensity',
    short: 'Max int.',
    unit: 'a.u. (0–255)',
    category: 'static',
    perPaw: true,
    match: /^maxintensity/,
    description:
      'Maximum pixel intensity of the complete paw print. Because the light signal increases with contact pressure, intensity is used as an indirect measure of weight bearing.',
    down: 'Reduced weight bearing: pain (allodynia), weakness, or deliberate unloading of the limb.',
    up: 'Increased loading, e.g. a compensating limb carrying weight shifted away from an injured one.',
  },
  {
    id: 'min_intensity',
    label: 'Min intensity',
    short: 'Min int.',
    unit: 'a.u. (0–255)',
    category: 'static',
    perPaw: true,
    match: /^minintensity/,
    description: 'Minimum pixel intensity of the complete paw print.',
  },
  {
    id: 'mean_intensity',
    label: 'Mean intensity',
    short: 'Mean int.',
    unit: 'a.u. (0–255)',
    category: 'static',
    perPaw: true,
    match: /^meanintensity(?!ofthe15)|^intensity$/,
    description: 'Mean pixel intensity of the complete paw print; an indirect measure of weight bearing.',
    down: 'Reduced weight bearing: pain, weakness or unloading of the limb.',
    up: 'Compensatory overloading.',
  },
  {
    id: 'mean_intensity_15',
    label: 'Mean intensity of the 15 most intense pixels',
    short: 'Top-15 int.',
    unit: 'a.u. (0–255)',
    category: 'static',
    perPaw: true,
    match: /^meanintensityofthe15/,
    description: 'Mean intensity of the 15 brightest pixels of the print; less sensitive to print size than mean intensity.',
    down: 'Reduced peak weight bearing.',
  },
  // ---- Per-paw temporal -----------------------------------------------------
  {
    id: 'stand',
    label: 'Stand',
    short: 'Stand',
    unit: 's',
    category: 'temporal',
    perPaw: true,
    match: /^stand$|^stand(duration)?s?$|^stance$/,
    description: 'Duration of contact of the paw with the glass (the stance phase).',
    down: 'Shorter contact: limb guarding (pain) or faster walking.',
    up: 'Prolonged stance: slow walking, weakness, or the paw being used for balance support.',
  },
  {
    id: 'swing_speed',
    label: 'Swing speed',
    short: 'Swing spd',
    unit: 'cm/s',
    category: 'kinetic',
    perPaw: true,
    match: /^swingspeed/,
    description: 'Speed of the paw during the swing phase (stride length / swing duration).',
    down: 'Reduced limb propulsion: motor-neuron disease, weakness, spasticity or bradykinesia.',
    up: 'Faster limb advancement; usually follows higher body speed.',
  },
  {
    id: 'swing',
    label: 'Swing',
    short: 'Swing',
    unit: 's',
    category: 'temporal',
    perPaw: true,
    match: /^swing$|^swing(duration)?s?$/,
    description: 'Duration of no contact of the paw with the glass during a step cycle (the swing phase).',
    up: 'Longer time to advance the limb: weakness, reduced flexor drive, or guarding of a painful paw.',
    down: 'Faster limb advancement.',
  },
  {
    id: 'step_cycle',
    label: 'Step cycle',
    short: 'Step cycle',
    unit: 's',
    category: 'temporal',
    perPaw: true,
    match: /^stepcycle/,
    description: 'Time between two consecutive initial contacts of the same paw (stand + swing).',
    up: 'Slower stepping; strongly linked to lower walking speed.',
    down: 'Faster stepping.',
  },
  {
    id: 'duty_cycle',
    label: 'Duty cycle',
    short: 'Duty cycle',
    unit: '%',
    category: 'temporal',
    perPaw: true,
    match: /^dutycycle/,
    description: 'Stand as a percentage of the step cycle: stand / (stand + swing) × 100.',
    down: 'Less time loaded on this limb; a guarding (pain) signature when it is unilateral.',
    up: 'More time on this limb; compensation or balance support.',
  },
  {
    id: 'single_stance',
    label: 'Single stance',
    short: 'Single stance',
    unit: 's',
    category: 'temporal',
    perPaw: true,
    match: /^singlestance/,
    description: 'Duration of ground contact of a single hind paw while the contralateral hind paw is in swing.',
    down: 'Reluctance to bear weight on this limb alone: pain or weakness.',
  },
  {
    id: 'initial_dual_stance',
    label: 'Initial dual stance',
    short: 'Init. dual',
    unit: 's',
    category: 'temporal',
    perPaw: true,
    match: /^initialdualstance/,
    description: 'First period in the stance phase of a hind paw when the contralateral hind paw is also on the glass.',
    up: 'Prolonged double support: postural insecurity, weakness or ataxia.',
  },
  {
    id: 'terminal_dual_stance',
    label: 'Terminal dual stance',
    short: 'Term. dual',
    unit: 's',
    category: 'temporal',
    perPaw: true,
    match: /^terminaldualstance/,
    description: 'Second period in the stance phase of a hind paw when the contralateral hind paw is also on the glass.',
    up: 'Prolonged double support: postural insecurity, weakness or ataxia.',
  },
  // ---- Per-paw spatial ------------------------------------------------------
  {
    id: 'stride_length',
    label: 'Stride length',
    short: 'Stride',
    unit: 'cm',
    category: 'spatial',
    perPaw: true,
    match: /^stridelength|^stride$/,
    description: 'Distance between successive placements of the same paw.',
    down: 'Short, shuffling steps: parkinsonism, motor-neuron disease, weakness or pain.',
    up: 'Longer strides; follows higher speed, and can occur in some ataxic models.',
  },
  {
    id: 'toe_spread',
    label: 'Toe spread',
    short: 'Toe spread',
    unit: 'cm',
    category: 'static',
    perPaw: true,
    match: /^toespread/,
    description:
      'Distance between the first and fifth toes (measured manually in CatWalk XT). Used with print length and intermediate toe spread to calculate the sciatic, peroneal and tibial functional indices.',
    down: 'Reduced toe spread: denervation of the intrinsic foot muscles (sciatic/tibial nerve injury, neuropathy).',
  },
  {
    id: 'intermediate_toe_spread',
    label: 'Intermediate toe spread',
    short: 'Int. toe spread',
    unit: 'cm',
    category: 'static',
    perPaw: true,
    match: /^intermediatetoespread/,
    description: 'Distance between the second and fourth toes (measured manually). Used in the functional-index formulas.',
    down: 'Reduced intermediate toe spread: peripheral nerve dysfunction.',
  },
  {
    id: 'manual_print_length',
    label: 'Manual print length',
    short: 'Manual length',
    unit: 'cm',
    category: 'static',
    perPaw: true,
    match: /^manualprintlength/,
    description: 'Print length measured manually from heel to the third toe tip. Used in the functional-index formulas.',
    up: 'Longer prints (heel contact, flattened foot), classically increased after sciatic nerve injury.',
  },
  {
    id: 'paw_angle_body_axis',
    label: 'Paw angle (body axis)',
    short: 'Paw angle body',
    unit: '°',
    category: 'positioning',
    perPaw: true,
    match: /^pawanglebodyaxis/,
    description: 'Angle between the paw print\'s long axis and the body axis. Requires manual paw-axis annotation in CatWalk XT.',
    up: 'More outward (external) rotation of the paw; a compensation for instability, seen in some ataxic and neuromuscular models.',
  },
  {
    id: 'paw_angle_movement_vector',
    label: 'Paw angle (movement vector)',
    short: 'Paw angle move',
    unit: '°',
    category: 'positioning',
    perPaw: true,
    match: /^pawanglemovementvector/,
    description: 'Angle between the paw print\'s long axis and the direction of movement. Requires manual paw-axis annotation.',
    up: 'More outward paw rotation relative to the direction of travel.',
  },
  {
    id: 'body_speed_variation',
    label: 'Body speed variation',
    short: 'Body spd var.',
    unit: '%',
    category: 'kinetic',
    perPaw: true,
    match: /^bodyspeedvariation/,
    description: 'Variation in body speed over the step cycle of this paw.',
    up: 'Less smooth, more irregular progression.',
  },
  {
    id: 'body_speed',
    label: 'Body speed',
    short: 'Body spd',
    unit: 'cm/s',
    category: 'kinetic',
    perPaw: true,
    match: /^bodyspeed/,
    description: 'Speed of the body over one step cycle of this paw.',
    down: 'Slower progression.',
  },
]

export const PARAM_BY_ID: Record<string, ParamDef> = Object.fromEntries(PARAMS.map((p) => [p.id, p]))

export function otherParam(label: string): ParamDef {
  return {
    id: `other:${label}`,
    label,
    short: label,
    unit: '',
    category: 'other',
    perPaw: false,
    match: /$^/,
    description: 'A numeric column that did not match a known CatWalk parameter. It is still analysed.',
  }
}

// ---------------------------------------------------------------------------
// Column-name recognition

export type StatKind = 'mean' | 'sd' | 'sem' | 'median' | 'min' | 'max' | 'cv' | 'r' | 'value'

export interface ColumnMatch {
  paramId: string
  paw?: Paw
  variant?: string
  stat: StatKind
}

const STAT_SUFFIX: [RegExp, StatKind][] = [
  // Circular statistics used by CatWalk XT for phase dispersions and couplings
  [/[\s_\-.]*(?<![a-z0-9])c?stat\s*r\s*$/i, 'r'],
  [/[\s_\-.]*(?<![a-z0-9])c?stat\s*ad\s*$/i, 'sd'],
  [/[\s_\-.]*(?<![a-z0-9])(mean|average|avg)\s*$/i, 'mean'],
  [/[\s_\-.]*(?<![a-z0-9])(stdev|st\.?\s?dev|std|sd|standard\s?deviation)\s*$/i, 'sd'],
  [/[\s_\-.]*(?<![a-z0-9])(sem|se|standard\s?error)\s*$/i, 'sem'],
  [/[\s_\-.]*(?<![a-z0-9])(median)\s*$/i, 'median'],
  [/[\s_\-.]*(?<![a-z0-9])(min|minimum)\s*$/i, 'min'],
  [/[\s_\-.]*(?<![a-z0-9])(max|maximum)\s*$/i, 'max'],
  [/[\s_\-.]*(?<![a-z0-9])(cv|coef\.?\s?var)\s*$/i, 'cv'],
]

const PAW_PREFIX: [RegExp, Paw][] = [
  [/^\s*(lf|lfp)(?=[\s_\-.(:]|$)/i, 'LF'],
  [/^\s*(rf|rfp)(?=[\s_\-.(:]|$)/i, 'RF'],
  [/^\s*(lh|lhp)(?=[\s_\-.(:]|$)/i, 'LH'],
  [/^\s*(rh|rhp)(?=[\s_\-.(:]|$)/i, 'RH'],
  [/^\s*left[\s_-]*(front|fore)[\s_-]*(paw)?/i, 'LF'],
  [/^\s*right[\s_-]*(front|fore)[\s_-]*(paw)?/i, 'RF'],
  [/^\s*left[\s_-]*hind[\s_-]*(paw)?/i, 'LH'],
  [/^\s*right[\s_-]*hind[\s_-]*(paw)?/i, 'RH'],
  [/^\s*front[\s_-]*left/i, 'LF'],
  [/^\s*front[\s_-]*right/i, 'RF'],
  [/^\s*hind[\s_-]*left/i, 'LH'],
  [/^\s*hind[\s_-]*right/i, 'RH'],
]

const PAW_SUFFIX: [RegExp, Paw][] = [
  [/[\s_\-.(]+(lf)\)?\s*$/i, 'LF'],
  [/[\s_\-.(]+(rf)\)?\s*$/i, 'RF'],
  [/[\s_\-.(]+(lh)\)?\s*$/i, 'LH'],
  [/[\s_\-.(]+(rh)\)?\s*$/i, 'RH'],
]

const PAIR = /(?<![a-z0-9])(lf|rf|lh|rh)\s*(?:->|→|-|_|>|to|\s)\s*(lf|rf|lh|rh)(?![a-z0-9])/i

export function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // units in parentheses
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/cm²|cm\^2|cm2/g, ' ')
    .replace(/[^a-z0-9]+/g, '')
}

export function matchColumn(name: string): ColumnMatch | null {
  // CatWalk XT 10 prefixes some whole-run values with "OtherStatistics_"
  let rest = name.trim().replace(/^other[\s_]*statistics[\s_]*/i, '')
  let stat: StatKind = 'value'
  for (const [re, kind] of STAT_SUFFIX) {
    if (re.test(rest)) {
      // don't strip "average" from "average speed"-style names that are only one word long
      const stripped = rest.replace(re, '')
      if (normalizeKey(stripped).length > 0) {
        stat = kind
        rest = stripped
      }
      break
    }
  }
  // Units trailing after a stat, e.g. "BOS_HindPaws_Mean_(cm)"
  if (stat === 'value') {
    const noUnits = rest.replace(/[\s_]*\([^)]*\)\s*$/, '')
    for (const [re, kind] of STAT_SUFFIX) {
      if (re.test(noUnits)) {
        const stripped = noUnits.replace(re, '')
        if (normalizeKey(stripped).length > 0) {
          stat = kind
          rest = stripped
        }
        break
      }
    }
  }

  let paw: Paw | undefined
  let pairVariant: string | undefined
  const pair = PAIR.exec(rest)
  const restKeyFull = normalizeKey(rest)
  if (pair && /^(phasedispersion|coupling)/.test(restKeyFull)) {
    pairVariant = `${pair[1].toUpperCase()}→${pair[2].toUpperCase()}`
    rest = rest.replace(PAIR, ' ')
  } else {
    for (const [re, p] of PAW_PREFIX) {
      if (re.test(rest)) {
        paw = p
        rest = rest.replace(re, '')
        break
      }
    }
    if (!paw) {
      for (const [re, p] of PAW_SUFFIX) {
        if (re.test(rest)) {
          paw = p
          rest = rest.replace(re, '')
          break
        }
      }
    }
  }

  const key = normalizeKey(rest)
  if (!key) return null
  for (const def of PARAMS) {
    if (def.perPaw !== Boolean(paw)) continue
    if (def.pairwise && !pairVariant) continue
    if (!def.pairwise && pairVariant) continue
    // Circular R columns map to their own "consistency" parameter.
    if (def.pairwise && def.id.endsWith('_r') !== (stat === 'r')) continue
    if (def.match.test(key)) {
      return { paramId: def.id, paw, variant: pairVariant, stat: stat === 'r' ? 'mean' : stat }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Metadata-column recognition

export type MetaRole = 'subject' | 'group' | 'grouptype' | 'time' | 'run' | 'compliant' | 'trial' | 'sex' | 'nruns' | 'equipment' | 'other'

const META_PATTERNS: [RegExp, MetaRole][] = [
  [/description$/i, 'other'],
  [/^group\s*type$/i, 'grouptype'],
  [/^number\s*of\s*runs/i, 'nruns'],
  [/^(camera|green\s*intensity|ceiling\s*light|walkway\s*(light|length|width)|[xy][\s-]*unit)/i, 'equipment'],
  [/^(animal|subject|mouse|rat)(\s*(id|name|nr|no|number|code))?$|^(animal|subject)\s*id|^id$|^ear\s*tag/i, 'subject'],
  [/^(group|genotype|treatment|condition|cohort|strain|line|dose|arm|vector|cohort\s*name)\b/i, 'group'],
  [/^(time\s*point|timepoint|time|week|weeks|day|days|session|visit|pod|dpi|wpi)\b/i, 'time'],
  [/^run(\s*(id|nr|no|number|name))?$/i, 'run'],
  [/complian/i, 'compliant'],
  [/^(catwalk\s*)?trial(\s*(id|name|nr|no|number))?$/i, 'trial'],
  [/^(sex|gender)$/i, 'sex'],
  [/^(experiment|file|source|date|comment|notes?|remarks?|status|label|detection|age|dob|birth|body\s*weight|weight)/i, 'other'],
]

export function metaRole(name: string): MetaRole | null {
  // CatWalk XT 10 uses underscores (Group_Type, Time_Point, Trial_Description)
  const n = name.trim().replace(/_/g, ' ')
  for (const [re, role] of META_PATTERNS) if (re.test(n)) return role
  return null
}
