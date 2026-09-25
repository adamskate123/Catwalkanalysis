import changelog from '../../CHANGELOG.md?raw'
import { APP_VERSION } from '../version'
import type { ReactNode } from 'react'

// Tiny renderer for the subset of Markdown used in CHANGELOG.md.
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1]) out.push(<b key={m.index}>{m[1]}</b>)
    else
      out.push(
        <a key={m.index} href={m[3]} target="_blank" rel="noreferrer">
          {m[2]}
        </a>,
      )
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

interface Item {
  text: string
  children: string[]
}

export function Changelog() {
  const blocks: ReactNode[] = []
  let list: Item[] = []
  const flush = () => {
    if (!list.length) return
    const items = list
    blocks.push(
      <ul key={`ul${blocks.length}`}>
        {items.map((it, i) => (
          <li key={i}>
            {inline(it.text)}
            {it.children.length > 0 && (
              <ul>
                {it.children.map((c, j) => (
                  <li key={j}>{inline(c)}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>,
    )
    list = []
  }
  for (const line of changelog.split(/\r?\n/)) {
    if (/^\[[^\]]+\]:/.test(line)) continue // link reference definitions
    const sub = /^\s{2,}- (.*)/.exec(line)
    const item = /^- (.*)/.exec(line)
    if (sub && list.length) list[list.length - 1].children.push(sub[1])
    else if (item) list.push({ text: item[1], children: [] })
    else {
      flush()
      if (line.startsWith('# ')) continue
      if (line.startsWith('## ')) {
        const v = line.slice(3).replace(/\[|\]/g, '')
        blocks.push(
          <h2 key={`h${blocks.length}`} style={{ marginTop: 20 }}>
            {v}
            {v.startsWith(APP_VERSION + ' ') && <span className="badge strong" style={{ marginLeft: 8, verticalAlign: 'middle' }}>current</span>}
          </h2>,
        )
      } else if (line.startsWith('### ')) blocks.push(<h3 key={`h${blocks.length}`}>{line.slice(4)}</h3>)
      else if (line.trim()) blocks.push(<p key={`p${blocks.length}`} className="small muted">{inline(line)}</p>)
    }
  }
  flush()
  return (
    <div className="card changelog">
      <h1>What's new</h1>
      <p>
        You are using <b>version {APP_VERSION}</b>. When a new version is published the app updates itself the next time it is opened online.
      </p>
      {blocks}
    </div>
  )
}
