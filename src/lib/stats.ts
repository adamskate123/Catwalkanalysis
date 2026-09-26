// Small, dependency-free statistics toolkit used by the analysis engine.
// Distribution functions follow the standard continued-fraction / series
// formulations (Numerical Recipes, 3rd ed.) and are checked in stats.test.ts.

export function finite(xs: readonly (number | null | undefined)[]): number[] {
  return xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
}

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) return NaN
  let s = 0
  for (const x of xs) s += x
  return s / xs.length
}

export function variance(xs: readonly number[]): number {
  const n = xs.length
  if (n < 2) return NaN
  const m = mean(xs)
  let s = 0
  for (const x of xs) s += (x - m) ** 2
  return s / (n - 1)
}

export function sd(xs: readonly number[]): number {
  return Math.sqrt(variance(xs))
}

export function sem(xs: readonly number[]): number {
  return xs.length < 2 ? NaN : sd(xs) / Math.sqrt(xs.length)
}

export function median(xs: readonly number[]): number {
  if (xs.length === 0) return NaN
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export interface Describe {
  n: number
  mean: number
  sd: number
  sem: number
  median: number
  min: number
  max: number
}

export function describe(xs: readonly number[]): Describe {
  return {
    n: xs.length,
    mean: mean(xs),
    sd: sd(xs),
    sem: sem(xs),
    median: median(xs),
    min: xs.length ? Math.min(...xs) : NaN,
    max: xs.length ? Math.max(...xs) : NaN,
  }
}

// ---------------------------------------------------------------------------
// Special functions

// Published Lanczos coefficients (Numerical Recipes); extra digits are intentional.
/* oxlint-disable no-loss-of-precision */
const LANCZOS = [
  57.1562356658629235, -59.5979603554754912, 14.1360979747417471, -0.491913816097620199,
  0.339946499848118887e-4, 0.465236289270485756e-4, -0.983744753048795646e-4,
  0.158088703224912494e-3, -0.210264441724104883e-3, 0.217439618115212643e-3,
  -0.164318106536763890e-3, 0.844182239838527433e-4, -0.261908384015814087e-4,
  0.368991826595316234e-5,
]
/* oxlint-enable no-loss-of-precision */

export function lnGamma(xx: number): number {
  let x = xx
  let y = xx
  let tmp = x + 5.2421875
  tmp = (x + 0.5) * Math.log(tmp) - tmp
  // oxlint-disable-next-line no-loss-of-precision
  let ser = 0.999999999999997092
  for (const c of LANCZOS) ser += c / ++y
  // oxlint-disable-next-line no-loss-of-precision
  return tmp + Math.log((2.5066282746310005 * ser) / x)
}

function betacf(a: number, b: number, x: number): number {
  const FPMIN = 1e-300
  const EPS = 1e-15
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m < 10000; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

/** Regularized incomplete beta I_x(a, b). */
export function incBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a
  return 1 - (bt * betacf(b, a, 1 - x)) / b
}

/** Regularized lower incomplete gamma P(a, x). */
export function incGammaP(a: number, x: number): number {
  if (x <= 0) return 0
  const gln = lnGamma(a)
  if (x < a + 1) {
    let ap = a
    let sum = 1 / a
    let del = sum
    for (let n = 0; n < 10000; n++) {
      ap += 1
      del *= x / ap
      sum += del
      if (Math.abs(del) < Math.abs(sum) * 1e-15) break
    }
    return sum * Math.exp(-x + a * Math.log(x) - gln)
  }
  const FPMIN = 1e-300
  let b = x + 1 - a
  let c = 1 / FPMIN
  let d = 1 / b
  let h = d
  for (let i = 1; i < 10000; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = b + an / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-15) break
  }
  return 1 - Math.exp(-x + a * Math.log(x) - gln) * h
}

export function normalCdf(z: number): number {
  // erfc-based, accurate to ~1e-7 is not enough for small p; use incGamma form.
  const p = 0.5 * (1 + Math.sign(z) * incGammaP(0.5, (z * z) / 2))
  return p
}

/** Two-sided p for a Student t statistic. */
export function tTwoSidedP(t: number, df: number): number {
  if (!Number.isFinite(t) || !(df > 0)) return NaN
  return incBeta(df / (df + t * t), df / 2, 0.5)
}

/** Upper-tail p for an F statistic. */
export function fUpperP(f: number, d1: number, d2: number): number {
  if (!Number.isFinite(f) || f < 0) return NaN
  return incBeta(d2 / (d2 + d1 * f), d2 / 2, d1 / 2)
}

export function chiSqUpperP(x: number, k: number): number {
  if (!Number.isFinite(x) || x < 0) return NaN
  return 1 - incGammaP(k / 2, x / 2)
}

// ---------------------------------------------------------------------------
// Tests

export interface TestResult {
  test: string
  statistic: number
  df?: number | [number, number]
  p: number
}

/** Welch's unequal-variance t-test (two-sided). */
export function welchT(a: readonly number[], b: readonly number[]): TestResult {
  const na = a.length
  const nb = b.length
  if (na < 2 || nb < 2) return { test: 'Welch t', statistic: NaN, p: NaN }
  const va = variance(a) / na
  const vb = variance(b) / nb
  const se = Math.sqrt(va + vb)
  if (se === 0) return { test: 'Welch t', statistic: NaN, p: NaN }
  const t = (mean(a) - mean(b)) / se
  const df = (va + vb) ** 2 / (va ** 2 / (na - 1) + vb ** 2 / (nb - 1))
  return { test: 'Welch t', statistic: t, df, p: tTwoSidedP(t, df) }
}

function rankAll(values: readonly number[]): { ranks: number[]; tieTerm: number } {
  const idx = values.map((v, i) => [v, i] as const).sort((x, y) => x[0] - y[0])
  const ranks = new Array<number>(values.length)
  let tieTerm = 0
  for (let i = 0; i < idx.length; ) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++
    const r = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) ranks[idx[k][1]] = r
    const t = j - i + 1
    if (t > 1) tieTerm += t ** 3 - t
    i = j + 1
  }
  return { ranks, tieTerm }
}

/** Exact null distribution of U (no ties) via recursive counting. */
function exactMannWhitneyP(u: number, n1: number, n2: number): number {
  // counts[i][j][u] = number of arrangements; use 2D rolling DP over u.
  const maxU = n1 * n2
  // f(i, j) distribution vector
  let prev: number[][] = []
  for (let j = 0; j <= n2; j++) {
    const v = new Array(maxU + 1).fill(0)
    v[0] = 1
    prev[j] = v
  }
  for (let i = 1; i <= n1; i++) {
    const cur: number[][] = []
    const v0 = new Array(maxU + 1).fill(0)
    v0[0] = 1
    cur[0] = v0
    for (let j = 1; j <= n2; j++) {
      const v = new Array(maxU + 1).fill(0)
      // f(i,j,u) = f(i-1,j,u-j) + f(i,j-1,u)
      for (let k = 0; k <= maxU; k++) {
        v[k] = (k - j >= 0 ? prev[j][k - j] : 0) + cur[j - 1][k]
      }
      cur[j] = v
    }
    prev = cur
  }
  const dist = prev[n2]
  const total = dist.reduce((s, x) => s + x, 0)
  const uLow = Math.min(u, maxU - u)
  let cum = 0
  for (let k = 0; k <= Math.floor(uLow + 1e-9); k++) cum += dist[k]
  return Math.min(1, (2 * cum) / total)
}

/** Mann–Whitney U (Wilcoxon rank-sum), two-sided. Exact when small and tie-free. */
export function mannWhitney(a: readonly number[], b: readonly number[]): TestResult {
  const n1 = a.length
  const n2 = b.length
  if (n1 < 1 || n2 < 1) return { test: 'Mann–Whitney U', statistic: NaN, p: NaN }
  const { ranks, tieTerm } = rankAll([...a, ...b])
  let r1 = 0
  for (let i = 0; i < n1; i++) r1 += ranks[i]
  const u1 = r1 - (n1 * (n1 + 1)) / 2
  if (tieTerm === 0 && n1 + n2 <= 40) {
    return { test: 'Mann–Whitney U (exact)', statistic: u1, p: exactMannWhitneyP(u1, n1, n2) }
  }
  const n = n1 + n2
  const mu = (n1 * n2) / 2
  const sigma = Math.sqrt(((n1 * n2) / 12) * (n + 1 - tieTerm / (n * (n - 1))))
  if (sigma === 0) return { test: 'Mann–Whitney U', statistic: u1, p: 1 }
  const z = (Math.abs(u1 - mu) - 0.5) / sigma
  return { test: 'Mann–Whitney U', statistic: u1, p: Math.min(1, 2 * (1 - normalCdf(Math.max(z, 0)))) }
}

/** Classic one-way ANOVA. */
export function oneWayAnova(groups: readonly (readonly number[])[]): TestResult {
  const gs = groups.filter((g) => g.length > 0)
  const k = gs.length
  const N = gs.reduce((s, g) => s + g.length, 0)
  if (k < 2 || N - k < 1) return { test: 'One-way ANOVA', statistic: NaN, p: NaN }
  const grand = mean(gs.flat())
  let ssb = 0
  let ssw = 0
  for (const g of gs) {
    const m = mean(g)
    ssb += g.length * (m - grand) ** 2
    for (const x of g) ssw += (x - m) ** 2
  }
  const d1 = k - 1
  const d2 = N - k
  if (ssw === 0) return { test: 'One-way ANOVA', statistic: NaN, df: [d1, d2], p: NaN }
  const f = ssb / d1 / (ssw / d2)
  return { test: 'One-way ANOVA', statistic: f, df: [d1, d2], p: fUpperP(f, d1, d2) }
}

export function kruskalWallis(groups: readonly (readonly number[])[]): TestResult {
  const gs = groups.filter((g) => g.length > 0)
  const k = gs.length
  const all = gs.flat()
  const N = all.length
  if (k < 2 || N < 3) return { test: 'Kruskal–Wallis', statistic: NaN, p: NaN }
  const { ranks, tieTerm } = rankAll(all)
  let h = 0
  let off = 0
  for (const g of gs) {
    let r = 0
    for (let i = 0; i < g.length; i++) r += ranks[off + i]
    off += g.length
    h += (r * r) / g.length
  }
  h = (12 / (N * (N + 1))) * h - 3 * (N + 1)
  const corr = 1 - tieTerm / (N ** 3 - N)
  if (corr > 0) h /= corr
  return { test: 'Kruskal–Wallis', statistic: h, df: k - 1, p: chiSqUpperP(h, k - 1) }
}

/** Hedges' g (bias-corrected standardized mean difference), a relative to b. */
export function hedgesG(a: readonly number[], b: readonly number[]): number {
  const na = a.length
  const nb = b.length
  if (na < 2 || nb < 2) return NaN
  const sp = Math.sqrt(((na - 1) * variance(a) + (nb - 1) * variance(b)) / (na + nb - 2))
  if (!(sp > 0)) return NaN
  const d = (mean(a) - mean(b)) / sp
  const J = 1 - 3 / (4 * (na + nb) - 9)
  return d * J
}

/** Benjamini–Hochberg adjusted q-values; NaN inputs stay NaN. */
export function benjaminiHochberg(ps: readonly number[]): number[] {
  const idx = ps.map((p, i) => [p, i] as const).filter(([p]) => Number.isFinite(p))
  const m = idx.length
  const q = new Array<number>(ps.length).fill(NaN)
  idx.sort((x, y) => x[0] - y[0])
  let prev = 1
  for (let r = m - 1; r >= 0; r--) {
    const [p, i] = idx[r]
    const v = Math.min(prev, (p * m) / (r + 1))
    q[i] = v
    prev = v
  }
  return q
}

/** Holm step-down adjustment. */
export function holm(ps: readonly number[]): number[] {
  const idx = ps.map((p, i) => [p, i] as const).filter(([p]) => Number.isFinite(p))
  const m = idx.length
  const out = new Array<number>(ps.length).fill(NaN)
  idx.sort((x, y) => x[0] - y[0])
  let prev = 0
  idx.forEach(([p, i], r) => {
    const v = Math.min(1, Math.max(prev, (m - r) * p))
    out[i] = v
    prev = v
  })
  return out
}

/** Ordinary least squares slope/intercept/r². */
export function linearFit(xs: readonly number[], ys: readonly number[]): { slope: number; intercept: number; r2: number } {
  const n = Math.min(xs.length, ys.length)
  if (n < 3) return { slope: NaN, intercept: NaN, r2: NaN }
  const mx = mean(xs)
  const my = mean(ys)
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
    syy += (ys[i] - my) ** 2
  }
  if (sxx === 0) return { slope: NaN, intercept: NaN, r2: NaN }
  const slope = sxy / sxx
  return { slope, intercept: my - slope * mx, r2: syy === 0 ? NaN : (sxy * sxy) / (sxx * syy) }
}

/**
 * Pooled within-group slope of y on x (ANCOVA common slope). Groups are
 * centred separately, so between-group differences in x don't leak into the
 * slope estimate.
 */
export function pooledWithinSlope(points: readonly { x: number; y: number; g: string }[]): number {
  const byG = new Map<string, { x: number; y: number }[]>()
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    const arr = byG.get(p.g) ?? []
    arr.push(p)
    byG.set(p.g, arr)
  }
  let sxy = 0
  let sxx = 0
  for (const arr of byG.values()) {
    if (arr.length < 2) continue
    const mx = mean(arr.map((p) => p.x))
    const my = mean(arr.map((p) => p.y))
    for (const p of arr) {
      sxy += (p.x - mx) * (p.y - my)
      sxx += (p.x - mx) ** 2
    }
  }
  return sxx > 0 ? sxy / sxx : NaN
}
