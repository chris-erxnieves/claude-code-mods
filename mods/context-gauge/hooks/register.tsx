import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Segment } from '../types'
import {
  DEFAULT_THRESHOLD,
  LABEL,
  TOGGLE_GAP,
  bandView,
  countCell,
  evaluateAlert,
  formatTokens,
} from './gauge'

const FILL_GLYPH = '█'
const TRACK_GLYPH = '░'

const tokens = atom({ plugin: 'context-gauge', key: 'tokens' } as const, null)
const isExpanded = atom({ plugin: 'context-gauge', key: 'isExpanded' } as const, false)
const segments = atom({ plugin: 'context-gauge', key: 'segments' } as const, null)
const isAlertArmed = atom({ plugin: 'context-gauge', key: 'isAlertArmed' } as const, true)

async function refreshSegments($: EngineInterface) {
  const { context } = await $.session.usage({ breakdown: 'summary' })
  const rows: Segment[] = (context.breakdown?.categories ?? [])
    .filter(category => category.kind === 'used' && category.tokens > 0)
    .map(({ name, color, tokens }) => ({ name, color, tokens }))
    .sort((a, b) => b.tokens - a.tokens)
  await update($, segments, () => rows)
}

async function record(
  $: EngineInterface,
  { current, threshold }: { current: number | null; threshold: number },
) {
  await update($, tokens, () => current)

  if (current !== null) {
    const alert = evaluateAlert({
      tokens: current,
      threshold,
      isArmed: await read($, isAlertArmed),
    })
    await update($, isAlertArmed, () => alert.isArmed)
    if (alert.shouldToast) {
      $.ui.toast(
        `Context past ${formatTokens(threshold)} (${formatTokens(current)}). /compact at the next phase boundary.`,
      )
    }
  }

  await refreshSegments($)
}

export const register: Register = (on, options) => {
  const threshold =
    typeof options.threshold === 'number' && options.threshold > 0
      ? options.threshold
      : DEFAULT_THRESHOLD

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({
      name: 'context-gauge',
      description: 'Show or hide the per-category context details under the gauge',
      immediate: true,
    })
    const { context } = await $.session.usage()
    await record($, { current: context.tokens ?? null, threshold })
    return result
  })

  on('command.run', { command: 'context-gauge' }, async $ => {
    await update($, isExpanded, value => !value)
    return { text: (await read($, isExpanded)) ? 'Context details shown.' : 'Context details hidden.' }
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context')) {
      await record($, { current: e.context.tokens ?? null, threshold })
    }
    return next(e)
  })

  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && e.trigger !== 'precompute' && result.messages) {
      await record($, { current: null, threshold })
    }
    return result
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, isAlertArmed, () => true)
      await record($, { current: null, threshold })
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt', surface: 'terminal' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const view = bandView({
      tokens: await read($, tokens),
      threshold,
      segments: await read($, segments),
      isExpanded: await read($, isExpanded),
      columns: e.props.bodyColumns,
    })

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between">
          <Box flexDirection="row" flexShrink={1} marginRight={TOGGLE_GAP}>
            <Text bold>{LABEL}</Text>
            <Text color={view.count.color}>{countCell(view.count.text)}</Text>
            <Text wrap="truncate-end">
              {view.bar.runs.map(run => (
                <Text color={run.color}>{FILL_GLYPH.repeat(run.cells)}</Text>
              ))}
              <Text dimColor>{TRACK_GLYPH.repeat(view.bar.trackCells)}</Text>
            </Text>
          </Box>
          <Button
            key="toggle"
            plain
            label={view.toggleLabel}
            onPress={() => update($, isExpanded, value => !value)}
          />
        </Box>
        {view.details.state === 'measuring' && <Box marginTop={1}><Text dimColor>measuring…</Text></Box>}
        {view.details.state === 'shown' && (
          <Box flexDirection="row" flexWrap="wrap" columnGap={2} marginTop={1}>
            {view.details.rows.map(row => (
              <Box flexDirection="row" flexShrink={0} gap={1}>
                <Text color={row.color}>■</Text>
                <Text>{row.name}</Text>
                <Text dimColor>{row.tokens}</Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    )
  })
}
