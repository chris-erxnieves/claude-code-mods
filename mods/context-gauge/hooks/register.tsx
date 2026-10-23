import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Segment } from '../types'
import {
  DEFAULT_THRESHOLD,
  ZONE_COLOR,
  barRuns,
  evaluateAlert,
  formatTokens,
  zoneOf,
} from './gauge'

const tokens = atom({ plugin: 'context-gauge', key: 'tokens' } as const, null)
const isExpanded = atom({ plugin: 'context-gauge', key: 'isExpanded' } as const, false)
const segments = atom({ plugin: 'context-gauge', key: 'segments' } as const, null)
const isAlertArmed = atom({ plugin: 'context-gauge', key: 'isAlertArmed' } as const, true)

async function refreshSegments($: EngineInterface) {
  const { context } = await $.session.usage({ breakdown: 'summary' })
  const rows: Segment[] = (context.breakdown?.categories ?? [])
    .filter(category => category.kind === 'used' && category.tokens > 0)
    .map(({ name, color, tokens }) => ({ name, color, tokens }))
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
    const { context } = await $.session.usage()
    await record($, { current: context.tokens ?? null, threshold })
    return result
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

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const current = await read($, tokens)
    const expanded = await read($, isExpanded)
    const rows = await read($, segments)
    const level = current ?? 0
    const count = (current === null ? '—' : formatTokens(current)).padStart(4)
    const nameWidth = Math.max(0, ...(rows ?? []).map(row => row.name.length))

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between">
          <Box flexDirection="row">
            <Text bold>Context</Text>
            <Text color={current === null ? undefined : ZONE_COLOR[zoneOf({ tokens: level, threshold })]}>
              {`  ${count} of ${formatTokens(threshold)}  `}
            </Text>
            {barRuns({ tokens: level, threshold, segments: rows }).map(run => (
              <Text color={run.color} backgroundColor={run.backgroundColor} mono>
                {run.text}
              </Text>
            ))}
          </Box>
          <Button
            key="toggle"
            plain
            label={expanded ? 'Hide' : 'Show'}
            onPress={() => update($, isExpanded, value => !value)}
          />
        </Box>
        {expanded && rows === null && <Text dimColor>  measuring…</Text>}
        {expanded &&
          rows?.map(row => (
            <Box flexDirection="row">
              <Text color={row.color}>  ■ </Text>
              <Text>{row.name.padEnd(nameWidth)}  </Text>
              <Text dimColor>~{formatTokens(row.tokens).padStart(6)}</Text>
            </Box>
          ))}
      </Box>
    )
  })
}
