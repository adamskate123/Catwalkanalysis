import { useState, type RefObject } from 'react'
import { chartFiles, collectCharts, download, downloadZip, safeName, type GraphFormat } from '../lib/export'
import { program } from '../programs'

/** "Export this tab's graphs": the charts currently shown under `root`, as SVG and/or PNG. */
export function TabGraphsExport({ root, name, time }: { root: RefObject<HTMLElement | null>; name: string; time?: string }) {
  const [format, setFormat] = useState<GraphFormat>('png')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const go = async () => {
    const el = root.current
    if (!el) return
    const charts = collectCharts(el)
    if (!charts.length) {
      setMsg('No graphs on this tab.')
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const files = await chartFiles(charts, format)
      const base = safeName(`${program().filePrefix}_${name}${time ? `_${time}` : ''}_${new Date().toISOString().slice(0, 10)}`)
      const paths = Object.keys(files)
      if (paths.length === 1) download(paths[0], files[paths[0]] as BlobPart, format === 'svg' ? 'image/svg+xml' : 'image/png')
      else downloadZip(`${base}.zip`, files)
      setMsg(`Saved ${charts.length} graph${charts.length === 1 ? '' : 's'}.`)
    } catch (e) {
      setMsg(`Could not export: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }
  return (
    <span className="row tab-export" style={{ gap: 6 }}>
      <span className="small muted">Export this tab's graphs</span>
      <select value={format} onChange={(e) => setFormat(e.target.value as GraphFormat)} style={{ width: 'auto', minWidth: 0 }} aria-label="Graph file format">
        <option value="png">PNG</option>
        <option value="svg">SVG</option>
        <option value="both">SVG + PNG</option>
      </select>
      <button className="btn sm" onClick={go} disabled={busy}>
        {busy ? 'Saving…' : 'Download'}
      </button>
      {msg && (
        <span className="small muted" role="status">
          {msg}
        </span>
      )}
    </span>
  )
}
