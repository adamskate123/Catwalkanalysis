import { useState } from 'react'

/** Pick two or more groups and analyse them as one (e.g. several wild-type cohorts). */
export function CombineGroups({
  groups,
  control,
  onCombine,
  defaultOpen = false,
}: {
  groups: string[]
  control: string | null
  onCombine: (groups: string[], name: string) => void
  defaultOpen?: boolean
}) {
  const [picked, setPicked] = useState<string[]>([])
  const [name, setName] = useState('')
  const chosen = picked.filter((g) => groups.includes(g))
  // Suggested name: the control if it is included, otherwise the shortest name picked.
  const suggestion = chosen.includes(control ?? '') ? control! : ([...chosen].sort((a, b) => a.length - b.length)[0] ?? '')
  const finalName = name.trim() || suggestion
  const clash = groups.includes(finalName) && !chosen.includes(finalName)
  return (
    <details className="combine" style={{ marginTop: 16 }} open={defaultOpen}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Combine groups</summary>
      <p className="small muted" style={{ margin: '6px 0 8px' }}>
        Analyse several groups as one, for example wild-type cohorts from different sources. The original group labels stay in your data, and you can split the
        combined group again at any time. Check first that the groups are comparable: cohorts bred or tested at different times can differ.
      </p>
      <div className="chips">
        {groups.map((g) => (
          <label key={g} className="chip" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={chosen.includes(g)} onChange={(e) => setPicked(e.target.checked ? [...chosen, g] : chosen.filter((x) => x !== g))} />
            {g}
          </label>
        ))}
      </div>
      <div className="row" style={{ marginTop: 10, alignItems: 'flex-end' }}>
        <label className="field" style={{ flex: '1 1 200px', maxWidth: 320 }}>
          Name of the combined group
          <input type="text" value={name} placeholder={suggestion || 'e.g. All WT'} onChange={(e) => setName(e.target.value)} />
        </label>
        <button
          className="btn primary"
          disabled={chosen.length < 2 || !finalName || clash}
          onClick={() => {
            onCombine(chosen, finalName)
            setPicked([])
            setName('')
          }}
        >
          Combine {chosen.length >= 2 ? `${chosen.length} groups` : ''}
        </button>
      </div>
      {clash && <p className="small save-error">“{finalName}” is another group's name; include it or choose a different name.</p>}
    </details>
  )
}
