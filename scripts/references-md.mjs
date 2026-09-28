// Regenerates REFERENCES.md from src/lib/references.ts: node scripts/references-md.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import ts from 'typescript'

const src = readFileSync(new URL('../src/lib/references.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { REFERENCE_GROUPS } = await import('data:text/javascript,' + encodeURIComponent(js))

const lines = [
  '# References and sources',
  '',
  '<!-- Generated from src/lib/references.ts by `node scripts/references-md.mjs`; edit that file instead. -->',
  '',
  "Every source behind Behavior Lab's tutorials, parameter descriptions, phenotype patterns, statistics and file handling. The same list is shown in the app under *References & sources* in the footer.",
  '',
  'Journal articles in the biomedical sections were verified in PubMed. The statistics papers, which PubMed does not index, were checked against the publisher’s record.',
  '',
  'The phenotype patterns are the app’s own summaries of this literature. They group parameters that tend to change together, to orient the reader; they are not diagnostic criteria.',
  '',
]
for (const g of REFERENCE_GROUPS) {
  lines.push(`## ${g.title}`, '', `*Used for:* ${g.use}`, '', `*${g.verified}.*`, '')
  g.refs.forEach((r, i) => {
    const link = r.doi ? ` [doi:${r.doi}](https://doi.org/${r.doi})` : r.url ? ` <${r.url}>` : ''
    lines.push(`${i + 1}. ${r.text}${link}`)
  })
  lines.push('')
}
writeFileSync(new URL('../REFERENCES.md', import.meta.url), lines.join('\n'))
console.log('REFERENCES.md written')
