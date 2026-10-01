// Keeps the reference list, the tutorials and REFERENCES.md in step.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CAGEHANG_REFS, CATWALK_REFS, OPENFIELD_REFS, REFERENCE_GROUPS, ROTAROD_REFS, WEIGHT_REFS } from './references'

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const citedIds = (src: string) => [...src.matchAll(/ids=\{\[([^\]]*)\]\}/g)].flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]))

describe('references', () => {
  const all = REFERENCE_GROUPS.flatMap((g) => g.refs)

  it('have unique ids and a link or a book citation', () => {
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length)
    for (const r of all) expect(r.text.length).toBeGreaterThan(20)
  })

  it('cover every citation in the tutorials', () => {
    const catwalk = new Set(CATWALK_REFS.map((r) => r.id))
    for (const id of citedIds(read('../components/Learn.tsx'))) expect(catwalk.has(id), id).toBe(true)
    const other = new Set([...ROTAROD_REFS, ...OPENFIELD_REFS, ...CAGEHANG_REFS, ...WEIGHT_REFS].map((r) => r.id))
    for (const id of citedIds(read('../components/LearnProgram.tsx'))) expect(other.has(id), id).toBe(true)
  })

  it('are all listed in REFERENCES.md (regenerate with `node scripts/references-md.mjs`)', () => {
    const md = read('../../REFERENCES.md')
    for (const r of all) expect(md, r.id).toContain(r.text)
  })
})
