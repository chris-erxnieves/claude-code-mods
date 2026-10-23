import type { ThemeKey } from 'claude-code'

import type { Segment } from '../types'

export const DEFAULT_THRESHOLD = 150_000
export const BAR_CELLS = 20
export const HATCH_CELLS = 512
export const WARN_RATIO = 0.8

export type Zone = 'ok' | 'warn' | 'over'

export const ZONE_COLOR = {
  ok: 'success',
  warn: 'warning',
  over: 'error',
} as const satisfies Record<Zone, ThemeKey>

export const TRACK_COLOR: ThemeKey = 'inverseText'
export const HATCH_COLOR: ThemeKey = 'subtle'
export const HATCH_GLYPH = '╲'
export const PENDING_COLOR: ThemeKey = 'inactive'

export type Fill = { color: string; percent: number; isTrack: boolean }

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
      ? segments.map(segment => ({
          color: segment.color,
          percent: (segment.tokens / total) * filled,
          isTrack: false,
        }))
      : [{ color: PENDING_COLOR, percent: filled, isTrack: false }]

  return [...fills, { color: TRACK_COLOR, percent: 100 - filled, isTrack: true }].filter(
    fill => fill.percent > 0,
  )
}

export const formatTokens = (tokens: number): string => {
  if (tokens < 1000) {
    return String(Math.round(tokens))
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
