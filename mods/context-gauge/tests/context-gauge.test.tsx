import type { ContextCategory, SessionContextBreakdown, SessionUsage } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { bandView, formatTokens } from '../hooks/gauge'

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

const SEGMENTS = [
  { name: 'a', color: 'x', tokens: 3_000 },
  { name: 'b', color: 'y', tokens: 1_000 },
]

const view = (overrides: Partial<Parameters<typeof bandView>[0]> = {}) =>
  bandView({
    tokens: 75_000,
    threshold: 150_000,
    segments: null,
    isExpanded: false,
    surface: 'terminal',
    ...overrides,
  })

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

test('the count color turns at 80% and past the threshold', () => {
  expect(view({ tokens: 119_999 }).count.color).toBe('success')
  expect(view({ tokens: 120_000 }).count.color).toBe('warning')
  expect(view({ tokens: 150_000 }).count.color).toBe('warning')
  expect(view({ tokens: 150_001 }).count.color).toBe('error')
  expect(view({ tokens: null }).count.color).toBeUndefined()
})

test('the count reads a dash until a count is known', () => {
  expect(view({ tokens: null }).count.text).toBe('   — of 150k')
  expect(view({ tokens: 104_000 }).count.text).toBe('104k of 150k')
  expect(view({ tokens: 90_000, threshold: 100_000 }).count.text).toBe(' 90k of 100k')
})

test('the bar fills by segment share of the used fraction', () => {
  expect(view({ segments: SEGMENTS }).fills).toEqual([
    { color: 'x', grow: 37.5 },
    { color: 'y', grow: 12.5 },
    { grow: 50 },
  ])
  expect(view({ tokens: 0, segments: SEGMENTS }).fills).toEqual([{ grow: 100 }])
  expect(view({ tokens: null, segments: SEGMENTS }).fills).toEqual([{ grow: 100 }])
})

test('the fill is one neutral color before the breakdown arrives', () => {
  const half = [{ color: 'subtle', grow: 50 }, { grow: 50 }]
  expect(view({ segments: null }).fills).toEqual(half)
  expect(view({ segments: [] }).fills).toEqual(half)
})

test('past the threshold the bar is full with no track', () => {
  const full = [{ color: 'subtle', grow: 100 }]
  expect(view({ tokens: 150_000 }).fills).toEqual(full)
  expect(view({ tokens: 163_000 }).fills).toEqual(full)
  expect(view({ tokens: 900_000 }).fills).toEqual(full)
})

test('the bar is a full row in the terminal and 85% on desktop', () => {
  expect(view({ surface: 'terminal' }).barHeight).toBe(1)
  expect(view({ surface: 'desktop' }).barHeight).toBe('85%')
})

test('details are hidden, measuring, or the formatted segments', () => {
  expect(view({ segments: SEGMENTS })).toMatchObject({ details: { state: 'hidden' }, toggleLabel: 'Show' })
  expect(view({ isExpanded: true })).toMatchObject({ details: { state: 'measuring' }, toggleLabel: 'Hide' })
  expect(view({ isExpanded: true, segments: SEGMENTS }).details).toEqual({
    state: 'shown',
    rows: [
      { name: 'a', color: 'x', tokens: '3k' },
      { name: 'b', color: 'y', tokens: '1k' },
    ],
  })
})

test('token counts read as whole numbers', () => {
  expect(formatTokens(950)).toBe('950')
  expect(formatTokens(3_100)).toBe('3k')
  expect(formatTokens(88_500)).toBe('89k')
  expect(formatTokens(4_000)).toBe('4k')
  expect(formatTokens(150_000)).toBe('150k')
})

test('the band shows a dash before the first response, then the count', async ($, on) => {
  const state: { tokens?: number; toasts: string[] } = { toasts: [] }
  engine(on, state)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  let ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /of 150k/ }))?.text).toContain('— of 150k')
  await ui.unmount()

  state.tokens = 104_000
  await $.session.measure({ context: usage({ tokens: 104_000, withBreakdown: false }).context, rateLimits: [], changed: ['context'] })

  ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /of 150k/ }))?.text).toContain('104k of 150k')
  await ui.unmount()
})

test('the bar keeps its layout on each surface', async ($, on) => {
  const state: { tokens?: number; toasts: string[] } = { tokens: 104_000, toasts: [] }
  engine(on, state)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const boxes = await ui.findAll({ type: 'Box' })
    const bar = boxes.find(found => found.props.minWidth !== undefined)
    expect(bar?.props.minWidth).toBe(20)
    expect(bar?.props.flexGrow).toBe(1)
    const fills = boxes.filter(found => found.props.height !== undefined && found.props.minWidth === undefined)
    expect(fills.map(found => found.props.backgroundColor)).toEqual(['permission', 'promptBorder', undefined])
    expect(fills.every(found => found.props.height === (surface === 'desktop' ? '85%' : 1))).toBe(true)
    await ui.unmount()
  }
})

test('details toggle the used categories, largest first', async ($, on) => {
  const state: { tokens?: number; toasts: string[] } = { tokens: 124_000, toasts: [] }
  engine(on, state)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    await ui.press({ key: 'toggle' })

    expect((await ui.find({ key: 'toggle' }))?.props.label).toBe('Hide')
    const texts = (await ui.findAll({ type: 'Text' })).map(found => found.text)
    expect(texts.indexOf('Messages')).toBeGreaterThan(-1)
    expect(texts.indexOf('Messages')).toBeLessThan(texts.indexOf('System prompt'))
    expect(texts).toContain('88k')
    expect(texts).toContain('3k')
    expect(texts.some(text => /~|Free space|Autocompact|deferred/.test(text))).toBe(false)
    const details = (await ui.findAll({ type: 'Box' })).find(found => found.props.flexWrap === 'wrap')
    expect(details?.props.marginTop).toBe(1)

    await ui.press({ key: 'toggle' })
    expect((await ui.find({ key: 'toggle' }))?.props.label).toBe('Show')
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
  const count = await ui.find({ type: 'Text', text: /of 100k/ })
  expect(count?.text).toContain(' 90k of 100k')
  expect(count?.props.color).toBe('warning')
  await ui.unmount()
})
