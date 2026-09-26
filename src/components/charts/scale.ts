export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return []
  if (min === max) {
    const d = Math.abs(min) * 0.1 || 1
    min -= d
    max += d
  }
  const span = max - min
  const step0 = span / count
  const mag = 10 ** Math.floor(Math.log10(step0))
  const err = step0 / mag
  const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag
  const start = Math.floor(min / step) * step
  const end = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = start; v <= end + step / 2; v += step) ticks.push(+v.toFixed(12))
  return ticks
}

export function linear(d0: number, d1: number, r0: number, r1: number) {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0)
  return (v: number) => r0 + (v - d0) * k
}

export function fmtTick(v: number): string {
  const a = Math.abs(v)
  if (a === 0) return '0'
  if (a >= 1000) return v.toLocaleString()
  if (a >= 10) return String(+v.toFixed(1))
  if (a >= 1) return String(+v.toFixed(2))
  return String(+v.toPrecision(2))
}

/** Stable pseudo-jitter in [-1, 1] so dots don't move between renders. */
export function jitter(i: number, n: number): number {
  if (n <= 1) return 0
  // spread evenly then interleave for a beeswarm-like look
  const pos = ((i * 0.618034) % 1) * 2 - 1
  return pos
}
