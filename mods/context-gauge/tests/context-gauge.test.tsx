import type { ContextCategory, SessionContextBreakdown, SessionUsage } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { bandView, formatTokens } from '../hooks/gauge'

const BAND = {
  plugin: 'context-gauge',
  component: 'AbovePrompt',
  surface: 'terminal',
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

// 69 columns less "Context", "   75k of 150k  ", the gap and "Show" leaves 40 bar cells.
const FORTY_CELLS = 69

const view = (overrides: Partial<Parameters<typeof bandView>[0]> = {}) =>
  bandView({
    tokens: 75_000,
    threshold: 150_000,
    segments: null,
    isExpanded: false,
    columns: FORTY_CELLS,
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
  on('command.register', () => ({ value: { command: 'context-gauge' } }))
  on('ui.toast', (_, e) => {
    state.toasts.push(e.text)
    return { value: undefined }
  })
}

const cellsOf = (bar: ReturnType<typeof view>['bar']) =>
  bar.runs.reduce((sum, run) => sum + run.cells, 0) + bar.trackCells

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

test('the bar takes the columns the label, count and toggle leave', () => {
  expect(cellsOf(view().bar)).toBe(40)
  expect(cellsOf(view({ columns: 120 }).bar)).toBe(91)
  expect(cellsOf(view({ isExpanded: true }).bar)).toBe(40)
  expect(cellsOf(view({ columns: 30 }).bar)).toBe(10)
})

test('the bar fills whole cells by segment share of the used fraction', () => {
  expect(view({ segments: SEGMENTS }).bar).toEqual({
    runs: [
      { color: 'x', cells: 15 },
      { color: 'y', cells: 5 },
    ],
    trackCells: 20,
  })
  expect(view({ tokens: 0, segments: SEGMENTS }).bar).toEqual({ runs: [], trackCells: 40 })
  expect(view({ tokens: null, segments: SEGMENTS }).bar).toEqual({ runs: [], trackCells: 40 })
})

test('rounded runs add up to the filled cells exactly', () => {
  const thirds = [
    { name: 'a', color: 'x', tokens: 1 },
    { name: 'b', color: 'y', tokens: 1 },
    { name: 'c', color: 'z', tokens: 1 },
  ]
  for (const tokens of [10_000, 37_500, 75_000, 112_345, 149_999]) {
    const { bar } = view({ tokens, segments: thirds })
    expect(cellsOf(bar)).toBe(40)
    expect(bar.trackCells).toBe(40 - Math.round((tokens / 150_000) * 40))
  }
})

test('any usage shows at least one cell', () => {
  expect(view({ tokens: 100 }).bar).toEqual({ runs: [{ color: 'subtle', cells: 1 }], trackCells: 39 })
})

test('the fill is one neutral color before the breakdown arrives', () => {
  const half = { runs: [{ color: 'subtle', cells: 20 }], trackCells: 20 }
  expect(view({ segments: null }).bar).toEqual(half)
  expect(view({ segments: [] }).bar).toEqual(half)
})

test('past the threshold the bar is full with no track', () => {
  const full = { runs: [{ color: 'subtle', cells: 40 }], trackCells: 0 }
  expect(view({ tokens: 150_000 }).bar).toEqual(full)
  expect(view({ tokens: 163_000 }).bar).toEqual(full)
  expect(view({ tokens: 900_000 }).bar).toEqual(full)
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

  let ui = await $.ui.mount(BAND)
  expect((await ui.find({ type: 'Text', text: /of 150k/ }))?.text).toContain('— of 150k')
  await ui.unmount()

  state.tokens = 104_000
  await $.session.measure({ context: usage({ tokens: 104_000, withBreakdown: false }).context, rateLimits: [], changed: ['context'] })

  ui = await $.ui.mount(BAND)
  expect((await ui.find({ type: 'Text', text: /of 150k/ }))?.text).toContain('104k of 150k')
  await ui.unmount()
})

test('the bar is drawn in category colors and fills the row to the toggle', async ($, on) => {
  const state: { tokens?: number; toasts: string[] } = { tokens: 104_000, toasts: [] }
  engine(on, state)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount(BAND)
  const glyphs = await ui.findAll({ type: 'Text', text: /^[█░]+$/ })
  const bar = glyphs.find(found => found.props.wrap !== undefined)
  expect(bar?.text.length).toBe(80 - 'Context'.length - '  104k of 150k  '.length - 2 - 'Show'.length)
  const runs = glyphs
    .filter(found => found !== bar)
    .map(found => ({ color: found.props.color, isDim: found.props.dimColor === true, glyph: found.text[0] }))
  expect(runs).toEqual([
    { color: 'permission', isDim: false, glyph: '█' },
    { color: 'promptBorder', isDim: false, glyph: '█' },
    { color: undefined, isDim: true, glyph: '░' },
  ])
  await ui.unmount()
})

test('details toggle the used categories, largest first', async ($, on) => {
  const state: { tokens?: number; toasts: string[] } = { tokens: 124_000, toasts: [] }
  engine(on, state)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount(BAND)
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
})

test('/context-gauge toggles the details from the prompt', async ($, on) => {
  const toggle = () =>
    $.command.run({
      command: 'context-gauge',
      args: '',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: false, columns: 80 },
    })
  const state: { tokens?: number; toasts: string[] } = { tokens: 124_000, toasts: [] }
  engine(on, state)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  expect(await toggle()).toMatchObject({ text: 'Context details shown.' })
  let ui = await $.ui.mount(BAND)
  expect((await ui.find({ key: 'toggle' }))?.props.label).toBe('Hide')
  expect(await ui.find({ type: 'Text', text: 'Messages' })).toBeDefined()
  await ui.unmount()

  expect(await toggle()).toMatchObject({ text: 'Context details hidden.' })
  ui = await $.ui.mount(BAND)
  expect((await ui.find({ key: 'toggle' }))?.props.label).toBe('Show')
  await ui.unmount()
})

test('the band is drawn in the terminal only', async ($, on) => {
  const state: { tokens?: number; toasts: string[] } = { tokens: 104_000, toasts: [] }
  engine(on, state)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /of 150k/ })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: 'engine' }))?.text).toBe('engine')
  await ui.unmount()
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

  const ui = await $.ui.mount(BAND)
  const count = await ui.find({ type: 'Text', text: /of 100k/ })
  expect(count?.text).toContain(' 90k of 100k')
  expect(count?.props.color).toBe('warning')
  await ui.unmount()
})
