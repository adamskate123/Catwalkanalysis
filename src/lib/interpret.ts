// Maps statistically supported gait changes onto recognisable phenotype
// "domains". This is pattern matching to help orient the reader, not a
// diagnosis: every statement is phrased as "consistent with".

import type { AnalysisConfig, Comparison, MeasureResult, TimeResults } from './analysis'
import { formatP, primaryComparison } from './analysis'
import { program } from '../programs'

export type Where = 'run' | 'front' | 'hind' | 'any' | 'asymF' | 'asymH' | 'hindFront'

export interface SignatureItem {
  param: string
  where: Where
  /** +1 increase expected, -1 decrease expected, 0 either direction (magnitude) */
  dir: 1 | -1 | 0
  /**
   * A marker specific to this pattern. When a pattern has key markers, it is
   * reported only if at least one of them changed, so that shared, non-specific
   * markers (e.g. slower swing) cannot report it on their own.
   */
  key?: boolean
}

export interface Domain {
  id: string
  title: string
  summary: string
  conditions: string
  /** Plain-language interpretation of what the pattern may reflect biologically. */
  meaning: string
  /** Complementary tests that would confirm or refine the interpretation. */
  followUp: string[]
  items: SignatureItem[]
}


export interface Evidence {
  result: MeasureResult
  comparison: Comparison
  supports: boolean
}

export interface DomainFinding {
  domain: Domain
  evidence: Evidence[]
  supporting: Evidence[]
  available: number
  score: number
  side?: 'left' | 'right'
}

function whereMatches(r: MeasureResult, where: Where): boolean {
  const m = r.measure
  switch (where) {
    case 'run':
      return !m.paw && !m.derived
    case 'front':
      return m.derived === 'FRONT'
    case 'hind':
      return m.derived === 'HIND'
    case 'any':
      return m.derived === 'FRONT' || m.derived === 'HIND' || (!m.paw && !m.derived && !m.def.perPaw)
    case 'asymF':
      return m.derived === 'ASYM_F'
    case 'asymH':
      return m.derived === 'ASYM_H'
    case 'hindFront':
      return m.derived === 'HF'
  }
}

export interface InterpretOptions {
  alpha: number
  minEffect: number
  useFdr: boolean
}

export const DEFAULT_INTERPRET: InterpretOptions = { alpha: 0.05, minEffect: 0.8, useFdr: false }

export function isSignificant(r: MeasureResult, c: Comparison, opt: InterpretOptions): boolean {
  const p = c.pAdj
  if (!(p < opt.alpha)) return false
  if (opt.useFdr && !(r.q < opt.alpha)) return false
  return Math.abs(c.g) >= opt.minEffect
}

export function interpret(tr: TimeResults, cfg: AnalysisConfig, opt: InterpretOptions = DEFAULT_INTERPRET): DomainFinding[] {
  const findings: DomainFinding[] = []
  for (const domain of program().domains) {
    const evidence: Evidence[] = []
    for (const item of domain.items) {
      for (const r of tr.results) {
        if (r.measure.def.id !== item.param || !whereMatches(r, item.where)) continue
        const c = primaryComparison(r, cfg)
        if (!c || !Number.isFinite(c.g)) continue
        const dirOk = item.dir === 0 ? true : Math.sign(c.g) === item.dir
        evidence.push({ result: r, comparison: c, supports: dirOk && isSignificant(r, c, opt) })
      }
    }
    if (evidence.length === 0) continue
    const supporting = evidence.filter((e) => e.supports)
    const available = new Set(evidence.map((e) => e.result.measure.def.id + e.result.measure.derived)).size
    const supportedParams = new Set(supporting.map((e) => e.result.measure.def.id + e.result.measure.derived)).size
    const finding: DomainFinding = {
      domain,
      evidence,
      supporting,
      available,
      score: available ? supportedParams / available : 0,
    }
    if (domain.id === 'lateralised' && supporting.length) {
      // Positive asymmetry index = left > right, so the right side is reduced.
      const s = supporting.reduce((acc, e) => acc + Math.sign(e.comparison.diff), 0)
      if (s !== 0) finding.side = s > 0 ? 'right' : 'left'
    }
    findings.push(finding)
  }
  return findings.sort((a, b) => b.supporting.length - a.supporting.length || b.score - a.score)
}

/**
 * A pattern is reported when at least two of its markers changed, or all of them
 * when fewer than two were measured (e.g. a rotarod file with latency only).
 */
export function isReported(f: DomainFinding): boolean {
  return isShown(f) && f.supporting.length >= Math.min(2, f.available)
}

/**
 * A pattern is shown at all when at least one marker changed and, for a pattern
 * with key markers, at least one of those did.
 */
export function isShown(f: DomainFinding): boolean {
  if (!f.supporting.length) return false
  const keys = f.domain.items.filter((i) => i.key)
  return !keys.length || f.supporting.some((e) => keys.some((i) => i.param === e.result.measure.def.id && whereMatches(e.result, i.where)))
}

export function describeEvidence(e: Evidence): string {
  const arrow = e.comparison.diff > 0 ? '↑' : '↓'
  const pct = Number.isFinite(e.comparison.diffPct) && !e.result.measure.derived?.startsWith('ASYM') ? ` (${e.comparison.diffPct > 0 ? '+' : ''}${e.comparison.diffPct.toFixed(0)}%)` : ''
  return `${e.result.measure.label} ${arrow}${pct}, g = ${e.comparison.g.toFixed(2)}, p = ${formatP(e.comparison.pAdj)}`
}

export interface Change {
  result: MeasureResult
  comparison: Comparison
}

/**
 * Parameters that changed versus the control group at the current thresholds,
 * keyed by measure key. When several groups are compared with control, the
 * comparison with the smallest adjusted p is kept.
 */
export function changedMeasures(tr: TimeResults | undefined, cfg: AnalysisConfig, opt: InterpretOptions): Map<string, Change> {
  const out = new Map<string, Change>()
  if (!tr) return out
  for (const r of tr.results) {
    const vsControl = r.comparisons.filter((c) => !cfg.controlGroup || c.reference === cfg.controlGroup)
    let best: Comparison | undefined
    for (const c of vsControl) if (isSignificant(r, c, opt) && (!best || c.pAdj < best.pAdj)) best = c
    if (best) out.set(r.measure.key, { result: r, comparison: best })
  }
  return out
}
