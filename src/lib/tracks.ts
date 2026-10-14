// Movement tracks from a photobeam arena (SDI PAS): the animal's beam position at
// every ambulatory beam break and every rearing, kept compactly with the
// experiment so tracks can be redrawn and replayed, and turned into time-in-place
// (occupancy) maps for groups. Positions are beam numbers (1…16), 2.5 cm apart;
// times are 0.1 s from the start of the session.

export interface TrackRun {
  /** Session length (s) and interval length (s). */
  secs: number
  intervalSecs: number
  /** Number of events and the packed events (base64; see packEvents). */
  n: number
  data: string
}

export interface TrackSet {
  version: 1
  beamCm: number
  xBeams: number
  yBeams: number
  /** Beam positions ("x,y") of the centre zone. */
  centre: string[]
  /** By recording ("<session> · chamber <n>"). */
  runs: Record<string, TrackRun>
}

/** A run's events, unpacked: times (0.1 s), beam positions, and whether each is a rearing. */
export interface TrackEvents {
  t: Int32Array
  x: Uint8Array
  y: Uint8Array
  rear: Uint8Array
}

// ---------------------------------------------------------------------------
// Packing: 4 bytes per event (time step in 0.1 s as uint16, x with a rearing flag, y)

const toBase64 = (bytes: Uint8Array): string => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
const fromBase64 = (b64: string): Uint8Array => {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

/** Packs events given as [t, x, y, isRearing] in time order. */
export function packEvents(events: [number, number, number, boolean][]): { n: number; data: string } {
  const bytes = new Uint8Array(events.length * 4)
  let last = 0
  events.forEach(([t, x, y, rear], i) => {
    // Gaps longer than 109 min are capped (a session is far shorter).
    const dt = Math.max(0, Math.min(0xffff, Math.round(t - last)))
    last += dt
    bytes[i * 4] = dt & 0xff
    bytes[i * 4 + 1] = dt >> 8
    bytes[i * 4 + 2] = (x & 0x3f) | (rear ? 0x80 : 0)
    bytes[i * 4 + 3] = y & 0x3f
  })
  return { n: events.length, data: toBase64(bytes) }
}

export function unpackEvents(run: TrackRun): TrackEvents {
  const bytes = fromBase64(run.data)
  const n = Math.floor(bytes.length / 4)
  const t = new Int32Array(n)
  const x = new Uint8Array(n)
  const y = new Uint8Array(n)
  const rear = new Uint8Array(n)
  let now = 0
  for (let i = 0; i < n; i++) {
    now += bytes[i * 4] | (bytes[i * 4 + 1] << 8)
    t[i] = now
    x[i] = bytes[i * 4 + 2] & 0x3f
    rear[i] = bytes[i * 4 + 2] & 0x80 ? 1 : 0
    y[i] = bytes[i * 4 + 3]
  }
  return { t, x, y, rear }
}

/** Combines the track sets of several files; a later file's run replaces an earlier one with the same recording. */
export function mergeTrackSets(sets: (TrackSet | undefined)[]): TrackSet | undefined {
  const list = sets.filter((s): s is TrackSet => Boolean(s))
  if (!list.length) return undefined
  return { ...list[list.length - 1], runs: Object.assign({}, ...list.map((s) => s.runs)) }
}

// ---------------------------------------------------------------------------
// Time in place

/**
 * Seconds spent at each beam position (row-major, y then x; index (y-1)·xBeams + (x-1)),
 * from each movement to the next, the last position held to the end of the session.
 * `until` (0.1 s) limits it to the start of the session.
 */
export function occupancy(ev: TrackEvents, set: Pick<TrackSet, 'xBeams' | 'yBeams'>, secs: number, until = Infinity): Float64Array {
  const occ = new Float64Array(set.xBeams * set.yBeams)
  const end = Math.min(until, secs * 10)
  let cur = -1
  let since = 0
  for (let i = 0; i < ev.t.length && ev.t[i] <= end; i++) {
    if (ev.rear[i]) continue
    if (cur >= 0) occ[cur] += (ev.t[i] - since) / 10
    cur = (ev.y[i] - 1) * set.xBeams + (ev.x[i] - 1)
    since = ev.t[i]
  }
  if (cur >= 0 && end > since) occ[cur] += (end - since) / 10
  return occ
}

/** Percentage of time at each position, averaged over animals (each animal counts once). */
export function groupOccupancy(maps: Float64Array[]): Float64Array | null {
  if (!maps.length) return null
  const out = new Float64Array(maps[0].length)
  let used = 0
  for (const m of maps) {
    const total = m.reduce((a, b) => a + b, 0)
    if (!(total > 0)) continue
    used++
    for (let i = 0; i < m.length; i++) out[i] += (m[i] / total) * 100
  }
  if (!used) return null
  for (let i = 0; i < out.length; i++) out[i] /= used
  return out
}
