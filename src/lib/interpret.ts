// Maps statistically supported gait changes onto recognisable phenotype
// "domains". This is pattern matching to help orient the reader, not a
// diagnosis: every statement is phrased as "consistent with".

import type { AnalysisConfig, Comparison, MeasureResult, TimeResults } from './analysis'
import { formatP, primaryComparison } from './analysis'

type Where = 'run' | 'front' | 'hind' | 'any' | 'asymF' | 'asymH'

interface SignatureItem {
  param: string
  where: Where
  /** +1 increase expected, -1 decrease expected, 0 either direction (magnitude) */
  dir: 1 | -1 | 0
}

export interface Domain {
  id: string
  title: string
  summary: string
  conditions: string
  /** Plain-language interpretation of what the pattern may reflect biologically. */
  meaning: string
  /** Complementary tests that would confirm or refine the interpretation. */
  followUp: string[]
  items: SignatureItem[]
}

export const DOMAINS: Domain[] = [
  {
    id: 'hypokinesia',
    title: 'Global slowing (hypokinesia / bradykinesia-like)',
    summary: 'Slower walking with longer step cycles, longer stance and shorter strides across all four limbs.',
    conditions:
      'Parkinsonian models (bilateral MPTP, α-synuclein), Huntington disease models, generalised weakness (ALS, SMA, myopathy), sickness behaviour or reduced motivation.',
    meaning:
      "The animals move more slowly overall and every limb stays on the ground longer. That is a global change in locomotor drive or capacity rather than a problem with one limb or with coordination. It can come from reduced motor output (basal ganglia, motor neurons or muscle), from general illness or pain in several limbs, or simply from lower motivation to cross the walkway.",
    followUp: ["Check body weight and general health at the same timepoint.", "Open-field activity to separate motivation from motor capacity.", "Grip strength and rotarod to test strength and motor endurance.", "Re-analyse with speed adjustment (Setup) to see which changes remain beyond the slowing itself."],
    items: [
      { param: 'speed', where: 'run', dir: -1 },
      { param: 'cadence', where: 'run', dir: -1 },
      { param: 'run_duration', where: 'run', dir: 1 },
      { param: 'step_cycle', where: 'any', dir: 1 },
      { param: 'stand', where: 'any', dir: 1 },
      { param: 'stride_length', where: 'any', dir: -1 },
    ],
  },
  {
    id: 'ataxia',
    title: 'Ataxia / impaired balance',
    summary:
      'Wide-based stance, less precise paw placement, more time on three or four paws and irregular stepping.',
    conditions:
      'Cerebellar ataxias (SCA models, MSA-C-like models), sensory/proprioceptive neuropathy (e.g. Friedreich ataxia models), vestibular dysfunction, leukodystrophies and lysosomal storage disorders with cerebellar involvement.',
    meaning:
      "The animals widen their stance, place their paws less precisely and rely on more paws at once. These are compensations for poor balance or imprecise limb control. The pattern points towards cerebellar, proprioceptive (large-fibre sensory or dorsal column) or vestibular dysfunction rather than weakness alone.",
    followUp: ["Balance beam or ladder-rung walking to count foot slips.", "Rotarod and hind-limb clasping or composite ataxia scoring.", "Cerebellar histology, e.g. Purkinje cell counts with calbindin.", "Sensory nerve conduction or dorsal root ganglion histology if a sensory neuropathy is possible."],
    items: [
      { param: 'bos_hind', where: 'run', dir: 1 },
      { param: 'bos_front', where: 'run', dir: 1 },
      { param: 'print_pos_right', where: 'run', dir: 1 },
      { param: 'print_pos_left', where: 'run', dir: 1 },
      { param: 'support_three', where: 'run', dir: 1 },
      { param: 'support_four', where: 'run', dir: 1 },
      { param: 'support_lateral', where: 'run', dir: 1 },
      { param: 'support_diagonal', where: 'run', dir: -1 },
      { param: 'speed_variation', where: 'run', dir: 1 },
      { param: 'initial_dual_stance', where: 'hind', dir: 1 },
      { param: 'terminal_dual_stance', where: 'hind', dir: 1 },
    ],
  },
  {
    id: 'coordination',
    title: 'Interlimb coordination deficit',
    summary: 'Fewer normal step sequences and altered phase relationships between limbs.',
    conditions:
      'Spinal cord injury (especially lesions of descending or propriospinal pathways), severe cerebellar/vestibular disease, and advanced basal-ganglia disease.',
    meaning:
      "The timing between limbs is disrupted: fewer steps follow normal sequences and paw pairs lose their usual phase relationship. Interlimb coordination depends on spinal central pattern generators and the propriospinal and descending pathways that link fore- and hind-limb circuits, so this pattern points to spinal, brainstem or cerebellar involvement.",
    followUp: ["Horizontal ladder or ladder-rung test.", "BMS or BBB locomotor scoring if a spinal process is possible.", "Spinal cord histology (white matter and propriospinal tracts).", "Check that the finding is not driven by few runs per animal or stop-and-go runs (Setup \u2192 Run quality)."],
    items: [
      { param: 'regularity_index', where: 'run', dir: -1 },
      { param: 'step_seq_ab', where: 'run', dir: 0 },
      { param: 'step_seq_aa', where: 'run', dir: 0 },
      { param: 'step_seq_ca', where: 'run', dir: 0 },
      { param: 'step_seq_cb', where: 'run', dir: 0 },
      { param: 'step_seq_ra', where: 'run', dir: 0 },
      { param: 'step_seq_rb', where: 'run', dir: 0 },
      { param: 'phase_dispersion', where: 'run', dir: 0 },
      { param: 'phase_dispersion_r', where: 'run', dir: -1 },
      { param: 'coupling', where: 'run', dir: 0 },
      { param: 'coupling_r', where: 'run', dir: -1 },
    ],
  },
  {
    id: 'hindlimb',
    title: 'Hind-limb predominant motor deficit',
    summary:
      'Smaller, lighter hind paw prints with slower swing and shorter strides; front paws relatively spared.',
    conditions:
      'Thoracic spinal cord injury, motor-neuron disease (SOD1-G93A and other ALS models, milder SMA models), hereditary spastic paraplegia, length-dependent neuropathies and leukodystrophies affecting long tracts.',
    meaning:
      "The hind paws bear less weight and are carried forward more slowly with shorter strides, while the front paws are relatively preserved. A length- or level-dependent pattern like this suggests involvement of long motor or sensory tracts, of lower motor neurons serving the hind limbs, or weakness of hind-limb muscles.",
    followUp: ["Hind-limb grip strength and hanging-wire tests.", "Hind-limb clasping score.", "EMG/CMAP or nerve conduction studies.", "Lumbar motor neuron counts, neuromuscular junction innervation and muscle histology; spinal cord white matter."],
    items: [
      { param: 'print_area', where: 'hind', dir: -1 },
      { param: 'max_contact_area', where: 'hind', dir: -1 },
      { param: 'max_intensity', where: 'hind', dir: -1 },
      { param: 'mean_intensity', where: 'hind', dir: -1 },
      { param: 'swing_speed', where: 'hind', dir: -1 },
      { param: 'stride_length', where: 'hind', dir: -1 },
      { param: 'swing', where: 'hind', dir: 1 },
      { param: 'print_width', where: 'hind', dir: -1 },
    ],
  },
  {
    id: 'forelimb',
    title: 'Fore-limb predominant motor deficit',
    summary: 'Front paw prints are smaller or lighter, with altered front-paw timing.',
    conditions:
      'Cervical spinal cord injury, sensorimotor-cortex stroke (MCAO, photothrombosis), traumatic brain injury, forelimb-onset motor-neuron disease.',
    meaning:
      "The front paws are loaded less or used differently while the hind paws are relatively spared. Fore-limb predominant changes suggest cervical spinal cord, motor cortex or fore-limb motor unit involvement.",
    followUp: ["Fore-limb grip strength.", "Cylinder test for fore-limb use and asymmetry.", "Skilled reaching (single pellet) if cortical involvement is suspected.", "Cortical or cervical cord histology."],
    items: [
      { param: 'print_area', where: 'front', dir: -1 },
      { param: 'max_contact_area', where: 'front', dir: -1 },
      { param: 'max_intensity', where: 'front', dir: -1 },
      { param: 'mean_intensity', where: 'front', dir: -1 },
      { param: 'swing_speed', where: 'front', dir: -1 },
      { param: 'stand', where: 'front', dir: 1 },
    ],
  },
  {
    id: 'lateralised',
    title: 'Lateralised (left–right asymmetric) deficit',
    summary:
      'One side is loaded less or used differently from the other. Reduced stance and duty cycle with preserved swing speed points towards pain-related guarding; reduced area, intensity and swing speed points towards a unilateral motor lesion.',
    conditions:
      'Unilateral lesions: 6-OHDA hemiparkinsonism, focal stroke, unilateral spinal (hemisection or cervical) injury, sciatic nerve injury, and neuropathic or inflammatory pain models (CCI, SNI, CFA).',
    meaning:
      "One side differs from the other. The side with smaller area, lower intensity or shorter stance is usually the affected (or painful) side, and the opposite side may compensate. Guarding with normal swing speed suggests pain; reduced swing speed and print area suggest a motor deficit.",
    followUp: ["Confirm the affected side is the same in every animal; the asymmetry index averages out if sides differ.", "Von Frey or Hargreaves testing if pain is possible.", "Cylinder test for limb-use asymmetry.", "Histology of the corresponding hemisphere, spinal segment or nerve."],
    items: [
      { param: 'print_area', where: 'asymH', dir: 0 },
      { param: 'print_area', where: 'asymF', dir: 0 },
      { param: 'max_intensity', where: 'asymH', dir: 0 },
      { param: 'max_intensity', where: 'asymF', dir: 0 },
      { param: 'mean_intensity', where: 'asymH', dir: 0 },
      { param: 'stand', where: 'asymH', dir: 0 },
      { param: 'duty_cycle', where: 'asymH', dir: 0 },
      { param: 'swing_speed', where: 'asymH', dir: 0 },
      { param: 'swing_speed', where: 'asymF', dir: 0 },
    ],
  },
  {
    id: 'hyperactivity',
    title: 'Faster, hyperkinetic gait',
    summary: 'Higher walking speed with shorter stance and more time on one or zero paws.',
    conditions:
      'Hyperactivity phenotypes (e.g. some dopaminergic, neurodevelopmental and anxiety models) or poor habituation to the walkway. Check that this isn’t a handling artefact.',
    meaning:
      "The animals move faster with less ground contact. This can reflect hyperactivity, anxiety-driven escape or poor habituation to the walkway rather than a motor deficit, and speed by itself changes many other gait parameters.",
    followUp: ["Open-field activity and anxiety tests (e.g. elevated plus maze).", "Re-analyse with speed adjustment (Setup).", "Review habituation and handling before recording."],
    items: [
      { param: 'speed', where: 'run', dir: 1 },
      { param: 'cadence', where: 'run', dir: 1 },
      { param: 'stand', where: 'any', dir: -1 },
      { param: 'support_single', where: 'run', dir: 1 },
      { param: 'support_zero', where: 'run', dir: 1 },
    ],
  },
]

export interface Evidence {
  result: MeasureResult
  comparison: Comparison
  supports: boolean
}

export interface DomainFinding {
  domain: Domain
  evidence: Evidence[]
  supporting: Evidence[]
  available: number
  score: number
  side?: 'left' | 'right'
}

function whereMatches(r: MeasureResult, where: Where): boolean {
  const m = r.measure
  switch (where) {
    case 'run':
      return !m.paw && !m.derived
    case 'front':
      return m.derived === 'FRONT'
    case 'hind':
      return m.derived === 'HIND'
    case 'any':
      return m.derived === 'FRONT' || m.derived === 'HIND' || (!m.paw && !m.derived && !m.def.perPaw)
    case 'asymF':
      return m.derived === 'ASYM_F'
    case 'asymH':
      return m.derived === 'ASYM_H'
  }
}

export interface InterpretOptions {
  alpha: number
  minEffect: number
  useFdr: boolean
}

export const DEFAULT_INTERPRET: InterpretOptions = { alpha: 0.05, minEffect: 0.8, useFdr: false }

export function isSignificant(r: MeasureResult, c: Comparison, opt: InterpretOptions): boolean {
  const p = c.pAdj
  if (!(p < opt.alpha)) return false
  if (opt.useFdr && !(r.q < opt.alpha)) return false
  return Math.abs(c.g) >= opt.minEffect
}

export function interpret(tr: TimeResults, cfg: AnalysisConfig, opt: InterpretOptions = DEFAULT_INTERPRET): DomainFinding[] {
  const findings: DomainFinding[] = []
  for (const domain of DOMAINS) {
    const evidence: Evidence[] = []
    for (const item of domain.items) {
      for (const r of tr.results) {
        if (r.measure.def.id !== item.param || !whereMatches(r, item.where)) continue
        const c = primaryComparison(r, cfg)
        if (!c || !Number.isFinite(c.g)) continue
        const dirOk = item.dir === 0 ? true : Math.sign(c.g) === item.dir
        evidence.push({ result: r, comparison: c, supports: dirOk && isSignificant(r, c, opt) })
      }
    }
    if (evidence.length === 0) continue
    const supporting = evidence.filter((e) => e.supports)
    const available = new Set(evidence.map((e) => e.result.measure.def.id + e.result.measure.derived)).size
    const supportedParams = new Set(supporting.map((e) => e.result.measure.def.id + e.result.measure.derived)).size
    const finding: DomainFinding = {
      domain,
      evidence,
      supporting,
      available,
      score: available ? supportedParams / available : 0,
    }
    if (domain.id === 'lateralised' && supporting.length) {
      // Positive asymmetry index = left > right, so the right side is reduced.
      const s = supporting.reduce((acc, e) => acc + Math.sign(e.comparison.diff), 0)
      if (s !== 0) finding.side = s > 0 ? 'right' : 'left'
    }
    findings.push(finding)
  }
  return findings.sort((a, b) => b.supporting.length - a.supporting.length || b.score - a.score)
}

export function describeEvidence(e: Evidence): string {
  const arrow = e.comparison.diff > 0 ? '↑' : '↓'
  const pct = Number.isFinite(e.comparison.diffPct) && !e.result.measure.derived?.startsWith('ASYM') ? ` (${e.comparison.diffPct > 0 ? '+' : ''}${e.comparison.diffPct.toFixed(0)}%)` : ''
  return `${e.result.measure.label} ${arrow}${pct}, g = ${e.comparison.g.toFixed(2)}, p = ${formatP(e.comparison.pAdj)}`
}

export interface Change {
  result: MeasureResult
  comparison: Comparison
}

/**
 * Parameters that changed versus the control group at the current thresholds,
 * keyed by measure key. When several groups are compared with control, the
 * comparison with the smallest adjusted p is kept.
 */
export function changedMeasures(tr: TimeResults | undefined, cfg: AnalysisConfig, opt: InterpretOptions): Map<string, Change> {
  const out = new Map<string, Change>()
  if (!tr) return out
  for (const r of tr.results) {
    const vsControl = r.comparisons.filter((c) => !cfg.controlGroup || c.reference === cfg.controlGroup)
    let best: Comparison | undefined
    for (const c of vsControl) if (isSignificant(r, c, opt) && (!best || c.pAdj < best.pAdj)) best = c
    if (best) out.set(r.measure.key, { result: r, comparison: best })
  }
  return out
}
