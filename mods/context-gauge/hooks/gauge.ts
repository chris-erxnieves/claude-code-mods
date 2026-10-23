import type { ThemeKey } from 'claude-code'

import type { Segment } from '../types'

export const DEFAULT_THRESHOLD = 150_000
export const BAR_CELLS = 20
export const MAX_OVERFLOW_CELLS = 10
export const WARN_RATIO = 0.8

export type Zone = 'ok' | 'warn' | 'over'

export const ZONE_COLOR = {
  ok: 'success',
  warn: 'warning',
  over: 'error',
} as const satisfies Record<Zone, ThemeKey>

export type Run = { text: string; color?: string; isDim?: boolean }

type Level = { tokens: number; threshold: number }

export const zoneOf = ({ tokens, threshold }: Level): Zone => {
  if (tokens > threshold) {
    return 'over'
  }

  return tokens >= threshold * WARN_RATIO ? 'warn' : 'ok'
}

export const filledCells = ({ tokens, threshold }: Level): number =>
  Math.min(BAR_CELLS + MAX_OVERFLOW_CELLS, Math.round((tokens / threshold) * BAR_CELLS))

export const allocateCells = ({
  segments,
  cells,
}: {
  segments: readonly Segment[]
  cells: number
}): number[] => {
  const total = segments.reduce((sum, segment) => sum + segment.tokens, 0)

  if (total === 0 || cells === 0) {
    return segments.map(() => 0)
  }

  const exact = segments.map(segment => (segment.tokens / total) * cells)
  const counts = exact.map(Math.floor)
  let remaining = cells - counts.reduce((sum, count) => sum + count, 0)
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

const glyphAt = (cell: number) => (cell < BAR_CELLS ? '█' : '▌')

const mergeRuns = (cells: readonly Run[]): Run[] =>
  cells.reduce<Run[]>((runs, cell) => {
    const last = runs.at(-1)
    if (last && last.color === cell.color && last.isDim === cell.isDim) {
      runs[runs.length - 1] = { ...last, text: last.text + cell.text }
    } else {
      runs.push(cell)
    }
    return runs
  }, [])

export const barRuns = ({
  tokens,
  threshold,
  segments,
}: Level & { segments: readonly Segment[] | null }): Run[] => {
  const filled = filledCells({ tokens, threshold })
  const colors = segments?.length
    ? allocateCells({ segments, cells: filled }).flatMap((count, index) =>
        Array<string>(count).fill(segments[index]?.color ?? ''),
      )
    : Array<string>(filled).fill(ZONE_COLOR[zoneOf({ tokens, threshold })])
  const cells: Run[] = colors.map((color, cell) => ({ text: glyphAt(cell), color }))

  for (let cell = filled; cell < BAR_CELLS; cell += 1) {
    cells.push({ text: '░', isDim: true })
  }

  return mergeRuns(cells)
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
