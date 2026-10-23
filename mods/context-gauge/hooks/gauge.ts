import type { ThemeKey } from 'claude-code'

import type { Segment } from '../types'

export const DEFAULT_THRESHOLD = 150_000
const DESKTOP_BAR_HEIGHT = '85%'
const WARN_RATIO = 0.8

type Zone = 'ok' | 'warn' | 'over'

const ZONE_COLOR = {
  ok: 'success',
  warn: 'warning',
  over: 'error',
} as const satisfies Record<Zone, ThemeKey>

const PENDING_COLOR: ThemeKey = 'subtle'

export type Fill = { color?: string; grow: number }

export type DetailsRow = { name: string; color: string; tokens: string }

export type Details =
  | { state: 'hidden' }
  | { state: 'measuring' }
  | { state: 'shown'; rows: DetailsRow[] }

export type BandView = {
  count: { text: string; color?: ThemeKey }
  fills: Fill[]
  barHeight: number | string
  details: Details
  toggleLabel: 'Show' | 'Hide'
}

type Level = { tokens: number; threshold: number }

const zoneOf = ({ tokens, threshold }: Level): Zone => {
  if (tokens > threshold) {
    return 'over'
  }

  return tokens >= threshold * WARN_RATIO ? 'warn' : 'ok'
}

const barFills = ({
  tokens,
  threshold,
  segments,
}: Level & { segments: readonly Segment[] | null }): Fill[] => {
  const filled = Math.min(1, Math.max(0, tokens / threshold)) * 100
  const total = segments?.reduce((sum, segment) => sum + segment.tokens, 0) ?? 0
  const fills: Fill[] =
    segments?.length && total > 0
      ? segments.map(segment => ({ color: segment.color, grow: (segment.tokens / total) * filled }))
      : [{ color: PENDING_COLOR, grow: filled }]

  return [...fills, { grow: 100 - filled }].filter(fill => fill.grow > 0)
}

const detailsOf = ({
  segments,
  isExpanded,
}: {
  segments: readonly Segment[] | null
  isExpanded: boolean
}): Details => {
  if (!isExpanded) {
    return { state: 'hidden' }
  }
  if (segments === null) {
    return { state: 'measuring' }
  }
  return {
    state: 'shown',
    rows: segments.map(({ name, color, tokens }) => ({ name, color, tokens: formatTokens(tokens) })),
  }
}

export const formatTokens = (tokens: number): string => {
  if (tokens < 1000) {
    return String(Math.round(tokens))
  }
  return `${Math.round(tokens / 1000)}k`
}

export const bandView = ({
  tokens,
  threshold,
  segments,
  isExpanded,
  surface,
}: {
  tokens: number | null
  threshold: number
  segments: readonly Segment[] | null
  isExpanded: boolean
  surface: string
}): BandView => {
  const count = (tokens === null ? '—' : formatTokens(tokens)).padStart(4)

  return {
    count: {
      text: `${count} of ${formatTokens(threshold)}`,
      color: tokens === null ? undefined : ZONE_COLOR[zoneOf({ tokens, threshold })],
    },
    fills: barFills({ tokens: tokens ?? 0, threshold, segments }),
    barHeight: surface === 'desktop' ? DESKTOP_BAR_HEIGHT : 1,
    details: detailsOf({ segments, isExpanded }),
    toggleLabel: isExpanded ? 'Hide' : 'Show',
  }
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
