/*
 * Praha Demo — color tokens & formatters
 * TO REBRAND: Change COLORS here AND --color-* in globals.css
 */
export const COLORS = {
  brandPrimary:   '#D62828',  // Prague red
  brandSecondary: '#003049',  // dark navy
  brandAccent:    '#2DC653',  // cycling green
  surface:        '#f8fafc',
  border:         '#e2e8f0',
  positive:       '#2DC653',
  negative:       '#ef4444',
  warning:        '#f59e0b',
  bgWhite:        '#ffffff',
  chart: ['#D62828', '#2DC653', '#f59e0b', '#003049', '#8b5cf6', '#06b6d4'],
} as const

export function formatCount(value: number): string {
  return new Intl.NumberFormat('cs-CZ').format(Math.round(value))
}

export function formatSpeed(value: number): string {
  return `${value.toFixed(1)} km/h`
}

export function formatDelta(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

export function formatCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${(value / 1_000).toFixed(0)}k`
  return `${Math.round(value)}`
}
