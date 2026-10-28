import type { ThemeKey } from 'claude-code'

import type { Segment } from '../types'

export const DEFAULT_THRESHOLD = 150_000
export const MIN_BAR_CELLS = 10
export const TOGGLE_GAP = 2
const WARN_RATIO = 0.8

type Zone = 'ok' | 'warn' | 'over'

const ZONE_COLOR = {
  ok: 'success',
  warn: 'warning',
  over: 'error',
} as const satisfies Record<Zone, ThemeKey>

const PENDING_COLOR: ThemeKey = 'subtle'

export type Run = { color: string; cells: number }

export type Bar = { runs: Run[]; trackCells: number }

export type DetailsRow = { name: string; color: string; tokens: string }

export type Details =
  | { state: 'hidden' }
  | { state: 'measuring' }
  | { state: 'shown'; rows: DetailsRow[] }

export type BandView = {
  count: { text: string; color?: ThemeKey }
  bar: Bar
  details: Details
  toggleLabel: 'Show' | 'Hide'
}

type Level = { tokens: number; threshold: number }

export const LABEL = 'Context'

const zoneOf = ({ tokens, threshold }: Level): Zone => {
  if (tokens > threshold) {
    return 'over'
  }

  return tokens >= threshold * WARN_RATIO ? 'warn' : 'ok'
}

const filledCells = ({ tokens, threshold, cells }: Level & { cells: number }): number => {
  if (tokens <= 0) {
    return 0
  }
  return Math.max(1, Math.round(Math.min(1, tokens / threshold) * cells))
}

// Largest remainder, so the runs add up to exactly `cells` and the bar never
// drifts a cell short or long as shares change.
const apportion = ({ segments, cells }: { segments: readonly Segment[]; cells: number }): Run[] => {
  const total = segments.reduce((sum, segment) => sum + segment.tokens, 0)
  const shares = segments.map((segment, index) => {
    const exact = (segment.tokens / total) * cells
    return { index, color: segment.color, whole: Math.floor(exact), remainder: exact % 1 }
  })
  const left = cells - shares.reduce((sum, share) => sum + share.whole, 0)
  const roundedUp = new Set(
    [...shares]
      .sort((a, b) => b.remainder - a.remainder)
      .slice(0, left)
      .map(share => share.index),
  )
  return shares.map(share => ({
    color: share.color,
    cells: share.whole + (roundedUp.has(share.index) ? 1 : 0),
  }))
}

const barOf = ({
  tokens,
  threshold,
  segments,
  cells,
}: Level & { segments: readonly Segment[] | null; cells: number }): Bar => {
  const filled = filledCells({ tokens, threshold, cells })
  const total = segments?.reduce((sum, segment) => sum + segment.tokens, 0) ?? 0
  const runs =
    segments?.length && total > 0
      ? apportion({ segments, cells: filled })
      : [{ color: PENDING_COLOR, cells: filled }]

  return { runs: runs.filter(run => run.cells > 0), trackCells: cells - filled }
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

export const countCell = (text: string) => `  ${text}  `

export const bandView = ({
  tokens,
  threshold,
  segments,
  isExpanded,
  columns,
}: {
  tokens: number | null
  threshold: number
  segments: readonly Segment[] | null
  isExpanded: boolean
  columns: number
}): BandView => {
  const countText = `${(tokens === null ? '—' : formatTokens(tokens)).padStart(4)} of ${formatTokens(threshold)}`
  const toggleLabel = isExpanded ? 'Hide' : 'Show'
  const fixed = LABEL.length + countCell(countText).length + TOGGLE_GAP + toggleLabel.length

  return {
    count: {
      text: countText,
      color: tokens === null ? undefined : ZONE_COLOR[zoneOf({ tokens, threshold })],
    },
    bar: barOf({
      tokens: tokens ?? 0,
      threshold,
      segments,
      cells: Math.max(MIN_BAR_CELLS, columns - fixed),
    }),
    details: detailsOf({ segments, isExpanded }),
    toggleLabel,
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
