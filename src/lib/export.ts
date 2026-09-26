import type { AggregateResult, Measure, TimeResults } from './analysis'

export function download(filename: string, data: BlobPart, mime: string) {
  const blob = new Blob([data], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v))) return ''
  const s = typeof v === 'number' ? String(+v.toPrecision(8)) : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\n')
}

export function animalCsv(agg: AggregateResult, measures: Measure[]): string {
  const header = ['Animal', 'Group', 'Time', 'Runs averaged', ...measures.map((m) => m.label)]
  const rows = agg.subjects.map((s) => [s.id, s.group, s.time, s.nRuns, ...measures.map((m) => s.values[m.key])])
  return toCsv([header, ...rows])
}

export function statsCsv(results: TimeResults[], groups: string[]): string {
  const maxComp = Math.max(0, ...results.flatMap((t) => t.results.map((r) => r.comparisons.length)))
  const header = [
    'Time',
    'Parameter',
    'Category',
    ...groups.flatMap((g) => [`${g} n`, `${g} mean`, `${g} SD`, `${g} SEM`]),
    'Omnibus test',
    'Omnibus statistic',
    'Omnibus p',
    'Primary p',
    'FDR q (BH)',
    ...Array.from({ length: maxComp }, (_, i) => [
      `Comparison ${i + 1}`,
      `C${i + 1} test`,
      `C${i + 1} statistic`,
      `C${i + 1} p`,
      `C${i + 1} p (Holm)`,
      `C${i + 1} Hedges g`,
      `C${i + 1} difference %`,
    ]).flat(),
    'Rescue %',
  ]
  const rows = results.flatMap((t) =>
    t.results.map((r) => [
      t.time,
      r.measure.label,
      r.measure.def.category,
      ...groups.flatMap((g): unknown[] => {
        const d = r.groups[g]
        return d ? [d.n, d.mean, d.sd, d.sem] : ['', '', '', '']
      }),
      r.omnibus?.test ?? '',
      r.omnibus?.statistic,
      r.omnibus?.p,
      r.pPrimary,
      r.q,
      ...Array.from({ length: maxComp }, (_, i) => {
        const c = r.comparisons[i]
        const cells: unknown[] = c ? [`${c.group} vs ${c.reference}`, c.test.test, c.test.statistic, c.test.p, c.pAdj, c.g, c.diffPct] : ['', '', '', '', '', '', '']
        return cells
      }).flat(),
      r.rescuePct,
    ]),
  )
  return toCsv([header, ...rows])
}

function serialise(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  // Hit-target circles are invisible; drop them from the file.
  clone.querySelectorAll('circle[fill="transparent"]').forEach((c) => c.remove())
  return new XMLSerializer().serializeToString(clone)
}

export function downloadSvg(svg: SVGSVGElement | null, name: string) {
  if (!svg) return
  download(`${name}.svg`, serialise(svg), 'image/svg+xml')
}

export async function downloadPng(svg: SVGSVGElement | null, name: string, scale = 3) {
  if (!svg) return
  const w = Number(svg.getAttribute('width'))
  const h = Number(svg.getAttribute('height'))
  const img = new Image()
  const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(serialise(svg))
  await new Promise<void>((res, rej) => {
    img.onload = () => res()
    img.onerror = () => rej(new Error('Could not render the chart image'))
    img.src = src
  })
  const canvas = document.createElement('canvas')
  canvas.width = w * scale
  canvas.height = h * scale
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0, w, h)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  if (blob) download(`${name}.png`, blob, 'image/png')
}

export function safeName(s: string): string {
  return s.replace(/[^\w-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 80) || 'chart'
}
