import type { ContextCategory, SessionContextBreakdown, SessionUsage } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { allocateCells, barRuns, formatTokens, zoneOf } from '../hooks/gauge'

const SURFACES = ['terminal', 'desktop'] as const

const BAND = {
  plugin: 'context-gauge',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const CATEGORIES: ContextCategory[] = [
  { name: 'System prompt', tokens: 3_100, color: 'promptBorder', isDeferred: false, kind: 'used' },
  { name: 'Messages', tokens: 88_200, color: 'permission', isDeferred: false, kind: 'used' },
  { name: 'MCP tools (deferred)', tokens: 40_000, color: 'inactive', isDeferred: true, kind: 'deferred' },
  { name: 'Free space', tokens: 800_000, color: 'inactive', isDeferred: false, kind: 'free' },
  { name: 'Autocompact buffer', tokens: 33_000, color: 'inactive', isDeferred: false, kind: 'buffer' },
]

const usage = ({ tokens, withBreakdown }: { tokens?: number; withBreakdown: boolean }): SessionUsage => ({
  startedAt: 0,
  rateLimits: [],
  context: {
    tokens,
    window: 1_000_000,
    percent: tokens === undefined ? undefined : Math.round(tokens / 10_000),
    breakdown: withBreakdown
      ? ({ categories: CATEGORIES } as Partial<SessionContextBreakdown> as SessionContextBreakdown)
      : undefined,
  },
})

type On = Parameters<TestBody>[1]

const engine = (on: On, state: { tokens?: number; toasts: string[] }) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('session.usage', (_, e) => ({
    value: usage({ tokens: state.tokens, withBreakdown: e?.breakdown !== undefined }),
  }))
  on('ui.toast', (_, e) => {
    state.toasts.push(e.text)
    return { value: undefined }
  })
}

test('zone boundaries sit at 80% and past the threshold', () => {
  const threshold = 150_000
  expect(zoneOf({ tokens: 119_999, threshold })).toBe('ok')
  expect(zoneOf({ tokens: 120_000, threshold })).toBe('warn')
  expect(zoneOf({ tokens: 150_000, threshold })).toBe('warn')
  expect(zoneOf({ tokens: 150_001, threshold })).toBe('over')
})

test('cells go by largest remainder and a sliver gets none', () => {
  const segments = [
    { name: 'a', color: 'x', tokens: 88_000 },
    { name: 'b', color: 'y', tokens: 17_000 },
    { name: 'c', color: 'z', tokens: 3_000 },
  ]
  const counts = allocateCells({ segments, cells: 14 })
  expect(counts.reduce((sum, n) => sum + n, 0)).toBe(14)
  expect(counts).toEqual([12, 2, 0])
  expect(allocateCells({ segments, cells: 3 })).toEqual([2, 1, 0])
})

test('the bar overflows past the threshold, capped', () => {
  const runs = barRuns({ tokens: 163_000, threshold: 150_000, segments: null })
  expect(runs.map(run => run.text).join('')).toBe('█'.repeat(20) + '▌'.repeat(2))
  const capped = barRuns({ tokens: 900_000, threshold: 150_000, segments: null })
  expect(capped.map(run => run.text).join('').length).toBe(30)
})

test('token counts read short', () => {
  expect(formatTokens(950)).toBe('950')
  expect(formatTokens(88_200)).toBe('88.2k')
  expect(formatTokens(4_000)).toBe('4k')
  expect(formatTokens(150_000)).toBe('150k')
})

test('the band shows a dash before the first response, then the count', async ($, on) => {
  const state: { tokens?: number; toasts: string[] } = { toasts: [] }
  engine(on, state)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /\/ 150k/ }))?.text).toContain('— / 150k')
    await ui.unmount()
  }

  state.tokens = 104_000
  await $.session.measure({ context: usage({ tokens: 104_000, withBreakdown: false }).context, rateLimits: [], changed: ['context'] })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const count = await ui.find({ type: 'Text', text: /\/ 150k/ })
    expect(count?.text).toContain('104k / 150k')
    expect(count?.props.color).toBe('success')
    expect(await ui.find({ type: 'Text', text: /■/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('details toggle a legend of used categories only', async ($, on) => {
  const state: { tokens?: number; toasts: string[] } = { tokens: 124_000, toasts: [] }
  engine(on, state)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    await ui.press({ key: 'toggle' })

    expect((await ui.find({ key: 'toggle' }))?.props.label).toBe('▾ details')
    expect((await ui.find({ type: 'Text', text: /\/ 150k/ }))?.props.color).toBe('warning')
    const names = (await ui.findAll({ type: 'Text' })).map(found => found.text)
    expect(names.some(text => text.startsWith('System prompt'))).toBe(true)
    expect(names.some(text => text.startsWith('Messages'))).toBe(true)
    expect(names.some(text => /Free space|Autocompact|deferred/.test(text))).toBe(false)

    await ui.press({ key: 'toggle' })
    expect((await ui.find({ key: 'toggle' }))?.props.label).toBe('▸ details')
    expect(await ui.find({ type: 'Text', text: /■/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('the toast fires once past the threshold and re-arms below 80%', async ($, on) => {
  const state: { tokens?: number; toasts: string[] } = { toasts: [] }
  engine(on, state)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const measure = (tokens: number) => {
    state.tokens = tokens
    return $.session.measure({ context: usage({ tokens, withBreakdown: false }).context, rateLimits: [], changed: ['context'] })
  }

  await measure(140_000)
  expect(state.toasts).toHaveLength(0)
  await measure(151_000)
  expect(state.toasts).toHaveLength(1)
  await measure(170_000)
  await measure(125_000)
  await measure(160_000)
  expect(state.toasts).toHaveLength(1)
  await measure(60_000)
  await measure(155_000)
  expect(state.toasts).toHaveLength(2)
})

test('the threshold comes from the settings', { options: { threshold: 100_000 } }, async ($, on) => {
  const state: { tokens?: number; toasts: string[] } = { tokens: 90_000, toasts: [] }
  engine(on, state)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const count = await ui.find({ type: 'Text', text: /\/ 100k/ })
  expect(count?.text).toContain('90k / 100k')
  expect(count?.props.color).toBe('warning')
  await ui.unmount()
})
