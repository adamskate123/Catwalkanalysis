import { useEffect, useMemo, useRef, useState, type MouseEvent, type RefObject } from 'react'
import { downloadPng, downloadSvg, safeName } from '../../lib/export'
import { naturalCompare } from '../../lib/analysis'
import { groupOccupancy, occupancy, unpackEvents, type TrackEvents, type TrackRun, type TrackSet } from '../../lib/tracks'
import { trackRuns, type TrackRunInfo } from '../../lib/trackRuns'
import { seriesColor, type ChartTheme } from '../../lib/theme'
import { Legend, Tooltip, type TipState } from '../charts/common'
import { MouseIcon } from '../charts/MouseIcon'
import { useWidth } from '../charts/useWidth'
import { ChartCard } from './figures'
import type { TabProps } from './types'

const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif"

/**
 * Fixed jitter so repeated passes over the same beams spread out like a video track: up to
 * ±0.45 beam, within the half-beam the position is uncertain by anyway.
 */
const jitter = (i: number, k: number) => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
  return (v - Math.floor(v) - 0.5) * 0.9
}

const clock = (tenths: number) => {
  const s = Math.max(0, Math.round(tenths / 10))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Unpacked events, kept for each packed run while it is in memory. */
const unpacked = new WeakMap<TrackRun, TrackEvents>()
function eventsOf(run: TrackRun | undefined): TrackEvents | null {
  if (!run) return null
  let ev = unpacked.get(run)
  if (!ev) unpacked.set(run, (ev = unpackEvents(run)))
  return ev
}

function useEvents(set: TrackSet | undefined) {
  return useMemo(() => (rec: string) => eventsOf(set?.runs[rec]), [set])
}

interface ArenaGeom {
  size: number
  pad: number
  cell: number
  /** Centre of beam x / y (1-based) in px. */
  px: (b: number) => number
}

const geom = (size: number, set: TrackSet): ArenaGeom => {
  const pad = 2
  const cell = (size - 2 * pad) / Math.max(set.xBeams, set.yBeams)
  return { size, pad, cell, px: (b) => pad + (b - 0.5) * cell }
}

/** Arena outline, quarter grid lines (as in the classic overhead view) and the centre zone. */
function ArenaFrame({ g, set, theme, ox = 0, oy = 0, showCentre = true }: { g: ArenaGeom; set: TrackSet; theme: ChartTheme; ox?: number; oy?: number; showCentre?: boolean }) {
  const inner = g.size - 2 * g.pad
  const xs = set.centre.map((c) => +c.split(',')[0])
  const ys = set.centre.map((c) => +c.split(',')[1])
  return (
    <g transform={`translate(${ox} ${oy})`}>
      {[1, 2, 3].map((k) => (
        <g key={k}>
          <line x1={g.pad + (inner * k) / 4} y1={g.pad} x2={g.pad + (inner * k) / 4} y2={g.pad + inner} stroke={theme.axis} strokeWidth={1} />
          <line x1={g.pad} y1={g.pad + (inner * k) / 4} x2={g.pad + inner} y2={g.pad + (inner * k) / 4} stroke={theme.axis} strokeWidth={1} />
        </g>
      ))}
      {showCentre && xs.length > 0 && (
        <rect
          x={g.pad + (Math.min(...xs) - 1) * g.cell}
          y={g.pad + (Math.min(...ys) - 1) * g.cell}
          width={(Math.max(...xs) - Math.min(...xs) + 1) * g.cell}
          height={(Math.max(...ys) - Math.min(...ys) + 1) * g.cell}
          fill="none"
          stroke={theme.series[4]}
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
      )}
      <rect x={g.pad} y={g.pad} width={inner} height={inner} fill="none" stroke={theme.text2} strokeWidth={2} />
    </g>
  )
}

/** Track points (with jitter) of events up to `until` (0.1 s), split by interval. */
function trackSegments(ev: TrackEvents, g: ArenaGeom, intervalTenths: number, until: number) {
  const segs: { interval: number; pts: string[] }[] = []
  let last: string | null = null
  for (let i = 0; i < ev.t.length && ev.t[i] <= until; i++) {
    if (ev.rear[i]) continue
    const p = `${(g.px(ev.x[i]) + jitter(i, 1) * g.cell).toFixed(1)},${(g.px(ev.y[i]) + jitter(i, 2) * g.cell).toFixed(1)}`
    const k = Math.floor(ev.t[i] / intervalTenths)
    if (!segs.length || segs[segs.length - 1].interval !== k) segs.push({ interval: k, pts: last ? [last] : [] })
    segs[segs.length - 1].pts.push(p)
    last = p
  }
  return segs
}

// ---------------------------------------------------------------------------

export function TracksTab(props: TabProps & { exportOnly?: boolean }) {
  const { ds, cfg, theme, time, colorOf, exportOnly } = props
  const set = ds.tracks
  const runs = useMemo(() => trackRuns(ds, cfg), [ds, cfg])
  const events = useEvents(set)
  if (!set || !runs.length) return <p className="muted">No movement tracks in the data. Tracks come from SDI PAS databases (.mdb).</p>
  const atTime = runs.filter((r) => !r.excluded && (!cfg.timeCol || r.time === time))
  return (
    <>
      {!exportOnly && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Movement tracks</h2>
          <p className="small" style={{ margin: 0 }}>
            Redrawn from the beam events in the PAS database: the animal's position at every move to a new beam and every rearing, to 0.1 s. Positions
            are known to the nearest beam ({set.beamCm} cm apart, {set.xBeams} × {set.yBeams}), so a track is made of straight steps between beams; a
            small fixed jitter spreads repeated passes so they read like a video track. The dashed square is the centre zone. Runs left out under Setup →
            Data checks are not drawn in the group maps.
          </p>
        </div>
      )}
      <GroupMaps runs={atTime} set={set} theme={theme} cfg={cfg} time={time} events={events} colorOf={colorOf} />
      {!exportOnly && <OneAnimal runs={runs} set={set} theme={theme} time={time} events={events} timeCol={cfg.timeCol} />}
    </>
  )
}

// ---------------------------------------------------------------------------
// Group maps

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const hex = (c: number[]) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

/** One hue, light → dark (the theme's blue ramp from the chart surface), interpolated for f in 0…1. */
function sequential(theme: ChartTheme, f: number): string {
  const ramp = [theme.surface, ...theme.divNeg]
  const x = Math.max(0, Math.min(1, f)) * (ramp.length - 1)
  const i = Math.min(ramp.length - 2, Math.floor(x))
  const a = rgb(ramp[i])
  const b = rgb(ramp[i + 1])
  return hex(a.map((v, k) => v + (b[k] - v) * (x - i)))
}

/** Colour position of a share of time: square root, so the walls and corners don't wash out the rest of the arena. */
const shade = (v: number, max: number) => Math.sqrt(Math.max(0, v) / (max || 1))

function diverging(theme: ChartTheme, d: number, max: number): string {
  const a = Math.abs(d) / (max || 1)
  if (a < 0.08) return theme.divMid
  const i = Math.min(5, Math.floor(a * 6))
  return d < 0 ? theme.divNeg[i] : theme.divPos[i]
}

function GroupMaps({
  runs,
  set,
  theme,
  cfg,
  time,
  events,
  colorOf,
}: {
  runs: TrackRunInfo[]
  set: TrackSet
  theme: ChartTheme
  cfg: TabProps['cfg']
  time: string
  events: (rec: string) => TrackEvents | null
  colorOf: (g: string) => string
}) {
  const [mode, setMode] = useState<'heat' | 'tracks'>('heat')
  const [box, width] = useWidth<HTMLDivElement>(700)
  const heatRef = useRef<SVGSVGElement>(null)
  const diffRef = useRef<SVGSVGElement>(null)
  const [tip, setTip] = useState<TipState | null>(null)
  const [diffTip, setDiffTip] = useState<TipState | null>(null)

  // Each animal counts once: its runs at this timepoint are averaged, then animals are averaged.
  const groups = useMemo(() => {
    const order = cfg.groupOrder.filter((g) => runs.some((r) => r.group === g))
    return order.map((group) => {
      const bySubject = new Map<string, TrackRunInfo[]>()
      for (const r of runs.filter((x) => x.group === group)) bySubject.set(r.subject, [...(bySubject.get(r.subject) ?? []), r])
      const maps: Float64Array[] = []
      for (const list of bySubject.values()) {
        const per = list.map((r) => events(r.recording)).map((ev, i) => (ev ? occupancy(ev, set, set.runs[list[i].recording].secs) : null)).filter((m): m is Float64Array => m !== null)
        const avg = groupOccupancy(per)
        if (avg) maps.push(avg)
      }
      return { group, n: maps.length, map: groupOccupancy(maps), recordings: runs.filter((x) => x.group === group).map((r) => r.recording) }
    })
  }, [runs, set, cfg.groupOrder, events])
  const shown = groups.filter((g) => g.map)
  if (!shown.length) return null

  const max = Math.max(...shown.flatMap((g) => [...g.map!]))
  const cols = Math.max(1, Math.min(shown.length, Math.floor((width + 12) / 190)))
  const size = Math.min(260, Math.floor((width - (cols - 1) * 12) / cols))
  const g = geom(size, set)
  const titleH = 20
  const rowsN = Math.ceil(shown.length / cols)
  const svgW = cols * size + (cols - 1) * 12
  const svgH = rowsN * (size + titleH + 10)
  const at = (k: number) => ({ ox: (k % cols) * (size + 12), oy: Math.floor(k / cols) * (size + titleH + 10) + titleH })
  const steps = [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1]
  const control = cfg.controlGroup && shown.some((s) => s.group === cfg.controlGroup) ? shown.find((s) => s.group === cfg.controlGroup)! : null
  const others = control ? shown.filter((s) => s !== control) : []
  const diffs = others.map((o) => ({ ...o, diff: o.map!.map((v, i) => v - control!.map![i]) }))
  const dmax = Math.max(0.01, ...diffs.flatMap((d) => [...d.diff].map(Math.abs)))
  const when = cfg.timeCol && time ? ` · ${time}` : ''
  const cellTip = (e: MouseEvent, content: string, show: (t: TipState | null) => void) => {
    const r = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect()
    show({ x: e.clientX - r.left, y: e.clientY - r.top - 12, content })
  }

  const panelTitle = (s: (typeof shown)[number], k: number, extra = '') => (
    <text x={at(k).ox + 2} y={at(k).oy - 6} fontSize={12} fontWeight={600} fill={theme.text}>
      <tspan fill={colorOf(s.group)}>■ </tspan>
      {s.group}
      {extra} (n = {s.n})
    </text>
  )

  return (
    <div ref={box}>
      <ChartCard title={`Where each group spends its time${when}`} svg={heatRef} name={`Track occupancy${when}`}>
        <div className="row" style={{ gap: 6, margin: '4px 0 8px' }} role="group" aria-label="Show">
          <button className={`btn sm${mode === 'heat' ? ' primary' : ''}`} aria-pressed={mode === 'heat'} onClick={() => setMode('heat')}>
            Time in place
          </button>
          <button className={`btn sm${mode === 'tracks' ? ' primary' : ''}`} aria-pressed={mode === 'tracks'} onClick={() => setMode('tracks')}>
            All tracks
          </button>
        </div>
        <div style={{ position: 'relative' }} onMouseLeave={() => setTip(null)}>
          <svg
            ref={heatRef}
            width={svgW}
            height={svgH}
            viewBox={`0 0 ${svgW} ${svgH}`}
            role="img"
            aria-label={mode === 'heat' ? 'Time spent at each beam position, by group' : 'All tracks, by group'}
            data-chart-name={mode === 'heat' ? `Time in place${when}` : `All tracks${when}`}
            data-chart-note={
              mode === 'heat'
                ? `Share of session time at each beam position (${set.beamCm} cm), each animal's map averaged so every animal counts once; dashed square = centre zone.`
                : `Every animal's track, drawn faintly so busy areas build up; dashed square = centre zone.`
            }
            {...(mode === 'heat' ? { 'data-scale': JSON.stringify(steps.map((f) => sequential(theme, f))), 'data-scale-labels': JSON.stringify(['0%', '% of time (square-root scale)', `${max.toFixed(1)}%`]) } : {})}
            xmlns="http://www.w3.org/2000/svg"
            fontFamily={FONT}
          >
            <rect width={svgW} height={svgH} fill={theme.surface} />
            {shown.map((s, k) => (
              <g key={s.group}>
                {panelTitle(s, k)}
                <g transform={`translate(${at(k).ox} ${at(k).oy})`}>
                  {mode === 'heat'
                    ? [...s.map!].map((v, i) => {
                        const x = i % set.xBeams
                        const y = Math.floor(i / set.xBeams)
                        return (
                          <rect
                            key={i}
                            x={g.pad + x * g.cell}
                            y={g.pad + y * g.cell}
                            width={g.cell + 0.4}
                            height={g.cell + 0.4}
                            fill={sequential(theme, shade(v, max))}
                            onMouseMove={(e) => cellTip(e, `${s.group}: ${v.toFixed(2)}% of the session at beam ${x + 1}, ${y + 1}`, setTip)}
                          />
                        )
                      })
                    : s.recordings.map((rec) => {
                        const ev = events(rec)
                        if (!ev) return null
                        return trackSegments(ev, g, 1e9, Infinity).map((seg, j) => (
                          <polyline key={`${rec}${j}`} points={seg.pts.join(' ')} fill="none" stroke={theme.text} strokeWidth={0.5} strokeOpacity={Math.max(0.06, 0.6 / Math.sqrt(s.recordings.length))} />
                        ))
                      })}
                </g>
                <ArenaFrame g={g} set={set} theme={theme} ox={at(k).ox} oy={at(k).oy} />
              </g>
            ))}
          </svg>
          <Tooltip tip={tip} width={svgW} />
        </div>
        {mode === 'heat' && (
          <div className="div-legend" aria-label="Colour scale: share of session time">
            <span>0%</span>
            <span className="div-legend-bar">
              {steps.map((f) => (
                <span key={f} style={{ background: sequential(theme, f) }} />
              ))}
            </span>
            <span>{max.toFixed(1)}% of session time per beam position (square-root scale)</span>
          </div>
        )}
        <p className="small muted" style={{ marginBottom: 0 }}>
          {mode === 'heat'
            ? 'Darker = more time. Wall-hugging (thigmotaxis) shows as a dark rim and corners; a pale centre is centre avoidance.'
            : 'Each line is one animal; overlapping tracks darken where animals travel most.'}
        </p>
      </ChartCard>

      {control && diffs.length > 0 && (
        <ChartCard title={`Difference from ${control.group}${when}`} svg={diffRef} name={`Track occupancy difference${when}`}>
          <div style={{ position: 'relative' }} onMouseLeave={() => setDiffTip(null)}>
            <svg
              ref={diffRef}
              width={Math.min(svgW, diffs.length * (size + 12) - 12)}
              height={Math.ceil(diffs.length / cols) * (size + titleH + 10)}
              viewBox={`0 0 ${Math.min(svgW, diffs.length * (size + 12) - 12)} ${Math.ceil(diffs.length / cols) * (size + titleH + 10)}`}
              role="img"
              aria-label={`Difference in time at each position from ${control.group}`}
              data-chart-name={`Difference from ${control.group}${when}`}
              data-chart-note={`Group map minus the ${control.group} map, in percentage points of session time at each beam position. Red = more time than ${control.group}, blue = less.`}
              data-scale={JSON.stringify([-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].map((f) => diverging(theme, f * dmax, dmax)))}
              data-scale-labels={JSON.stringify([`−${dmax.toFixed(2)}`, `points vs ${control.group}`, `+${dmax.toFixed(2)}`])}
              xmlns="http://www.w3.org/2000/svg"
              fontFamily={FONT}
            >
              <rect width="100%" height="100%" fill={theme.surface} />
              {diffs.map((s, k) => (
                <g key={s.group}>
                  {panelTitle(s, k, ` − ${control.group}`)}
                  <g transform={`translate(${at(k).ox} ${at(k).oy})`}>
                    {[...s.diff].map((d, i) => {
                      const x = i % set.xBeams
                      const y = Math.floor(i / set.xBeams)
                      return (
                        <rect
                          key={i}
                          x={g.pad + x * g.cell}
                          y={g.pad + y * g.cell}
                          width={g.cell + 0.4}
                          height={g.cell + 0.4}
                          fill={diverging(theme, d, dmax)}
                          onMouseMove={(e) => cellTip(e, `${s.group} − ${control.group}: ${d >= 0 ? '+' : ''}${d.toFixed(2)} points at beam ${x + 1}, ${y + 1}`, setDiffTip)}
                        />
                      )
                    })}
                  </g>
                  <ArenaFrame g={g} set={set} theme={theme} ox={at(k).ox} oy={at(k).oy} />
                </g>
              ))}
            </svg>
            <Tooltip tip={diffTip} width={svgW} />
          </div>
          <div className="div-legend" aria-label="Colour scale: difference in percentage points">
            <span>Less time than {control.group}</span>
            <span className="div-legend-bar">
              {[-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].map((f) => (
                <span key={f} style={{ background: diverging(theme, f * dmax, dmax) }} />
              ))}
            </span>
            <span>More (±{dmax.toFixed(2)} points)</span>
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>
            A descriptive map, not a test: with few animals single beam positions are noisy. The Parameters tab tests centre time, centre entries and
            the other zone measures.
          </p>
        </ChartCard>
      )}
    </div>
  )
}

/**
 * Direction of travel at event `i` (degrees, as Math.atan2(dy, dx)): from the
 * position a few beams back, so the mouse doesn't twitch with each beam step.
 * Facing down (90°) before the first move.
 */
function headingAt(ev: TrackEvents, i: number, g: ArenaGeom): number {
  const at = (k: number) => [g.px(ev.x[k]) + jitter(k, 1) * g.cell, g.px(ev.y[k]) + jitter(k, 2) * g.cell]
  const [x, y] = at(i)
  let seen = 0
  let from = -1
  for (let k = i - 1; k >= 0 && seen < 3; k--) {
    if (ev.rear[k] || (ev.x[k] === ev.x[i] && ev.y[k] === ev.y[i])) continue
    from = k
    seen++
  }
  if (from < 0) return 90
  const [fx, fy] = at(from)
  return (Math.atan2(y - fy, x - fx) * 180) / Math.PI
}

// ---------------------------------------------------------------------------
// One animal: track and replay

function OneAnimal({
  runs,
  set,
  theme,
  time,
  events,
  timeCol,
}: {
  runs: TrackRunInfo[]
  set: TrackSet
  theme: ChartTheme
  time: string
  events: (rec: string) => TrackEvents | null
  timeCol: string | null
}) {
  const animals = useMemo(() => {
    const m = new Map<string, TrackRunInfo[]>()
    for (const r of runs) m.set(r.subject, [...(m.get(r.subject) ?? []), r])
    for (const list of m.values()) list.sort((a, b) => a.date.localeCompare(b.date) || naturalCompare(a.recording, b.recording))
    return [...m].sort((a, b) => naturalCompare(a[1][0].group, b[1][0].group) || naturalCompare(a[0], b[0]))
  }, [runs])
  const firstAtTime = runs.find((r) => !r.excluded && (!timeCol || r.time === time)) ?? runs[0]
  const [animal, setAnimal] = useState(firstAtTime.subject)
  const list = animals.find(([a]) => a === animal)?.[1] ?? animals[0][1]
  const [recPick, setRec] = useState<string | null>(null)
  const run = list.find((r) => r.recording === recPick) ?? list.find((r) => !timeCol || r.time === time) ?? list[0]
  const tr = set.runs[run.recording]
  const ev = events(run.recording)
  const end = tr.secs * 10
  // Replay position and state belong to one run: another run starts with its whole track shown.
  const [posState, setPosState] = useState<{ rec: string; v: number } | null>(null)
  const [playingRec, setPlayingRec] = useState<string | null>(null)
  const pos = posState && posState.rec === run.recording ? posState.v : end
  const setPos = (v: number) => setPosState({ rec: run.recording, v })
  const playing = playingRec === run.recording
  const setPlaying = (on: boolean) => setPlayingRec(on ? run.recording : null)
  const [speed, setSpeed] = useState(30)
  const [byInterval, setByInterval] = useState(true)
  const [showRear, setShowRear] = useState(true)
  const [marker, setMarker] = useState<'mouse' | 'circle'>('mouse')
  const ref = useRef<SVGSVGElement>(null)
  const [box, width] = useWidth<HTMLDivElement>(480)

  const rec = run.recording
  useEffect(() => {
    if (!playing) return
    // The position this render shows; the loop advances its own copy.
    let v = pos
    let last = performance.now()
    let raf = 0
    const step = (now: number) => {
      v = Math.min(end, v + ((now - last) / 1000) * speed * 10)
      last = now
      setPosState({ rec, v })
      if (v >= end) setPlayingRec(null)
      else raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // pos is read once when playing starts (or the speed changes), not on every frame
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, end, rec])

  if (!ev) return null
  const size = Math.max(220, Math.min(460, width))
  const g = geom(size, set)
  const intervalTenths = tr.intervalSecs * 10
  const segs = trackSegments(ev, g, byInterval ? intervalTenths : 1e9, pos)
  const nIntervals = Math.max(1, Math.round(tr.secs / tr.intervalSecs))
  // Rearing takes a colour no interval uses (intervals take the first four).
  const rearColor = theme.series[6]
  const intervalColor = (k: number) => (byInterval ? seriesColor(theme, Math.min(k, theme.series.length - 1)) : theme.text)
  let cur = -1
  for (let i = 0; i < ev.t.length && ev.t[i] <= pos; i++) if (!ev.rear[i]) cur = i
  const rears = showRear ? Array.from({ length: ev.t.length }, (_, i) => i).filter((i) => ev.rear[i] && ev.t[i] <= pos) : []
  const legend = [
    ...(byInterval
      ? Array.from({ length: nIntervals }, (_, k) => ({ label: `${(k * tr.intervalSecs) / 60}–${((k + 1) * tr.intervalSecs) / 60} min`, color: intervalColor(k) }))
      : [{ label: 'Track', color: theme.text }]),
    ...(showRear ? [{ label: 'Rearing', color: rearColor }] : []),
  ]
  const label = `${run.subject} · ${run.group} · ${run.date}${run.time && run.time !== run.date ? ` (${run.time})` : ''}`

  return (
    <div className="card" ref={box}>
      <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem' }}>One animal's track</h3>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <label className="field" style={{ margin: 0, minWidth: 0, maxWidth: '100%' }}>
          Animal
          <select
            value={animal}
            onChange={(e) => {
              setAnimal(e.target.value)
              setRec(null)
            }}
            style={{ width: 'auto', maxWidth: '100%' }}
          >
            {animals.map(([a, l]) => (
              <option key={a} value={a}>
                {a} · {l[0].group}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ margin: 0, minWidth: 0, maxWidth: '100%' }}>
          Run
          <select value={run.recording} onChange={(e) => setRec(e.target.value)} style={{ width: '100%', maxWidth: '100%' }}>
            {list.map((r) => (
              <option key={r.recording} value={r.recording}>
                {r.date}
                {r.time && r.time !== r.date ? ` (${r.time})` : ''} · {r.recording}
                {r.excluded ? ' · excluded' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <label className="check">
          <input type="checkbox" checked={byInterval} onChange={(e) => setByInterval(e.target.checked)} />
          <span>Colour by {tr.intervalSecs / 60}-min interval</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={showRear} onChange={(e) => setShowRear(e.target.checked)} />
          <span>Show rearing</span>
        </label>
        <span className="row" role="radiogroup" aria-label="Replay marker" style={{ gap: 12 }}>
          <span className="small muted">Replay marker:</span>
          {(['mouse', 'circle'] as const).map((m) => (
            <label key={m} className="check">
              <input type="radio" name="track-marker" checked={marker === m} onChange={() => setMarker(m)} />
              <span>{m === 'mouse' ? 'Mouse' : 'Circle'}</span>
            </label>
          ))}
        </span>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <button
          className="btn sm primary"
          onClick={() => {
            if (pos >= end) setPos(0)
            setPlaying(!playing)
          }}
        >
          {playing ? 'Pause' : pos >= end ? 'Replay' : 'Play'}
        </button>
        <select value={speed} onChange={(e) => setSpeed(+e.target.value)} aria-label="Replay speed" style={{ width: 'auto' }}>
          {[1, 10, 30, 60, 120].map((s) => (
            <option key={s} value={s}>
              {s}× speed
            </option>
          ))}
        </select>
        <input
          type="range"
          min={0}
          max={end}
          step={10}
          value={Math.round(pos)}
          onChange={(e) => {
            setPlaying(false)
            setPos(+e.target.value)
          }}
          aria-label="Time in the session"
          style={{ flex: '1 1 160px', minWidth: 120 }}
        />
        <span className="small" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {clock(pos)} / {clock(end)}
        </span>
      </div>
      <Legend items={legend} />
      <div className="row" style={{ justifyContent: 'space-between', margin: '6px 0 4px' }}>
        <span className="small muted">{label}</span>
        <ChartActions svg={ref} name={`Track ${run.subject} ${run.date}`} />
      </div>
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Track of ${run.subject}, ${run.date}`}
        data-chart-name={`Track: ${label}`}
        data-chart-note={`Beam position at each move and rearing (${set.beamCm} cm beams), ${clock(0)}–${clock(pos)} of the session; dashed square = centre zone.`}
        data-legend={JSON.stringify(legend)}
        xmlns="http://www.w3.org/2000/svg"
        fontFamily={FONT}
      >
        <rect width={size} height={size} fill={theme.surface} />
        {segs.map((s, k) => (
          <polyline key={k} points={s.pts.join(' ')} fill="none" stroke={intervalColor(s.interval)} strokeWidth={1} strokeLinejoin="round" strokeOpacity={0.85} />
        ))}
        {rears.map((i) => (
          <circle key={i} cx={g.px(ev.x[i]) + jitter(i, 3) * g.cell} cy={g.px(ev.y[i]) + jitter(i, 4) * g.cell} r={2.2} fill={rearColor} />
        ))}
        <ArenaFrame g={g} set={set} theme={theme} />
        {cur >= 0 && pos < end && marker === 'circle' && (
          <circle cx={g.px(ev.x[cur]) + jitter(cur, 1) * g.cell} cy={g.px(ev.y[cur]) + jitter(cur, 2) * g.cell} r={Math.max(5, g.cell * 0.45)} fill={theme.text} stroke={theme.surface} strokeWidth={2} />
        )}
        {cur >= 0 && pos < end && marker === 'mouse' && (
          <MouseIcon
            x={g.px(ev.x[cur]) + jitter(cur, 1) * g.cell}
            y={g.px(ev.y[cur]) + jitter(cur, 2) * g.cell}
            heading={headingAt(ev, cur, g)}
            length={Math.max(24, g.cell * 2.6)}
            ink={theme.text}
            fill={theme.surface}
          />
        )}
      </svg>
    </div>
  )
}

/** SVG / PNG buttons for a chart that is not in a ChartCard. */
function ChartActions({ svg, name }: { svg: RefObject<SVGSVGElement | null>; name: string }) {
  return (
    <span className="chart-actions">
      <button className="btn sm" onClick={() => downloadSvg(svg.current, safeName(name))} aria-label="Download the track as SVG">
        SVG
      </button>
      <button className="btn sm" onClick={() => downloadPng(svg.current, safeName(name))} aria-label="Download the track as PNG">
        PNG
      </button>
    </span>
  )
}
