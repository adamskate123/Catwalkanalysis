// Phenotype patterns for CatWalk gait data (see lib/interpret.ts).

import type { Domain } from '../lib/interpret'

export const CATWALK_DOMAINS: Domain[] = [
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
    id: 'dragging',
    title: 'Hind-paw dragging / poor hind-limb clearance',
    summary:
      'Longer, narrower hind prints (or the body touching the glass), with slower hind swing, longer hind stance and shorter strides.',
    conditions:
      'Thoracic spinal cord injury and other lesions of descending motor tracts, motor-neuron disease with hind-limb onset (e.g. SOD1-G93A), hereditary spastic paraplegia and leukodystrophies, and distal hind-limb weakness from neuropathy or myopathy.',
    meaning:
      "The hind paws are not lifted clear of the glass. A hind print that gets longer without getting wider suggests the paw slides along the glass during stance or is dragged forward, and a rising hind ÷ front ratio shows it is the hind paws that changed. Body contact with the glass (abdomen, tail, hips, knees), which CatWalk XT reports when those contacts are labelled, is the direct measure of dragging. The other markers (slower hind swing, longer stance, shorter strides and a lower regularity index) are consistent CatWalk findings after spinal cord injury but are not specific to dragging. This pattern is therefore shown only when elongation or body contact changed, and it should be confirmed on the run videos. With complete hind-limb paralysis the hind prints shrink rather than lengthen, so elongation may not rise; labelled abdomen contact is then the better marker (paralysed rats drag the lower body and leave large abdomen contacts).",
    followUp: [
      'Review the run videos for toe drag during swing, dorsal stepping and belly or tail contact.',
      'Label body contacts (abdomen, tail, hips, knees) during classification in CatWalk XT to measure dragging directly.',
      'Basso Mouse Scale (BMS) for plantar stepping, paw position and trunk stability.',
      'Hind-limb grip strength and clasping; spinal cord white matter and lumbar motor neurons.',
    ],
    items: [
      { param: 'contact_abdomen', where: 'run', dir: 1, key: true },
      { param: 'contact_tail', where: 'run', dir: 1, key: true },
      { param: 'contact_left_hip', where: 'run', dir: 1, key: true },
      { param: 'contact_right_hip', where: 'run', dir: 1, key: true },
      { param: 'contact_left_knee', where: 'run', dir: 1, key: true },
      { param: 'contact_right_knee', where: 'run', dir: 1, key: true },
      { param: 'print_elongation', where: 'hind', dir: 1, key: true },
      { param: 'print_elongation', where: 'hindFront', dir: 1, key: true },
      { param: 'swing_speed', where: 'hind', dir: -1 },
      { param: 'stand', where: 'hind', dir: 1 },
      { param: 'stride_length', where: 'hind', dir: -1 },
      { param: 'regularity_index', where: 'run', dir: -1 },
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
