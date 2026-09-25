import { useState } from 'react'
import { CATEGORY_LABELS, CATEGORY_ORDER, PARAMS } from '../lib/catalog'
import { DOMAINS } from '../lib/interpret'
import { FootprintDiagram, IntensityDiagram, StepCycleDiagram, StepPatternDiagram, SupportDiagram, WalkwayDiagram } from './diagrams'

// References verified in PubMed.
const REFS = [
  { id: 'hamers2006', text: 'Hamers FPT, Koopmans GC, Joosten EAJ. CatWalk-assisted gait analysis in the assessment of spinal cord injury. J Neurotrauma. 2006;23(3-4):537-48.', doi: '10.1089/neu.2006.23.537' },
  { id: 'batka2014', text: 'Batka RJ, Brown TJ, Mcmillan KP, et al. The need for speed in rodent locomotion analyses. Anat Rec. 2014;297(10):1839-64.', doi: '10.1002/ar.22955' },
  { id: 'vrinten2003', text: "Vrinten DH, Hamers FFT. 'CatWalk' automated quantitative gait analysis as a novel method to assess mechanical allodynia in the rat; a comparison with von Frey testing. Pain. 2003;102(1-2):203-9.", doi: '10.1016/s0304-3959(02)00382-2' },
  { id: 'vogelaar2004', text: 'Vogelaar CF, Vrinten DH, Hoekman MFM, et al. Sciatic nerve regeneration in mice and rats: recovery of sensory innervation is followed by a slowly retreating neuropathic pain-like syndrome. Brain Res. 2004;1027(1-2):67-72.', doi: '10.1016/j.brainres.2004.08.036' },
  { id: 'vandeputte2010', text: 'Vandeputte C, Taymans JM, Casteels C, et al. Automated quantitative gait analysis in animal models of movement disorders. BMC Neurosci. 2010;11:92.', doi: '10.1186/1471-2202-11-92' },
  { id: 'hendriks2006', text: 'Hendriks WTJ, Eggers R, Ruitenberg MJ, et al. Profound differences in spontaneous long-term functional recovery after defined spinal tract lesions in the rat. J Neurotrauma. 2006;23(1):18-35.', doi: '10.1089/neu.2006.23.18' },
  { id: 'gensel2006', text: 'Gensel JC, Tovar CA, Hamers FPT, et al. Behavioral and histological characterization of unilateral cervical spinal cord contusion injury in rats. J Neurotrauma. 2006;23(1):36-54.', doi: '10.1089/neu.2006.23.36' },
  { id: 'caballero2017', text: 'Caballero-Garrido E, Pena-Philippides JC, Galochkina Z, et al. Characterization of long-term gait deficits in mouse dMCAO, using the CatWalk system. Behav Brain Res. 2017;331:282-96.', doi: '10.1016/j.bbr.2017.05.042' },
  { id: 'vergouts2015', text: 'Vergouts M, Marinangeli C, Ingelbrecht C, et al. Early ALS-type gait abnormalities in AMP-dependent protein kinase-deficient mice suggest a role for this metabolic sensor in early stages of the disease. Metab Brain Dis. 2015;30(6):1369-77.', doi: '10.1007/s11011-015-9706-9' },
  { id: 'meszaros2021', text: 'Mészáros L, Riemenschneider MJ, Gassner H, et al. Human alpha-synuclein overexpressing MBP29 mice mimic functional and structural hallmarks of the cerebellar subtype of multiple system atrophy. Acta Neuropathol Commun. 2021;9(1):68.', doi: '10.1186/s40478-021-01166-x' },
  { id: 'kopecky2012', text: 'Kopecky B, Decook R, Fritzsch B. Mutational ataxia resulting from abnormal vestibular acquisition and processing is partially compensated for. Behav Neurosci. 2012;126(2):301-13.', doi: '10.1037/a0026896' },
  { id: 'zimmermann2016', text: "Zimmermann T, Remmers F, Lutz B, Leschik J. ESC-derived BDNF-overexpressing neural progenitors differentially promote recovery in Huntington's disease models by enhanced striatal differentiation. Stem Cell Reports. 2016;7(4):693-706.", doi: '10.1016/j.stemcr.2016.08.018' },
  { id: 'salazar2010', text: 'Salazar DL, Uchida N, Hamers FPT, et al. Human neural stem cells differentiate and promote locomotor recovery in an early chronic spinal cord injury NOD-scid mouse model. PLoS One. 2010;5(8):e12272.', doi: '10.1371/journal.pone.0012272' },
]

function Cite({ ids }: { ids: string[] }) {
  return (
    <sup>
      {ids.map((id, i) => {
        const n = REFS.findIndex((r) => r.id === id) + 1
        return (
          <span key={id}>
            {i > 0 && ','}
            <a href={`#ref-${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`ref-${id}`)?.scrollIntoView({ behavior: 'smooth' }) }}>
              {n}
            </a>
          </span>
        )
      })}
    </sup>
  )
}

interface DiseaseModel {
  name: string
  models: string
  signature: string[]
  notes: string
  refs: string[]
}

const DISEASES: DiseaseModel[] = [
  {
    name: 'Spinal cord injury',
    models: 'Thoracic contusion, hemisection or tract-specific lesions; unilateral cervical contusion',
    signature: [
      'Regularity index ↓ and altered step-sequence patterns (loss of consistent interlimb coordination)',
      'Hind paw print area, contact area and intensity ↓; hind base of support ↑',
      'Unilateral cervical injury: deficits concentrated in the ipsilateral forelimb',
    ],
    notes:
      'CatWalk was originally developed for SCI. Coordination measures can separate lesions of different tracts and follow recovery for months, complementing the BBB score.',
    refs: ['hamers2006', 'hendriks2006', 'gensel2006', 'salazar2010'],
  },
  {
    name: 'Neuropathic pain and peripheral nerve injury',
    models: 'Chronic constriction injury (CCI), sciatic crush or transection, spared nerve injury',
    signature: [
      'Affected hind paw: stand and duty cycle ↓, intensity (pressure) ↓, print area ↓ → strong left–right asymmetry',
      'Parameters correlate with von Frey thresholds (mechanical allodynia)',
      'After nerve crush, reduced weight bearing can persist after conventional motor tests have normalised',
    ],
    notes:
      'Guarding (less time and less pressure on a paw) with preserved swing speed favours pain; smaller toe spread (print width) favours motor/sensory denervation.',
    refs: ['vrinten2003', 'vogelaar2004'],
  },
  {
    name: 'Parkinsonism',
    models: 'Unilateral 6-OHDA (striatum or medial forebrain bundle); bilateral toxins and α-synuclein models',
    signature: [
      'Unilateral lesion: changes in static and dynamic parameters of the contralateral paws → asymmetry indices',
      'Bilateral/progressive models: slower speed, shorter strides and longer stance (bradykinesia-like)',
    ],
    notes:
      'In hemiparkinsonian rats, CatWalk findings agreed with the cylinder test. Always check speed, because hypokinesia itself changes most parameters.',
    refs: ['vandeputte2010'],
  },
  {
    name: 'Huntington disease',
    models: 'Transgenic HD rat; R6/2 and N171-82Q mice; quinolinic acid lesions',
    signature: ['Multiple static and dynamic gait parameters altered', 'In the tgHD rat, CatWalk detected deficits that rotarod did not'],
    notes: 'CatWalk has been used as an outcome for cell- and neurotrophin-based therapies in HD models.',
    refs: ['vandeputte2010', 'zimmermann2016'],
  },
  {
    name: 'Stroke and focal cortical injury',
    models: 'Distal or proximal MCAO, photothrombotic cortical infarcts',
    signature: [
      'Largest changes in the paw contralateral to the lesion, especially the forepaw',
      'Paw area ↓; stand and dual-stance times ↑; interlimb coordination deficits',
      'Spontaneous recovery over weeks: plan timepoints accordingly',
    ],
    notes: 'CatWalk is useful for long-term outcome in mice, where many sensorimotor tests lose sensitivity after the first week.',
    refs: ['caballero2017', 'vandeputte2010'],
  },
  {
    name: 'Motor-neuron disease (ALS)',
    models: 'hSOD1-G93A and other ALS mice',
    signature: [
      'Gait abnormalities detectable early, before overt paralysis',
      'Typically hind-limb predominant: swing speed, stride length and paw intensity decline as disease progresses',
    ],
    notes: 'Repeated testing from a pre-symptomatic baseline gives the most sensitive readout of onset and of treatment-induced delay.',
    refs: ['vergouts2015'],
  },
  {
    name: 'Cerebellar and vestibular ataxia',
    models: 'MSA-C-like α-synuclein mice, vestibulo-cerebellar developmental mutants, SCA models',
    signature: [
      'Wider hind base of support; slower walking; longer strides in some models',
      'Less diagonal support, more lateral and three-paw support (wide-based, unsteady gait)',
      'Lower step regularity (regularity index)',
    ],
    notes: 'Look at variability too (StDev columns in the export): ataxic animals often vary more from step to step.',
    refs: ['meszaros2021', 'kopecky2012'],
  },
]

const SECTIONS = [
  ['how', 'How CatWalk works'],
  ['protocol', 'Running a good experiment'],
  ['step', 'Anatomy of a step'],
  ['prints', 'Paw prints and weight bearing'],
  ['coordination', 'Interlimb coordination'],
  ['support', 'Support and base of support'],
  ['speed', 'Why speed matters'],
  ['diseases', 'Gait changes in disease models'],
  ['reading', 'Reading the results'],
  ['glossary', 'Parameter glossary'],
  ['refs', 'References'],
] as const

export function Learn({ onAnalyze }: { onAnalyze: () => void }) {
  const [q, setQ] = useState('')
  const glossary = PARAMS.filter((p) => (p.label + ' ' + p.description).toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="learn">
      <nav aria-label="Tutorial sections">
        <ol>
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }}>
                {label}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div style={{ minWidth: 0 }}>
        <div className="card">
          <h1>CatWalk gait analysis: a short tutorial</h1>
          <p>
            CatWalk XT (Noldus) is an automated system for measuring how rodents walk. The animal crosses an illuminated glass walkway voluntarily, and software
            reconstructs each paw print: where and when it landed, how large it was and how hard it pressed. From these prints it derives more than a hundred
            parameters describing individual limbs and how the limbs work together. This tutorial explains where those numbers come from and how changes in them
            relate to different kinds of neurological deficit.
          </p>
          <button className="btn primary" onClick={onAnalyze}>
            Go to the analyzer
          </button>
        </div>

        <section id="how" className="card">
          <h2>1. How CatWalk works</h2>
          <figure className="figure">
            <WalkwayDiagram />
            <figcaption>Illuminated-footprint technology: paw contact makes the glass light up locally, with brightness increasing with pressure.</figcaption>
          </figure>
          <p>
            Light is shone into the edge of a glass plate and stays trapped inside by total internal reflection. Where a paw touches the glass, the reflection is
            disrupted and light scatters downward, so a high-speed camera beneath the walkway sees a bright print. The brightness (intensity) of each pixel rises with
            contact pressure, which is why intensity is used as an indirect measure of weight bearing. A dim, colored ceiling light gives contrast to the body
            outline.
          </p>
          <p>
            Each crossing is a <b>run</b>. After acquisition, the software detects prints and labels them LF, RF, LH or RH (left/right, front/hind). Automatic
            classification should always be checked, because a misclassified paw corrupts every parameter from that run. Runs are then tested against{' '}
            <b>compliance</b> criteria you define: typically a minimum and maximum run duration and a maximum speed variation (for example ≤ 60%), so that stop-and-go
            runs are excluded.
          </p>
          <p>
            The <i>Run Statistics</i> export lists one row per run with all parameters. Mean and StDev columns describe the steps within that run. This app averages
            compliant runs per animal before comparing groups, so each animal counts once.
          </p>
        </section>

        <section id="protocol" className="card">
          <h2>2. Running a good experiment</h2>
          <ul>
            <li>
              <b>Habituate and train</b> animals to cross the walkway without stopping before baseline recording. Use the same room, lighting, time of day and
              experimenter throughout.
            </li>
            <li>
              <b>Collect at least 3 compliant runs</b> per animal per session (many labs aim for 3–5).
            </li>
            <li>
              <b>Calibrate</b> the walkway and keep camera gain and intensity thresholds constant across a study; intensity values are not comparable across
              different settings.
            </li>
            <li>
              <b>Record body weight</b> at each session: print area and intensity scale with body size, which matters when a genotype or treatment changes growth.
            </li>
            <li>
              <b>Blind</b> the person who checks paw classification to group.
            </li>
            <li>
              <b>For longitudinal therapy studies</b> (e.g. gene therapy), record a baseline before dosing, test before symptom onset where possible, and include
              wild-type, untreated disease and treated groups at every timepoint. Pre-register a small number of primary gait endpoints to limit multiple testing
              across more than a hundred parameters.
            </li>
            <li>
              <b>Include both sexes</b> and analyse sex as a variable; body size and walking speed can differ.
            </li>
          </ul>
        </section>

        <section id="step" className="card">
          <h2>3. Anatomy of a step</h2>
          <figure className="figure">
            <StepCycleDiagram />
            <figcaption>Gait diagram: bars are stance phases (paw on glass), gaps are swing phases.</figcaption>
          </figure>
          <p>
            Each limb alternates between <b>stance</b> (CatWalk: <i>Stand</i>, paw in contact) and <b>swing</b> (paw in the air). One stance plus one swing is the{' '}
            <b>step cycle</b>. <b>Duty cycle</b> is the share of the step cycle spent in stance. For hind paws, CatWalk splits stance into <b>initial dual stance</b>{' '}
            (both hind paws down, at the start), <b>single stance</b> (only this hind paw down) and <b>terminal dual stance</b> (both down again, at the end).
          </p>
          <p>
            <b>Swing speed</b> is stride length divided by swing time: how fast the limb is carried forward. It is sensitive to motor weakness and upper or lower motor
            neuron dysfunction. Prolonged stance and dual-stance times suggest the animal is using the limb for stability.
          </p>
        </section>

        <section id="prints" className="card">
          <h2>4. Paw prints and weight bearing</h2>
          <figure className="figure">
            <IntensityDiagram />
          </figure>
          <p>
            <b>Print area</b> is the total area touched during stance; <b>max contact area</b> is the area at the moment of greatest contact. <b>Print length</b> and{' '}
            <b>print width</b> describe the print's shape: width largely reflects toe spread, which falls with sciatic, tibial and peroneal nerve dysfunction.{' '}
            <b>Intensity</b> (max, mean, or mean of the 15 brightest pixels) reflects pressure.
          </p>
          <p>
            A paw that is painful or weak is loaded less: its intensity and area fall, often with shorter stance. The opposite limb, or the other girdle, may then
            carry more weight (a compensatory increase). Comparing each paw with its contralateral partner, as the app's asymmetry index does, reveals unilateral
            problems that group means across paws would hide.
          </p>
          <figure className="figure">
            <FootprintDiagram />
            <figcaption>Top view of prints: stride length is measured between successive prints of the same paw.</figcaption>
          </figure>
        </section>

        <section id="coordination" className="card">
          <h2>5. Interlimb coordination</h2>
          <figure className="figure">
            <StepPatternDiagram />
            <figcaption>The six normal step-sequence patterns. Numbers give the order in which the paws land.</figcaption>
          </figure>
          <p>
            A normal walking rodent places its four paws in one of six regular sequences: cruciate (Ca, Cb), alternate (Aa, Ab) and rotary (Ra, Rb). The{' '}
            <b>regularity index</b> is the percentage of paw placements that fit one of these patterns: close to 100% in healthy animals and reduced when coordination
            between the limbs breaks down.<Cite ids={['hamers2006']} /> Shifts from one pattern to another can also be informative.
          </p>
          <p>
            <b>Phase dispersion</b> and <b>couplings</b> describe timing between pairs of paws: when does paw B land within paw A's step cycle? Diagonal pairs land
            together (about 0%) and ipsilateral pairs are about half a cycle apart (about 50%) in a normal walking gait. A larger spread in these values means less
            consistent coordination.
          </p>
        </section>

        <section id="support" className="card">
          <h2>6. Support and base of support</h2>
          <figure className="figure">
            <SupportDiagram />
            <figcaption>Support categories: which paws are on the glass at the same time.</figcaption>
          </figure>
          <p>
            <b>Support</b> parameters give the percentage of the run spent with each combination of paws on the ground. Healthy rodents spend most of the time on
            diagonal pairs. Animals with poor balance, weakness or slow gait spend more time on three or four paws, or on lateral pairs.
          </p>
          <p>
            <b>Base of support (BOS)</b> is the distance between the left and right front or hind paws. A wider hind BOS is a classic feature of ataxia. <b>Print
            position</b> is the distance between where a hind paw lands and where the ipsilateral front paw was placed; healthy rodents place the hind paw almost on
            top of the front print, and larger distances indicate less precise placement.
          </p>
        </section>

        <section id="speed" className="card">
          <h2>7. Why speed matters</h2>
          <p>
            Walking speed changes almost everything: faster animals have shorter stance and step cycles, longer strides, faster swing and different support
            patterns. In a study of 162 CatWalk variables in wild-type mice, over 90% depended on speed, mostly non-linearly.<Cite ids={['batka2014']} /> If a
            disease model walks more slowly, many parameters will differ from controls for that reason alone.
          </p>
          <div className="callout">
            <b>What the app does:</b> the <i>Speed check</i> tab compares speed between groups and plots any parameter against speed. The optional{' '}
            <i>speed adjustment</i> fits one pooled slope for each parameter from run-to-run speed variation within animals, removes the part explained by speed, and
            re-centres values at the overall mean speed. It is a simple ANCOVA-style correction that assumes a linear relationship. For definitive analyses,
            consider a mixed model with speed as a covariate on the exported run-level data, as Batka and colleagues recommend.
          </div>
          <p>
            Static print parameters (area, intensity) and ratios between limbs are generally less speed-sensitive than temporal parameters, which is one reason
            asymmetry indices are robust markers of unilateral lesions.
          </p>
        </section>

        <section id="diseases" className="card">
          <h2>8. Gait changes in disease models</h2>
          <p>
            The patterns below summarise published findings. They are tendencies, not rules: the exact profile depends on species, strain, lesion size, disease
            stage and speed. Use them to form hypotheses and choose endpoints, then confirm with study-specific data.
          </p>
          {DISEASES.map((d) => (
            <div className="domain" key={d.name}>
              <header>
                <h4>
                  {d.name}
                  <Cite ids={d.refs} />
                </h4>
              </header>
              <p className="small muted" style={{ margin: '4px 0' }}>
                {d.models}
              </p>
              <ul>
                {d.signature.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <p className="small" style={{ marginTop: 6, marginBottom: 0 }}>
                {d.notes}
              </p>
            </div>
          ))}
          <h3 style={{ marginTop: 16 }}>Patterns the app looks for</h3>
          <p className="small">
            The Summary tab scores your data against these phenotype patterns. A pattern is reported when several of its markers change in the expected direction.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pattern</th>
                  <th>What it looks like</th>
                  <th>Typical conditions</th>
                </tr>
              </thead>
              <tbody>
                {DOMAINS.map((d) => (
                  <tr key={d.id}>
                    <td style={{ whiteSpace: 'normal', minWidth: 140, fontWeight: 600 }}>{d.title}</td>
                    <td style={{ whiteSpace: 'normal', minWidth: 220 }}>{d.summary}</td>
                    <td style={{ whiteSpace: 'normal', minWidth: 220 }}>{d.conditions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="reading" className="card">
          <h2>9. Reading the results</h2>
          <ul>
            <li>
              <b>Hedges g</b> is the difference between group means divided by the pooled standard deviation, with a small-sample correction. As a rough guide, 0.2 is
              small, 0.5 medium and 0.8 large. It is the best number for comparing parameters on different scales and for planning sample sizes.
            </li>
            <li>
              <b>p (Holm)</b> is the p-value of the pairwise test (Welch t or Mann–Whitney), adjusted for the number of comparisons made for that parameter.
            </li>
            <li>
              <b>q (FDR)</b> controls the false discovery rate across all parameters (Benjamini–Hochberg). With 100+ parameters, a handful of p &lt; 0.05 results are
              expected by chance alone, so give more weight to q, effect sizes and coherent patterns.
            </li>
            <li>
              <b>Asymmetry index</b> = (left − right) / mean(left, right) × 100 for each girdle. Positive means the left paw's value is larger. It works best when
              lesions are on the same side in all animals.
            </li>
            <li>
              <b>Rescue %</b> expresses a treated group's value on the scale from untreated disease (0%) to control (100%). Values above 100% overshoot control;
              values are unreliable when the disease effect is small.
            </li>
            <li>
              <b>The gait fingerprint</b> shows every parameter's effect size at once. Look for coherent blocks, such as all hind-paw static parameters in blue,
              rather than isolated cells.
            </li>
          </ul>
        </section>

        <section id="glossary" className="card">
          <h2>10. Parameter glossary</h2>
          <input type="search" placeholder="Search the glossary" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the glossary" style={{ marginBottom: 8 }} />
          {CATEGORY_ORDER.filter((c) => c !== 'other').map((cat) => {
            const list = glossary.filter((p) => p.category === cat)
            if (!list.length) return null
            return (
              <div key={cat}>
                <h3 style={{ marginTop: 16 }}>{CATEGORY_LABELS[cat]}</h3>
                {list.map((p) => (
                  <details key={p.id} className="gloss">
                    <summary>
                      <span>{p.label}</span>
                      <span className="muted small">
                        {p.unit}
                        {p.perPaw ? ' · per paw' : ''}
                      </span>
                    </summary>
                    <p className="small" style={{ margin: '6px 0' }}>
                      {p.description}
                    </p>
                    {p.down && (
                      <p className="dir">
                        <span className="arrow-down">↓ Lower:</span> {p.down}
                      </p>
                    )}
                    {p.up && (
                      <p className="dir">
                        <span className="arrow-up">↑ Higher:</span> {p.up}
                      </p>
                    )}
                  </details>
                ))}
              </div>
            )
          })}
        </section>

        <section id="refs" className="card">
          <h2>References</h2>
          <ol className="refs">
            {REFS.map((r) => (
              <li key={r.id} id={`ref-${r.id}`}>
                {r.text}{' '}
                <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer">
                  doi:{r.doi}
                </a>
              </li>
            ))}
          </ol>
          <p className="small muted">
            Parameter definitions follow the CatWalk XT reference manual's terminology. CatWalk is a trademark of Noldus Information Technology; this app is an
            independent tool and is not affiliated with Noldus.
          </p>
        </section>
      </div>
    </div>
  )
}
