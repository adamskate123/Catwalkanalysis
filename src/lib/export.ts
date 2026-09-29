import { zipSync } from 'fflate'
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

const SVG_NS = 'http://www.w3.org/2000/svg'
const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif"

function svgEl(name: string, attrs: Record<string, string | number>, text?: string): SVGElement {
  const el = document.createElementNS(SVG_NS, name)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
  if (text !== undefined) el.textContent = text
  return el
}

function isDark(hex: string): boolean {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex)
  if (!m) return false
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128
}

/** Group legend items drawn as HTML next to a chart (see charts/common.tsx Legend). */
function legendItems(svg: SVGSVGElement): { label: string; color: string }[] {
  const list = svg.parentElement?.querySelector(':scope > .legend')
  if (!list) return []
  return [...list.querySelectorAll('li')].map((li) => ({
    label: li.textContent?.trim() ?? '',
    color: (li.querySelector('.swatch') as HTMLElement | null)?.style.background ?? '#888',
  }))
}

/**
 * A standalone copy of a chart: hit targets removed, and the HTML legend (groups)
 * or the heatmap colour scale drawn into the SVG so the file makes sense on its own.
 */
function standalone(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', SVG_NS)
  // Hit-target circles are invisible; drop them from the file.
  clone.querySelectorAll('circle[fill="transparent"]').forEach((c) => c.remove())
  const w = Number(svg.getAttribute('width'))
  const h = Number(svg.getAttribute('height'))
  const bg = svg.querySelector('rect')?.getAttribute('fill') ?? '#ffffff'
  const ink = isDark(bg) ? '#ffffff' : '#333333'
  const items = legendItems(svg)
  const scale = svg.dataset.scale ? (JSON.parse(svg.dataset.scale) as string[]) : null
  if (!items.length && !scale) return clone

  // Legend rows: wrap items across the chart width.
  const rows: { label: string; color: string; x: number }[][] = []
  let x = 10
  for (const it of items) {
    const iw = 18 + it.label.length * 6 + 14
    if (!rows.length || (x + iw > w - 10 && x > 10)) {
      rows.push([])
      x = 10
    }
    rows[rows.length - 1].push({ ...it, x })
    x += iw
  }
  const top = rows.length * 18 + (rows.length ? 6 : 0)
  const bottom = scale ? 40 : 0
  const out = svgEl('svg', { xmlns: SVG_NS, width: w, height: h + top + bottom, viewBox: `0 0 ${w} ${h + top + bottom}`, 'font-family': FONT }) as SVGSVGElement
  out.appendChild(svgEl('rect', { width: w, height: h + top + bottom, fill: bg }))
  rows.forEach((row, ri) => {
    for (const it of row) {
      const y = 6 + ri * 18
      out.appendChild(svgEl('rect', { x: it.x, y: y + 2, width: 11, height: 11, rx: 2, fill: it.color }))
      out.appendChild(svgEl('text', { x: it.x + 16, y: y + 11, 'font-size': 11, fill: ink }, it.label))
    }
  })
  const inner = svgEl('g', { transform: `translate(0 ${top})` })
  inner.appendChild(clone)
  clone.removeAttribute('xmlns')
  out.appendChild(inner)
  if (scale) {
    // Colour bar with its labels underneath, so it fits even a narrow heatmap.
    const y = top + h + 6
    const cw = Math.min(16, (w - 20) / scale.length)
    const x0 = (w - scale.length * cw) / 2
    const x1 = x0 + scale.length * cw
    scale.forEach((c, i) => out.appendChild(svgEl('rect', { x: x0 + i * cw, y, width: cw, height: 12, fill: c })))
    out.appendChild(svgEl('text', { x: x0, y: y + 25, 'font-size': 10, fill: ink }, 'Lower'))
    out.appendChild(svgEl('text', { x: (x0 + x1) / 2, y: y + 25, 'text-anchor': 'middle', 'font-size': 10, fill: ink }, 'Hedges g'))
    out.appendChild(svgEl('text', { x: x1, y: y + 25, 'text-anchor': 'end', 'font-size': 10, fill: ink }, 'Higher'))
  }
  return out
}

export function svgText(svg: SVGSVGElement): string {
  return new XMLSerializer().serializeToString(standalone(svg))
}

export function downloadSvg(svg: SVGSVGElement | null, name: string) {
  if (!svg) return
  download(`${name}.svg`, svgText(svg), 'image/svg+xml')
}

/** Renders a chart to PNG at `scale` × its on-screen size (3 × ≈ 300 dpi at print size). */
export async function svgToPng(svg: SVGSVGElement, scale = 3): Promise<Blob> {
  const text = svgText(svg)
  const size = /<svg[^>]*\swidth="([\d.]+)"[^>]*\sheight="([\d.]+)"/.exec(text)
  const w = Number(size?.[1] ?? svg.getAttribute('width'))
  const h = Number(size?.[2] ?? svg.getAttribute('height'))
  const img = new Image()
  const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text)
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
  if (!blob) throw new Error('Could not render the chart image')
  return blob
}

export async function downloadPng(svg: SVGSVGElement | null, name: string, scale = 3) {
  if (!svg) return
  download(`${name}.png`, await svgToPng(svg, scale), 'image/png')
}

// ---------------------------------------------------------------------------
// Several charts at once

export interface ChartItem {
  /** File name without extension; may contain "/" for folders. */
  name: string
  svg: SVGSVGElement
}

export type GraphFormat = 'svg' | 'png' | 'both'

const GENERIC_LABEL = /^(dot plot|time course|effect-size heatmap)$/i

/** Every chart inside `root`, named from its card title (or its own label), with `prefix` as folder. */
export function collectCharts(root: Element, prefix = ''): ChartItem[] {
  const out: ChartItem[] = []
  const used = new Map<string, number>()
  for (const svg of root.querySelectorAll<SVGSVGElement>('svg[role="img"]')) {
    if (!svg.getAttribute('width') || Number(svg.getAttribute('width')) <= 0) continue
    const aria = svg.getAttribute('aria-label') ?? ''
    const card = svg.closest('.card')
    const heading = card?.querySelector('h3, h2')?.textContent?.trim() ?? ''
    const own = svg.dataset.chartName
    const label = own || (aria && !GENERIC_LABEL.test(aria) ? aria : heading || aria || 'chart')
    const scopes: string[] = []
    for (let el: Element | null = svg; el && el !== root.parentElement; el = el.parentElement) {
      const sc = (el as HTMLElement).dataset?.chartScope
      if (sc) scopes.unshift(...sc.split(' › '))
    }
    const folder = [...prefix.split(' › '), ...scopes].filter(Boolean).map(safeName).join('/')
    let name = (folder ? folder + '/' : '') + safeName(label)
    const k = used.get(name) ?? 0
    used.set(name, k + 1)
    if (k) name += `_${k + 1}`
    out.push({ name, svg })
  }
  return out
}

/** Chart files for a ZIP: SVG text and/or PNG images, keyed by path. */
export async function chartFiles(charts: ChartItem[], format: GraphFormat, onProgress?: (done: number, total: number) => void): Promise<Record<string, Uint8Array>> {
  const files: Record<string, Uint8Array> = {}
  const enc = new TextEncoder()
  let done = 0
  for (const c of charts) {
    if (format !== 'png') files[`${format === 'both' ? 'svg/' : ''}${c.name}.svg`] = enc.encode(svgText(c.svg))
    if (format !== 'svg') files[`${format === 'both' ? 'png/' : ''}${c.name}.png`] = new Uint8Array(await (await svgToPng(c.svg)).arrayBuffer())
    onProgress?.(++done, charts.length)
  }
  return files
}

export function downloadZip(filename: string, files: Record<string, Uint8Array>) {
  // PNGs are already compressed; store them, deflate the text files.
  const entries: Record<string, [Uint8Array, { level: 0 | 6 }]> = {}
  for (const [k, v] of Object.entries(files)) entries[k] = [v, { level: /\.png$/i.test(k) ? 0 : 6 }]
  download(filename, zipSync(entries) as BlobPart, 'application/zip')
}

export function safeName(s: string): string {
  // "≤50 days" → "up_to_50_days": keep the meaning of age-window signs in file names.
  return s.replace(/≤\s*/g, 'up to ').replace(/≥\s*/g, 'from ').replace(/[^\w-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 80) || 'chart'
}
