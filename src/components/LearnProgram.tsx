import { useState, type ReactElement, type ReactNode } from 'react'
import { getProgram, type ProgramId } from '../programs'
import { ArenaDiagram, CageHangDiagram, RotarodDiagram } from './diagrams'
import { CAGEHANG_REFS, OPENFIELD_REFS, ROTAROD_REFS, type Reference } from '../lib/references'

// Tutorials for the rotarod and open field programs. References live in lib/references.ts.

type Ref = Reference

interface Content {
  title: string
  intro: string
  figure: () => ReactElement
  caption: string
  how: ReactNode
  protocol: ReactNode
  confounds: ReactNode
  refs: Ref[]
}

function Cite({ refs, ids }: { refs: Ref[]; ids: string[] }) {
  return (
    <sup>
      {ids.map((id, i) => {
        const n = refs.findIndex((r) => r.id === id) + 1
        return (
          <a key={id} href={`#ref-${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`ref-${id}`)?.scrollIntoView({ behavior: 'smooth' }) }}>
            {i ? ',' : ''}
            {n}
          </a>
        )
      })}
    </sup>
  )
}

const CONTENT: Record<Exclude<ProgramId, 'catwalk'>, Content> = {
  rotarod: {
    title: 'The rotarod: a short tutorial',
    intro:
      'The rotarod is the most widely used test of motor coordination in mice and rats. The animal walks on a horizontal rod that rotates about its long axis and must keep stepping forward to stay on. The time until it falls, and the rod speed at that moment, summarise balance, coordination, grip, endurance and, with repeated trials, motor learning.',
    figure: RotarodDiagram,
    caption: 'Several lanes run at once; each lane has its own fall sensor that stops the timer.',
    how: (
      <>
        <p>
          Two protocols are common. On an <b>accelerating rotarod</b> the rod speeds up steadily (for example from 4 to 40 rpm over 300 s), so latency and rod speed
          at fall rise together. On a <b>fixed-speed rotarod</b> the rod turns at one speed per trial, often several speeds in increasing order; it separates
          capacity at each speed from learning.<Cite refs={ROTAROD_REFS} ids={['deacon2013', 'rustay2003a']} /> Systems such as the San Diego Instruments
          Rotor-Rod record latency, rpm at fall and distance for each lane and trial.
        </p>
        <p>
          Some animals grip the rod and rotate with it instead of walking (<b>passive rotation</b>). Many labs count the first full passive rotation as a fall,
          which makes latencies comparable between observers.
        </p>
      </>
    ),
    protocol: (
      <ul>
        <li>
          Use the same protocol for every group: start speed, acceleration, maximum trial length, number of trials and inter-trial interval. Small changes in these
          parameters change results and even which strains look impaired.<Cite refs={ROTAROD_REFS} ids={['rustay2003a', 'rustay2003b']} />
        </li>
        <li>Give 3 or more trials per day, typically for 2–3 consecutive days, with 10–15 min between trials so fatigue doesn't mask learning.</li>
        <li>Habituate animals to the room, test at the same time of day, and balance genotypes across lanes and days.</li>
        <li>Record body weight: heavier animals fall sooner regardless of coordination.</li>
        <li>
          In the spreadsheet, keep one row per animal per trial with a <b>Trial</b> number and a <b>Day</b> column, or one column per trial (“Trial 1”, “Trial
          2”…). Rotarod Lab averages trials within each day and works out best, first and last trial and within-day improvement.
        </li>
      </ul>
    ),
    confounds: (
      <ul>
        <li>
          <b>Weakness vs incoordination.</b> A short latency can come from weakness, poor balance, ataxia, fatigue or low motivation. Grip strength, beam walking
          or gait analysis (Gait Lab) tell these apart.
        </li>
        <li>
          <b>Learning vs capacity.</b> A group that starts at the control level but improves less suggests a motor-learning deficit; one that is lower from the first
          trial suggests a coordination or strength deficit. See the Learning curves tab.
        </li>
        <li>
          <b>Ceiling effects.</b> If many controls reach the maximum trial time, differences are compressed; use a faster acceleration or a longer maximum.
        </li>
        <li>
          <b>Body weight, sex and age</b> all change rotarod performance. Check them in Setup (filters) and in the Story tab's “Before drawing conclusions”.
        </li>
      </ul>
    ),
    refs: ROTAROD_REFS,
  },
  openfield: {
    title: 'The open field: a short tutorial',
    intro:
      'The open field test places a rodent in a novel, enclosed arena and records how it moves for 5–60 minutes. It is one of the most common behavioural tests because a single session gives measures of general locomotor activity, exploration and anxiety-like behaviour.',
    figure: ArenaDiagram,
    caption: 'Tracking software such as EthoVision XT divides the arena into a centre zone and a periphery.',
    how: (
      <>
        <p>
          A camera above the arena tracks the animal's position. <b>Distance moved</b>, <b>velocity</b> and time <b>moving</b> or <b>immobile</b> measure activity.
          Rodents avoid open, brightly lit spaces and stay close to the walls (<b>thigmotaxis</b>), so <b>time in the centre</b>, <b>entries into the centre</b> and
          the <b>latency to first enter</b> it are used as indices of anxiety-like behaviour.<Cite refs={OPENFIELD_REFS} ids={['seibenhener2015', 'prut2003']} />{' '}
          <b>Rearing</b> reflects exploration, and grooming, stereotypies and fecal boli add information about repetitive behaviour and emotionality.
        </p>
        <p>
          Classical anxiolytics such as benzodiazepines increase centre time in most studies, but drugs used for other anxiety disorders often do not, so the open
          field is best treated as one measure of anxiety-like behaviour among several.<Cite refs={OPENFIELD_REFS} ids={['prut2003']} />
        </p>
        <p>
          <b>Habituation.</b> Activity is highest when the arena is new and falls across the session as it becomes familiar (intrasession habituation); a second
          session on another day starts lower still (intersession habituation). The two depend partly on different genes, so they are best measured separately.
          <Cite refs={OPENFIELD_REFS} ids={['bolivar2009']} /> Open Field Lab reads values per interval (e.g. four 5-minute bins) and reports each animal's first
          and last interval and the % change between them; the Habituation tab plots the curves.
        </p>
      </>
    ),
    protocol: (
      <ul>
        <li>Keep arena size, lighting (lux), session length and time of day the same for every group; brighter light increases centre avoidance.</li>
        <li>Habituate animals to the testing room (30–60 min), clean the arena between animals, and randomise or balance test order by genotype.</li>
        <li>
          Define the centre zone the same way for every trial (often the central 25–50% of the floor area) and include both the centre and border zones in the
          EthoVision export.
        </li>
        <li>
          Export EthoVision's trial statistics with independent variables (genotype, sex, age). To look at habituation within a session, export results per time
          bin (e.g. 5 min); Open Field Lab treats bins as timepoints.
        </li>
      </ul>
    ),
    confounds: (
      <ul>
        <li>
          <b>Activity vs anxiety.</b> A hypoactive animal spends less time in the centre simply because it moves less. Read centre measures together with total
          distance, or use centre time as a percentage of the session or centre distance as a percentage of total distance.
        </li>
        <li>
          <b>Motor impairment.</b> Low distance can reflect motor deficits (confirm with rotarod or gait analysis) rather than low motivation.
        </li>
        <li>
          <b>Novelty and habituation.</b> Activity falls over a session as the arena becomes familiar. Hyperactive models often fail to slow down; time bins show
          this.
        </li>
        <li>
          <b>Repeated testing</b> reduces novelty, so a second open field session is not equivalent to the first; note test order in multi-test batteries.
        </li>
      </ul>
    ),
    refs: OPENFIELD_REFS,
  },
  cagehang: {
    title: 'The cage hang test: a short tutorial',
    intro:
      'In the cage hang (inverted screen or cage-lid hanging) test, a mouse grips a wire cage lid or grid that is then turned upside down, and the time until it falls is recorded. It is a quick, non-invasive test of four-limb grip strength and muscular endurance that can be repeated throughout life, which makes it common in neuromuscular and neurodegenerative disease models.',
    figure: CageHangDiagram,
    caption: 'The mouse holds on to the inverted lid above a soft surface; the timer runs until it falls or reaches the cut-off.',
    how: (
      <>
        <p>
          The inverted screen test goes back to Kondziela (1964). Most healthy young adult mice reach the cut-off easily, so it is a gross screen of strength
          rather than a graded force measure; grip meters or weight-lifting tests give finer data.<Cite refs={CAGEHANG_REFS} ids={['deacon2013strength']} /> It
          still detects weakness and fatigue well in disease models and can be repeated weekly to follow progression.
        </p>
        <p>
          Heavier mice must hold more weight, so hang time alone penalises large animals. The <b>holding impulse</b>, body weight × hang time, corrects for
          this and is used in standard operating procedures for neuromuscular models; wire and grid hanging tests are part of those
          protocols.<Cite refs={CAGEHANG_REFS} ids={['aartsmarus2014']} /> Cage Hang Lab calculates it whenever body weight is loaded.
        </p>
      </>
    ),
    protocol: (
      <ul>
        <li>Use the same lid or grid, height above bedding, cut-off (e.g. 60 s) and number of trials for every group.</li>
        <li>Give each mouse 2–3 trials with a rest of at least a few minutes between them, and record the best or mean.</li>
        <li>Weigh the animals on the test day; the holding impulse needs it.</li>
        <li>Shake the lid gently when turning it over so the mouse grips; keep handling the same across groups and testers.</li>
        <li>
          In the spreadsheet, keep one row per animal per trial with a <b>Trial</b> number and an <b>Age</b> (or timepoint) column, or one column per trial.
          Age-binned Prism tables with ear tags as row titles are read directly.
        </li>
      </ul>
    ),
    confounds: (
      <ul>
        <li>
          <b>Ceiling.</b> If many animals reach the cut-off, differences are compressed; the app warns when many values sit at the maximum. A longer cut-off
          or a harder grid increases sensitivity.
        </li>
        <li>
          <b>Body weight.</b> Lighter animals hang longer. Compare body weight and the holding impulse, or adjust for weight (Setup → Statistics).
        </li>
        <li>
          <b>Weakness vs coordination vs motivation.</b> A short hang can reflect weakness, poor coordination or an animal that simply lets go. Grip strength,
          rotarod and gait analysis help tell these apart.
        </li>
        <li>
          <b>Fatigue.</b> A drop across trials suggests fatigability; confirm with longer rests between trials.
        </li>
      </ul>
    ),
    refs: CAGEHANG_REFS,
  },
}

const SECTIONS = [
  ['how', 'How it works'],
  ['protocol', 'Running a good experiment'],
  ['confounds', 'Interpreting with care'],
  ['diseases', 'Patterns the app looks for'],
  ['glossary', 'Parameter glossary'],
  ['refs', 'References'],
] as const

export function LearnProgram({ id, onAnalyze }: { id: Exclude<ProgramId, 'catwalk'>; onAnalyze: () => void }) {
  const [q, setQ] = useState('')
  const prog = getProgram(id)
  const c = CONTENT[id]
  const Figure = c.figure
  const glossary = prog.params.filter((p) => (p.label + ' ' + p.description).toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="learn">
      <nav aria-label="Tutorial sections">
        <ol>
          {SECTIONS.map(([sid, label]) => (
            <li key={sid}>
              <a href={`#${sid}`} onClick={(e) => { e.preventDefault(); document.getElementById(sid)?.scrollIntoView({ behavior: 'smooth' }) }}>
                {label}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div style={{ minWidth: 0 }}>
        <div className="card">
          <h1>{c.title}</h1>
          <p>{c.intro}</p>
          <button className="btn primary" onClick={onAnalyze}>
            Go to the analyzer
          </button>
        </div>

        <section id="how" className="card">
          <h2>1. How it works</h2>
          <figure className="figure">
            <Figure />
            <figcaption>{c.caption}</figcaption>
          </figure>
          {c.how}
        </section>

        <section id="protocol" className="card">
          <h2>2. Running a good experiment</h2>
          {c.protocol}
        </section>

        <section id="confounds" className="card">
          <h2>3. Interpreting with care</h2>
          {c.confounds}
        </section>

        <section id="diseases" className="card">
          <h2>4. Patterns the app looks for</h2>
          <p className="small">
            The Summary and Story tabs score your data against these patterns. A pattern is reported when several of its markers change in the expected direction.
            They orient the reader; they are not diagnoses.
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
                {prog.domains.map((d) => (
                  <tr key={d.id}>
                    <td style={{ whiteSpace: 'normal', minWidth: 140, fontWeight: 600 }}>{d.title}</td>
                    <td style={{ whiteSpace: 'normal', minWidth: 200 }}>{d.summary}</td>
                    <td style={{ whiteSpace: 'normal', minWidth: 220 }}>{d.conditions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="glossary" className="card">
          <h2>5. Parameter glossary</h2>
          <input type="search" placeholder="Search the glossary" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the glossary" style={{ marginBottom: 8 }} />
          {prog.categoryOrder
            .filter((cat) => cat !== 'other')
            .map((cat) => {
              const list = glossary.filter((p) => p.category === cat)
              if (!list.length) return null
              return (
                <div key={cat}>
                  <h3 style={{ marginTop: 16 }}>{prog.categoryLabels[cat]}</h3>
                  {list.map((p) => (
                    <details key={p.id} className="gloss">
                      <summary>
                        <span>{p.label}</span>
                        <span className="muted small">{p.unit}</span>
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
            {c.refs.map((r) => (
              <li key={r.id} id={`ref-${r.id}`}>
                {r.text}{' '}
                <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer">
                  doi:{r.doi}
                </a>
              </li>
            ))}
          </ol>
          <p className="small">
            <a href="#sources">All references and sources the app is built on (statistics, file formats, other programs) →</a>
          </p>
          <p className="small muted">
            {prog.instrument} is a trademark of its manufacturer; this app is an independent tool and is not affiliated with it.
          </p>
        </section>
      </div>
    </div>
  )
}
