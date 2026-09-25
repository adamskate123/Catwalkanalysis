import { useEffect, useState } from 'react'

// Chart colours are resolved in JS (not CSS variables) so exported SVG/PNG
// files carry concrete colours. Values follow a CVD-validated categorical
// order; the dark column is the same hues stepped for a dark surface.

export interface ChartTheme {
  mode: 'light' | 'dark'
  surface: string
  text: string
  text2: string
  muted: string
  grid: string
  axis: string
  series: string[]
  divNeg: string[]
  divPos: string[]
  divMid: string
}

const LIGHT: ChartTheme = {
  mode: 'light',
  surface: '#fcfcfb',
  text: '#0b0b0b',
  text2: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  // blue arm (decrease) light→dark, red arm (increase) light→dark
  divNeg: ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95'],
  divPos: ['#fbd5d2', '#f5aca7', '#ee837d', '#e34948', '#c0302f', '#962221'],
  divMid: '#f0efec',
}

const DARK: ChartTheme = {
  mode: 'dark',
  surface: '#1a1a19',
  text: '#ffffff',
  text2: '#c3c2b7',
  muted: '#898781',
  grid: '#2c2c2a',
  axis: '#383835',
  series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
  divNeg: ['#1f3450', '#1c4476', '#1c5cab', '#2a78d6', '#5598e7', '#86b6ef'],
  divPos: ['#4a2221', '#6e2a29', '#983230', '#c94140', '#e66767', '#f09a98'],
  divMid: '#383835',
}

function currentMode(): 'light' | 'dark' {
  const attr = document.documentElement.dataset.theme
  if (attr === 'light' || attr === 'dark') return attr
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useChartTheme(): ChartTheme {
  const [mode, setMode] = useState<'light' | 'dark'>(() => (typeof window === 'undefined' ? 'light' : currentMode()))
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setMode(currentMode())
    mq.addEventListener('change', update)
    const obs = new MutationObserver(update)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      mq.removeEventListener('change', update)
      obs.disconnect()
    }
  }, [])
  return mode === 'dark' ? DARK : LIGHT
}

export function seriesColor(theme: ChartTheme, index: number): string {
  // Fixed order, never cycled: groups past 8 fall back to muted ink and rely on labels.
  return index < theme.series.length ? theme.series[index] : theme.muted
}

/** Diverging colour for an effect size (Hedges g), clipped at ±3. */
export function divergingColor(theme: ChartTheme, g: number): string {
  if (!Number.isFinite(g)) return theme.divMid
  const a = Math.min(Math.abs(g), 3)
  if (a < 0.2) return theme.divMid
  const steps = [0.2, 0.5, 0.8, 1.2, 1.8, 2.5]
  let i = 0
  while (i < steps.length - 1 && a >= steps[i + 1]) i++
  return g < 0 ? theme.divNeg[i] : theme.divPos[i]
}

export function inkOn(hex: string): string {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return L > 0.35 ? '#0b0b0b' : '#ffffff'
}
