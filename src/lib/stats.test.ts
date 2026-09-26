import { describe, expect, it } from 'vitest'
import {
  benjaminiHochberg,
  chiSqUpperP,
  fUpperP,
  hedgesG,
  holm,
  kruskalWallis,
  mannWhitney,
  normalCdf,
  oneWayAnova,
  pooledWithinSlope,
  tTwoSidedP,
  welchT,
} from './stats'

// Reference values computed with SciPy 1.x.
const a = [5.1, 4.9, 6.2, 5.8, 6.0, 5.5, 5.3]
const b = [4.1, 4.5, 3.9, 4.8, 5.0, 4.2]
const c = [5.0, 5.2, 4.7, 5.9, 5.4]

describe('distribution functions', () => {
  it('matches scipy tail probabilities', () => {
    expect(tTwoSidedP(2.5, 7)).toBeCloseTo(0.04099221858575289, 9)
    expect(fUpperP(3.2, 2, 15)).toBeCloseTo(0.06959549735275734, 9)
    expect(chiSqUpperP(7.1, 3)).toBeCloseTo(0.06877781936579971, 9)
    expect(normalCdf(1.96)).toBeCloseTo(0.9750021048517795, 9)
    expect(normalCdf(-1.96)).toBeCloseTo(1 - 0.9750021048517795, 9)
  })
})

describe('tests', () => {
  it('Welch t', () => {
    const r = welchT(a, b)
    expect(r.statistic).toBeCloseTo(4.484470081304182, 9)
    expect(r.df as number).toBeCloseTo(10.971125940053607, 9)
    expect(r.p).toBeCloseTo(0.0009305813608129476, 9)
  })

  it('Mann–Whitney exact', () => {
    const r = mannWhitney(a, b)
    expect(r.statistic).toBe(41)
    expect(r.p).toBeCloseTo(0.002331002331002331, 9)
  })

  it('Mann–Whitney with ties (normal approximation, continuity corrected)', () => {
    const r = mannWhitney([1, 2, 2, 3, 4, 5, 5, 6], [3, 3, 4, 6, 7, 8, 8, 9])
    expect(r.statistic).toBe(13)
    expect(r.p).toBeCloseTo(0.05047987865939703, 6)
  })

  it('one-way ANOVA', () => {
    const r = oneWayAnova([a, b, c])
    expect(r.statistic).toBeCloseTo(10.333066859347856, 9)
    expect(r.p).toBeCloseTo(0.0015092604507422785, 9)
  })

  it('Kruskal–Wallis', () => {
    const r = kruskalWallis([a, b, c])
    expect(r.statistic).toBeCloseTo(9.959860783156246, 9)
    expect(r.p).toBeCloseTo(0.006874541066796706, 9)
  })

  it('Hedges g', () => {
    // pooled SD by hand
    const g = hedgesG(a, b)
    expect(g).toBeGreaterThan(2)
    expect(hedgesG(b, a)).toBeCloseTo(-g, 12)
  })
})

describe('multiplicity', () => {
  it('BH matches scipy', () => {
    const q = benjaminiHochberg([0.01, 0.04, 0.03, 0.2, 0.005])
    ;[0.025, 0.05, 0.05, 0.2, 0.025].forEach((v, i) => expect(q[i]).toBeCloseTo(v, 12))
  })
  it('BH keeps NaN', () => {
    const q = benjaminiHochberg([NaN, 0.01])
    expect(q[0]).toBeNaN()
    expect(q[1]).toBeCloseTo(0.01)
  })
  it('Holm', () => {
    const q = holm([0.01, 0.04, 0.03])
    expect(q).toEqual([0.03, 0.06, 0.06])
  })
})

describe('pooled slope', () => {
  it('ignores between-group offset in x', () => {
    const pts = [
      ...[1, 2, 3, 4].map((x) => ({ x, y: 2 * x, g: 'A' })),
      ...[11, 12, 13, 14].map((x) => ({ x, y: 2 * x - 100, g: 'B' })),
    ]
    expect(pooledWithinSlope(pts)).toBeCloseTo(2, 12)
  })
})
