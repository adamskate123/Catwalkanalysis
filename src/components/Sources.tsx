import { REFERENCE_GROUPS } from '../lib/references'

/** Every published source the app is built on, grouped by where it is used. */
export function Sources({ onBack }: { onBack: () => void }) {
  return (
    <div className="learn-single">
      <div className="card">
        <h1>References &amp; sources</h1>
        <p>
          Every source behind Behavior Lab's tutorials, parameter descriptions, phenotype patterns, statistics and file handling. Journal articles in the
          biomedical sections were verified in PubMed; the statistics papers, which PubMed does not index, were checked against the publisher's record.
        </p>
        <p className="small muted">
          The phenotype patterns (e.g. “ataxia”, “reduced motor learning”, “anxiety-like behaviour”) are the app's own summaries of the literature below. They
          group parameters that tend to change together and are meant to orient the reader, not to diagnose. The thresholds they use (α, minimum Hedges g) are
          set under Setup.
        </p>
        <button className="btn" onClick={onBack}>
          ← Back
        </button>
      </div>
      {REFERENCE_GROUPS.map((g) => (
        <section key={g.id} id={`sources-${g.id}`} className="card">
          <h2>{g.title}</h2>
          <p className="small">
            <b>Used for:</b> {g.use}
          </p>
          <p className="small muted">{g.verified}.</p>
          <ol className="refs">
            {g.refs.map((r) => (
              <li key={r.id}>
                {r.text}{' '}
                {r.doi ? (
                  <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer">
                    doi:{r.doi}
                  </a>
                ) : r.url ? (
                  <a href={r.url} target="_blank" rel="noreferrer">
                    {r.url.replace(/^https?:\/\/(www\.)?/, '')}
                  </a>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ))}
      <p className="small muted">
        CatWalk and EthoVision are trademarks of Noldus Information Technology; Rotor-Rod is a trademark of San Diego Instruments; Prism is a trademark of
        GraphPad Software. Behavior Lab is independent and not affiliated with any of them.
      </p>
    </div>
  )
}
