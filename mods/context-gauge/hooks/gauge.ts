import type { ThemeKey } from 'claude-code'

import type { Segment } from '../types'

export const DEFAULT_THRESHOLD = 150_000
export const BAR_CELLS = 20
export const EIGHTHS_PER_CELL = 8
export const BAR_EIGHTHS = BAR_CELLS * EIGHTHS_PER_CELL
export const WARN_RATIO = 0.8

export type Zone = 'ok' | 'warn' | 'over'

export const ZONE_COLOR = {
  ok: 'success',
  warn: 'warning',
  over: 'error',
} as const satisfies Record<Zone, ThemeKey>

export const TRACK_COLOR: ThemeKey = 'subtle'
export const PENDING_COLOR: ThemeKey = 'inactive'

const LEFT_EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'] as const

export type Run = { text: string; color?: string; backgroundColor?: string }

type Level = { tokens: number; threshold: number }

export const zoneOf = ({ tokens, threshold }: Level): Zone => {
  if (tokens > threshold) {
    return 'over'
  }

  return tokens >= threshold * WARN_RATIO ? 'warn' : 'ok'
}

export const filledEighths = ({ tokens, threshold }: Level): number =>
  Math.min(BAR_EIGHTHS, Math.round((tokens / threshold) * BAR_EIGHTHS))

export const allocateEighths = ({
  segments,
  eighths,
}: {
  segments: readonly Segment[]
  eighths: number
}): number[] => {
  const total = segments.reduce((sum, segment) => sum + segment.tokens, 0)

  if (total === 0 || eighths === 0) {
    return segments.map(() => 0)
  }

  const exact = segments.map(segment => (segment.tokens / total) * eighths)
  const counts = exact.map(Math.floor)
  let remaining = eighths - counts.reduce((sum, count) => sum + count, 0)
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder)

  for (const { index } of byRemainder) {
    if (remaining === 0) {
      break
    }
    counts[index] = (counts[index] ?? 0) + 1
    remaining -= 1
  }

  return counts
}

const mergeRuns = (cells: readonly Run[]): Run[] =>
  cells.reduce<Run[]>((runs, cell) => {
    const last = runs.at(-1)
    if (last && last.color === cell.color && last.backgroundColor === cell.backgroundColor) {
      runs[runs.length - 1] = { ...last, text: last.text + cell.text }
    } else {
      runs.push(cell)
    }
    return runs
  }, [])

const cellRun = (eighths: readonly string[]): Run => {
  const left = eighths[0] ?? TRACK_COLOR
  const leading = eighths.findIndex(color => color !== left)

  if (leading === -1) {
    return { text: ' ', backgroundColor: left }
  }

  return { text: LEFT_EIGHTHS[leading] ?? ' ', color: left, backgroundColor: eighths.at(-1) }
}

export const barRuns = ({
  tokens,
  threshold,
  segments,
}: Level & { segments: readonly Segment[] | null }): Run[] => {
  const filled = filledEighths({ tokens, threshold })
  const eighths: string[] = segments?.length
    ? allocateEighths({ segments, eighths: filled }).flatMap((count, index) =>
        Array<string>(count).fill(segments[index]?.color ?? PENDING_COLOR),
      )
    : Array<string>(filled).fill(PENDING_COLOR)

  while (eighths.length < BAR_EIGHTHS) {
    eighths.push(TRACK_COLOR)
  }

  return mergeRuns(
    Array.from({ length: BAR_CELLS }, (_, cell) =>
      cellRun(eighths.slice(cell * EIGHTHS_PER_CELL, (cell + 1) * EIGHTHS_PER_CELL)),
    ),
  )
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
