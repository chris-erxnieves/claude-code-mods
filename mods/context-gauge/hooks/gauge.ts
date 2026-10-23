import type { ThemeKey } from 'claude-code'

import type { Segment } from '../types'

export const DEFAULT_THRESHOLD = 150_000
export const BAR_CELLS = 20
export const WARN_RATIO = 0.8

export type Zone = 'ok' | 'warn' | 'over'

export const ZONE_COLOR = {
  ok: 'success',
  warn: 'warning',
  over: 'error',
} as const satisfies Record<Zone, ThemeKey>

export const TRACK_COLOR: ThemeKey = 'inverseText'
export const PENDING_COLOR: ThemeKey = 'inactive'

export type Fill = { color: string; percent: number }

type Level = { tokens: number; threshold: number }

export const zoneOf = ({ tokens, threshold }: Level): Zone => {
  if (tokens > threshold) {
    return 'over'
  }

  return tokens >= threshold * WARN_RATIO ? 'warn' : 'ok'
}

export const barFills = ({
  tokens,
  threshold,
  segments,
}: Level & { segments: readonly Segment[] | null }): Fill[] => {
  const filled = Math.min(1, Math.max(0, tokens / threshold)) * 100
  const total = segments?.reduce((sum, segment) => sum + segment.tokens, 0) ?? 0
  const fills =
    segments?.length && total > 0
      ? segments.map(segment => ({ color: segment.color, percent: (segment.tokens / total) * filled }))
      : [{ color: PENDING_COLOR, percent: filled }]

  return [...fills, { color: TRACK_COLOR, percent: 100 - filled }].filter(fill => fill.percent > 0)
}

export const formatTokens = (tokens: number): string => {
  if (tokens < 1000) {
    return String(Math.round(tokens))
  }
  if (tokens < 100_000) {
    return `${(tokens / 1000).toFixed(1).replace(/\.0$/, '')}k`
  }
  return `${Math.round(tokens / 1000)}k`
}

export const evaluateAlert = ({
  tokens,
  threshold,
  isArmed,
}: Level & { isArmed: boolean }): { shouldToast: boolean; isArmed: boolean } => {
  if (isArmed && tokens > threshold) {
    return { shouldToast: true, isArmed: false }
  }
  if (!isArmed && tokens < threshold * WARN_RATIO) {
    return { shouldToast: false, isArmed: true }
  }
  return { shouldToast: false, isArmed }
}
