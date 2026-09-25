import { distinctValues, groupDefaults, type AnalysisConfig, type Measure } from '../lib/analysis'
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../lib/catalog'
import type { InterpretOptions } from '../lib/interpret'
import type { Dataset } from '../lib/parse'

interface Props {
  ds: Dataset
  measures: Measure[]
  cfg: AnalysisConfig
  setCfg: (c: AnalysisConfig) => void
  opt: InterpretOptions
  setOpt: (o: InterpretOptions) => void
  colorOf: (g: string) => string
  onLearn: (anchor?: string) => void
}

function move<T>(arr: T[], i: number, d: number): T[] {
  const j = i + d
  if (j < 0 || j >= arr.length) return arr
  const out = [...arr]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}

export function Setup({ ds, measures, cfg, setCfg, opt, setOpt, colorOf, onLearn }: Props) {
  const textCols = ds.columns.filter((c) => c.meta || c.numericShare < 0.8 || c.distinct <= 50).map((c) => c.name)
  const allCols = ds.headers
  const update = (patch: Partial<AnalysisConfig>) => setCfg({ ...cfg, ...patch })
  const hasSpeed = measures.some((m) => m.def.id === 'speed')
  const groups = cfg.groupOrder

  const colSelect = (label: string, hint: string, value: string | null, onChange: (v: string | null) => void, options = textCols) => (
    <label className="field">
      {label}
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">— none —</option>
        {[...new Set([...(value ? [value] : []), ...options])].map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <span className="hint">{hint}</span>
    </label>
  )

  const byCat = CATEGORY_ORDER.map((cat) => ({
    cat,
    n: new Set(measures.filter((m) => m.def.category === cat && !m.derived).map((m) => m.def.id + (m.variant ?? ''))).size,
  })).filter((x) => x.n > 0)
  const others = measures.filter((m) => m.def.category === 'other')

  return (
    <>
      <div className="card">
        <h2>Columns</h2>
        <p className="small muted">These were detected automatically. Change them if the guess is wrong.</p>
        <div className="form-grid">
          {colSelect('Animal ID', 'Runs with the same ID (and timepoint) are averaged into one value per animal.', cfg.subjectCol, (v) => update({ subjectCol: v }), allCols)}
          {colSelect('Group', 'Genotype, treatment or cohort to compare.', cfg.groupCol, (v) => {
            const d = groupDefaults(distinctValues(ds, v))
            update({ groupCol: v, ...d, excludedGroups: [] })
          })}
          {colSelect('Timepoint', 'Optional. Each timepoint is analysed separately and plotted over time.', cfg.timeCol, (v) =>
            update({ timeCol: v, timeOrder: distinctValues(ds, v) }),
          )}
          {colSelect('Compliant run flag', 'Optional. CatWalk marks runs that meet your speed-variation and duration criteria.', cfg.compliantCol, (v) =>
            update({ compliantCol: v, onlyCompliant: Boolean(v) }),
          )}
        </div>
        {cfg.compliantCol && (
          <label className="check" style={{ marginTop: 12 }}>
            <input type="checkbox" checked={cfg.onlyCompliant} onChange={(e) => update({ onlyCompliant: e.target.checked })} />
            <span>Use compliant runs only</span>
          </label>
        )}
      </div>

      {cfg.groupCol && (
        <div className="card">
          <h2>Groups</h2>
          <div className="form-grid">
            <label className="field">
              Control / reference group
              <select value={cfg.controlGroup ?? ''} onChange={(e) => update({ controlGroup: e.target.value || null, diseaseGroup: cfg.diseaseGroup === e.target.value ? null : cfg.diseaseGroup })}>
                {groups.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
              <span className="hint">Every other group is compared with this one, e.g. wild-type or sham.</span>
            </label>
            <label className="field">
              Untreated disease group (optional)
              <select value={cfg.diseaseGroup ?? ''} onChange={(e) => update({ diseaseGroup: e.target.value || null })}>
                <option value="">— none —</option>
                {groups
                  .filter((g) => g !== cfg.controlGroup)
                  .map((g) => (
                    <option key={g}>{g}</option>
                  ))}
              </select>
              <span className="hint">
                For treatment studies. Treated groups are also compared with this group, and the app reports the % of the deficit that was rescued.
              </span>
            </label>
          </div>
          <h3 style={{ marginTop: 16 }}>Order and inclusion</h3>
          <ul className="file-list">
            {groups.map((g, i) => (
              <li key={g}>
                <label className="check" style={{ alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={!cfg.excludedGroups.includes(g)}
                    onChange={(e) =>
                      update({ excludedGroups: e.target.checked ? cfg.excludedGroups.filter((x) => x !== g) : [...cfg.excludedGroups, g] })
                    }
                  />
                  <span className="swatch" style={{ background: colorOf(g) }} aria-hidden />
                  <span>
                    {g}
                    {g === cfg.controlGroup && <span className="badge" style={{ marginLeft: 6 }}>control</span>}
                    {g === cfg.diseaseGroup && <span className="badge" style={{ marginLeft: 6 }}>disease</span>}
                  </span>
                </label>
                <span className="row" style={{ gap: 4 }}>
                  <button className="btn sm" onClick={() => update({ groupOrder: move(groups, i, -1) })} disabled={i === 0} aria-label={`Move ${g} up`}>
                    ↑
                  </button>
                  <button className="btn sm" onClick={() => update({ groupOrder: move(groups, i, 1) })} disabled={i === groups.length - 1} aria-label={`Move ${g} down`}>
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {cfg.timeCol && cfg.timeOrder.length > 1 && (
            <>
              <h3 style={{ marginTop: 16 }}>Timepoint order</h3>
              <ul className="file-list">
                {cfg.timeOrder.map((t, i) => (
                  <li key={t}>
                    <span>{t}</span>
                    <span className="row" style={{ gap: 4 }}>
                      <button className="btn sm" onClick={() => update({ timeOrder: move(cfg.timeOrder, i, -1) })} disabled={i === 0} aria-label={`Move ${t} earlier`}>
                        ↑
                      </button>
                      <button className="btn sm" onClick={() => update({ timeOrder: move(cfg.timeOrder, i, 1) })} disabled={i === cfg.timeOrder.length - 1} aria-label={`Move ${t} later`}>
                        ↓
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="card">
        <h2>Statistics</h2>
        <div className="form-grid">
          <label className="field">
            Test
            <select value={cfg.test} onChange={(e) => update({ test: e.target.value as AnalysisConfig['test'] })}>
              <option value="parametric">Parametric: Welch t-test / one-way ANOVA</option>
              <option value="nonparametric">Non-parametric: Mann–Whitney U / Kruskal–Wallis</option>
            </select>
            <span className="hint">Pairwise p-values are Holm-adjusted within each parameter; q-values control the false discovery rate across parameters.</span>
          </label>
          <label className="field">
            Minimum runs per animal
            <input type="number" min={1} max={20} value={cfg.minRuns} onChange={(e) => update({ minRuns: Math.max(1, Number(e.target.value) || 1) })} />
            <span className="hint">Animals with fewer usable runs are left out.</span>
          </label>
          <label className="field">
            Significance level (α)
            <select value={opt.alpha} onChange={(e) => setOpt({ ...opt, alpha: Number(e.target.value) })}>
              {[0.1, 0.05, 0.01, 0.001].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Minimum effect size for the summary (|Hedges g|)
            <select value={opt.minEffect} onChange={(e) => setOpt({ ...opt, minEffect: Number(e.target.value) })}>
              {[0, 0.5, 0.8, 1.2].map((a) => (
                <option key={a} value={a}>
                  {a === 0 ? 'none' : a === 0.5 ? '0.5 (medium)' : a === 0.8 ? '0.8 (large)' : '1.2 (very large)'}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          <label className="check">
            <input type="checkbox" checked={opt.useFdr} onChange={(e) => setOpt({ ...opt, useFdr: e.target.checked })} />
            <span>
              Also require FDR q &lt; α across all parameters <span className="muted">(stricter; recommended for exploratory screens of many parameters)</span>
            </span>
          </label>
          <label className="check">
            <input type="checkbox" checked={cfg.speedAdjust} disabled={!hasSpeed} onChange={(e) => update({ speedAdjust: e.target.checked })} />
            <span>
              Adjust all parameters for walking speed{' '}
              <span className="muted">
                (removes the part of each parameter explained by run-to-run speed differences, using a pooled within-animal regression, then re-centres at the mean
                speed.{' '}
                <button className="btn ghost sm" style={{ padding: 0, minHeight: 0 }} onClick={() => onLearn('speed')}>
                  Why?
                </button>
                )
              </span>
            </span>
          </label>
        </div>
      </div>

      <div className="card">
        <h2>Recognised parameters</h2>
        <div className="chips">
          {byCat.map(({ cat, n }) => (
            <span key={cat} className="chip">
              {CATEGORY_LABELS[cat]}: <b>{n}</b>
            </span>
          ))}
        </div>
        {others.length > 0 && (
          <p className="small muted" style={{ marginTop: 10 }}>
            Numeric columns not matched to a known CatWalk parameter (still analysed): {others.map((m) => m.label).join(', ')}
          </p>
        )}
        <p className="small muted" style={{ marginTop: 10 }}>
          When both Mean and StDev columns exist for a parameter, the Mean column is used. Derived values (front/hind means and left–right asymmetry indices) are
          calculated per animal for every parameter measured on all four paws.
        </p>
      </div>
    </>
  )
}
